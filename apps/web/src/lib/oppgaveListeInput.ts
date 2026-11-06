/**
 * Input til `oppgave.hentForProsjekt` fra web-oppgavelisten (TILLEGG ORDRE 28).
 *
 * Listen følger toppbarens byggeplass: aktiv byggeplass sendes, og serveren scoper med
 * `byggeplassFilterViaTegning` (egen byggeplass, ellers tegningens; byggeplass-løse vises
 * overalt). «Hele prosjektet» (ingen aktiv byggeplass) = ingen `byggeplassId` → ufiltrert.
 * Paritet med HMS-siden og mobil `oppgave/index.tsx`.
 */
export function oppgaveListeInput(
  projectId: string,
  aktivByggeplass: { id: string } | null | undefined,
): { projectId: string; byggeplassId?: string } {
  return aktivByggeplass ? { projectId, byggeplassId: aktivByggeplass.id } : { projectId };
}
