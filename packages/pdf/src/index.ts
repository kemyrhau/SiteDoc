/**
 * @sitedoc/pdf — Delt PDF-generering for web og mobil.
 *
 * Null runtime-avhengigheter. Genererer komplett HTML som brukes av:
 * - Mobil: expo-print (Print.printToFileAsync({ html }))
 * - Web: CSS print / window.print() (felt-rendering + konstanter)
 */

// Typer
export type {
  RapportObjekt,
  TreObjekt,
  Vedlegg,
  FeltVerdi,
  VaerVerdi,
  SjekklisteForPdf,
  OppgaveForPdf,
  ProsjektForPdf,
  Utskriftsinnstillinger,
  PdfConfig,
} from "./typer";

// Konstanter
export {
  STATUS_TEKST,
  STATUS_FARGE,
  TRAFIKKLYS,
  PRIORITETS_TEKST,
} from "./konstanter";

// Hjelpefunksjoner
export {
  esc,
  normaliserOpsjon,
  formaterDato,
  formaterDatoTid,
  formaterDatoTidKort,
  formaterDatoKort,
  fullBildeUrl,
  formaterNummer,
} from "./hjelpere";

// CSS
export { hentCss } from "./css";

// Header-generatorer
export {
  byggSjekklisteHeader,
  byggOppgaveHeader,
  byggMetadataRutenett,
} from "./header";
export type {
  SjekklisteHeaderData,
  OppgaveHeaderData,
  MetadataRutenettData,
} from "./header";

// Felt-renderer
export { renderFelt, renderAllefelter } from "./felt";

// Tegningsposisjon
export { byggTegningPosisjon } from "./tegning";
export type { TegningPosisjonData } from "./tegning";

// Tegning via screenshot (alternativ uten koordinatberegning)
export { genererTegningMedScreenshot } from "./tegning-screenshot";
export type { TegningScreenshotData } from "./tegning-screenshot";

// Komplett HTML-generatorer
export { byggSjekklisteHtml } from "./sjekkliste";
export { byggOppgaveHtml } from "./oppgave";

// Sluttrapport (kontrollplan SAK10 §14-7)
export { genererSluttrapportHtml } from "./sluttrapport";
export type { SluttrapportData, SluttrapportPunkt } from "./sluttrapport";
