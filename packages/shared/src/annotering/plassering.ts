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

// ── Tekstboks-geometri (Del 1, Kenneth 2026-10-22: IText → Textbox) ──────────────
//
// Kenneth-funn (bilde 10, BHO4): den gamle `fabric.IText` hadde ingen bredde og brøt
// aldri — teksten vokste rett forbi bildets høyre kant («linjeskift slutter ikke ved
// enden … fordi vinduet ikke starter ved kant»). Vedtaket er `fabric.Textbox` med en
// EKSPLISITT bredde satt ved opprettelse: fra trykkpunktet til bildets høyre kant minus
// en marg, så teksten bryter på bildet og aldri havner utenfor.
//
// 🔴 Disse funksjonene er den TESTBARE kilden. `annoterings-html.ts` inliner nøyaktig
// samme formler i `lagTekst`/`object:moving` (HTML-strengen kan ikke importere). Endres
// formelen her, endres den der.

/** Standard marg (canvas-piksler) mellom en tekstboks og bildekanten. */
export const TEKSTBOKS_MARG = 8;
/** Minste tekstboks-bredde (canvas-piksler) — en boks helt inntil høyre kant blir ikke smalere. */
export const TEKSTBOKS_MIN_BREDDE = 60;

/**
 * Standardbredden til en ny tekstboks: fra trykkpunktet (`trykkX`) til bildets høyre kant
 * minus `marg`, slik at `trykkX + bredde === canvasBredde - marg` i normaltilfellet og
 * teksten bryter akkurat innenfor kanten. Klemmes så den aldri blir smalere enn `minBredde`
 * og aldri bredere enn hele flaten tillater (`canvasBredde - 2·marg`) — et trykk helt ute
 * ved høyre kant gir en smal boks, ikke en negativ bredde.
 */
export function tekstboksStandardBredde(
  trykkX: number,
  canvasBredde: number,
  marg: number = TEKSTBOKS_MARG,
  minBredde: number = TEKSTBOKS_MIN_BREDDE,
): number {
  const fraTrykk = canvasBredde - trykkX - marg;
  const maksIFlate = Math.max(0, canvasBredde - 2 * marg);
  const onsket = Math.max(minBredde, fraTrykk);
  return Math.max(0, Math.min(onsket, maksIFlate));
}

/**
 * Klem en tekstboks' øvre venstre hjørne (`left`/`top`) slik at boksen aldri havner utenfor
 * bildet — Kenneths krav «teksten skal aldri havne utenfor bildet», både ved opprettelse,
 * ved dra (flytt) og etter bredde-endring. Størrelsen (`bredde`/`hoyde`) er den aktuelle
 * utflatede boksstørrelsen i canvas-piksler. Når boksen er bredere/høyere enn flaten mellom
 * margene, vinner øvre/venstre marg (boksen kan ikke få plass, men toppen forblir synlig).
 */
export function klemTekstboksPosisjon(p: {
  left: number;
  top: number;
  bredde: number;
  hoyde: number;
  canvasBredde: number;
  canvasHoyde: number;
  marg?: number;
}): { left: number; top: number } {
  const marg = p.marg ?? TEKSTBOKS_MARG;
  const maksLeft = p.canvasBredde - marg - p.bredde;
  const maksTop = p.canvasHoyde - marg - p.hoyde;
  return {
    left: Math.max(marg, Math.min(p.left, maksLeft)),
    top: Math.max(marg, Math.min(p.top, maksTop)),
  };
}

// ── Tap-vs-dra på en tekst (RETUR 5965e37b, Kenneth 2026-10-22) ───────────────────
//
// Regresjon fra Textbox-migreringen: en «avsluttet» tekst kunne ikke lenger treffes for
// redigering, og tap-til-rediger var dessuten bundet til Tekst-verktøyet. Kenneths krav
// (orkestrator-GO 2026-10-22): et TRYKK (bevegelse < TEKST_TAP_TERSKEL, som «Sett punkt»)
// på en tekst åpner den for redigering i ALLE verktøy; et DRA som starter på en tekst
// tegner fortsatt pil/sirkel/firkant/frihånd (ellers kan man ikke tegne fra en etikett).
// 'draw' og 'select' eies av Fabric (frihånd / flytt), så der rører vi ikke tapet.
//
// 🔴 TESTBAR KILDE. `annoterings-html.ts` inliner nøyaktig samme betingelse i mouse:up
// (HTML-strengen kan ikke importere). Endres regelen her, endres den der.

/** Terskel (canvas-piksler) for å skille et trykk fra et dra på en tekst. */
export const TEKST_TAP_TERSKEL = 10;

/** Er objekttypen en tekst-annotering — ny `Textbox` eller eldre `i-text`/`text`-lag? */
export function erTekstType(objType: string | null | undefined): boolean {
  return objType === "textbox" || objType === "i-text" || objType === "text";
}

/**
 * Skal et trykk/dra på et objekt åpne teksten for redigering? Sann bare når objektet er en
 * tekst, verktøyet ikke er Fabric-eid (`draw`/`select`) og bevegelsen er under tap-terskelen
 * (et dra skal i stedet tegne formen). `beveget` er true når flyttelengden ≥ TEKST_TAP_TERSKEL.
 */
export function skalTekstTapRedigere(p: {
  objType: string | null | undefined;
  aktivtVerktoy: string;
  beveget: boolean;
}): boolean {
  if (!erTekstType(p.objType)) return false;
  if (p.aktivtVerktoy === "draw" || p.aktivtVerktoy === "select") return false;
  if (p.beveget) return false;
  return true;
}

/**
 * Skal en tekst være Fabric-flyttbar (`selectable`) i et gitt verktøy? Tekst er ALLTID
 * `evented` (så tap-til-rediger ser treffet), men bare selectable i `select` (flytt) og
 * `text` (Del 1 «dra flytter»). I tegneverktøyene er den IKKE selectable, så et dra som
 * starter på en tekst tegner formen i stedet for at Fabric plukker opp teksten.
 */
export function tekstErSelectableIVerktoy(aktivtVerktoy: string): boolean {
  return aktivtVerktoy === "select" || aktivtVerktoy === "text";
}
