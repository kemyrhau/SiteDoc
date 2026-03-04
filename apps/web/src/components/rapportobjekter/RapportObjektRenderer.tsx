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
import { UkjentObjekt } from "./UkjentObjekt";

// Display-only typer som ikke wrappes med FeltWrapper/FeltDokumentasjon
export const DISPLAY_TYPER = new Set(["heading", "subtitle", "location"]);

// Typer som skjules i utfyllingsmodus (vises kun i print/lesemodus)
export const SKJULT_I_UTFYLLING = new Set(["location", "drawing_position"]);

// Read-only typer (viser verdi men kan ikke endres av bruker)
export const READONLY_TYPER = new Set(["calculation"]);

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
  location: LokasjonObjekt,
  drawing_position: TegningPosisjonObjekt,
};

export function RapportObjektRenderer(props: RapportObjektProps) {
  const Komponent = KOMPONENT_MAP[props.objekt.type] ?? UkjentObjekt;
  return <Komponent {...props} />;
}
