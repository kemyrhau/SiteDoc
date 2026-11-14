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
 * kilde: "osrm" (beregnet) | "manuell" | "manuell_endret" (POST 2026-11-14 (10)).
 * Uoppnåelige par lagres med kjoretidMin = -1 (computed-men-uoppnåelig; R4
 * skiller fra fravær = live-fallback).
 *
 * 🔴 MANUELL-VAKT (avstand gir lønn): en rad med kilde som starter på "manuell"
 * er firmaets egen verdi. recompute (alle triggere + «Beregn matrise») skal
 * ALDRI overskrive eller slette den — kun `oppmotested.tilbakestillAvstand`
 * fjerner den. Flyttes et av punktene (`plasseringEndret`), merkes raden
 * "manuell_endret" i stedet, så fanen Avstander kan si at verdien ble satt før
 * plasseringen endret seg. Voktet av `reisetidMatrise-manuell.test.ts`.
 */

import { prisma } from "@sitedoc/db";
import { hentKjoretidMatrise, UOPPNAAELIG, type Coord } from "./rute-service";

/** Kilde-prefiks for firmaets egne verdier. */
export const MANUELL_KILDE = "manuell";
export const MANUELL_ENDRET_KILDE = "manuell_endret";
export function erManuellKilde(kilde: string): boolean {
  return kilde.startsWith(MANUELL_KILDE);
}
const MANUELL_FILTER = { kilde: { startsWith: MANUELL_KILDE } };

/** Har punktet faktisk flyttet seg (inkl. satt/fjernet)? */
export function koordinatEndret(
  forrige: { lat: number | null; lng: number | null } | null,
  ny: { lat: number | null; lng: number | null },
): boolean {
  return (forrige?.lat ?? null) !== ny.lat || (forrige?.lng ?? null) !== ny.lng;
}

// Margin under OSRM /table sitt ~100-koordinat-tak (kontorer + chunk ≤ dette).
const OSRM_MAX_KOORDINATER = 90;

interface RecomputeArgs {
  organizationId: string;
  oppmotestedId?: string;
  byggeplassId?: string;
  /**
   * Triggeren kommer fra en faktisk koordinatendring (byggeplass eller
   * oppmøtested). Manuelle rader i settet merkes da "manuell_endret".
   */
  plasseringEndret?: boolean;
}

/**
 * Beregn og upsert matrise-rader for et firma.
 * - `oppmotestedId` satt → kolonne (det kontoret × alle firmaets byggeplasser).
 * - `byggeplassId` satt → rad (alle firmaets kontorer × den byggeplassen).
 * - ingen → full firma-backfill.
 */
export interface RecomputeResultat {
  rader: number;
  /** Byggeplasser i dette recompute-settet som mangler eget punkt (H21-fiks, C1). */
  manglerPunkt: { byggeplassId: string; navn: string; projectId: string }[];
  /** Antall upsertede par markert uoppnåelig (kjoretidMin === -1). */
  uoppnaaelige: number;
}

