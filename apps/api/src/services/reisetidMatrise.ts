/**
 * Reisetid-matrise — recompute-motor (R3).
 *
 * Fyller `ReisetidMatrise` med faktisk kjøretid per [kontor × byggeplass] via
 * OSRM `/table` (rute-service). Per tur (R4) blir oppslaget da rent.
 *
 * Firma-isolasjon (HARD): en rad pares KUN når byggeplassens
 * `project.primaryOrganizationId` === kontorets `organizationId`. Byggeplass har
 * ingen `organizationId` — org-aksen går via prosjektet. Vakten er intrinsisk i
 * spørringene: kontorer filtreres på `organizationId`, byggeplasser på
 * `project.primaryOrganizationId` — en rad kan derfor aldri pare ulik org.
 *
 * Non-blocking: triggere bruker `recomputeMatriseIBakgrunn` /
 * `recomputeRadForByggeplass` (fire-and-forget, selvstendig catch) → en lagring
 * av kontor/georef venter aldri på OSRM og feiler aldri pga matrisen. Den
 * eksplisitte «beregn matrise»-knappen `await`-er `recomputeMatrise`.
 *
 * kilde v1 = kun "osrm". Uoppnåelige par lagres med kjoretidMin = -1
 * (computed-men-uoppnåelig; R4 skiller fra fravær = live-fallback).
 */

import { prisma } from "@sitedoc/db";
import { hentKjoretidMatrise, type Coord } from "./rute-service";

// Margin under OSRM /table sitt ~100-koordinat-tak (kontorer + chunk ≤ dette).
const OSRM_MAX_KOORDINATER = 90;

interface RecomputeArgs {
  organizationId: string;
  oppmotestedId?: string;
  byggeplassId?: string;
}

/**
 * Beregn og upsert matrise-rader for et firma.
 * - `oppmotestedId` satt → kolonne (det kontoret × alle firmaets byggeplasser).
 * - `byggeplassId` satt → rad (alle firmaets kontorer × den byggeplassen).
 * - ingen → full firma-backfill.
 */
export async function recomputeMatrise(
  args: RecomputeArgs,
): Promise<{ rader: number }> {
  const { organizationId, oppmotestedId, byggeplassId } = args;

  // 1. Kontorer (sources). lat/lng er påkrevde felt på Oppmotested.
  const kontorer = await prisma.oppmotested.findMany({
    where: oppmotestedId
      ? { id: oppmotestedId, organizationId }
      : { organizationId },
    select: { id: true, lat: true, lng: true },
  });
  if (kontorer.length === 0) return { rader: 0 };

  // 2. Byggeplasser (destinations). Firma-isolasjon via project.primaryOrganizationId.
  const byggeplasserRaw = await prisma.byggeplass.findMany({
    where: byggeplassId
      ? { id: byggeplassId, project: { primaryOrganizationId: organizationId } }
      : { project: { primaryOrganizationId: organizationId } },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      project: { select: { latitude: true, longitude: true } },
    },
  });

  // Resolv koordinat: byggeplass egen → prosjekt-fallback → ingen.
  const byggeplasser = byggeplasserRaw.map((b) => {
    const lat = b.latitude ?? b.project?.latitude ?? null;
    const lng = b.longitude ?? b.project?.longitude ?? null;
    const coord: Coord | null =
      lat != null && lng != null ? { lat, lng } : null;
    return { id: b.id, coord };
  });

  // Stale-rydding: byggeplasser som mangler koordinat → slett ev. eksisterende
  // rader (utdatert cache ville servere R4 feil tid for en posisjonsløs byggeplass).
  const utenKoord = byggeplasser.filter((b) => b.coord == null).map((b) => b.id);
  if (utenKoord.length > 0) {
    await prisma.reisetidMatrise.deleteMany({
      where: { organizationId, byggeplassId: { in: utenKoord } },
    });
  }

  const medKoord = byggeplasser.filter(
    (b): b is { id: string; coord: Coord } => b.coord != null,
  );
  if (medKoord.length === 0) return { rader: 0 };

  // 3. OSRM /table — batch destinasjonene slik at kontorer + chunk ≤ taket.
  const kontorKoord: Coord[] = kontorer.map((k) => ({ lat: k.lat, lng: k.lng }));
  const chunkStorrelse = Math.max(1, OSRM_MAX_KOORDINATER - kontorer.length);
  if (medKoord.length > chunkStorrelse) {
    console.log(
      `[reisetid-matrise] batcher ${medKoord.length} byggeplasser i chunks à ${chunkStorrelse} (org ${organizationId})`,
    );
  }

  let rader = 0;
  for (let i = 0; i < medKoord.length; i += chunkStorrelse) {
    const chunk = medKoord.slice(i, i + chunkStorrelse);
    const matrise = await hentKjoretidMatrise(
      kontorKoord,
      chunk.map((b) => b.coord),
    );
    // OSRM-feil (timeout/nettverk) → behold eksisterende rader, hopp over chunk.
    if (!matrise) continue;

    const ops = [];
    for (let ki = 0; ki < kontorer.length; ki++) {
      for (let bi = 0; bi < chunk.length; bi++) {
        const kjoretidMin = matrise[ki]?.[bi];
        if (kjoretidMin == null) continue;
        ops.push(
          prisma.reisetidMatrise.upsert({
            where: {
              oppmotestedId_byggeplassId: {
                oppmotestedId: kontorer[ki]!.id,
                byggeplassId: chunk[bi]!.id,
              },
            },
            create: {
              organizationId,
              oppmotestedId: kontorer[ki]!.id,
              byggeplassId: chunk[bi]!.id,
              kjoretidMin,
              kilde: "osrm",
            },
            update: { kjoretidMin, kilde: "osrm", beregnetAt: new Date() },
          }),
        );
      }
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops);
      rader += ops.length;
    }
  }

  return { rader };
}

/**
 * Fire-and-forget-variant for triggere — venter aldri, feiler aldri kallestien.
 */
export function recomputeMatriseIBakgrunn(args: RecomputeArgs): void {
  recomputeMatrise(args).catch((e) => {
    console.error(
      "[reisetid-matrise] recompute feilet (ikke-blokkerende):",
      e,
    );
  });
}

/**
 * Rad-trigger ved byggeplass-koordinatendring. Resolver firma via
 * `project.primaryOrganizationId`; orphan/standalone (null) → ingen matrise.
 * Fire-and-forget.
 */
export function recomputeRadForByggeplass(byggeplassId: string): void {
  void (async () => {
    const bp = await prisma.byggeplass.findUnique({
      where: { id: byggeplassId },
      select: { project: { select: { primaryOrganizationId: true } } },
    });
    const orgId = bp?.project?.primaryOrganizationId;
    if (!orgId) return; // orphan/standalone-prosjekt → ingen firma-matrise
    await recomputeMatrise({ organizationId: orgId, byggeplassId });
  })().catch((e) => {
    console.error(
      "[reisetid-matrise] rad-recompute feilet (ikke-blokkerende):",
      e,
    );
  });
}
