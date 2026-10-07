// Ren gest-logikk for tegningszoom.
//
// To ting trukket ut av `tegninger/page.tsx` slik at de kan testes uten å bygge
// om komponenten:
//   1) klassifisering av et `wheel`-event (musehjul vs. styreflate-knip vs.
//      styreflate-scroll) — Kenneth spurte «er det mulig å oppdage om zoomhjul
//      eller touchpad benyttes?». Ja, via en heuristikk på `ctrlKey`/`deltaMode`/
//      `deltaX`/`deltaY`.
//   2) kontinuerlig knip-zoom forankret i pekeren, bygget på den eksisterende
//      `ønsketZoomScroll`-formelen (som IKKE endres).

import { ønsketZoomScroll } from "./zoom-scroll";

export type WheelGest = "knip" | "hjul" | "styreflate-scroll";

/** Felt fra et `WheelEvent` som klassifiseringen trenger (rene tall — testbart). */
export interface WheelHendelse {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
  /** `WheelEvent.deltaMode`: 0 = piksel, 1 = linje, 2 = side. */
  deltaMode: number;
}

/**
 * Over dette (piksler) regnes et rent vertikalt, helt pikseldelta som et
 * musehjul-hakk. Mindre/desimale/sidelengs delta er styreflate-scroll.
 */
export const HJUL_PIKSEL_TERSKEL = 40;

/** Følsomhet for knip-zoom: faktor = exp(-akkumulertDeltaY · k). */
export const KNIP_K = 0.01;

/**
 * Klassifiser et wheel-event.
 *
 * - `ctrlKey=true` ⇒ **knip** (styreflate-knip OG ctrl+hjul rapporteres slik av
 *   Chrome/Safari på Mac) → kontinuerlig zoom.
 * - `deltaMode ≠ 0` (linje/side) ⇒ **hjul** — tradisjonelt musehjul.
 * - pikselmodus: musehjulet gir store, hele, rene vertikale hakk; styreflate-
 *   scroll gir sidebevegelse og/eller små, ofte desimale delta i høy frekvens.
 *
 * Konservativ som standard: tvetydige, store, rene vertikale hakk tolkes som
 * **hjul** så musehjul-zoom ikke regresser til panorering.
 */
export function klassifiserWheel(e: WheelHendelse): WheelGest {
  if (e.ctrlKey) return "knip";
  if (e.deltaMode !== 0) return "hjul";
  const harSideBevegelse = Math.abs(e.deltaX) > 0;
  const rentVertikaltHakk =
    !harSideBevegelse &&
    Number.isInteger(e.deltaY) &&
    Math.abs(e.deltaY) >= HJUL_PIKSEL_TERSKEL;
  return rentVertikaltHakk ? "hjul" : "styreflate-scroll";
}

/** Forankring: pekerposisjon i viewporten + gjeldende scroll (piksler). */
export interface ZoomForankring {
  /** `clientX - rect.left`. */
  viewX: number;
  /** `clientY - rect.top`. */
  viewY: number;
  scrollLeft: number;
  scrollTop: number;
}

/**
 * Anvend en zoomfaktor og regn ut ønsket scroll som holder bildepunktet under
 * pekeren fast. Zoomen klippes til [min, maks]. Scrollen kan overstige dagens
 * maksimum — den skal settes ETTER at innholdet har fått ny bredde
 * (useLayoutEffect), ellers klipper nettleseren den.
 */
export function anvendZoomFaktor(
  forrigeZoom: number,
  faktor: number,
  grenser: { min: number; maks: number },
  f: ZoomForankring,
): { zoom: number; scroll: { left: number; top: number } } {
  const neste = Math.min(grenser.maks, Math.max(grenser.min, forrigeZoom * faktor));
  const skala = neste / forrigeZoom;
  const contentX = f.viewX + f.scrollLeft;
  const contentY = f.viewY + f.scrollTop;
  const scroll = ønsketZoomScroll({ contentX, contentY, viewX: f.viewX, viewY: f.viewY, skala });
  return { zoom: neste, scroll };
}

/** Kontinuerlig knip-faktor fra akkumulert deltaY (eksponentiell → sømløs). */
export function knipFaktor(akkumulertDeltaY: number): number {
  return Math.exp(-akkumulertDeltaY * KNIP_K);
}

/** Musehjul-trinn: dagens diskrete 0,8 / 1,25 (uendret). */
export function hjulFaktor(deltaY: number): number {
  return deltaY > 0 ? 0.8 : 1.25;
}