export async function recomputeMatrise(
  args: RecomputeArgs,
): Promise<RecomputeResultat> {
  const { organizationId, oppmotestedId, byggeplassId, plasseringEndret } = args;

  // 1. Kontorer (sources). lat/lng er påkrevde felt på Oppmotested.
  const kontorer = await prisma.oppmotested.findMany({
    where: oppmotestedId
      ? { id: oppmotestedId, organizationId }
      : { organizationId },
    select: { id: true, lat: true, lng: true },
  });
  if (kontorer.length === 0)
    return { rader: 0, manglerPunkt: [], uoppnaaelige: 0 };

  // 2. Byggeplasser (destinations). Firma-isolasjon via project.primaryOrganizationId.
  const byggeplasserRaw = await prisma.byggeplass.findMany({
    where: byggeplassId
      ? { id: byggeplassId, project: { primaryOrganizationId: organizationId } }
      : { project: { primaryOrganizationId: organizationId } },
    select: {
      id: true,
      name: true,
      projectId: true,
      latitude: true,
      longitude: true,
    },
  });

  // 🔴 C1/H21: KUN byggeplassens eget punkt. Prosjekt-arven (`?? b.project?.latitude`)
  // er fjernet — et prosjekt kan strekke seg over kilometer, og avstanden avgjør om
  // kjøringen dit betales som arbeidstid eller reisetid. Byggeplass uten eget punkt
  // får ingen matriserad (og eventuelle arv-baserte rader slettes av stale-ryddingen
  // under, siden de nå faller i `utenKoord`).
  const byggeplasser = byggeplasserRaw.map((b) => {
    const coord: Coord | null =
      b.latitude != null && b.longitude != null
        ? { lat: b.latitude, lng: b.longitude }
        : null;
    return { id: b.id, navn: b.name, projectId: b.projectId, coord };
  });

  // Stale-rydding: byggeplasser som mangler koordinat → slett ev. eksisterende
  // rader (utdatert cache ville servere R4 feil tid for en posisjonsløs byggeplass).
  const utenPunkt = byggeplasser.filter((b) => b.coord == null);
  const utenKoord = utenPunkt.map((b) => b.id);
  const manglerPunkt = utenPunkt.map((b) => ({
    byggeplassId: b.id,
    navn: b.navn,
    projectId: b.projectId,
  }));
  if (utenKoord.length > 0) {
    // 🔴 Manuell-vakt: firmaets egne verdier slettes ikke av stale-ryddingen.
    await prisma.reisetidMatrise.deleteMany({
      where: {
        organizationId,
        byggeplassId: { in: utenKoord },
        NOT: MANUELL_FILTER,
      },
    });
  }

  // Manuelle par i settet: hoppes over i upserten under. Flyttet punkt →
  // merk "manuell_endret" (verdien beholdes).
  const kontorIder = kontorer.map((k) => k.id);
  const byggeplassIder = byggeplasser.map((b) => b.id);
  const settFilter = {
    organizationId,
    oppmotestedId: { in: kontorIder },
    byggeplassId: { in: byggeplassIder },
    ...MANUELL_FILTER,
  };
  const manuelle =
    byggeplassIder.length > 0
      ? await prisma.reisetidMatrise.findMany({
          where: settFilter,
          select: { oppmotestedId: true, byggeplassId: true },
        })
      : [];
  const manuellPar = new Set(
    manuelle.map((m) => `${m.oppmotestedId}|${m.byggeplassId}`),
  );
  if (plasseringEndret && manuelle.length > 0) {
    await prisma.reisetidMatrise.updateMany({
      where: settFilter,
      data: { kilde: MANUELL_ENDRET_KILDE },
    });
  }

  const medKoord = byggeplasser.filter(
    (b): b is { id: string; navn: string; projectId: string; coord: Coord } =>
      b.coord != null,
  );
  if (medKoord.length === 0) return { rader: 0, manglerPunkt, uoppnaaelige: 0 };

  // 3. OSRM /table — batch destinasjonene slik at kontorer + chunk ≤ taket.
  const kontorKoord: Coord[] = kontorer.map((k) => ({ lat: k.lat, lng: k.lng }));
  const chunkStorrelse = Math.max(1, OSRM_MAX_KOORDINATER - kontorer.length);
  if (medKoord.length > chunkStorrelse) {
    console.log(
      `[reisetid-matrise] batcher ${medKoord.length} byggeplasser i chunks à ${chunkStorrelse} (org ${organizationId})`,
    );
  }

  let rader = 0;
  let uoppnaaelige = 0;
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
        const kjoretidMin = matrise.durations[ki]?.[bi];
        if (kjoretidMin == null) continue;
        // 🔴 Manuell-vakt: firmaets egen verdi overskrives aldri.
        if (manuellPar.has(`${kontorer[ki]!.id}|${chunk[bi]!.id}`)) continue;
        if (kjoretidMin === UOPPNAAELIG) uoppnaaelige++;
        // Avstand fra samme OSRM-kall (reise-terskel-km). UOPPNAAELIG (-1) er
        // symmetrisk med kjoretidMin; manglende celle → null (aldri sett i
        // praksis siden distances speiler durations, men defensivt).
        const avstandM = matrise.distances[ki]?.[bi] ?? null;
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
              avstandM,
              kilde: "osrm",
            },
            update: {
              kjoretidMin,
              avstandM,
              kilde: "osrm",
              beregnetAt: new Date(),
            },
          }),
        );
      }
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops);
      rader += ops.length;
    }
  }

  return { rader, manglerPunkt, uoppnaaelige };
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
export function recomputeRadForByggeplass(
  byggeplassId: string,
  opts: { plasseringEndret?: boolean } = {},
): void {
  void (async () => {
    const bp = await prisma.byggeplass.findUnique({
      where: { id: byggeplassId },
      select: { project: { select: { primaryOrganizationId: true } } },
    });
    const orgId = bp?.project?.primaryOrganizationId;
    if (!orgId) return; // orphan/standalone-prosjekt → ingen firma-matrise
    await recomputeMatrise({
      organizationId: orgId,
      byggeplassId,
      plasseringEndret: opts.plasseringEndret,
    });
  })().catch((e) => {
    console.error(
      "[reisetid-matrise] rad-recompute feilet (ikke-blokkerende):",
      e,
    );
  });
}
