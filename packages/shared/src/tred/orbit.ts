/**
 * Orbit-punktet holdes innenfor bygget (3D, web + mobil).
 *
 * Vedtak Kenneth 2026-11-17 (`docs/claude/3d-agent-prinsipper.md` § 3c (iv)). Rotasjon skjer
 * rundt flaten midt på skjermen (§ 3b punkt 1). Inne i bygget kan blikklinja gå ut gjennom en
 * åpning og treffe noe utenfor, og ved bom ble forrige avstand brukt, som kan være like lang
 * som hele modellen. Begge deler la punktet utenfor bygget (målt i ORDRE 3D-web 6).
 *
 * Regel, når kameraet står inne i byggets boks (robust, uten objekter langt unna):
 * - treff innenfor boksen godtas;
 * - treff utenfor boksen, og bom (forrige avstand), kortes til der blikklinja forlater boksen.
 * Kameraet utenfor boksen (eller ingen boks): treffet, ellers forrige avstand — som før.
 */
import type { Boks3, Punkt3 } from "./utliggere";
import { ZOOM_MIN_STEG_M } from "./zoom-fart";

/**
 * Avstand langs blikklinja fra `kamera` til der linja forlater `boks`, eller `null` når
 * kameraet ikke står inne i boksen (eller boksen/retningen er ugyldig).
 */
export function avstandUtAvBoks(kamera: Punkt3, retning: Punkt3, boks: Boks3): number | null {
  const lengde = Math.hypot(retning.x, retning.y, retning.z);
  if (!Number.isFinite(lengde) || lengde === 0) return null;
  let ut = Infinity;
  for (const akse of ["x", "y", "z"] as const) {
    const p = kamera[akse];
    const lo = boks.min[akse];
    const hi = boks.max[akse];
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null;
    if (p < lo || p > hi) return null;
    const r = retning[akse] / lengde;
    if (r > 0) ut = Math.min(ut, (hi - p) / r);
    else if (r < 0) ut = Math.min(ut, (lo - p) / r);
  }
  return Number.isFinite(ut) ? ut : null;
}

/**
 * Orbit-avstanden langs blikklinja (kamera → orbit-punkt).
 *
 * @param kamera kameraposisjon
 * @param retning blikkretning (normaliseres her)
 * @param treffAvstand avstand til treffet fra skjermmidten, eller `null` ved bom
 * @param sisteAvstand forrige orbit-avstand (brukes ved bom)
 * @param bygg byggets boks uten objekter langt unna, eller `null` når den ikke er kjent
 */
export function orbitAvstandIBygg(
  kamera: Punkt3,
  retning: Punkt3,
  treffAvstand: number | null,
  sisteAvstand: number,
  bygg: Boks3 | null,
): number {
  const harTreff = treffAvstand !== null && Number.isFinite(treffAvstand) && treffAvstand > 0;
  const grunn = harTreff ? treffAvstand : sisteAvstand;
  if (!bygg) return grunn;
  const ut = avstandUtAvBoks(kamera, retning, bygg);
  if (ut === null) return grunn;
  // Kameraet inne i bygget: aldri lenger enn til byggets vegg i blikkretningen
  return Math.max(Math.min(grunn, ut), ZOOM_MIN_STEG_M);
}
