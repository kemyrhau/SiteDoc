/**
 * Kamera som følger modellen i mobil-vieweren (M1–M3).
 *
 * Før: innramming, orbit-target, near/far tok utgangspunkt i samlet bounding box over
 * alle objekter. Ett objekt langt unna (markør i origo, terrengbit, feilplassert element)
 * blåser opp boksen: modellen blir liten og forskjøvet ved åpning, og rotasjon, pan og
 * zoom regnes mot et punkt i tomrommet. Her beregnes en robust boks som ser bort fra
 * slike utliggere, og kameraverdier skalert til den.
 */

export type Punkt = { x: number; y: number; z: number };
export type Boks = { min: Punkt; max: Punkt };

const AKSER = ["x", "y", "z"] as const;

/** Under dette antallet objekter er det for få til å skille utliggere — bruk hele boksen. */
export const MIN_OBJEKTER_FOR_ROBUST = 10;

function gyldig(b: Boks): boolean {
  return AKSER.every(
    (a) => Number.isFinite(b.min[a]) && Number.isFinite(b.max[a]) && b.min[a] <= b.max[a],
  );
}

function persentil(sortert: number[], p: number): number {
  const i = (sortert.length - 1) * p;
  const lav = Math.floor(i);
  const høy = Math.ceil(i);
  return sortert[lav]! + (sortert[høy]! - sortert[lav]!) * (i - lav);
}

function union(bokser: Boks[]): Boks {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of bokser) {
    for (const a of AKSER) {
      if (b.min[a] < min[a]) min[a] = b.min[a];
      if (b.max[a] > max[a]) max[a] = b.max[a];
    }
  }
  return { min, max };
}

export type RobustResultat = { boks: Boks; antall: number; utliggere: number };

/**
 * Robust boks over objektboksene. Et objekt er utligger når senteret ligger utenfor
 * [P1 − margin, P99 + margin] på en akse. Margin = max(halve P1–P99-spennet på aksen,
 * en firedel av største spenn på tvers av aksene), så flate modeller beholder taket og
 * lange bygg beholder endene. Boksen er union av hele objektboksene som beholdes.
 */
export function robustBoks(bokser: Boks[]): RobustResultat | null {
  const gyldige = bokser.filter(gyldig);
  if (gyldige.length === 0) return null;
  if (gyldige.length < MIN_OBJEKTER_FOR_ROBUST) {
    return { boks: union(gyldige), antall: gyldige.length, utliggere: 0 };
  }

  const sentre = gyldige.map((b) => ({
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  }));
  const grenser = AKSER.map((a) => {
    const s = sentre.map((c) => c[a]).sort((p, q) => p - q);
    return { a, lav: persentil(s, 0.01), høy: persentil(s, 0.99) };
  });
  const størsteSpenn = Math.max(...grenser.map((g) => g.høy - g.lav));
  const intervall = grenser.map((g) => {
    const margin = Math.max((g.høy - g.lav) / 2, størsteSpenn / 4);
    return { a: g.a, fra: g.lav - margin, til: g.høy + margin };
  });

  const beholdt = gyldige.filter((_, i) =>
    intervall.every(({ a, fra, til }) => sentre[i]![a] >= fra && sentre[i]![a] <= til),
  );
  if (beholdt.length === 0) {
    return { boks: union(gyldige), antall: gyldige.length, utliggere: 0 };
  }
  return { boks: union(beholdt), antall: gyldige.length, utliggere: gyldige.length - beholdt.length };
}

export type Innramming = {
  target: Punkt;
  posisjon: Punkt;
  avstand: number;
  near: number;
  far: number;
  minDistance: number;
};

/** Samme skrå blikkretning som før (fra +x, +y, +z mot sentrum). */
const RETNING = (() => {
  const l = Math.sqrt(1 + 0.7 * 0.7 + 1);
  return { x: 1 / l, y: 0.7 / l, z: 1 / l };
})();

/**
 * Ramme inn boksen slik at hele omsluttende kule får plass i den smaleste synsvinkelen
 * (stående telefon: horisontal). near/far har samme forhold til modellstørrelsen som
 * z-fighting-fiksen 4a356784 (near = maks·0,001, far = maks·20). minDistance skaleres
 * med near i stedet for fast 6 m, så man kan komme helt inntil en vegg uten at target
 * skyves gjennom den.
 */
export function beregnInnramming(boks: Boks, vfovGrader: number, aspect: number): Innramming {
  const target = {
    x: (boks.min.x + boks.max.x) / 2,
    y: (boks.min.y + boks.max.y) / 2,
    z: (boks.min.z + boks.max.z) / 2,
  };
  const dx = boks.max.x - boks.min.x;
  const dy = boks.max.y - boks.min.y;
  const dz = boks.max.z - boks.min.z;
  const maks = Math.max(dx, dy, dz, 0.01);
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 0.005);

  const vfov = (vfovGrader * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const fov = Math.min(vfov, hfov);
  const avstand = radius / Math.sin(fov / 2);

  const near = maks * 0.001;
  const far = Math.max(maks * 20, (avstand + radius) * 2);
  const minDistance = Math.max(near * 5, 0.05);

  return {
    target,
    posisjon: {
      x: target.x + RETNING.x * avstand,
      y: target.y + RETNING.y * avstand,
      z: target.z + RETNING.z * avstand,
    },
    avstand,
    near,
    far,
    minDistance,
  };
}

/**
 * Skal treffpunktet under fingrene bli nytt orbit-punkt? Nei når det ligger nærmere enn
 * minDistance (da ville kameraet hoppe bakover) eller ikke er et tall.
 */
export function brukSomOrbitPunkt(kamera: Punkt, treff: Punkt, minDistance: number): boolean {
  const d = Math.hypot(treff.x - kamera.x, treff.y - kamera.y, treff.z - kamera.z);
  return Number.isFinite(d) && d > minDistance * 1.5;
}

/** Skjermpunktet gesten handler om: én finger = fingeren, flere = midtpunktet. */
export function gestPunkt(pekere: { x: number; y: number }[]): { x: number; y: number } | null {
  if (pekere.length === 0) return null;
  const sum = pekere.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pekere.length, y: sum.y / pekere.length };
}
