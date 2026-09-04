/**
 * @sitedoc/pdf — Delt PDF-generering for web og mobil.
 *
 * Null runtime-avhengigheter. Genererer komplett HTML som brukes av:
 * - Mobil: expo-print (Print.printToFileAsync({ html }))
 * - Web: CSS print / window.print() (felt-rendering + konstanter)
 */

// Timer-rapport PDF (ny mal på HTML→PDF-motoren)
export { byggTimerRapportHtml } from "./timer-rapport";
export type {
  TimerRapportData,
  TimerRapportTekster,
  TimerRapportAnsatt,
  TimerRapportDetaljRad,
  TimerRapportRadType,
  TimerRapportMaskinMerke,
} from "./timer-rapport";

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
  harMeningsfullLabel,
  normaliserOpsjon,
  formaterDato,
  formaterDatoTid,
  formaterDatoTidKort,
  formaterDatoTidPunkt,
  formaterDatoKort,
  fullBildeUrl,
  formaterNummer,
} from "./hjelpere";

// CSS
export { hentCss } from "./css";

// Prosjekt-referanse (header-generatorene ble slettet 2026-08-24 med den døde klient-utskrift-
// grenen — arkivmalen bygger header-HTML nå).
export { prosjektReferanseForUtskrift } from "./header";

// Felt-renderer (renderAllefelter slettet 2026-08-24 — byggSjekklisteHtml var eneste kaller).
export { renderFelt } from "./felt";

// Tegningsposisjon
export { byggTegningPosisjon, byggDetaljUtsnitt } from "./tegning";
export type { TegningPosisjonData, DetaljUtsnittData } from "./tegning";

// Komplett HTML: byggSjekklisteHtml + tegning-screenshot slettet 2026-08-24 (mobil gikk over
// til arkivmalen; 0 importører). Arkiv-PDF (`arkivmal/`) er eneste HTML-genererings-vei.

// Sluttrapport (kontrollplan SAK10 §14-7)
export { genererSluttrapportHtml } from "./sluttrapport";
export type { SluttrapportData, SluttrapportPunkt } from "./sluttrapport";

// Arkivmal — datalag for dokumentgenerering (fase 3, rent lag, ingen Prisma)
export * from "./arkivmal";
