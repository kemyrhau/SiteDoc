/**
 * Kamera-regler for 3D-vieweren (ren geometri, uten three.js — testbar).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Minste dybde (scene-enheter) før pan-target flyttes; matcher «2 enheter foran» for rotasjon. */
export const MIN_PAN_DYBDE = 2;

/**
 * W4 — orbit-target for pan (høyre/midtre museknapp).
 *
 * camera-controls panorerer med fart proporsjonal med avstanden kamera→target. Vieweren
 * legger target 2 enheter foran kamera for rotasjon rundt eget ståsted; da blir pan
 * nesten stillestående på en bygning sett på avstand. For pan legges target i stedet på
 * modellsenterets dybde langs blikkretningen (senteret projisert på blikklinja).
 *
 * Returnerer `null` når target skal beholdes: senteret ligger bak kamera eller nærmere
 * enn `MIN_PAN_DYBDE` langs blikket (f.eks. inne i bygget med ryggen mot senteret).
 *
 * @param retning enhetsvektor for blikkretningen
 */
export function panTargetPaaModellDybde(kamera: Vec3, retning: Vec3, modellSenter: Vec3): Vec3 | null {
  const dybde =
    (modellSenter.x - kamera.x) * retning.x +
    (modellSenter.y - kamera.y) * retning.y +
    (modellSenter.z - kamera.z) * retning.z;
  if (!(dybde > MIN_PAN_DYBDE)) return null;
  return {
    x: kamera.x + retning.x * dybde,
    y: kamera.y + retning.y * dybde,
    z: kamera.z + retning.z * dybde,
  };
}

/**
 * W6 — hjul-zoom flytter kamera og target langs blikkretningen (også loddrett).
 *
 * Før: `ctrl.forward()` i camera-controls flytter langs `camera.up × høyre`, altså
 * vannrett. Sett skrått ned på modellen gled den da ut av bildet nedover ved innzoom.
 *
 * @param retning enhetsvektor for blikkretningen
 * @param avstand positiv = fremover (inn), negativ = bakover (ut)
 */
export function flyttLangsBlikk(punkt: Vec3, retning: Vec3, avstand: number): Vec3 {
  return {
    x: punkt.x + retning.x * avstand,
    y: punkt.y + retning.y * avstand,
    z: punkt.z + retning.z * avstand,
  };
}

/** Steg pr. hjulhakk (scene-enheter pr. 100 deltaY) — samme som før W6. */
export const HJUL_STEG = 2.5;

/** Hjul-delta → avstand langs blikket; positiv = inn. */
export function hjulAvstand(deltaY: number): number {
  return (-deltaY / 100) * HJUL_STEG;
}

/**
 * Rotasjon rundt skjermmidten (Kenneth 2026-11-17).
 *
 * Orbit-punktet legges på blikklinja gjennom skjermmidten: på treffets avstand når
 * raycasten fra midten traff modellen, ellers på samme avstand som sist.
 * Punktet ligger alltid på blikklinja, så kameraet snur seg ikke når target settes.
 *
 * @param retning enhetsvektor for blikkretningen
 * @param treffAvstand avstand kamera→treffpunkt, eller `null` når midten ikke traff noe
 */
export function orbitPunkt(
  kamera: Vec3,
  retning: Vec3,
  treffAvstand: number | null,
  sisteAvstand: number,
): { punkt: Vec3; avstand: number } {
  const avstand = treffAvstand !== null && treffAvstand > 0 ? treffAvstand : sisteAvstand;
  return { punkt: flyttLangsBlikk(kamera, retning, avstand), avstand };
}
