/**
 * Koordinatkonvertering: UTM/NTM → WGS84
 *
 * Støtter:
 * - ETRS89 UTM sone 32, 33, 35, 36 (EPSG:25832–25836)
 * - NTM sone 5–20 (EPSG:5105–5120)
 */

/** Alle støttede koordinatsystemer */
export type KoordinatSystem =
  | "wgs84"
  | "utm32" | "utm33" | "utm35" | "utm36"
  | "ntm5" | "ntm6" | "ntm7" | "ntm8" | "ntm9" | "ntm10"
  | "ntm11" | "ntm12" | "ntm13" | "ntm14" | "ntm15"
  | "ntm16" | "ntm17" | "ntm18" | "ntm19" | "ntm20";

/** Sentralmeridianer for UTM-soner (grader) */
const UTM_SENTRALMERIDIAN: Record<string, number> = {
  utm32: 9, utm33: 15, utm35: 27, utm36: 33,
};

/** EPSG-kode → intern KoordinatSystem */
export const EPSG_TIL_SYSTEM: Record<string, KoordinatSystem> = {
  "25832": "utm32", "25833": "utm33", "25835": "utm35", "25836": "utm36",
  "5105": "ntm5", "5106": "ntm6", "5107": "ntm7", "5108": "ntm8",
  "5109": "ntm9", "5110": "ntm10", "5111": "ntm11", "5112": "ntm12",
  "5113": "ntm13", "5114": "ntm14", "5115": "ntm15", "5116": "ntm16",
  "5117": "ntm17", "5118": "ntm18", "5119": "ntm19", "5120": "ntm20",
};

interface WGS84 {
  lat: number;
  lng: number;
}

/**
 * Generell Transverse Mercator → WGS84 konvertering.
 * Fungerer for både UTM og NTM med riktige parametere.
 */
function tmTilWgs84(
  nord: number,
  ost: number,
  sentralmeridian: number,
  scaleFactor: number,
  falseEasting: number,
): WGS84 {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = scaleFactor;
  const lng0 = (sentralmeridian * Math.PI) / 180;

  const M = nord / k0;
  const mu =
    M /
    (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) *
      Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 * e1 * e1 * e1) / 512) * Math.sin(8 * mu);

  const ep2 = e2 / (1 - e2);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = ep2 * cosPhi1 * cosPhi1;
  const R1 =
    (a * (1 - e2)) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = (ost - falseEasting) / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) *
          D *
          D *
          D *
          D) /
          24 +
        ((61 +
          90 * T1 +
          298 * C1 +
          45 * T1 * T1 -
          252 * ep2 -
          3 * C1 * C1) *
          D *
          D *
          D *
          D *
          D *
          D) /
          720);

  const lng =
    lng0 +
    (D -
      ((1 + 2 * T1 + C1) * D * D * D) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) *
        D *
        D *
        D *
        D *
        D) /
        120) /
      cosPhi1;

  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}

/** Konverter UTM (ETRS89) til WGS84 */
export function utmTilWgs84(
  nord: number,
  ost: number,
  sone: string,
): WGS84 {
  const sentralmeridian = UTM_SENTRALMERIDIAN[sone] ?? 15;
  return tmTilWgs84(nord, ost, sentralmeridian, 0.9996, 500000);
}

/** Konverter NTM (Norwegian Transverse Mercator) til WGS84 */
export function ntmTilWgs84(
  nord: number,
  ost: number,
  sone: number,
): WGS84 {
  const sentralmeridian = sone + 0.5;
  // NTM: scale factor 1.0, false easting 100000
  return tmTilWgs84(nord, ost, sentralmeridian, 1.0, 100000);
}

/** Konverter fra vilkårlig støttet system til WGS84 */
export function konverterTilWgs84(
  nord: number,
  ost: number,
  system: KoordinatSystem,
): WGS84 | null {
  if (system === "wgs84") return { lat: nord, lng: ost };

  if (system.startsWith("utm")) {
    return utmTilWgs84(nord, ost, system);
  }

  if (system.startsWith("ntm")) {
    const sone = parseInt(system.replace("ntm", ""), 10);
    if (isNaN(sone)) return null;
    return ntmTilWgs84(nord, ost, sone);
  }

  return null;
}

/**
 * Detekter koordinatsystem fra filnavn og/eller koordinatverdier.
 * Returnerer null hvis ikke detekterbart.
 */
export function detekterKoordinatSystem(
  filnavn: string,
  extents?: { minX: number; maxX: number; minY: number; maxY: number },
): KoordinatSystem | null {
  const upper = filnavn.toUpperCase();

  // EPSG-kode i filnavn
  const epsgMatch = upper.match(/EPSG[:\s_-]*(\d{4,5})/);
  if (epsgMatch && epsgMatch[1]) {
    const system = EPSG_TIL_SYSTEM[epsgMatch[1]];
    if (system) return system;
  }

  // NTM-sone i filnavn (NTM5, NTM6, NTM_6, NTM-6, etc.)
  const ntmMatch = upper.match(/NTM[_\s-]*(\d{1,2})/);
  if (ntmMatch && ntmMatch[1]) {
    const sone = parseInt(ntmMatch[1], 10);
    if (sone >= 5 && sone <= 20) return `ntm${sone}` as KoordinatSystem;
  }

  // UTM-sone i filnavn (UTM32, UTM33, UTM_33, etc.)
  const utmMatch = upper.match(/UTM[_\s-]*(\d{2})/);
  if (utmMatch && utmMatch[1]) {
    const sone = parseInt(utmMatch[1], 10);
    if ([32, 33, 35, 36].includes(sone)) return `utm${sone}` as KoordinatSystem;
  }

  // Heuristikk basert på koordinatverdier
  if (extents) {
    const { minX, maxX, minY, maxY } = extents;
    // Northing i Norge: 6400000–7950000
    const erNorskNorthing =
      minY > 6400000 && maxY < 8000000;

    if (erNorskNorthing) {
      // NTM: false easting 100000, typisk 50000–150000
      if (minX > 30000 && maxX < 200000) {
        // Trenger sentralmeridian for å bestemme sone — prøv å gjette
        // fra filnavn (allerede sjekket) eller standard NTM for vestlandet
        return null; // Kan ikke bestemme sone fra verdiene alene
      }
      // UTM: false easting 500000, typisk 100000–900000
      if (minX > 100000 && maxX < 900000) {
        // UTM-33 er vanligst i Norge
        if (minX > 400000 && maxX < 600000) return "utm33";
        return "utm33"; // Standard fallback
      }
    }
  }

  return null;
}
