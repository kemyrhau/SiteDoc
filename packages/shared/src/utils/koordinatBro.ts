/**
 * Koordinatbro: GPS (WGS84) ↔ 3D-verdenskoordinater (Three.js)
 *
 * Brukes for å koble tegninger (2D) med 3D-modeller via GPS.
 * Konverteringskjede: Tegning (pixel%) ↔ GPS ↔ UTM ↔ 3D-verden
 *
 * IFC-modeller har en GPS-opprinnelse (fra IFCSITE).
 * Three.js-koordinater er relative til denne opprinnelsen:
 *   3D x = UTM øst - opprinnelse UTM øst
 *   3D z = -(UTM nord - opprinnelse UTM nord)  (negativ fordi Three.js z peker sørover)
 *   3D y = høyde
 */

import { konverterTilWgs84 } from "./koordinatKonvertering";
import type { KoordinatSystem } from "./koordinatKonvertering";

// ── WGS84 → UTM konvertering ──

const UTM_SENTRALMERIDIAN: Record<string, number> = {
  utm32: 9, utm33: 15, utm35: 27, utm36: 33,
};

/**
 * WGS84 → Transverse Mercator (generell).
 * Invers av tmTilWgs84 i koordinatKonvertering.ts.
 */
function wgs84TilTm(
  lat: number,
  lng: number,
  sentralmeridian: number,
  scaleFactor: number,
  falseEasting: number,
): { nord: number; ost: number } {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);
  const k0 = scaleFactor;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lng0Rad = (sentralmeridian * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ep2 * cosLat * cosLat;
  const A = cosLat * (lngRad - lng0Rad);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));

  const ost =
    falseEasting +
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A) / 120);

  const nord =
    k0 *
    (M +
      N *
        tanLat *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A) / 720));

  return { nord, ost };
}

/** WGS84 → UTM */
export function wgs84TilUtm(
  lat: number,
  lng: number,
  sone: string,
): { nord: number; ost: number } {
  const sentralmeridian = UTM_SENTRALMERIDIAN[sone] ?? 15;
  return wgs84TilTm(lat, lng, sentralmeridian, 0.9996, 500000);
}

/** WGS84 → NTM */
export function wgs84TilNtm(
  lat: number,
  lng: number,
  sone: number,
): { nord: number; ost: number } {
  const sentralmeridian = sone + 0.5;
  return wgs84TilTm(lat, lng, sentralmeridian, 1.0, 100000);
}

/** WGS84 → vilkårlig støttet projeksjonskoordinat */
export function wgs84TilProjeksjon(
  lat: number,
  lng: number,
  system: KoordinatSystem,
): { nord: number; ost: number } | null {
  if (system === "wgs84") return { nord: lat, ost: lng };
  if (system.startsWith("utm")) return wgs84TilUtm(lat, lng, system);
  if (system.startsWith("ntm")) {
    const sone = parseInt(system.replace("ntm", ""), 10);
    if (isNaN(sone)) return null;
    return wgs84TilNtm(lat, lng, sone);
  }
  return null;
}

// ── GPS ↔ 3D-verden ──

export interface IfcOpprinnelse {
  /** GPS-breddegrad for IFC-modellens opprinnelse (IFCSITE) */
  lat: number;
  /** GPS-lengdegrad for IFC-modellens opprinnelse (IFCSITE) */
  lng: number;
  /** Høyde over havet (meter), valgfritt */
  hoyde?: number;
}

/**
 * Konverter GPS-koordinater til 3D-verdenskoordinater (Three.js).
 *
 * Beregner UTM-differanse mellom GPS-punkt og IFC-opprinnelse,
 * og returnerer dette som Three.js-koordinater:
 *   x = øst-differanse (meter)
 *   z = -nord-differanse (Three.js z peker sørover)
 *   y = høyde (standard 0 eller fra etasjehøyde)
 *
 * @param gps GPS-koordinater
 * @param ifcOpprinnelse IFC-modellens GPS-opprinnelse
 * @param system Koordinatsystem (default utm33)
 * @param hoyde Y-koordinat i 3D (etasjehøyde), default 1.6 (øyehøyde)
 */
export function gpsTil3D(
  gps: { lat: number; lng: number },
  ifcOpprinnelse: IfcOpprinnelse,
  system: KoordinatSystem = "utm33",
  hoyde: number = 1.6,
): { x: number; y: number; z: number } | null {
  const punktUtm = wgs84TilProjeksjon(gps.lat, gps.lng, system);
  const originUtm = wgs84TilProjeksjon(ifcOpprinnelse.lat, ifcOpprinnelse.lng, system);
  if (!punktUtm || !originUtm) return null;

  return {
    x: punktUtm.ost - originUtm.ost,
    y: hoyde,
    z: -(punktUtm.nord - originUtm.nord),
  };
}

/**
 * Konverter 3D-verdenskoordinater (Three.js) til GPS.
 *
 * Invers av gpsTil3D: legger til 3D-offset på IFC-opprinnelsens UTM-koordinat
 * og konverterer tilbake til WGS84.
 *
 * @param punkt 3D-punkt (Three.js)
 * @param ifcOpprinnelse IFC-modellens GPS-opprinnelse
 * @param system Koordinatsystem (default utm33)
 */
export function tredjeTilGps(
  punkt: { x: number; y: number; z: number },
  ifcOpprinnelse: IfcOpprinnelse,
  system: KoordinatSystem = "utm33",
): { lat: number; lng: number } | null {
  const originUtm = wgs84TilProjeksjon(ifcOpprinnelse.lat, ifcOpprinnelse.lng, system);
  if (!originUtm) return null;

  const utmOst = originUtm.ost + punkt.x;
  const utmNord = originUtm.nord - punkt.z; // z er negativ nordover

  return konverterTilWgs84(utmNord, utmOst, system);
}
