// Geometri for annoteringsflaten (mobil) — hvor bildet står og hvor stort det vises.
//
// Kenneth-funn 2026-10-21 (test-OTA 0975a04e): da tastaturet kom opp, ble WebView-en
// translatert OPP med hele tastaturhøyden, så bildet hoppet under statuslinja og
// overskriftslinja ble dekket. Vedtaket (ERSTATTER dy-translasjonen): bildet skal ha ÉN
// FAST plassering i alle verktøy — med og uten tastatur. Flaten beregnes ÉN gang ved at
// tastaturhøyden ALLTID reserveres; derfor er resultatet per konstruksjon identisk enten
// tastaturet er fremme eller ikke (funksjonen tar ingen «tastatur synlig»-tilstand).
//
// 🔴 Disse to funksjonene er den TESTBARE kilden. `BildeAnnotering.tsx` bruker dem direkte
// (RN-side, ikke i HTML-strengen), og HTML-ens bildeskalering (`settBilde`) bruker samme
// min-skala-formel som `annoteringsbildeFit` — endres formelen her, endres den der.

/**
 * Høyden (pt) på flaten der annoteringsbildet vises: fra underkanten av overskriftslinja
 * ned til der tastaturet (+ hjelpe-/tilbehørslinje) begynner. Tastaturhøyden reserveres
 * ALLTID, så flaten er uendret enten tastaturet er fremme eller ikke — bildet hopper aldri.
 *
 * Klemmes til 0 (aldri negativ) så en liten skjerm / stor header ikke gir ugyldig høyde.
 */
export function annoteringsflateHoyde(p: {
  /** Vinduets fulle høyde (useWindowDimensions().height). */
  vindusHoyde: number;
  /** Statuslinje/hakk øverst (safe-area top inset). */
  insetTop: number;
  /** Målt høyde på overskriftslinja (Avbryt / Annoter bilde / Ferdig). */
  headerHoyde: number;
  /** Reservert tastaturhøyde — kjent/først målt verdi, aldri «er tastaturet oppe nå». */
  tastaturHoyde: number;
  /** Hjelpe-/tilbehørslinja over tastaturet (QuickType o.l.). */
  hjelpelinjeHoyde: number;
}): number {
  const { vindusHoyde, insetTop, headerHoyde, tastaturHoyde, hjelpelinjeHoyde } = p;
  return Math.max(0, vindusHoyde - insetTop - headerHoyde - tastaturHoyde - hjelpelinjeHoyde);
}

/**
 * Skala og visningsstørrelse for et bilde som skal passe i flaten med sideforholdet
 * bevart og øvre kant forankret. Liggende bilde bindes av BREDDEN (fyller flatens bredde,
 * vertikal plass til overs), stående av HØYDEN. Koordinatene i bildet er uendret — dette
 * er kun en visnings-skala (transform), slik vedtaket krever.
 *
 * Returnerer skala 1 / rå størrelse hvis et mål er ≤ 0 (udefinert flate før layout).
 */
export function annoteringsbildeFit(
  bildeBredde: number,
  bildeHoyde: number,
  flateBredde: number,
  flateHoyde: number,
): { skala: number; visningsBredde: number; visningsHoyde: number; bundetAv: "bredde" | "hoyde" } {
  if (bildeBredde <= 0 || bildeHoyde <= 0 || flateBredde <= 0 || flateHoyde <= 0) {
    return { skala: 1, visningsBredde: bildeBredde, visningsHoyde: bildeHoyde, bundetAv: "bredde" };
  }
  const skalaBredde = flateBredde / bildeBredde;
  const skalaHoyde = flateHoyde / bildeHoyde;
  const skala = Math.min(skalaBredde, skalaHoyde);
  return {
    skala,
    visningsBredde: bildeBredde * skala,
    visningsHoyde: bildeHoyde * skala,
    bundetAv: skalaBredde <= skalaHoyde ? "bredde" : "hoyde",
  };
}
