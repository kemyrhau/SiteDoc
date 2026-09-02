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
  objekt: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  };
  verdi: unknown;
  onEndreVerdi: (verdi: unknown) => void;
  leseModus?: boolean;
  // `prosjektId` FJERNET 2026-08-24: den var valgfri og ble aldri threadet til repeater-barn,
  // så prop-brukende felt (rom/sone/lokasjon/drawing_position) ble stille tomme uten kompileringsfeil.
  // Alle prosjekt-avhengige felt henter nå fra kontekst (`useProsjekt().valgtProsjektId`), som de
  // tre som alltid virket (firma/person/persons). En valgfri prop ingen threader konsekvent er en
  // felle — derfor borte helt, ikke bare fikset per felt.
  barneObjekter?: RapportObjekt[];
  /** Sjekkliste-ID for opplastingskø (brukes av RepeaterObjekt) */
  sjekklisteId?: string;
  /** Oppgave-ID for opplastingskø (brukes av RepeaterObjekt) */
  oppgaveIdForKo?: string;
  /**
   * Rad-scopet oppgave-kobling — KUN repeater. Nøkkel `${objekt.id}:${_radId}` (STABIL rad-id).
   * Whole-field-oppgave på repeateren er avskrudd (per-rad er entydig); prod har 0 slike
   * koblinger. Speiler web (apps/web/.../rapportobjekter/typer.ts).
   */
  radOppgaver?: RadOppgaveAdapter;
  /**
   * 4b (bindende vedtak `domene-arbeidsflyt.md`: dokumentflyten er nøkkelen): faggruppe-id-ene som
   * er MEDLEM av dokumentets dokumentflyt. `company`-feltet (FirmaObjekt) begrenser valgene til
   * disse — ikke prosjektets alle. `null`/utelatt = flyt-løst dokument (gyldig) → FirmaObjekt faller
   * tilbake til alle faggrupper med en mikrotekst-linje. En lagret verdi utenfor settet vises
   * som ikke-valgbar (utenfor flyten), aldri skjult. Speiler web (apps/web/.../rapportobjekter/typer.ts).
   */
  tillatteFaggruppeIder?: string[] | null;
  /**
   * Arv-tegning fra forrige repeater-rad (Kenneth-vedtak 2026-09-02): når et
   * drawing_position-barn rendres i repeater-rad n, sender RepeaterObjekt drawingId-en
   * fra rad n−1 hit. TegningPosisjonObjekt bruker den som FORHÅNDSVALG (ikke låsing) når
   * radens egen tegning mangler — så en befaring med ti funn på samme tegning krever ett
   * valg, ikke ti. Tom rad n−1 → utelatt/null → faller til per-byggeplass-minnet.
   * Kun repeater-barn får den; dokumentnivå-tegning (P1) er en navngitt oppfølger.
   */
  arvetDrawingId?: string | null;
}

/** Radens forhåndsposisjon (drawing_position-verdi ?? dokument-fallback avgjøres av kalleren). */
export interface OppgavePosisjon {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
}

/** Adapter for rad-scopede oppgaver i en repeater (nøkkel `${objekt.id}:${_radId}`). */
export interface RadOppgaveAdapter {
  /** C: alle oppgaver på en rad (flere er lov). Tom liste → ingen ennå. */
  finnForRad: (radNokkel: string) => Array<{ id: string; nummer?: string }>;
  /** `radNummer` (funn 3): radens 1-baserte posisjon, til tittelen (identifiserer raden). */
  onOpprett: (radNokkel: string, radPosisjon: OppgavePosisjon | null, radNummer: number) => void;
  onNaviger: (id: string) => void;
}
