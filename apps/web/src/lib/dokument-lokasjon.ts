/**
 * Leser dokument-lokasjon (tegningsmarkør) fra et RÅ dokument-query-resultat (checklist/task fra
 * `hentMedId` — har `drawingId`/`positionX`/`positionY` + `drawing`-relasjonen med byggeplass).
 *
 * 🔴 Bakgrunn (2026-08-23): oppgave-detaljsiden viste «Lokasjon: Ikke satt» selv når oppgaven HADDE
 * drawingId + posisjon. Rotårsak: den leste fra det OMFORMEDE `oppgave`-objektet fra
 * `useOppgaveSkjema`, som dropper `drawingId`/`positionX`/`positionY`/`drawing` — og `as unknown as`
 * skjulte de manglende feltene. Denne helperen tar det RÅ query-resultatet (fullOppgaveRå/
 * fullSjekklisteRå), så feltene faktisk finnes. Task har ingen egen byggeplass-kolonne → byggeplass
 * utledes av tegningens byggeplass.
 */
export interface DokumentLokasjon {
  tegningId: string | null;
  tegningNavn: string | null;
  bygningNavn: string | null;
  positionX: number | null;
  positionY: number | null;
}

export function lesDokumentLokasjon(raaDok: unknown): DokumentLokasjon {
  const d = raaDok as
    | {
        drawingId?: string | null;
        positionX?: number | null;
        positionY?: number | null;
        drawing?: { name?: string | null; byggeplass?: { name?: string | null } | null } | null;
      }
    | undefined;
  return {
    tegningId: d?.drawingId ?? null,
    tegningNavn: d?.drawing?.name ?? null,
    bygningNavn: d?.drawing?.byggeplass?.name ?? null,
    positionX: d?.positionX ?? null,
    positionY: d?.positionY ?? null,
  };
}
