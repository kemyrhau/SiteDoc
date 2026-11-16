/**
 * Input til `oppgave.hentForProsjekt` fra web-oppgavelisten (TILLEGG ORDRE 28).
 *
 * Listen følger toppbarens byggeplass: aktiv byggeplass sendes, og serveren scoper med
 * `byggeplassFilterViaTegning` (egen byggeplass, ellers tegningens; byggeplass-løse vises
 * overalt). Ingen aktiv byggeplass = ingen `byggeplassId` → ufiltrert — gjelder (22) kun
 * prosjekt uten byggeplasser; ellers viser `ByggeplassFilterPort` «Velg byggeplass».
 * Paritet med HMS-siden og mobil `oppgave/index.tsx`.
 */
export function oppgaveListeInput(
  projectId: string,
  aktivByggeplass: { id: string } | null | undefined,
): { projectId: string; byggeplassId?: string } {
  return aktivByggeplass ? { projectId, byggeplassId: aktivByggeplass.id } : { projectId };
}
