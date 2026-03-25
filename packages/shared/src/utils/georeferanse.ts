import type { GeoReferanse, GeoReferansePunkt } from "../types";

/**
 * Transformasjonsparametre for mapping mellom GPS og pixel-prosent.
 *
 * For 2 punkter: Lineær skalering (uavhengig x/y + cosLat).
 * For 3+ punkter: Full affine transformasjon (rotasjon, skalering, skjæring).
 *
 * GPS → Pixel:
 *   px = a * (lng * cosLat) + b * lat + c
 *   py = d * (lng * cosLat) + e * lat + f
 *
 * Pixel → GPS (invers):
 *   (lng * cosLat) = ia * px + ib * py + ic
 *   lat = id * px + ie * py + if
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

  // Bakoverkompatibilitet
  a: number;
  b: number;
  c: number;
  d: number;

  /** Affine parametre (satt ved 3+ punkter) */
  affine?: {
    // GPS → Pixel: px = a*gx + b*gy + c, py = d*gx + e*gy + f
    a: number; b: number; c: number;
    d: number; e: number; f: number;
    // Pixel → GPS (invers): gx = ia*px + ib*py + ic, gy = id*px + ie*py + if
    ia: number; ib: number; ic: number;
    id: number; ie: number; if_: number;
  };
}

/**
 * Samle alle referansepunkter fra GeoReferanse.
 */
function hentAllePunkter(ref: GeoReferanse): GeoReferansePunkt[] {
  const punkter = [ref.point1, ref.point2];
  if (ref.ekstraPunkter) {
    punkter.push(...ref.ekstraPunkter);
  }
  return punkter;
}

/**
 * Løs 3x3 lineært system Ax=b med Cramers regel.
 * Returnerer [x1, x2, x3] eller null hvis systemet er singulært.
 */
function løsSystem3x3(
  A: [[number, number, number], [number, number, number], [number, number, number]],
  b: [number, number, number],
): [number, number, number] | null {
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  if (Math.abs(det) < 1e-15) return null;

  const x1 =
    (b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (b[1] * A[2][2] - A[1][2] * b[2]) +
      A[0][2] * (b[1] * A[2][1] - A[1][1] * b[2])) / det;

  const x2 =
    (A[0][0] * (b[1] * A[2][2] - A[1][2] * b[2]) -
      b[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * b[2] - b[1] * A[2][0])) / det;

  const x3 =
    (A[0][0] * (A[1][1] * b[2] - b[1] * A[2][1]) -
      A[0][1] * (A[1][0] * b[2] - b[1] * A[2][0]) +
      b[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])) / det;

  return [x1, x2, x3];
}

/**
 * Beregn affine transformasjon fra 3+ referansepunkter med minste-kvadraters metode.
 *
 * For nøyaktig 3 punkter: eksakt løsning.
 * For 4+ punkter: best-fit (minste avvik) via normalligningene A^T*A*x = A^T*b.
 *
 * GPS → Pixel:
 *   px = a * gx + b * gy + c
 *   py = d * gx + e * gy + f
 *
 * Der gx = lng * cosLat, gy = lat.
 */
