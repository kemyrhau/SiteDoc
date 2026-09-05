export interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
}

export interface RapportObjektProps {
  objekt: RapportObjekt;
  verdi: unknown;
  onEndreVerdi: (verdi: unknown) => void;
  leseModus?: boolean;
  prosjektId?: string;
  barneObjekter?: RapportObjekt[];
  /**
   * Instans-unik nøkkel for felt som overlever en navigasjon (posisjonsvelger).
   * I en repeater deler alle rader samme `objekt.id` (malobjektets id) → uten en
   * rad-unik nøkkel overskriver rad 2 rad 1s posisjonsresultat ved retur. Settes
   * av `RepeaterObjekt` til `${objekt.id}:${radIndeks}`; utelatt (top-nivå) →
   * komponenten faller til `objekt.id`.
   */
  feltNokkel?: string;
  /**
   * Rad-scopet oppgave-kobling — KUN repeater (kalleren fyller den for `type === "repeater"`,
   * utelatt ellers). Nøkkel er `${objekt.id}:${_radId}` (STABIL rad-id, aldri array-indeks).
   * Whole-field-oppgave på selve repeateren er bevisst avskrudd (per-rad er entydig); se
   * page.tsx der `onOpprettOppgave` utelates for repeater. Reversibel — fjern utelatelsen om
   * et «oppgave på hele tabellen»-behov dukker opp.
   */
  radOppgaver?: RadOppgaveAdapter;
  /**
   * L9 (2026-09-04): dokumentets dokumentlokasjon-tegning. Kalleren (detaljsiden) fyller den for
   * repeateren; brukes KUN som siste fallback når «sist brukte tegning» skal forhåndsvelges i en
   * tom repeater-rads feltpin-velger. Kun tegningen — aldri pin. Innenfor samme dokument, aldri på
   * tvers (en «sist brukt» fra et annet dokument kan peke på feil byggeplass).
   */
  dokumentTegning?: { drawingId: string; drawingName?: string | null } | null;
  /**
   * L9 (2026-09-04): forhåndsvalgt «sist brukte» tegning for DENNE feltpin-velgeren, utledet av
   * `RepeaterObjekt` per rad (forrige rads tegning → ellers dokumentTegning). `TegningPosisjonObjekt`
   * bruker den kun når raden er tom: åpner tegningssiden på tegningen UTEN å sette pin/koordinater.
   */
  stickyTegning?: { drawingId: string; drawingName?: string | null } | null;
  /**
   * 4b (bindende vedtak `domene-arbeidsflyt.md`: dokumentflyten er nøkkelen): faggruppe-id-ene som
   * er MEDLEM av dokumentets dokumentflyt. `company`-feltet (FirmaObjekt) begrenser valgene til
   * disse — ikke prosjektets alle. `null`/utelatt = flyt-løst dokument (gyldig) → FirmaObjekt faller
   * tilbake til alle faggrupper med en mikrotekst-linje. En lagret verdi utenfor settet vises
   * READ-ONLY, aldri skjult.
   */
  tillatteFaggruppeIder?: string[] | null;
  /**
   * Dokument-referanse for `signature_list` (SJA/HMS-runder). Signaturlista bor
   * ikke i `felt.verdi` men i egne tabeller keyet til dokumentet — kalleren
   * (sjekkliste-/oppgave-siden) fyller checklistId/taskId. Utelatt for andre
   * felttyper.
   */
  dokumentRef?: { checklistId?: string; taskId?: string };
}

/**
 * Forhåndsutfylt tegnings-posisjon en rad-oppgave arver: radens egen `drawing_position`-verdi
 * hvis den finnes, ellers dokumentets lokasjon (kalleren avgjør fallbacken).
 */
export interface OppgavePosisjon {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
}

/** Adapter for rad-scopede oppgaver i en repeater (nøkkel `${objekt.id}:${_radId}`). */
export interface RadOppgaveAdapter {
  /** Alle oppgaver på en rad-nøkkel (C: flere er lov). Tom liste → ingen ennå. */
  finnForRad: (radNokkel: string) => Array<{ id: string; nummer?: string }>;
  /**
   * Åpner opprett-modal for raden. `radPosisjon` = radens posisjon (null → dokument-fallback).
   * `radNummer` = radens 1-baserte posisjon (til tittelen — identifiserer raden, som headeren/markøren).
   */
  onOpprett: (radNokkel: string, radPosisjon: OppgavePosisjon | null, radNummer: number) => void;
  /** Naviger til eksisterende rad-oppgave. */
  onNaviger: (id: string) => void;
}

export interface Vedlegg {
  id: string;
  type: "bilde" | "fil";
  url: string;
  filnavn: string;
  opprettet?: string;
  // Når bildet ble TATT (EXIF DateTimeOriginal), ikke når vedlegget ble lagt i
  // dokumentet (det er `opprettet`). ISO-streng ved treff; `null` når EXIF-tid
  // manglet. Nøkkelen finnes IKKE på vedlegg lagd før EXIF-runden (2026-09-04) —
  // web skiller på det: undefined ⇒ historisk, vis ingenting; null ⇒ «ikke
  // tilgjengelig». Bæres inline i Checklist.data (samme kilde som arkiv-PDF).
  // Kun type "bilde".
  opptakTidspunkt?: string | null;
  // Løpende bildenummer per dokument, tildelt ved opptak (kun type "bilde").
  // Dokgen leser dette; mangler det, faller den tilbake til dokumentrekkefølge.
  bildeNr?: number;
}

export interface FeltVerdi {
  verdi: unknown;
  kommentar: string;
  vedlegg: Vedlegg[];
}

export const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

/**
 * Repeater-RAD (rad-id-vedtak 2026-08-22, variant OMSLUTTING): `{ _radId, felter }`, ikke en
 * naken `Record`. `_radId` er en STABIL id tildelt ved opprettelse og bevart gjennom redigering/
 * sletting — fundamentet for persistente rad-scopede oppgaver (array-indeks brekker ved
 * radsletting). Typen er LOKAL for web (packages/pdf importerer bevisst ikke @sitedoc/shared).
 */
export interface Rad {
  _radId: string;
  felter: Record<string, FeltVerdi>;
}

/** Ny stabil rad-id. crypto.randomUUID i nettleser/Node; enkel fallback ellers. */
export function nyRadId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `rad-${Date.now().toString(36)}-${(globalThis.performance?.now() ?? 0).toString(36)}`;
}

/**
 * Normaliser en rå repeater-rad til `{ _radId, felter }` (migrer-ved-lesing). Gammel form
 * (naken `Record<string, FeltVerdi>`) omsluttes og får ny stabil id. Memoiseres av kalleren på
 * `verdi`-referansen så id-en er stabil på tvers av rendringer og persisteres ved neste lagring.
 */
export function normaliserRad(raa: unknown): Rad {
  if (raa && typeof raa === "object" && "felter" in raa) return raa as Rad;
  return { _radId: nyRadId(), felter: (raa ?? {}) as Record<string, FeltVerdi> };
}

// Normaliser opsjon — støtter både string og {value, label}-format
export function normaliserOpsjon(opsjon: unknown): { value: string; label: string } {
  if (typeof opsjon === "string") return { value: opsjon, label: opsjon };
  if (typeof opsjon === "object" && opsjon !== null) {
    const obj = opsjon as Record<string, unknown>;
    const value = typeof obj.value === "string" ? obj.value : String(obj.value ?? "");
    const label = typeof obj.label === "string" ? obj.label : value;
    return { value, label };
  }
  return { value: String(opsjon), label: String(opsjon) };
}
