// Ren zoom-matematikk for tegningsvisningen.
// Beregner scroll-posisjonen som holder innholdspunktet under musepekeren fast
// når zoom endres. Formelen er identisk med den som lå inline i
// `tegninger/page.tsx` (musehjul-zoom) — trukket ut slik at den kan testes uten
// å bygge om komponenten. Matematikken skal IKKE endres.

export interface ZoomScrollInput {
  /** Museposisjon i innholdet: `clientX - rect.left + scrollLeft` (før zoom). */
  contentX: number;
  /** Museposisjon i innholdet: `clientY - rect.top + scrollTop` (før zoom). */
  contentY: number;
  /** Museposisjon i viewporten: `clientX - rect.left`. */
  viewX: number;
  /** Museposisjon i viewporten: `clientY - rect.top`. */
  viewY: number;
  /** Skaleringsfaktor: `nesteZoom / forrigeZoom`. */
  skala: number;
}

/**
 * Ønsket scroll etter zoom, slik at punktet under musen ligger fast.
 * Verdien kan overstige gjeldende `scrollWidth/Height - clientWidth/Height`;
 * den skal derfor settes ETTER at innholdet har fått sin nye størrelse
 * (useLayoutEffect), ellers klipper nettleseren den til gammelt maksimum.
 */
export function ønsketZoomScroll({
  contentX,
  contentY,
  viewX,
  viewY,
  skala,
}: ZoomScrollInput): { left: number; top: number } {
  return {
    left: contentX * skala - viewX,
    top: contentY * skala - viewY,
  };
}
