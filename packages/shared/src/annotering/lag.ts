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
