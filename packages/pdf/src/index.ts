/**
 * @sitedoc/pdf — Delt PDF-generering for web og mobil.
 *
 * Null runtime-avhengigheter. Genererer komplett HTML som brukes av:
 * - Mobil: expo-print (Print.printToFileAsync({ html }))
 * - Web: CSS print / window.print() (felt-rendering + konstanter)
 */

// Typer
export { normaliserRad } from "./typer";
export type {
  RapportObjekt,
  TreObjekt,
  Vedlegg,
  FeltVerdi,
  Rad,
  VaerVerdi,
  SjekklisteForPdf,
  OppgaveForPdf,
  ProsjektForPdf,
  Utskriftsinnstillinger,
  PdfConfig,
  TegningsOppslagOppf,
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
  kanonisk,
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
  prosjektReferanseForUtskrift,
} from "./header";
export type {
  SjekklisteHeaderData,
  OppgaveHeaderData,
  MetadataRutenettData,
} from "./header";

// Felt-renderer
export { renderFelt, renderAllefelter } from "./felt";

// Tegningsposisjon
export { byggTegningPosisjon, byggDetaljUtsnitt } from "./tegning";
export type { TegningPosisjonData, DetaljUtsnittData } from "./tegning";

// Tegning via screenshot (alternativ uten koordinatberegning)
export { genererTegningMedScreenshot } from "./tegning-screenshot";
export type { TegningScreenshotData } from "./tegning-screenshot";

// Komplett HTML-generatorer
export { byggSjekklisteHtml } from "./sjekkliste";
// Merk: byggOppgaveHtml pensjonert (fase 3, 2026-08-12) — var eksportert uten
// kaller. Web-oppgave rendrer via JSX, mobil printer kun sjekkliste.

// Sluttrapport (kontrollplan SAK10 §14-7)
export { genererSluttrapportHtml } from "./sluttrapport";
export type { SluttrapportData, SluttrapportPunkt } from "./sluttrapport";

// Arkivmal — datalag for dokumentgenerering (fase 3, rent lag, ingen Prisma)
export * from "./arkivmal";