function beregnAffine(
  punkter: GeoReferansePunkt[],
  cosLat: number,
): NonNullable<Transformasjon["affine"]> {
  const n = punkter.length;

  // Sentrer koordinatene for numerisk stabilitet.
  // GPS-verdier (69.xxx, 6.xxx) har enorm absolutt verdi men minimal variasjon —
  // uten sentrering blir normalligningene nesten singulære.
  let meanGx = 0, meanGy = 0, meanPx = 0, meanPy = 0;
  for (const p of punkter) {
    meanGx += p.gps.lng * cosLat;
    meanGy += p.gps.lat;
    meanPx += p.pixel.x;
    meanPy += p.pixel.y;
  }
  meanGx /= n; meanGy /= n; meanPx /= n; meanPy /= n;

  // Bygg normalligninger med sentrerte koordinater
  let sumGx2 = 0, sumGy2 = 0, sumGxGy = 0;
  let sumGxPx = 0, sumGyPx = 0, sumPx = 0;
  let sumGxPy = 0, sumGyPy = 0, sumPy = 0;

  for (const p of punkter) {
    const gx = p.gps.lng * cosLat - meanGx;
    const gy = p.gps.lat - meanGy;
    const px = p.pixel.x - meanPx;
    const py = p.pixel.y - meanPy;

    sumGx2 += gx * gx;
    sumGy2 += gy * gy;
    sumGxGy += gx * gy;
    sumGxPx += gx * px;
    sumGyPx += gy * px;
    sumPx += px;
    sumGxPy += gx * py;
    sumGyPy += gy * py;
    sumPy += py;
  }

  // A^T * A matrise (symmetrisk) — nå med sentrerte verdier
  const ATA: [[number, number, number], [number, number, number], [number, number, number]] = [
    [sumGx2, sumGxGy, 0],
    [sumGxGy, sumGy2, 0],
    [0, 0, n],
  ];

  // Løs for px-retning: [a', b', c'] (sentrert)
  const bPx: [number, number, number] = [sumGxPx, sumGyPx, sumPx];
  const abcResult = løsSystem3x3(ATA, bPx);
  if (!abcResult) throw new Error("Kan ikke beregne affine transformasjon (singulær matrise)");
  const [aC, bC, _cC] = abcResult;

  // Løs for py-retning: [d', e', f'] (sentrert)
  const bPy: [number, number, number] = [sumGxPy, sumGyPy, sumPy];
  const defResult = løsSystem3x3(ATA, bPy);
  if (!defResult) throw new Error("Kan ikke beregne affine transformasjon (singulær matrise)");
  const [dC, eC, _fC] = defResult;

  // Konverter tilbake fra sentrerte til usentrerte koeffisienter:
  // px_sentrert = a' * gx_sentrert + b' * gy_sentrert + c'
  // px - meanPx = a' * (gx - meanGx) + b' * (gy - meanGy) + c'
  // px = a' * gx + b' * gy + (meanPx - a'*meanGx - b'*meanGy + c')
  const a = aC;
  const b = bC;
  const c = meanPx - aC * meanGx - bC * meanGy;
  const d = dC;
  const e = eC;
  const f = meanPy - dC * meanGx - eC * meanGy;

  // Beregn invers: Pixel → GPS
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-15) throw new Error("Affine transformasjon er singulær (kan ikke inverteres)");

  const ia = e / det;
  const ib = -b / det;
  const ic = (b * f - e * c) / det;
  const id = -d / det;
  const ie = a / det;
  const if_ = (d * c - a * f) / det;

  return { a, b, c, d, e, f, ia, ib, ic, id, ie, if_ };
}

/**
 * Beregn transformasjon fra referansepunkter.
 * - 2 punkter: Lineær skalering (bakoverkompatibel)
 * - 3+ punkter: Affine transformasjon (rotasjon + skalering + skjæring)
 */
export function beregnTransformasjon(ref: GeoReferanse): Transformasjon {
  const allePunkter = hentAllePunkter(ref);

  // Middelbreddegrad for cos-korreksjon
  const midLat = allePunkter.reduce((s, p) => s + p.gps.lat, 0) / allePunkter.length;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  // 3+ punkter → affine transformasjon
  if (allePunkter.length >= 3) {
    const affine = beregnAffine(allePunkter, cosLat);

    // Fyll ut bakoverkompatible felter med affine-verdier
    return {
      sx: affine.a,
      sy: affine.e,
      cx: affine.c,
      cy: affine.f,
      cosLat,
      a: affine.a,
      b: affine.b,
      c: affine.c,
      d: affine.d,
      affine,
    };
  }

  // 2 punkter → similaritetstransformasjon (skalering + rotasjon)
  //
  // Modell: px = a * gx + b * gy + tx
  //         py = -b * gx + a * gy + ty
  //
  // 2 punkter gir 4 ligninger, 4 ukjente (a, b, tx, ty).
  //
  // Fra punkt 1: px1 = a*gx1 + b*gy1 + tx,  py1 = -b*gx1 + a*gy1 + ty
  // Fra punkt 2: px2 = a*gx2 + b*gy2 + tx,  py2 = -b*gx2 + a*gy2 + ty
  //
  // Differanse: dpx = a*dGx + b*dGy,  dpy = -b*dGx + a*dGy
  //
  // Løs for a og b:
  //   a = (dpx*dGx + dpy*dGy) / (dGx² + dGy²)
  //   b = (dpx*dGy - dpy*dGx) / (dGx² + dGy²)

  const { point1, point2 } = ref;

  const gx1 = point1.gps.lng * cosLat;
  const gy1 = point1.gps.lat;
  const gx2 = point2.gps.lng * cosLat;
  const gy2 = point2.gps.lat;

  const px1 = point1.pixel.x;
  const py1 = point1.pixel.y;
  const px2 = point2.pixel.x;
  const py2 = point2.pixel.y;

  const dGx = gx2 - gx1;
  const dGy = gy2 - gy1;
  const denom = dGx * dGx + dGy * dGy;

  if (denom < 1e-20) {
    throw new Error("Referansepunktene har identiske GPS-koordinater");
  }

  const dpx = px2 - px1;
  const dpy = py2 - py1;

  const a = (dpx * dGx + dpy * dGy) / denom;
  const b = (dpx * dGy - dpy * dGx) / denom;
  const tx = px1 - a * gx1 - b * gy1;
  const ty = py1 + b * gx1 - a * gy1;

  // Invers: gx = ia*px + ib*py + ic, gy = id*px + ie*py + if_
  // Determinant for inversjon: a² + b²
  const det = a * a + b * b;
  if (Math.abs(det) < 1e-15) {
    throw new Error("Ugyldig transformasjon (degenerert)");
  }
  const ia = a / det;
  const ib = -b / det;  // NB: fortegn pga -b i py-linjen
  const ic = -(a * tx - b * ty) / det;
  const id_ = b / det;
  const ie = a / det;
  const if_ = -(b * tx + a * ty) / det;

  const affine = {
    a, b, c: tx,
    d: -b, e: a, f: ty,
    ia, ib, ic,
    id: id_, ie, if_,
  };

  return {
    sx: a, sy: a, cx: tx, cy: ty, cosLat,
    a, b, c: tx, d: ty,
    affine,
  };
}

