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
// 'select' eies av Fabric (flytt). 'draw' (frihånd) er med fra 2026-10-28 (velg alle
// objekter, punkt (c)): HTML-en fanger trykket og fjerner et ev. mikrostrøk.
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
 * tekst, verktøyet ikke er Fabric-eid (`select`) og bevegelsen er under tap-terskelen (et
 * dra skal i stedet tegne formen). `beveget` er true når flyttelengden ≥ TEKST_TAP_TERSKEL.
 * Frihånd (`draw`) er med: «uansett verktøy» (velg alle objekter, Kenneth 2026-10-28).
 */
export function skalTekstTapRedigere(p: {
  objType: string | null | undefined;
  aktivtVerktoy: string;
  beveget: boolean;
}): boolean {
  if (!erTekstType(p.objType)) return false;
  if (p.aktivtVerktoy === "select") return false;
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

// ── Velg alle objekter (Kenneth 2026-10-28: «samme regel for alle objekter») ─────────
//
// Trykk-regelen fra tekst (020d687c) gjelder nå sirkel, firkant, pil og frihånd også:
//   1. TRYKK (< TEKST_TAP_TERSKEL) på et objekt, i hvilket som helst verktøy → objektet
//      velges med håndtak (tekst: redigering som før).
//   2. DRA som starter på det VALGTE objektet → flytter det; dra i et HÅNDTAK → endrer det.
//   3. DRA som starter på et objekt som IKKE er valgt → tegner ny form som før.
//   4. TRYKK på tomt område → fjerner valget.
//
// Treff avgjøres mot formens egen STREK (ikke rammeboksen): et trykk midt i en stor sirkel
// skal ikke plukke den opp. Toleransen er 22 canvas-px til hver side (≈ 44 pt treffflate),
// samme tall som `targetFindTolerance` for tekst.
//
// 🔴 TESTBAR KILDE. `annoterings-html.ts` inliner `avstandTilForm`, `objektTrykkHandling`
// og `angreSisteHandling` (HTML-strengen kan ikke importere). Endres en formel her, endres
// den der.

/** Treff-toleranse (canvas-px) fra trykket til formens strek. ≈ 44 pt total treffflate. */
export const FORM_TREFF_TOLERANSE = 22;

export interface AnnoteringPunkt {
  x: number;
  y: number;
}

/**
 * Formens geometri i canvas-koordinater, utledet fra Fabric-objektet i HTML-en:
 * - `linje`: pil (fra halen til spissen)
 * - `ellipse`: sirkel (blir oval når bredde/høyde endres hver for seg)
 * - `rektangel`: firkant (og ukjente objekter via rammeboksen)
 * - `sti`: frihånd (punktene i stien)
 * `vinkel` (grader) er objektets rotasjon (bare mulig i web-«Flytt»).
 */
export type FormGeometri =
  | { type: "linje"; fra: AnnoteringPunkt; til: AnnoteringPunkt }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; vinkel?: number }
  | { type: "rektangel"; cx: number; cy: number; bredde: number; hoyde: number; vinkel?: number }
  | { type: "sti"; punkter: AnnoteringPunkt[] };

function avstand(a: AnnoteringPunkt, b: AnnoteringPunkt): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

