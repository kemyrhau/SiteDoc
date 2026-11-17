/**
 * Kamera som følger modellen i mobil-vieweren (M1–M3, § 3b).
 *
 * Innramming tar utgangspunkt i objektboksene uten objekter langt unna bygget (regelen
 * `finnUtliggere` bor i `@sitedoc/shared`). Orbit-punktet er flaten midt på skjermen
 * (`orbitAvstand`), og zoom-farten følger avstanden dit (`dollyFartForAvstand` i shared).
 */

import type { Boks3, Punkt3 } from "@sitedoc/shared/tred";

/** Robust boks og utligger-regelen bor i `@sitedoc/shared` (`finnUtliggere`), felles med web. */
export type Punkt = Punkt3;
export type Boks = Boks3;

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
 * Avstand langs siktelinja (fra kamera gjennom skjermmidten) til orbit-punktet (§ 3b punkt 1).
 * Treff i midten: treffavstanden, men aldri nærmere enn 1,5·minDistance (ellers hopper
 * kameraet bakover). Ingen treff: samme avstand som sist.
 */
export function orbitAvstand(treffAvstand: number | null, sisteAvstand: number, minDistance: number): number {
  const minst = minDistance * 1.5;
  if (treffAvstand != null && Number.isFinite(treffAvstand) && treffAvstand > 0) {
    return Math.max(treffAvstand, minst);
  }
  return Number.isFinite(sisteAvstand) && sisteAvstand > 0 ? Math.max(sisteAvstand, minst) : minst;
}
