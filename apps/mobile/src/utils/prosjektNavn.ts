/**
 * Visningsnavn for et prosjekt på mobil — ÉN kilde (Kenneth 2026-11-12).
 *
 * - Kun navnet. Prosjektnummeret («SD-nummer») er et databasetall og vises
 *   aldri på mobil. Det er fortsatt søkbart i prosjektvelgerne — det er
 *   filtrering, ikke visning.
 * - Ukjent prosjekt (ikke i lokal cache, tomt navn) vises som `ukjent`
 *   («Ukjent prosjekt», `timer.detalj.ukjentProsjekt`), aldri som ID.
 *
 * Web er uendret.
 */
export function prosjektVisningsnavn(
  prosjekt: { name?: string | null } | null | undefined,
  ukjent: string,
): string {
  const navn = prosjekt?.name?.trim();
  return navn ? navn : ukjent;
}
