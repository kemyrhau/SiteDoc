/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 * Rene hjelpere for dialogens adaptive felt (0 = skjult, 1 = auto, 2+ = nedtrekk).
 */

export type ByggeplassValg = { id: string; projectId: string; name: string };

/** Byggeplassene som hører til radens prosjekt — kun disse er gyldige valg. */
export function byggeplasserForProsjekt<T extends { projectId: string }>(
  alle: readonly T[] | undefined,
  projectId: string,
): T[] {
  return (alle ?? []).filter((b) => b.projectId === projectId);
}

/**
 * Forhåndsvalg for en NY rad. Gjeldende verdi beholdes bare hvis den hører til
 * prosjektet (prosjektbytte → nullstilles). Én kandidat velges automatisk;
 * ellers toppbarens byggeplass hvis den hører til prosjektet; ellers tomt.
 */
export function velgStandardByggeplass(args: {
  gjeldende: string | null;
  kandidater: readonly { id: string }[];
  toppbar: string | null;
}): string | null {
  const { gjeldende, kandidater, toppbar } = args;
  const finnes = (id: string | null) =>
    !!id && kandidater.some((k) => k.id === id);
  if (finnes(gjeldende)) return gjeldende;
  if (kandidater.length === 1) return kandidater[0]!.id;
  if (finnes(toppbar)) return toppbar;
  return null;
}