/**
 * Transformer GPS-koordinater til tegningsposisjon (prosent 0-100).
 * Returnerer verdier clampet til 0-100.
 */
export function gpsTilTegning(
  gps: { lat: number; lng: number },
  transformasjon: Transformasjon,
): { x: number; y: number } {
  const { cosLat, affine } = transformasjon;
  const gx = gps.lng * cosLat;
  const gy = gps.lat;

  let x: number;
  let y: number;

  if (affine) {
    x = affine.a * gx + affine.b * gy + affine.c;
    y = affine.d * gx + affine.e * gy + affine.f;
  } else {
    const { sx, sy, cx, cy } = transformasjon;
    x = sx * gx + cx;
    y = sy * gy + cy;
  }

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

/**
 * Transformer tegningsposisjon (prosent) til GPS-koordinater.
 * Invertert transformasjon.
 */
export function tegningTilGps(
  pixel: { x: number; y: number },
  transformasjon: Transformasjon,
): { lat: number; lng: number } {
  const { cosLat, affine } = transformasjon;

  if (affine) {
    const gx = affine.ia * pixel.x + affine.ib * pixel.y + affine.ic;
    const gy = affine.id * pixel.x + affine.ie * pixel.y + affine.if_;
    return { lat: gy, lng: gx / cosLat };
  }

  const { sx, sy, cx, cy } = transformasjon;

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

/**
 * Beregn gjennomsnittlig feil (i meter) for en transformasjon mot referansepunktene.
 * Nyttig for å vise brukeren kvaliteten på kalibreringen.
 */
export function beregnKalibreringsFeil(ref: GeoReferanse): {
  gjennomsnittFeil: number;
  maksFeil: number;
  feilPerPunkt: number[];
} {
  const allePunkter = hentAllePunkter(ref);
  const transformasjon = beregnTransformasjon(ref);

  const feilPerPunkt: number[] = [];

  for (const punkt of allePunkter) {
    // Transformer pixel tilbake til GPS
    const beregnetGps = tegningTilGps(punkt.pixel, transformasjon);

    // Beregn avstand i meter (Haversine-tilnærming for korte avstander)
    const dLat = (beregnetGps.lat - punkt.gps.lat) * (Math.PI / 180);
    const dLng = (beregnetGps.lng - punkt.gps.lng) * (Math.PI / 180);
    const midLat = (beregnetGps.lat + punkt.gps.lat) / 2;
    const R = 6371000; // Jordradius i meter
    const dx = dLng * Math.cos(midLat * Math.PI / 180) * R;
    const dy = dLat * R;
    const avstand = Math.sqrt(dx * dx + dy * dy);
    feilPerPunkt.push(avstand);
  }

  const gjennomsnittFeil = feilPerPunkt.reduce((s, f) => s + f, 0) / feilPerPunkt.length;
  const maksFeil = Math.max(...feilPerPunkt);

  return { gjennomsnittFeil, maksFeil, feilPerPunkt };
}
