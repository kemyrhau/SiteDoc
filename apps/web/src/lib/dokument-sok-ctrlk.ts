/**
 * SØK-2: dokumentgruppa i «Søk overalt» (Ctrl K). Rene regler — hooken (`useDokumentSok`) og
 * modalen (`SokModal`) bruker dem, testene låser dem. Tilgang avgjøres på serveren
 * (`ftdSok.sokDokumenter`: medlemskap + mappefilter), aldri her.
 */

export const MIN_DOK_SOK_TEGN = 3;
export const MAKS_DOK_TREFF = 5;
export const DOK_SOK_DEBOUNCE_MS = 250;
/** Chunks pr. kall — nok til å fylle MAKS_DOK_TREFF dokumenter etter sammenslåing. */
export const DOK_SOK_GRENSE = 20;

/** Dokumentsøket kalles bare inne i et prosjekt og fra MIN_DOK_SOK_TEGN tegn. */
export function skalSokeDokumenter(prosjektId: string | null | undefined, q: string): boolean {
  return !!prosjektId && q.trim().length >= MIN_DOK_SOK_TEGN;
}

/**
 * Ett treff pr. dokument (beste chunk = første, serveren sorterer helord → rank), maks
 * MAKS_DOK_TREFF, i serverens rekkefølge.
 */
export function slaaSammenPrDokument<T extends { documentId: string }>(treff: readonly T[]): T[] {
  const sett = new Set<string>();
  const ut: T[] = [];
  for (const t of treff) {
    if (sett.has(t.documentId)) continue;
    sett.add(t.documentId);
    ut.push(t);
    if (ut.length === MAKS_DOK_TREFF) break;
  }
  return ut;
}

/** Leseren med søkeordet markert; leseren scroller første markering i syne. */
export function leserHref(prosjektId: string, dokumentId: string, q: string): string {
  return `/dashbord/${prosjektId}/dokumenter/${dokumentId}/les?highlight=${encodeURIComponent(q.trim())}`;
}

/** «Se alle i Dokumentsøk» — siden leser `?q` og søker med en gang. */
export function seAlleHref(prosjektId: string, q: string): string {
  return `/dashbord/${prosjektId}/sok?q=${encodeURIComponent(q.trim())}`;
}
