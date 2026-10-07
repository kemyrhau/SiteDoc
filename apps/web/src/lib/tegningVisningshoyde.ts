// Gir tegnings-visningens scroll-container en DEFINIT høyde, målt fra containerens
// egen topp til bunnen av vinduet. Trukket ut av `tegninger/page.tsx` slik at den
// kan testes mot målte rektangler uten å mounte hele siden.
//
// HVORFOR dette trengs: den delte dashbord-layouten (`<main>`) er `display:block`,
// så `flex-1` nedover kjeden er inert og ingen definit høyde når frem til
// tegnings-containeren. Uten en definit høyde (a) scroller hele siden i stedet for
// tegningen — verktøylinja forsvinner oppover — og (b) får ikke scroll-containeren
// vertikal overflyt, så musehjul-zoomens `scrollTop`-korreksjon blir en no-op og
// zoomen låser seg til toppkanten. Den delte `<main>` kan ikke gjøres om til flex
// uten å klippe de prosjektsidene som er avhengige av at den scroller, så høyden
// måles her, scoped til tegningssiden.

/**
 * Tilgjengelig høyde fra et punkt `top` (viewport-relativ) til bunnen av et
 * vindu med høyden `innerHeight`. Aldri negativ.
 */
export function tilgjengeligHøyde(top: number, innerHeight: number): number {
  return Math.max(0, innerHeight - top);
}

/**
 * Setter en definit høyde på visnings-containeren = fra dens egen topp til bunnen
 * av vinduet, og overstyrer `flex-1` (ellers ville flex-algoritmen i en
 * innhold-dimensjonert kolonne ignorert den eksplisitte høyden). Returnerer høyden
 * som ble satt. Idempotent: samme input gir samme resultat uten sideeffekt utover
 * `style`-feltene.
 */
export function settVisningshøyde(el: HTMLElement, innerHeight: number): number {
  const top = el.getBoundingClientRect().top;
  const høyde = tilgjengeligHøyde(top, innerHeight);
  el.style.flex = "none";
  el.style.height = `${høyde}px`;
  return høyde;
}
