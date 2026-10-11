import { beregnStartutsnittZoom } from "@sitedoc/shared";

/**
 * L4b: ramme for å åpne mobil-tegningsviseren ZOOMET på startutsnittet (brøk [0,1] av
 * viewBox = bygget), ikke fit-to-width på rutenettet.
 *
 * Dette er den TESTEDE referansen for math-en. Den KJØRER inne i WebView-en (som inlinet
 * JS i `byggHtml`/`anvendStartutsnitt`), så koden der SPEILER denne — samme mønster som
 * render.py speiler dxfTilSvg. Endres formelen her, endres den samme stedet i byggHtml.
 *
 * Zoomen deles med web-viseren via `beregnStartutsnittZoom` (`@sitedoc/shared`): den får
 * HELE utsnittet inn i BEGGE akser (bredde + høyde), klemt [1, 50]. Tidligere regnet begge
 * visere kun bredden (`0,98/maks(w,h)`) og antok kvadratisk innerflate, så en stående
 * tegning sprengte høyden. Container-bredden blir zoom×100 % (markører er %-baserte →
 * følger med); scroll sentreres på utsnittets midtpunkt.
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

/**
 * Zoom som får utsnittet inn i begge akser, klemt [1, 50].
 * @param cw,ch   viewport (px)
 * @param forhold innerflatens `innerH/innerW` (bildets høyde/bredde). `null` → kun bredde.
 */
export function startutsnittZoom(
  su: Startutsnitt,
  cw: number,
  ch: number,
  forhold: number | null,
): number {
  return beregnStartutsnittZoom({
    bredde: su.w,
    høyde: su.h,
    cw,
    ch,
    forhold,
    minZoom: STARTUTSNITT_MIN_ZOOM,
    maksZoom: STARTUTSNITT_MAKS_ZOOM,
  });
}

/**
 * Zoom + scroll som sentrerer utsnittets midtpunkt i viewporten.
 * Innerflaten etter zoom er `innerW = cw·zoom`, `innerH = innerW·forhold`.
 * @param cw,ch   viewport (px)
 * @param forhold innerflatens `innerH/innerW`. `null` → kvadratisk fallback (innerH=innerW).
 */
export function startutsnittRamme(
  su: Startutsnitt,
  cw: number,
  ch: number,
  forhold: number | null,
): StartutsnittRamme {
  const zoom = startutsnittZoom(su, cw, ch, forhold);
  const innerW = cw * zoom;
  const innerH = forhold ? innerW * forhold : innerW;
  const left = Math.max(0, (su.x + su.w / 2) * innerW - cw / 2);
  const top = Math.max(0, (su.y + su.h / 2) * innerH - ch / 2);
  return { zoom, left, top };
}
