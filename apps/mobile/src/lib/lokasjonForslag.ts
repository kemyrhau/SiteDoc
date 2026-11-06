/**
 * Lokasjonsforslag for dokumenter (ORDRE 19, 2026-11-06). Ren logikk delt av
 * OpprettDokumentModal og LokasjonSeksjon (oppgave + sjekkliste) — ingen RN/GPS-kall her;
 * kallstedet henter posisjonen og sist-brukt-minnet og sender dem inn.
 */

export interface GpsBounds {
  point1: { gps: { lat: number; lng: number } };
  point2: { gps: { lat: number; lng: number } };
}

export interface ForslagTegning {
  id: string;
  geoReference?: unknown | null;
  byggeplassId?: string | null;
  byggeplass?: { id: string } | null;
}

export interface LokasjonsForslag {
  tegningId: string | null;
  byggeplassId: string | null;
  kilde: "gps" | "lagret";
}

/** Sjekk om GPS-koordinat er innenfor tegningens georeferanse-bounds */
export function erInnenforBounds(lat: number, lng: number, geo: GpsBounds): boolean {
  const minLat = Math.min(geo.point1.gps.lat, geo.point2.gps.lat);
  const maxLat = Math.max(geo.point1.gps.lat, geo.point2.gps.lat);
  const minLng = Math.min(geo.point1.gps.lng, geo.point2.gps.lng);
  const maxLng = Math.max(geo.point1.gps.lng, geo.point2.gps.lng);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * GPS-treff mot georefererte tegninger først (sist brukte blant treffene vinner, ellers
 * første treff); deretter sist brukte byggeplass + tegning; ellers null.
 */
export function foreslaaLokasjon(input: {
  tegninger: ForslagTegning[];
  gps: { lat: number; lng: number } | null;
  sistBygningId: string | null;
  sistTegningId: string | null;
}): LokasjonsForslag | null {
  const { tegninger, gps, sistBygningId, sistTegningId } = input;
  if (gps) {
    const treff = tegninger.filter(
      (t) => t.geoReference != null && erInnenforBounds(gps.lat, gps.lng, t.geoReference as GpsBounds),
    );
    if (treff.length > 0) {
      const valgt = (sistTegningId ? treff.find((t) => t.id === sistTegningId) : undefined) ?? treff[0]!;
      return {
        tegningId: valgt.id,
        byggeplassId: valgt.byggeplassId ?? valgt.byggeplass?.id ?? null,
        kilde: "gps",
      };
    }
  }
  if (sistBygningId) {
    return { tegningId: sistTegningId, byggeplassId: sistBygningId, kilde: "lagret" };
  }
  return null;
}

/** Paritet med web: lokasjonsfeltet vises med mindre malen eksplisitt sier showLocation=false. */
export function visLokasjon(template: { showLocation?: boolean | null } | null | undefined): boolean {
  return template?.showLocation !== false;
}

/** Forslag kun på utkast som ennå ikke har lokasjon (ingen tegning, intet omfang). */
export function skalForeslaaLokasjon(dok: {
  status: string;
  drawingId?: string | null;
  lokasjonOmfang?: string | null;
}): boolean {
  return dok.status === "draft" && !dok.drawingId && dok.lokasjonOmfang == null;
}
