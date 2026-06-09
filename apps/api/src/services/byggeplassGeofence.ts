import { prisma } from "@sitedoc/db";
import { beregnByggeplassGeofence, type GeoReferanse } from "@sitedoc/shared";

/**
 * Fase 1c: beregn og lagre byggeplass-geofence fra nyeste georefererte tegning.
 *
 * Senter + radius avledes fra tegningens georeferanse (gjenbruker shared-transformen).
 * Velger den nyeste tegningen (createdAt desc) som har `geoReference` satt.
 *
 * @param kunHvisTom Når true (auto-trigger ved georeferering): hopp over hvis
 *   byggeplassen allerede har geofence — auto klobrer aldri en satt/manuell verdi.
 *   Eksplisitt «beregn fra tegning» sender false → overskriver alltid.
 * @returns geofence hvis satt; null hvis ingen georef-tegning, degenerert
 *   georeferanse, eller hoppet pga kunHvisTom.
 */
export async function oppdaterByggeplassGeofence(
  byggeplassId: string,
  kunHvisTom: boolean,
): Promise<{ lat: number; lng: number; radiusM: number } | null> {
  const byggeplass = await prisma.byggeplass.findUnique({
    where: { id: byggeplassId },
    select: { latitude: true },
  });
  if (!byggeplass) return null;
  if (kunHvisTom && byggeplass.latitude != null) return null;

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
    },
  });
  return geofence;
}
