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
  prosjektId?: string;
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
}

/** Radens forhåndsposisjon (drawing_position-verdi ?? dokument-fallback avgjøres av kalleren). */
export interface OppgavePosisjon {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
}

/** Adapter for rad-scopede oppgaver i en repeater (nøkkel `${objekt.id}:${_radId}`). */
export interface RadOppgaveAdapter {
  finnForRad: (radNokkel: string) => { id: string; nummer?: string } | undefined;
  onOpprett: (radNokkel: string, radPosisjon: OppgavePosisjon | null) => void;
  onNaviger: (id: string) => void;
}
