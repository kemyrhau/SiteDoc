/**
 * Leser dokument-lokasjon (tegningsmarkør) fra et RÅ dokument-query-resultat (checklist/task fra
 * `hentMedId` — har `drawingId`/`positionX`/`positionY` + `drawing`-relasjonen med byggeplass).
 *
 * 🔴 Bakgrunn (2026-08-23): oppgave-detaljsiden viste «Lokasjon: Ikke satt» selv når oppgaven HADDE
 * drawingId + posisjon. Rotårsak: den leste fra det OMFORMEDE `oppgave`-objektet fra
 * `useOppgaveSkjema`, som dropper `drawingId`/`positionX`/`positionY`/`drawing` — og `as unknown as`
 * skjulte de manglende feltene. Denne helperen tar det RÅ query-resultatet (fullOppgaveRå/
 * fullSjekklisteRå), så feltene faktisk finnes. Byggeplass (ORDRE 28): dokumentets egen byggeplass
 * først, tegningens som reserve (eldre Task-rader uten egen verdi).
 */
export interface DokumentLokasjon {
  tegningId: string | null;
  tegningNavn: string | null;
  bygningNavn: string | null;
  positionX: number | null;
  positionY: number | null;
  /** Lokasjonsomfang (2026-09-04): "punkt" | "byggeplass" | "omrade" (steg 2b) | null. */
  lokasjonOmfang: "punkt" | "byggeplass" | "omrade" | null;
  /** Fritekst-sted (2026-09-06) — påheng på byggeplass når tegning mangler. */
  lokasjonFritekst: string | null;
  /** Område-referanse (steg 2b, 2026-09-23) — satt når lokasjonOmfang="omrade". */
  omradeId: string | null;
}

export function lesDokumentLokasjon(raaDok: unknown): DokumentLokasjon {
  const d = raaDok as
    | {
        drawingId?: string | null;
        positionX?: number | null;
        positionY?: number | null;
        lokasjonOmfang?: "punkt" | "byggeplass" | "omrade" | null;
        lokasjonFritekst?: string | null;
        omradeId?: string | null;
        drawing?: { name?: string | null; byggeplass?: { name?: string | null } | null } | null;
        byggeplass?: { name?: string | null } | null;
      }
    | undefined;
  return {
    tegningId: d?.drawingId ?? null,
    tegningNavn: d?.drawing?.name ?? null,
    bygningNavn: d?.byggeplass?.name ?? d?.drawing?.byggeplass?.name ?? null,
    positionX: d?.positionX ?? null,
    positionY: d?.positionY ?? null,
    lokasjonOmfang: d?.lokasjonOmfang ?? null,
    lokasjonFritekst: d?.lokasjonFritekst ?? null,
    omradeId: d?.omradeId ?? null,
  };
}

/**
 * ORDRE 29 #1: områdelista i lokasjonsvelgeren viser bare områdene på valgt byggeplass. Uten
 * valgt byggeplass («Alle») vises alle. Hvert område hører til nøyaktig én byggeplass (påkrevd i
 * skjemaet), så et område fra en annen byggeplass kan ikke velges inn på dokumentet.
 */
export function filtrerOmrader<T extends { byggeplassId: string }>(
  omrader: readonly T[],
  byggeplassId: string | null | undefined,
): T[] {
  return byggeplassId ? omrader.filter((o) => o.byggeplassId === byggeplassId) : [...omrader];
}

/**
 * ORDRE 29 #1/#5: byggeplassen et lokasjonsvalg uten tegning (hele byggeplassen, fritekst) skal
 * bære. Rekkefølge: byggeplassen valgt i velgeren → dokumentets egen → toppbarens aktive. Returnerer
 * `undefined` (ikke null) når ingen finnes, så serveren lar dokumentets byggeplass stå urørt — et
 * lokasjonsvalg tømmer aldri byggeplassen.
 */
export function byggeplassForLokasjon(kilder: {
  valgt?: string | null;
  dokument?: string | null;
  aktiv?: string | null;
}): string | undefined {
  return kilder.valgt || kilder.dokument || kilder.aktiv || undefined;
}

/**
 * ORDRE (20b): «Hele prosjektet» er kun et visningsfilter. I et prosjekt med byggeplasser kan
 * «Gjelder hele byggeplassen» / fritekst-sted bare lagres når en byggeplass er kjent — ellers ville
 * omfang «byggeplass» lagres uten byggeplass. Prosjekter uten byggeplasser er uendret.
 */
export function manglerByggeplassValg(d: { antallByggeplasser: number; byggeplassId: string | undefined }): boolean {
  return d.antallByggeplasser > 0 && !d.byggeplassId;
}

// ORDRE 29 #6 / (20b): flyttet til @sitedoc/shared så mobilens byggeplassvalg bruker samme regel.
export { byggeplassByttInput } from "@sitedoc/shared";
