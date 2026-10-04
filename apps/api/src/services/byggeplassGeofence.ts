import { prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import {
  beregnByggeplassGeofence,
  beregnTransformasjon,
  tegningTilGps,
  erEnkeltPolygon,
  sentroidePunkter,
  GEOFENCE_GRENSER,
  type GeoReferanse,
  type GpsPunkt,
} from "@sitedoc/shared";
import { recomputeRadForByggeplass } from "./reisetidMatrise";

/**
 * Fase 1c: beregn og lagre byggeplass-geofence fra nyeste georefererte tegning.
 *
 * Senter + radius avledes fra tegningens georeferanse (gjenbruker shared-transformen).
 * Velger den nyeste tegningen (createdAt desc) som har `geoReference` satt.
 *
 * @param kunHvisTom Når true (auto-trigger ved georeferering): hopp over hvis
 *   byggeplassen allerede har geofence — auto klobrer aldri en satt/manuell verdi.
 *   Eksplisitt «beregn fra tegning» sender false → overskriver `geokodet`/`tegning`/
 *   `ukjent`/`null`, men ALDRI `manuell` (C4: kartvelgeren overstyrer alltid).
 * @returns geofence hvis satt; null hvis ingen georef-tegning, degenerert
 *   georeferanse, eller hoppet pga kunHvisTom/manuell-fredning.
 */
export async function oppdaterByggeplassGeofence(
  byggeplassId: string,
  kunHvisTom: boolean,
): Promise<{ lat: number; lng: number; radiusM: number } | null> {
  const byggeplass = await prisma.byggeplass.findUnique({
    where: { id: byggeplassId },
    select: { latitude: true, geofenceKilde: true },
  });
  if (!byggeplass) return null;
  if (kunHvisTom && byggeplass.latitude != null) return null;
  // C4: et manuelt satt punkt fredes mot tegnings-avledning, også eksplisitt
  // «Beregn fra tegning» (kunHvisTom=false). Kartvelgeren overstyrer alltid.
  if (byggeplass.geofenceKilde === "manuell") return null;

  // Få byggeplassens tegninger, nyeste først; ta den første med georeferanse.
  const tegninger = await prisma.drawing.findMany({
    where: { byggeplassId },
    orderBy: { createdAt: "desc" },
    select: { geoReference: true },
  });
  const medGeoref = tegninger.find((t) => t.geoReference != null);
  if (!medGeoref) return null;

  let geofence: { lat: number; lng: number; radiusM: number };
  try {
    geofence = beregnByggeplassGeofence(
      medGeoref.geoReference as unknown as GeoReferanse,
    );
  } catch {
    // Degenerert georeferanse (identiske/kolineære punkter) — ikke oppdater.
    return null;
  }

  await prisma.byggeplass.update({
    where: { id: byggeplassId },
    data: {
      latitude: geofence.lat,
      longitude: geofence.lng,
      radiusM: geofence.radiusM,
      geofenceKilde: "tegning", // C3: punktet er avledet fra georeferert tegning
    },
  });
  // R3: byggeplass-koordinat endret (success-sti) → recompute rad (fire-and-forget).
  recomputeRadForByggeplass(byggeplassId);
  return geofence;
}

/**
 * Les en sones lat/lng-polygon fra Prisma Json-feltet som en punktliste.
 * Tomt/ugyldig → tom liste (ingen kaster på rar data).
 */
function lesGeoPolygon(verdi: unknown): GpsPunkt[] {
  if (!Array.isArray(verdi)) return [];
  const ut: GpsPunkt[] = [];
  for (const p of verdi) {
    if (
      p &&
      typeof p === "object" &&
      typeof (p as { lat?: unknown }).lat === "number" &&
      typeof (p as { lng?: unknown }).lng === "number"
    ) {
      ut.push({ lat: (p as GpsPunkt).lat, lng: (p as GpsPunkt).lng });
    }
  }
  return ut;
}

/**
 * V17-B / B2 — utled og lagre byggeplassens origo (reise-anker) fra sonene når
 * det ikke finnes et punkt fra før. Sentroide av ALLE sonenes hjørner.
 *
 * 🔴 Invariant (stille-tomhet krav c, origo-integrasjonstest): så snart en sone
 * får geometri på en punktløs byggeplass, SKAL byggeplassen få et punkt — ellers
 * er den ikke gjenkjennbar (A4 krever punkt) og mangler reise-anker (§ 0).
 *
 * B8-vern: et EKSISTERENDE punkt fredes alltid (manuell/geokodet/tegning/soner) —
 * origo re-utledes ikke automatisk når soner endres (punktet er stabilt reise-anker,
 * B2). Kan flyttes manuelt i modalen (→ `manuell`). Returnerer utledet punkt, eller
 * null hvis punkt fantes eller ingen sone har geometri.
 */
export async function sikreByggeplassOrigo(
  byggeplassId: string,
): Promise<{ lat: number; lng: number } | null> {
  const byggeplass = await prisma.byggeplass.findUnique({
    where: { id: byggeplassId },
    select: { latitude: true },
  });
  if (!byggeplass) return null;
  if (byggeplass.latitude != null) return null; // punktet finnes — fredet (B2/B8)

  const soner = await prisma.omrade.findMany({
    where: { byggeplassId },
    select: { geoPolygon: true },
  });
  const hjorner = soner.flatMap((s) => lesGeoPolygon(s.geoPolygon));
  if (hjorner.length === 0) return null;

  const origo = sentroidePunkter(hjorner);
  await prisma.byggeplass.update({
    where: { id: byggeplassId },
    data: {
      latitude: origo.lat,
      longitude: origo.lng,
      geofenceKilde: "soner", // B2: origo utledet av sonene
    },
  });
  // Reise-ankeret er nytt → recompute matrise-rad (fire-and-forget, som R3).
  recomputeRadForByggeplass(byggeplassId);
  return origo;
}

/**
 * V17-B / B4 — utled en sones lat/lng-geofence fra dens tegnings-polygon (prosent)
 * via tegningens georeferanse. Transformerer hvert prosent-punkt med `tegningTilGps`
 * (ingen buffer — tegnings-polygonet ER flaten, AVVIK 1), validerer enkelt polygon,
 * og skriver `geoPolygon` + `geoKilde = "tegning"`. Utleder origo etterpå (B2).
 *
 * 🔴 B8: fredes PR. SONE av `geoKilde = "kart"` — en kart-tegnet sone overskrives
 * ALDRI av tegningsutledning. Dette er en EGEN vakt fra punktets `manuell`-fredning:
 * en byggeplass med manuelt punkt får likevel soner herfra (test 8.9).
 *
 * Kaster `BAD_REQUEST` ved: ikke koblet tegning · tegning uten georeferanse ·
 * < POLYGON_MIN_PUNKTER punkter · degenerert georeferanse · selvkryssende resultat.
 * Returnerer null (ingen endring) kun når sonen allerede er `kart`-fredet.
 */
export async function utledGeometriFraTegning(
  omradeId: string,
): Promise<{ omradeId: string; punkter: number } | null> {
  const omrade = await prisma.omrade.findUnique({
    where: { id: omradeId },
    select: {
      id: true,
      byggeplassId: true,
      tegningId: true,
      polygon: true,
      geoKilde: true,
    },
  });
  if (!omrade) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke området." });
  }
  // B8: kart-tegnet sone fredes pr. sone — tegningsutledning overskriver den aldri.
  if (omrade.geoKilde === "kart") return null;

  if (!omrade.tegningId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Området er ikke koblet til en tegning å utlede sonen fra.",
    });
  }
  const tegning = await prisma.drawing.findUnique({
    where: { id: omrade.tegningId },
    select: { geoReference: true },
  });
  if (!tegning?.geoReference) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tegningen er ikke georeferert — kan ikke regne om polygonet til kart.",
    });
  }

  const prosent = omrade.polygon;
  if (
    !Array.isArray(prosent) ||
    prosent.length < GEOFENCE_GRENSER.polygonMinPunkter
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Området må ha minst ${GEOFENCE_GRENSER.polygonMinPunkter} tegnings-punkter for å utledes som sone.`,
    });
  }

  let latLng: GpsPunkt[];
  try {
    const t = beregnTransformasjon(tegning.geoReference as unknown as GeoReferanse);
    latLng = (prosent as { x: number; y: number }[]).map((p) =>
      tegningTilGps({ x: p.x, y: p.y }, t),
    );
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Georeferansen er ugyldig (degenerert) — kan ikke utlede sonen.",
    });
  }
  if (!erEnkeltPolygon(latLng)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Det utledede polygonet selvkrysser — rett opp tegnings-polygonet først.",
    });
  }

  await prisma.omrade.update({
    where: { id: omradeId },
    data: { geoPolygon: latLng, geoKilde: "tegning" },
  });
  await sikreByggeplassOrigo(omrade.byggeplassId);
  return { omradeId, punkter: latLng.length };
}
