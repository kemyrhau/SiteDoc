// Annoteringslaget — delt kontrakt mellom web og mobil (og den delte HTML-en).
//
// Modellen (Kenneth-vedtak 2026-09-29) er TRE artefakter:
//   1. Originalfoto  — røres aldri (bevis). Bevares i vedleggets `originalUrl`.
//   2. Annotasjonslag — Fabric-objektene som DATA (dette formatet). Noen få kB.
//   3. Utflatet JPEG  — det som vises i lista/PDF/hos mottaker (vedleggets `url`).
//
// Åpnes en annotering på nytt, lastes original + lag → pilene er OBJEKTER som kan
// flyttes, ikke et flatt bilde som må tegnes på nytt.

/**
 * Fabric-versjonen den delte tegnemotoren (`ANNOTERINGS_HTML`) laster fra CDN.
 * 🔴 LAGRES MED HVERT LAG (`AnnoteringsLag.fabricVersion`): JSON-en er Fabrics eget
 * serialiseringsformat, og en framtidig oppgradering kan gjøre gamle lag uleselige.
 * Med versjonen lagret kan den som feilsøker om to år SE hvorfor, i stedet for å
 * gjette. Den utflatede JPEG-en består uansett — et ulesbart lag koster
 * redigerbarhet, aldri bildet. Verdien MÅ matche `<script src=...fabric.js/X/...>`
 * i `annoterings-html.ts` (én kilde) — dette er CDN-STIEN vi laster.
 *
 * ⚠️ Selve laget lagrer `fabric.version` (runtime-sannheten), IKKE denne konstanten.
 * Målt 2026-09-29: cdnjs' 5.3.1-bygg rapporterer intern `fabric.version === "5.3.0"`
 * (5.3.1 var en re-pakking uten versjonsbump). Runtime-verdien er riktig å lagre —
 * den forteller hvilken kode som faktisk serialiserte laget.
 */
export const FABRIC_VERSJON = "5.3.1";

/**
 * Annotasjonslaget som lagres sammen med vedlegget (i Checklist.data).
 *
 * `bredde`/`hoyde` er canvas-dimensjonene (display-piksler) DA laget ble laget.
 * De MÅ lagres: objektenes koordinater er i det koordinatsystemet, og et lag laget
 * på web (stor canvas) åpnet på mobil (liten canvas) må reskaleres mot dem. Uten
 * dem er reskaleringen gjetning.
 */
export interface AnnoteringsLag {
  /** Fabric-versjonen laget ble serialisert med (se FABRIC_VERSJON). */
  fabricVersion: string;
  /** Canvas-bredde (display-piksler) da laget ble laget. */
  bredde: number;
  /** Canvas-høyde (display-piksler) da laget ble laget. */
  hoyde: number;
  /** Fabric `toObject().objects` — pilene/sirklene/tekstene som data. */
  objekter: Record<string, unknown>[];
}

function somTall(v: unknown, standard: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : standard;
}

/**
 * Kalibrerings-canvas (mobil ~390px display-piksler) der strek/font ble kalibrert.
 * Strek og tekst skal vokse med canvas-bredden (mobil ~390px, web opptil ~1160px), men
 * IKKE lineært: lineær skalering ga proporsjonalt lik strek, og på en stor web-canvas
 * ble den for tykk (Kenneth så det på et stort bilde 2026-09-29). Derfor SUB-LINEÆR —
 * kvadratrot av bredde-forholdet: streken vokser saktere enn canvas.
 *   390px → 3,0px · 1163px → ~5,2px  (lineær ga ~9px)
 *
 * 🔴 TVILLING: `annoterings-html.ts` inliner nøyaktig disse tallene og formlene (HTML-strengen
 * kan ikke importere). Endres en verdi eller formelen her, skal den endres begge steder.
 * Denne kopien er den enhets-testbare — HTML-en er ikke.
 */
export const ANNOTERING_REFERANSE_BREDDE = 390;
/** Rød strekbredde på referanse-canvas. */
export const ANNOTERING_BASIS_STREK = 3;
/** Tekst-fontstørrelse på referanse-canvas. */
export const ANNOTERING_BASIS_FONT = 14;
/** Hvit kontrastkant per side som ANDEL av den røde streken (ikke fast tillegg). */
export const ANNOTERING_KONTRAST_FRAKSJON = 0.3;
/** Tekst-outline som ANDEL av fontstørrelsen. */
export const ANNOTERING_TEKST_KANT_FRAKSJON = 0.1;

/** Sub-lineær skala (kvadratrot) fra referanse-canvas til gjeldende canvas-bredde. */
export function annoteringSkala(canvasBredde: number): number {
  return canvasBredde > 0 ? Math.sqrt(canvasBredde / ANNOTERING_REFERANSE_BREDDE) : 1;
}

/** Rød strekbredde for en gitt canvas-bredde. */
export function skalertStrek(canvasBredde: number): number {
  return ANNOTERING_BASIS_STREK * annoteringSkala(canvasBredde);
}

/** Tekst-fontstørrelse for en gitt canvas-bredde. */
export function skalertFont(canvasBredde: number): number {
  return ANNOTERING_BASIS_FONT * annoteringSkala(canvasBredde);
}

