import type { GeoReferanse } from "../types";

/**
 * Transformasjonsparametre for similaritetstransformasjon (2D).
 * Mapping: pixel (prosent) ↔ GPS (lat/lng)
 *
 * GPS → Pixel:
 *   x = a * lng + b * lat + c
 *   y = -b * lng + a * lat + d
 *
 * Pixel → GPS:
 *   Invertert transformasjon
 */
export interface Transformasjon {
  a: number;
  b: number;
  c: number;
  d: number;
  /** cos(middelbreddegrad) — kompenserer for at 1° lng ≠ 1° lat */
  cosLat: number;
}

/**
 * Beregn similaritetstransformasjon fra 2 referansepunkter.
 * Bruker skalering + rotasjon + translasjon (4 ukjente, 4 ligninger).
 *
 * GPS-koordinater normaliseres til lokalt kartesisk system før beregning:
 * longitude skaleres med cos(middelbreddegrad) for å kompensere for at
 * 1° lng er mye kortere enn 1° lat ved høye breddegrader (f.eks. Tromsø).
 */
export function beregnTransformasjon(ref: GeoReferanse): Transformasjon {
  const { point1, point2 } = ref;

  // Middelbreddegrad for cos-korreksjon
  const midLat = (point1.gps.lat + point2.gps.lat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  // Kilde: GPS-koordinater normalisert til lokalt kartesisk system
  const x1 = point1.gps.lng * cosLat;
  const y1 = point1.gps.lat;
  const x2 = point2.gps.lng * cosLat;
  const y2 = point2.gps.lat;

  // Mål: pixel-koordinater (prosent)
  const px1 = point1.pixel.x;
  const py1 = point1.pixel.y;
  const px2 = point2.pixel.x;
  const py2 = point2.pixel.y;

  // Differanser i normalisert GPS-rom
  const dX = x2 - x1;
  const dY = y2 - y1;
  const dPx = px2 - px1;
  const dPy = py2 - py1;

  // Løs for a og b:
  // dPx = a * dX + b * dY
  // dPy = -b * dX + a * dY
  const denom = dX * dX + dY * dY;
  if (denom === 0) {
    throw new Error("Referansepunktene har identiske GPS-koordinater");
  }

  const a = (dPx * dX + dPy * dY) / denom;
  const b = (dPx * dY - dPy * dX) / denom;

  // Løs for c og d fra punkt 1:
  const c = px1 - a * x1 - b * y1;
  const d = py1 + b * x1 - a * y1;

  // Lagre cosLat i transformasjonen for bruk i gpsTilTegning/tegningTilGps
  return { a, b, c, d, cosLat } as Transformasjon;
}

/**
 * Transformer GPS-koordinater til tegningsposisjon (prosent 0-100).
 * Returnerer verdier clampet til 0-100.
 */
export function gpsTilTegning(
  gps: { lat: number; lng: number },
  transformasjon: Transformasjon,
): { x: number; y: number } {
  const { a, b, c, d, cosLat } = transformasjon;

  // Normaliser longitude med cos(lat)-korreksjon
  const gx = gps.lng * cosLat;
  const gy = gps.lat;

  const x = a * gx + b * gy + c;
  const y = -b * gx + a * gy + d;

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

/**
 * Transformer tegningsposisjon (prosent) til GPS-koordinater.
 * Invertert similaritetstransformasjon.
 */
export function tegningTilGps(
  pixel: { x: number; y: number },
  transformasjon: Transformasjon,
): { lat: number; lng: number } {
  const { a, b, c, d, cosLat } = transformasjon;

  // Invertert transformasjon → normalisert GPS-rom
  const xShift = pixel.x - c;
  const yShift = pixel.y - d;

  const denom = a * a + b * b;
  if (denom === 0) {
    throw new Error("Ugyldig transformasjon (a og b er begge 0)");
  }

  const gx = (a * xShift - b * yShift) / denom;
  const gy = (b * xShift + a * yShift) / denom;

  // Denormaliser longitude
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
