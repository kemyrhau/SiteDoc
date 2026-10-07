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
 * Gjør visnings-containeren til et korrekt zoom-viewport:
 *
 * 1. **Definit høyde** = fra containerens egen topp til bunnen av vinduet, og
 *    overstyrer `flex-1` (ellers ville flex-algoritmen i en innhold-dimensjonert
 *    kolonne ignorert den eksplisitte høyden).
 * 2. **`scrollbar-gutter: stable`** — reserverer plassen til det vertikale
 *    rullefeltet PERMANENT. Uten dette dukker rullefeltet opp først når innholdet
 *    vokser forbi feltet (fit→overflyt-overgangen ved første zoomtrinn fra en
 *    tegning som får plass), og reserverer da ~15 px på høyre side. Innholdsbredden
 *    krymper midt i zoomen → bildet (bredde-styrt, sideforhold-låst) skaleres med
 *    en litt annen faktor enn `nesteZoom/forrigeZoom` → punktet under pekeren
 *    driver («hopper litt opp»). Målt i nettleser: drift 29 → 3 px med denne på.
 *    På systemer med overlay-rullefelt (reserverer ingenting) er den en no-op.
 *
 * Returnerer høyden som ble satt. Idempotent: samme input gir samme resultat uten
 * sideeffekt utover `style`-feltene.
 */
export function settVisningshøyde(el: HTMLElement, innerHeight: number): number {
  const top = el.getBoundingClientRect().top;
  const høyde = tilgjengeligHøyde(top, innerHeight);
  el.style.flex = "none";
  el.style.height = `${høyde}px`;
  el.style.scrollbarGutter = "stable";
  return høyde;
}
