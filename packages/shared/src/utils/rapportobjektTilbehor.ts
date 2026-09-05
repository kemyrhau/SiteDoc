/**
 * Felttyper der tilbehøret (FeltDokumentasjon: kommentar/bilde/vedlegg/oppgave/tegning) er en
 * REN FJERNING i nyregistrering (funn 6, Kenneth-vedtak 2026-08-22).
 *
 * ÉN delt kilde for web- og mobil-rendererens `TILBEHOR_REN_FJERNING`. De to var to kopier av
 * samme sett — drift-klassen «to kopier som skulle vært én», konsolidert 2026-09-06 (samme
 * mønster som `IKKE_UTFYLLBARE_FELTTYPER` i `feltLaasing.ts`).
 *
 * Rasjonale per felttype:
 * - `date` / `date_time` / `drawing_position` / `location`: 0 prod-data, ren fjerning i utfylling
 *   (`location` er også legacy-vernet i rendererne til D8/D9-malryddingen fjerner objektene).
 * - `signature` (Kenneth 2026-09-05) / `signature_list` (Kenneth 2026-09-06): signaturen er sin
 *   EGEN dokumentasjon → ingen tilbehør (bilde/galleri/+Oppgave/filopplasting).
 *
 * 🔴 `weather` er BEVISST IKKE i basissettet: mobil har den i sitt sett, web ikke. Om vær-tilbehør
 * skal fjernes på BEGGE flater (harmonisering) er et ÅPENT PRODUKTSPØRSMÅL til Kenneth (2026-09-06).
 * Til svaret kommer legger mobilrendereren `weather` til LOKALT — dagens oppførsel på begge flater,
 * ingen gjettet harmonisering.
 */
export const TILBEHOR_REN_FJERNING_BASE: ReadonlySet<string> = new Set([
  "date",
  "date_time",
  "drawing_position",
  "location",
  "signature",
  "signature_list",
]);
