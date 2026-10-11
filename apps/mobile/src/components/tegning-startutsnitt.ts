/**
 * L4b: ramme for å åpne mobil-tegningsviseren ZOOMET på startutsnittet (brøk [0,1] av
 * viewBox = bygget), ikke fit-to-width på rutenettet.
 *
 * Dette er den TESTEDE referansen for math-en. Den KJØRER inne i WebView-en (som inlinet
 * JS i `byggHtml`/`anvendStartutsnitt`), så koden der SPEILER denne — samme mønster som
 * render.py speiler dxfTilSvg. Endres formelen her, endres den samme stedet i byggHtml.
 *
 * Speiler web-viseren (`tegninger/page.tsx`): zoom = 0,98/maks(w,h) klemt [1, 50];
 * container-bredden blir zoom×100 % (markører er %-baserte → følger med); scroll sentreres
 * på utsnittets midtpunkt.
 */
export interface Startutsnitt {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StartutsnittRamme {
  /** Zoom-faktor = container-bredde som andel (×100 % i CSS). */
  zoom: number;
  /** window.scrollTo-mål (px), klemt til ≥ 0. */
  left: number;
  top: number;
}

export const STARTUTSNITT_MIN_ZOOM = 1;
export const STARTUTSNITT_MAKS_ZOOM = 50;

/** zoom = 0,98/maks(w,h) klemt [1, 50]. */
export function startutsnittZoom(su: Startutsnitt): number {
  return Math.min(
    STARTUTSNITT_MAKS_ZOOM,
    Math.max(STARTUTSNITT_MIN_ZOOM, 0.98 / Math.max(su.w, su.h)),
  );
}

/**
 * @param cw,ch       viewport (px)
 * @param innerW,innerH container-størrelse etter at zoom er anvendt (px)
 */
export function startutsnittRamme(
  su: Startutsnitt,
  cw: number,
  ch: number,
  innerW: number,
  innerH: number,
): StartutsnittRamme {
  const zoom = startutsnittZoom(su);
  const left = Math.max(0, (su.x + su.w / 2) * innerW - cw / 2);
  const top = Math.max(0, (su.y + su.h / 2) * innerH - ch / 2);
  return { zoom, left, top };
}
