/**
 * TILLEGG (33) pkt 4.2 — F6 (kort-id-spec § 11.4 raden «Dagskort-modus-skjermen», § 11.9 F6:
 * «vise nå, opprette senere», Kenneth 2026-11-16). Dagskort-modus-skjermen (`app/timer/[id].tsx`)
 * viser rader uten prosjekt i en egen lese-gruppe «Fravær» i stedet for at de faller på sedelens
 * prosjekt via sedelens prosjekt-fallback. Ingen oppretting, ingen redigering, intet tak (F11).
 */

/** Fraværsrader (`uten_prosjekt`) ut av prosjektgruppene; alt annet som før. */
export function delDagskortRader<T extends { utenProsjekt?: boolean | null }>(
  rader: readonly T[],
): { prosjektRader: T[]; fravaerRader: T[] } {
  const prosjektRader: T[] = [];
  const fravaerRader: T[] = [];
  for (const r of rader) (r.utenProsjekt ? fravaerRader : prosjektRader).push(r);
  return { prosjektRader, fravaerRader };
}

/**
 * Standardgruppa er sedelens prosjekt. En sedel startet fra fraværskortet har prosjekt `""`
 * (ingen prosjekt) — den får ingen tom «Ukjent prosjekt»-gruppe.
 */
export function dagskortStandardProsjekt(sedelProjectId: string): string[] {
  return sedelProjectId ? [sedelProjectId] : [];
}