/** Hvit kontrastkant per side for en form — andel av den røde streken, så halo og strek følges ad. */
export function skalertKontrast(canvasBredde: number): number {
  return skalertStrek(canvasBredde) * ANNOTERING_KONTRAST_FRAKSJON;
}

/** Hvit tekst-outline — andel av fontstørrelsen. */
export function skalertTekstKant(canvasBredde: number): number {
  return skalertFont(canvasBredde) * ANNOTERING_TEKST_KANT_FRAKSJON;
}

/** Rød merkefarge og hvit kontrastfarge — interpoleres inn i HTML-en (én kilde). */
export const ANNOTERING_STREK_FARGE = "#ef4444";
export const ANNOTERING_KONTRAST_FARGE = "#ffffff";

/**
 * Kontraststil for en form (pil/sirkel/firkant): den røde streken tegnes oppå en
 * bredere hvit «halo» som stikker én kontrastkant ut på hver side. Uten den forsvinner
 * rødt mot rød murvegg eller mørk asfalt (Kenneth-funn). `hvitStrek > rodStrek` er
 * invarianten som gjør kanten synlig; begge skalerer med canvas.
 *
 * 🔴 TVILLING: `annoterings-html.ts` bygger gruppen [hvit, rød] med nøyaktig disse
 * bredde-formlene inlinet (`s` og `s + 2 * k`). Denne er den testbare.
 */
export function formKontrastStil(canvasBredde: number): {
  rodStrek: number;
  hvitStrek: number;
} {
  const s = skalertStrek(canvasBredde);
  const k = skalertKontrast(canvasBredde);
  return { rodStrek: s, hvitStrek: s + 2 * k };
}

/**
 * Lag-beskrivelse for ÉN form: hvit og rød lag som skal være KONSENTRISKE. Feilen Kenneth
 * så (2026-09-29) var at to former plassert etter hjørnet (`left = cx - radius`) med ulik
 * strokeWidth ble forskjøvet med halve strekdifferansen — i Fabric er left/top hjørnet av
 * omslutningsboksen INKLUDERT strek. Løsning: begge lag posisjoneres etter SENTER
 * (`originX/originY: "center"` med senterkoordinatene), så de er konsentriske uansett
 * strekbredde. Denne funksjonen holder invarianten (samme senter for begge) testbar.
 *
 * 🔴 TVILLING: `annoterings-html.ts` `byggSirkel`/`byggFirkant` bygger de samme to lagene
 * med senter-origo. Endres origo-strategien her, endres den der.
 */
export function formLagBeskrivelse(
  canvasBredde: number,
  senterX: number,
  senterY: number,
): {
  hvit: { originX: "center"; originY: "center"; left: number; top: number; stroke: string; strokeWidth: number };
  rod: { originX: "center"; originY: "center"; left: number; top: number; stroke: string; strokeWidth: number };
} {
  const { rodStrek, hvitStrek } = formKontrastStil(canvasBredde);
  const felles = { originX: "center" as const, originY: "center" as const, left: senterX, top: senterY };
  return {
    hvit: { ...felles, stroke: ANNOTERING_KONTRAST_FARGE, strokeWidth: hvitStrek },
    rod: { ...felles, stroke: ANNOTERING_STREK_FARGE, strokeWidth: rodStrek },
  };
}

/**
 * Kontraststil for tekst: hvit outline malt FØRST (`paintFirst: "stroke"`) så den røde
 * fyllfargen legger seg oppå — samme kontrastprinsipp som formene. Font og kant skalerer
 * med canvas. 🔴 TVILLING inlinet i `annoterings-html.ts` (`lagTekst` — IText direkte på canvas).
 */
export function tekstKontrastStil(canvasBredde: number): {
  fontSize: number;
  hvitKant: number;
  paintFirst: "stroke";
} {
  return {
    fontSize: skalertFont(canvasBredde),
    hvitKant: skalertTekstKant(canvasBredde),
    paintFirst: "stroke",
  };
}

/**
 * Reskaler ETT serialisert Fabric-objekt fra sitt lagrede koordinatsystem til
 * gjeldende canvas — gang posisjon og skala med forholdet mellom ny og lagret
 * canvas-bredde. Type-agnostisk: `left`/`top`/`scaleX`/`scaleY` dekker posisjon og
 * størrelse for ALLE Fabric-objekttyper (gruppe/pil, sirkel, firkant, frihånd, tekst),
 * så vi slipper per-type-logikk.
 *
 * 🔴 TVILLING: identisk formel er inlinet i `annoterings-html.ts` (`settBilde` med
 * lag). HTML-strengen kan ikke importere denne funksjonen; endres formelen her, skal
 * den endres begge steder. Denne kopien er den testbare — HTML-en er ikke enhets-testbar.
 */
export function reskalerLagObjekt(
  obj: Record<string, unknown>,
  ratio: number,
): Record<string, unknown> {
  return {
    ...obj,
    left: somTall(obj.left, 0) * ratio,
    top: somTall(obj.top, 0) * ratio,
    scaleX: somTall(obj.scaleX, 1) * ratio,
    scaleY: somTall(obj.scaleY, 1) * ratio,
  };
}
