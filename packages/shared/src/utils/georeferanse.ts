import type { GeoReferanse } from "../types";

/**
 * Transformasjonsparametre for lineær mapping mellom GPS og pixel-prosent.
 *
 * Uavhengig skalering i x (longitude) og y (latitude) — håndterer
 * bilder med vilkårlig aspektforhold uten å anta lik skalering.
 *
 * GPS → Pixel:
 *   px = sx * (lng * cosLat) + cx
 *   py = sy * lat + cy
 *
 * Pixel → GPS:
 *   lat = (py - cy) / sy
 *   lng = (px - cx) / (sx * cosLat)
 */
export interface Transformasjon {
  /** X-skalering (longitude → pixel-prosent) */
  sx: number;
  /** Y-skalering (latitude → pixel-prosent) */
  sy: number;
  /** X-offset */
  cx: number;
  /** Y-offset */
  cy: number;
  /** cos(middelbreddegrad) — kompenserer for at 1° lng ≠ 1° lat */
  cosLat: number;

  // Bakoverkompatibilitet — eldre kode kan referere til a,b,c,d
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * Beregn lineær transformasjon fra 2 referansepunkter.
 * Uavhengig skalering i x og y — fungerer korrekt for bilder
 * med vilkårlig aspektforhold (f.eks. panorama-screenshots, brede kart).
 *
 * GPS-koordinater normaliseres med cos(middelbreddegrad) slik at
 * 1° lng ≈ 1° lat i meter (viktig for høye breddegrader som Norge).
 */
export function beregnTransformasjon(ref: GeoReferanse): Transformasjon {
  const { point1, point2 } = ref;

  // Middelbreddegrad for cos-korreksjon
  const midLat = (point1.gps.lat + point2.gps.lat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  // GPS normalisert
  const gx1 = point1.gps.lng * cosLat;
  const gy1 = point1.gps.lat;
  const gx2 = point2.gps.lng * cosLat;
  const gy2 = point2.gps.lat;

  // Pixel-koordinater (prosent)
  const px1 = point1.pixel.x;
  const py1 = point1.pixel.y;
  const px2 = point2.pixel.x;
  const py2 = point2.pixel.y;

  // Differanser
  const dGx = gx2 - gx1;
  const dGy = gy2 - gy1;

  if (dGx === 0 && dGy === 0) {
    throw new Error("Referansepunktene har identiske GPS-koordinater");
  }

  // Uavhengig lineær skalering
  // px = sx * gx + cx → sx = dPx / dGx
  // py = sy * gy + cy → sy = dPy / dGy
  let sx: number;
  let cx: number;
  let sy: number;
  let cy: number;

  if (Math.abs(dGx) < 1e-10) {
    // Punktene har samme longitude — kun y-skalering er definerbar
    // Bruk y-skalering for begge (fallback)
    sy = (py2 - py1) / dGy;
    cy = py1 - sy * gy1;
    sx = sy; // Anta lik skalering når x ikke kan beregnes
    cx = px1 - sx * gx1;
  } else if (Math.abs(dGy) < 1e-10) {
    // Punktene har samme latitude — kun x-skalering er definerbar
    sx = (px2 - px1) / dGx;
    cx = px1 - sx * gx1;
    sy = -sx; // Negativ fordi økende lat = mer nord = lavere y
    cy = py1 - sy * gy1;
  } else {
    // Normal case: uavhengig skalering i begge retninger
    sx = (px2 - px1) / dGx;
    cx = px1 - sx * gx1;
    sy = (py2 - py1) / dGy;
    cy = py1 - sy * gy1;
  }

  return { sx, sy, cx, cy, cosLat, a: sx, b: 0, c: cx, d: cy };
}

/**
 * Transformer GPS-koordinater til tegningsposisjon (prosent 0-100).
 * Returnerer verdier clampet til 0-100.
 */
export function gpsTilTegning(
  gps: { lat: number; lng: number },
  transformasjon: Transformasjon,
): { x: number; y: number } {
  const { sx, sy, cx, cy, cosLat } = transformasjon;

  const gx = gps.lng * cosLat;
  const gy = gps.lat;

  const x = sx * gx + cx;
  const y = sy * gy + cy;

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

/**
 * Transformer tegningsposisjon (prosent) til GPS-koordinater.
 * Invertert lineær transformasjon.
 */
export function tegningTilGps(
  pixel: { x: number; y: number },
  transformasjon: Transformasjon,
): { lat: number; lng: number } {
  const { sx, sy, cx, cy, cosLat } = transformasjon;

  if (sx === 0 || sy === 0) {
    throw new Error("Ugyldig transformasjon (skalering er 0)");
  }

  const gx = (pixel.x - cx) / sx;
  const gy = (pixel.y - cy) / sy;

  return { lat: gy, lng: gx / cosLat };
}

/**
 * Sjekk om en GPS-posisjon er innenfor tegningens dekningsområde.
 * Sjekker at transformerte koordinater er innenfor 0-100 med litt margin.
 */
export function erInnenforTegning(
  gps: { lat: number; lng: number },
  transformasjon: Transformasjon,
  margin: number = 10,
): boolean {
  const pos = gpsTilTegning(gps, transformasjon);
  return pos.x >= -margin && pos.x <= 100 + margin && pos.y >= -margin && pos.y <= 100 + margin;
}
