import type { RapportObjektProps } from "./typer";
import { OverskriftObjekt } from "./OverskriftObjekt";
import { UndertittelObjekt } from "./UndertittelObjekt";
import { TekstfeltObjekt } from "./TekstfeltObjekt";
import { EnkeltvalgObjekt } from "./EnkeltvalgObjekt";
import { FlervalgObjekt } from "./FlervalgObjekt";
import { TrafikklysObjekt } from "./TrafikklysObjekt";
import { HeltallObjekt } from "./HeltallObjekt";
import { DesimaltallObjekt } from "./DesimaltallObjekt";
import { BeregningObjekt } from "./BeregningObjekt";
import { DatoObjekt } from "./DatoObjekt";
import { DatoTidObjekt } from "./DatoTidObjekt";
import { PersonObjekt } from "./PersonObjekt";
import { FlerePersonerObjekt } from "./FlerePersonerObjekt";
import { FirmaObjekt } from "./FirmaObjekt";
import { VedleggObjekt } from "./VedleggObjekt";
import { BimEgenskapObjekt } from "./BimEgenskapObjekt";
import { SoneEgenskapObjekt } from "./SoneEgenskapObjekt";
import { RomEgenskapObjekt } from "./RomEgenskapObjekt";
import { VaerObjekt } from "./VaerObjekt";
import { SignaturObjekt } from "./SignaturObjekt";
import { RepeaterObjekt } from "./RepeaterObjekt";
import { LokasjonObjekt } from "./LokasjonObjekt";
import { TegningPosisjonObjekt } from "./TegningPosisjonObjekt";
import { QuizObjekt } from "./QuizObjekt";
import { InfoTekstObjekt } from "./InfoTekstObjekt";
import { InfoBildeObjekt } from "./InfoBildeObjekt";
import { VideoObjekt } from "./VideoObjekt";
import { UkjentObjekt } from "./UkjentObjekt";

// Display-only typer som ikke wrappes med FeltWrapper/FeltDokumentasjon.
// info_text/info_image/video (F2-rest 2026-08-23): instruksjonsfelt portert fra mobil,
// rendres som ren visning uten kommentar/vedlegg-tilbehør. Mobil holder video som
// interaktiv («watched»); web behandler den som ren visning (ordre: «no user value»).
export const DISPLAY_TYPER = new Set([
  "heading",
  "subtitle",
  "location",
  "info_text",
  "info_image",
  "video",
]);

// Typer som skjules i utfyllingsmodus (vises kun i print/lesemodus)
// LEGACY-VERN "location": location er avviklet fra palett og seeds 2026-09-02, men ≥9
// objekter lever i eksisterende maler (målt lokal dev; prod trolig flere). "location"
// beholdes i web-rendererens sett (DISPLAY_TYPER, SKJULT_I_UTFYLLING, TILBEHOR_REN_FJERNING,
// KOMPONENT_MAP) for å holde legacy-objektene skjult og krasjfrie i utfylling. Lesevisningen
// (RapportObjektVisning) rendrer dem som INGENTING (paritetsbruddet lukket). Fjernes FØRST
// når D8/D9-malryddingen har fjernet objektene fra malene.
export const SKJULT_I_UTFYLLING = new Set(["location", "drawing_position"]);

// Read-only typer (viser verdi men kan ikke endres av bruker)
export const READONLY_TYPER = new Set(["calculation"]);

// Funn 6 (Kenneth-vedtak 2026-08-22): tilbehør (kommentar/bilde/vedlegg/tegning) fjernes fra
// NYREGISTRERING på disse typene. «Øvrige felttyper beholder tilbehør» → deny-list PER felttype
// (gjelder også barnefelt i repeater-rader: et text_field-barn beholder sitt celle-tilbehør).
// `signature` (Kenneth-krav 2026-09-05): en signatur trenger ikke bilde/galleri/+Oppgave/
// filopplasting — den ER sin egen dokumentasjon. Navn + tidspunkt hører til feltet (fabels
// SJA-vedtak 05.09 pkt 4), men bygges som modellendring i egen runde — ikke som tilbehør her.
const TILBEHOR_REN_FJERNING = new Set(["date", "date_time", "drawing_position", "location", "signature"]);

/**
 * Hvordan tilbehøret (FeltDokumentasjon) skal vises for en felttype (funn 6):
 * - `date`/`date_time`/`drawing_position`/`location`: ren fjerning i utfylling (0 prod-data,
 *   ingen read-only). Global leseModus (visning av ferdig dokument) er unntatt.
 * - `repeater`: eksisterende objektnivå-tilbehør (prod: 4 kommentar + 4 vedlegg) vises READ-ONLY,
 *   men KUN når det finnes data — en tom read-only-ramme skjules (web self-hider, mobil mangler
 *   guarden, derfor gates det på `harData` her). Print-veien (F7 i packages/pdf) er URØRT.
 * - Øvrige: uendret (global `leseModus` styrer).
 */
export function tilbehorVisning(
  type: string,
  globalLeseModus: boolean,
  harData: boolean,
): { vis: boolean; leseModus: boolean } {
  if (!globalLeseModus && TILBEHOR_REN_FJERNING.has(type)) return { vis: false, leseModus: false };
  if (type === "repeater") return { vis: harData, leseModus: true };
  return { vis: true, leseModus: globalLeseModus };
}

const KOMPONENT_MAP: Record<string, React.ComponentType<RapportObjektProps>> = {
  heading: OverskriftObjekt,
  subtitle: UndertittelObjekt,
  text_field: TekstfeltObjekt,
  list_single: EnkeltvalgObjekt,
  list_multi: FlervalgObjekt,
  traffic_light: TrafikklysObjekt,
  integer: HeltallObjekt,
  decimal: DesimaltallObjekt,
  calculation: BeregningObjekt,
  date: DatoObjekt,
  date_time: DatoTidObjekt,
  person: PersonObjekt,
  persons: FlerePersonerObjekt,
  company: FirmaObjekt,
  attachments: VedleggObjekt,
  bim_property: BimEgenskapObjekt,
  zone_property: SoneEgenskapObjekt,
  room_property: RomEgenskapObjekt,
  weather: VaerObjekt,
  signature: SignaturObjekt,
  repeater: RepeaterObjekt,
  // LEGACY-VERN "location": avviklet 2026-09-02, men ≥9 objekter lever i legacy-maler.
  // Uten mappingen ville de rendret som UkjentObjekt. Se SKJULT_I_UTFYLLING over.
  location: LokasjonObjekt,
  drawing_position: TegningPosisjonObjekt,
  quiz: QuizObjekt,
  info_text: InfoTekstObjekt,
  info_image: InfoBildeObjekt,
  video: VideoObjekt,
};

export function RapportObjektRenderer(props: RapportObjektProps) {
  const Komponent = KOMPONENT_MAP[props.objekt.type] ?? UkjentObjekt;
  return <Komponent {...props} />;
}