/** Korteste avstand fra `p` til linjestykket `a`–`b`. */
export function avstandTilLinjestykke(p: AnnoteringPunkt, a: AnnoteringPunkt, b: AnnoteringPunkt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return avstand(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return avstand(p, { x: a.x + t * dx, y: a.y + t * dy });
}

// Punktet `p` uttrykt relativt til senteret, rotert tilbake (−vinkel) så formen er akse-rettet.
function lokaltPunkt(p: AnnoteringPunkt, cx: number, cy: number, vinkel: number | undefined): AnnoteringPunkt {
  const dx = p.x - cx;
  const dy = p.y - cy;
  if (!vinkel) return { x: dx, y: dy };
  const r = (-vinkel * Math.PI) / 180;
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}

/**
 * Avstand (canvas-px) fra trykkpunktet til formens STREK — ikke til rammeboksen. Et trykk
 * inne i en stor sirkel/firkant er langt fra streken og treffer derfor ikke.
 * - pil: avstand til linjestykket hale→spiss
 * - ellipse: radiell avstand til ellipsen (eksakt |d − r| for en sirkel)
 * - rektangel: avstand til nærmeste kant (innenfra og utenfra)
 * - sti: minste avstand til stiens linjestykker
 */
export function avstandTilForm(p: AnnoteringPunkt, g: FormGeometri): number {
  if (g.type === "linje") return avstandTilLinjestykke(p, g.fra, g.til);
  if (g.type === "sti") {
    const pk = g.punkter;
    if (pk.length === 0) return Infinity;
    if (pk.length === 1) return avstand(p, pk[0]!);
    let min = Infinity;
    for (let i = 1; i < pk.length; i++) {
      min = Math.min(min, avstandTilLinjestykke(p, pk[i - 1]!, pk[i]!));
    }
    return min;
  }
  if (g.type === "ellipse") {
    const q = lokaltPunkt(p, g.cx, g.cy, g.vinkel);
    const rx = Math.abs(g.rx);
    const ry = Math.abs(g.ry);
    // Degenerert (flat) ellipse = et linjestykke langs den andre aksen.
    if (rx === 0 || ry === 0) {
      return avstandTilLinjestykke(q, { x: -rx, y: -ry }, { x: rx, y: ry });
    }
    const d = Math.sqrt(q.x * q.x + q.y * q.y);
    if (d === 0) return Math.min(rx, ry);
    const k = Math.sqrt((q.x / rx) * (q.x / rx) + (q.y / ry) * (q.y / ry));
    return d * Math.abs(1 - 1 / k);
  }
  const q = lokaltPunkt(p, g.cx, g.cy, g.vinkel);
  const hx = Math.abs(g.bredde) / 2;
  const hy = Math.abs(g.hoyde) / 2;
  const ax = Math.abs(q.x);
  const ay = Math.abs(q.y);
  if (ax <= hx && ay <= hy) return Math.min(hx - ax, hy - ay);
  const ux = Math.max(ax - hx, 0);
  const uy = Math.max(ay - hy, 0);
  return Math.sqrt(ux * ux + uy * uy);
}

/** Treffer trykket formens strek innenfor toleransen? */
export function trefferForm(p: AnnoteringPunkt, g: FormGeometri, toleranse: number = FORM_TREFF_TOLERANSE): boolean {
  return avstandTilForm(p, g) <= toleranse;
}

/**
 * Hvilken form er en Fabric-gruppe, ut fra barnas typer? Formene bygges som
 * [hvit halo, rød strek] (sirkel/firkant) eller [hvit linje, hvitt hode, rød linje, rødt
 * hode] (pil), så det SISTE barnet avgjør. Gamle prod-grupper (`8c741180`) har samme
 * struktur — de gjenkjennes likt, med eller uten `strokeUniform`.
 */
export function formTypeFraBarn(barnTyper: readonly string[]): "pil" | "sirkel" | "firkant" | "ukjent" {
  const siste = barnTyper[barnTyper.length - 1];
  if (siste === "triangle") return "pil";
  if (siste === "circle") return "sirkel";
  if (siste === "rect") return "firkant";
  return "ukjent";
}

export type ObjektTrykkHandling =
  | "rediger-tekst"
  | "velg"
  | "flytt"
  | "endre"
  | "tegn"
  | "fjern-valg"
  | "ingen";

/**
 * Hva et trykk/dra på lerretet skal gjøre (regelen over). Avgjøres når gesten er ferdig
 * (`beveget` = største avstand fra nedtrykket ≥ TEKST_TAP_TERSKEL).
 * - `treffType`: hva gesten STARTET på, når det ikke var det valgte objektet
 *   (`"tekst"`, `"form"` eller `null` for tomt område).
 * - `traffValgt` / `traffHandtak`: gesten startet på det valgte objektet / i et håndtak —
 *   da eier Fabric draget (flytt / endre størrelse).
 * - `valgtType`: hva som var valgt da gesten startet.
 *
 * Unntak som bevarer eksisterende atferd: i Tekst-verktøyet lager et trykk på tomt område
 * ny tekst også mens en annen tekst er valgt (det er slik man skriver flere etiketter);
 * bare en valgt FORM fjernes. Et trykk på tomt i Frihånd uten valg gir en prikk som før.
 * `select` (web-«Flytt») eies helt av Fabric.
 */
export function objektTrykkHandling(p: {
  treffType: "tekst" | "form" | null;
  aktivtVerktoy: string;
  beveget: boolean;
  traffValgt: boolean;
  traffHandtak: boolean;
  valgtType: "tekst" | "form" | null;
}): ObjektTrykkHandling {
  if (p.aktivtVerktoy === "select") return "ingen";
  if (p.traffHandtak) return "endre";
  if (p.traffValgt) return p.beveget ? "flytt" : "ingen";
  if (p.beveget) return "tegn";
  if (p.treffType === "tekst") return "rediger-tekst";
  if (p.treffType === "form") return "velg";
  if (p.valgtType === "form") return "fjern-valg";
  if (p.valgtType === "tekst" && p.aktivtVerktoy !== "text") return "fjern-valg";
  if (p.aktivtVerktoy === "text" || p.aktivtVerktoy === "draw") return "tegn";
  return "ingen";
}

// ── Angre = siste HANDLING (punkt 6, Kenneth 2026-10-28) ──────────────────────────────
//
// Før: angre = `objekter.pop()` (bare opprettelse). Nå: en egen stakk ved siden av
// objektlista. `O` er objektet (Fabric-objekt i HTML-en), `S` en øyeblikkstilstand
// (posisjon/skala før en flytt/størrelse-endring).

export type AngreHandling<O, S> =
  | { type: "lagt-til"; obj: O }
  | { type: "endret"; obj: O; for: S }
  | { type: "erstattet"; gammel: O; ny: O };

export type AngreEffekt<O, S> =
  | { type: "fjern"; obj: O }
  | { type: "gjenopprett"; obj: O; tilstand: S }
  | { type: "bytt"; ut: O; inn: O };

/**
 * Angre siste handling. Handlinger på objekter som ikke lenger finnes (f.eks. en tom tekst
 * som ble ryddet bort) hoppes over. Er stakken tom, faller den tilbake til den gamle
 * oppførselen: fjern siste objekt (også objekter lastet inn fra et lagret lag).
 */
export function angreSisteHandling<O, S>(
  stakk: readonly AngreHandling<O, S>[],
  objekter: readonly O[],
): { stakk: AngreHandling<O, S>[]; objekter: O[]; effekt: AngreEffekt<O, S> | null } {
  const s = stakk.slice();
  const obj = objekter.slice();
  while (s.length > 0) {
    const h = s.pop()!;
    if (h.type === "lagt-til") {
      const i = obj.indexOf(h.obj);
      if (i < 0) continue;
      obj.splice(i, 1);
      return { stakk: s, objekter: obj, effekt: { type: "fjern", obj: h.obj } };
    }
    if (h.type === "endret") {
      if (obj.indexOf(h.obj) < 0) continue;
      return { stakk: s, objekter: obj, effekt: { type: "gjenopprett", obj: h.obj, tilstand: h.for } };
    }
    const i = obj.indexOf(h.ny);
    if (i < 0) continue;
    obj[i] = h.gammel;
    return { stakk: s, objekter: obj, effekt: { type: "bytt", ut: h.ny, inn: h.gammel } };
  }
  if (obj.length > 0) {
    const siste = obj.pop()!;
    return { stakk: s, objekter: obj, effekt: { type: "fjern", obj: siste } };
  }
  return { stakk: s, objekter: obj, effekt: null };
}
