import { TILBEHOR_REN_FJERNING_BASE } from "@sitedoc/shared";
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
import { SignaturListeObjekt } from "./SignaturListeObjekt";
import { RepeaterObjekt } from "./RepeaterObjekt";
import { LokasjonObjekt } from "./LokasjonObjekt";
import { TegningPosisjonObjekt } from "./TegningPosisjonObjekt";
import { InfoTekstObjekt } from "./InfoTekstObjekt";
import { InfoBildeObjekt } from "./InfoBildeObjekt";
import { VideoObjekt } from "./VideoObjekt";
import { QuizObjekt } from "./QuizObjekt";
import { UkjentObjekt } from "./UkjentObjekt";

// Display-only typer som ikke wrappes med FeltDokumentasjon
// LEGACY-VERN "location": location er avviklet fra palett og seeds 2026-09-02, men ≥9
// objekter lever i eksisterende maler (målt lokal dev; prod trolig flere — hvert seedet
// prosjekt fikk ett per seedet mal). "location" står igjen her (+ i KOMPONENT_MAP og
// sjekkliste-skippen) for å holde dem skjult og krasjfrie. Fjernes FØRST når D8/D9-
// malryddingen har fjernet objektene fra malene.
export const DISPLAY_TYPER = new Set(["heading", "subtitle", "location", "info_text", "info_image"]);

// Read-only typer (viser verdi men kan ikke endres av bruker)
export const READONLY_TYPER = new Set(["calculation"]);

// Funn 6 (Kenneth-vedtak 2026-08-22): tilbehør (kommentar/bilde/vedlegg/tegning) fjernes fra
// NYREGISTRERING på disse typene. Delt basissett i @sitedoc/shared (`TILBEHOR_REN_FJERNING_BASE`,
// felles med web — rasjonale per felttype ligger der).
// `weather` er mobil-LOKAL: web har den ikke i sitt sett. Om vær-tilbehør skal fjernes på BEGGE
// (harmonisering) er et åpent produktspørsmål til Kenneth (2026-09-06) — til svaret kommer beholdes
// dagens oppførsel (mobil har weather, web ikke), ingen gjettet harmonisering.
const TILBEHOR_REN_FJERNING = new Set([...TILBEHOR_REN_FJERNING_BASE, "weather"]);

/**
 * Hvordan tilbehøret (FeltDokumentasjon) skal vises for en felttype (funn 6, speiler web):
 * - de fire (+weather): ren fjerning i utfylling (0 prod-data). Global leseModus unntatt.
 * - `repeater`: eksisterende objektnivå-tilbehør (prod: 4+4) vises READ-ONLY, men KUN når det
 *   finnes data — mobil FeltDokumentasjon self-hider IKKE (rendrer tom kommentar-boks), derfor
 *   gates det på `harData` her. Print-veien (F7) er URØRT.
 * - Øvrige: uendret (global leseModus styrer).
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
  signature_list: SignaturListeObjekt,
  repeater: RepeaterObjekt,
  // LEGACY-VERN "location": avviklet fra palett og seeds 2026-09-02, men ≥9 objekter lever
  // i legacy-maler. Uten denne mappingen ville de rendret som UkjentObjekt («felttype ikke
  // støttet»). Beholdes til D8/D9-malryddingen fjerner objektene fra malene.
  location: LokasjonObjekt,
  drawing_position: TegningPosisjonObjekt,
  info_text: InfoTekstObjekt,
  info_image: InfoBildeObjekt,
  video: VideoObjekt,
  quiz: QuizObjekt,
};

export function RapportObjektRenderer(props: RapportObjektProps) {
  const Komponent = KOMPONENT_MAP[props.objekt.type] ?? UkjentObjekt;
  return <Komponent {...props} />;
}
