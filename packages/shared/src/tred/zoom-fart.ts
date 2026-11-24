/**
 * Zoom-fart etter avstand til flaten midt på skjermen (3D, web + mobil).
 *
 * Vedtak Kenneth 2026-11-17 (`docs/claude/3d-agent-prinsipper.md` § 3b punkt 2): rask langt
 * unna, sakte nær, «som en hyperbelfunksjon». Brukeren skal kunne gå inn i bygget uten at
 * det forsvinner ut av bildet. Justert etter Kenneths test 2026-11-17 (§ 3c (ii)): zoom inne
 * i bygget var for treg, så nærhetsleddet er 1 m (var 5) og gulvet 5 cm (var 2).
 *
 * Kurven (meter pr. zoom-enhet; én enhet = ett hjulhakk på web, 16 px endret fingeravstand
 * ved pinch på mobil — camera-controls måler fra midtpunktet til finger 2,
 * `extractClientCoordFromEvent`):
 *
 *   steg(d) = maks( ZOOM_MIN_STEG_M,  ZOOM_STEG_ANDEL · d · d / (d + ZOOM_NAERHET_M) )
 *
 * Andelen av avstanden pr. enhet, steg/d = 0,05 · d / (d + 1), er en rettvinklet hyperbel i d:
 * den går mot 5 % langt unna (som camera-controls' standard 0,95^Δ) og faller først under
 * ~1 m. Gulvet på 5 cm gjør at man alltid kommer videre — også gjennom en vegg.
 *
 *   d (m):     200    50    20    10     5     2     1   0,5
 *   steg (m): 9,95  2,45  0,95  0,45  0,21  0,07  0,05  0,05
 *   før (m):  9,76  2,27  0,80  0,33  0,13  0,03  0,02  0,02   (nærhet 5 m, gulv 2 cm)
 */

export const ZOOM_STEG_ANDEL = 0.05;
export const ZOOM_NAERHET_M = 1;
export const ZOOM_MIN_STEG_M = 0.05;

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
