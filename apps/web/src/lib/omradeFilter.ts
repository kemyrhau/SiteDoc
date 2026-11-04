/**
 * Metadata S-pakke B-1: område-filteret i web-listene (sjekklister, oppgaver). Alternativene er
 * de ulike områdenavnene i lista (A–Å). Filteret vises bare når det finnes minst ett område —
 * prosjekt uten områder, eller et eldre API uten feltet, gir ingen alternativer og skjult filter.
 */

export interface OmradeRad {
  omrade?: { navn: string } | null;
}

export function omradeFilterAlternativer(rader: OmradeRad[]): { value: string; label: string }[] {
  const navn = new Set<string>();
  for (const r of rader) if (r.omrade?.navn) navn.add(r.omrade.navn);
  return [...navn].sort().map((v) => ({ value: v, label: v }));
}

export function visOmradeFilter(alternativer: readonly unknown[] | undefined): boolean {
  return (alternativer?.length ?? 0) > 0;
}
