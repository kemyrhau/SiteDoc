/**
 * Zoom-fart etter avstand til flaten midt på skjermen (3D, web + mobil).
 *
 * Vedtak Kenneth 2026-11-17 (`docs/claude/3d-agent-prinsipper.md` § 3b punkt 2): rask langt
 * unna, sakte nær, «som en hyperbelfunksjon». Brukeren skal kunne gå inn i bygget uten at
 * det forsvinner ut av bildet.
 *
 * Kurven (meter pr. zoom-enhet; én enhet = ett hjulhakk på web, 8 px endret fingeravstand
 * ved pinch på mobil):
 *
 *   steg(d) = maks( ZOOM_MIN_STEG_M,  ZOOM_STEG_ANDEL · d · d / (d + ZOOM_NAERHET_M) )
 *
 * Andelen av avstanden pr. enhet, steg/d = 0,05 · d / (d + 5), er en rettvinklet hyperbel i d:
 * den går mot 5 % langt unna (som camera-controls' standard 0,95^Δ) og mot 0 nær flaten.
 * Gulvet på 2 cm gjør at man alltid kommer videre — også gjennom en vegg.
 *
 *   d (m):     200    50    20    10     5     2     1   0,5
 *   steg (m): 9,76  2,27  0,80  0,33  0,13  0,03  0,02  0,02
 *   før (m):  10,0  2,50  1,00  0,50  0,25  0,10  0,05  0,03   (5 % av d)
 */

export const ZOOM_STEG_ANDEL = 0.05;
export const ZOOM_NAERHET_M = 5;
export const ZOOM_MIN_STEG_M = 0.02;

/** Meter kameraet flyttes pr. zoom-enhet når flaten midt på skjermen er `avstand` meter unna. */
export function zoomSteg(avstand: number): number {
  if (!Number.isFinite(avstand) || avstand <= 0) return ZOOM_MIN_STEG_M;
  return Math.max(ZOOM_MIN_STEG_M, (ZOOM_STEG_ANDEL * avstand * avstand) / (avstand + ZOOM_NAERHET_M));
}

/**
 * `dollySpeed` for camera-controls som gir `zoomSteg(radius)` pr. dolly-enhet.
 * camera-controls flytter `radius · (1 − 0,95^fart)` pr. enhet (radius = avstand til
 * orbit-punktet). Steg større enn halve radiusen kappes til halve radiusen.
 */
export function dollyFartForAvstand(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 1;
  const andel = Math.min(zoomSteg(radius) / radius, 0.5);
  return Math.log(1 - andel) / Math.log(0.95);
}
