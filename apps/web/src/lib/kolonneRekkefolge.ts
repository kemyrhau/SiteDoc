/**
 * Kolonne-rekkefølge for sjekklister og oppgaver (per bruker, lagret i `tabelloppsett`).
 * `kolonner: string[]` var et Set før 04.11. Oppsett lagret før den datoen mangler
 * `rekkefolge`-flagget og vises i standardrekkefølgen. Fra første flytting eller av/på
 * lagres lista i visningsrekkefølge med `rekkefolge: true`.
 */

export interface LagretKolonner {
  kolonner: string[];
  /** true = `kolonner` er visningsrekkefølgen. Mangler i oppsett lagret før 04.11. */
  rekkefolge?: boolean;
}

/**
 * Aktive kolonner i visningsrekkefølge. Gammelt oppsett følger `kanonisk` (sidens
 * standardrekkefølge). Ukjente ider beholdes sist, for eksempel verdi-kolonner fra maler
 * som ikke er lastet ennå.
 */
export function effektivRekkefolge(lagret: LagretKolonner, kanonisk: readonly string[]): string[] {
  const unike = [...new Set(lagret.kolonner)];
  if (lagret.rekkefolge) return unike;
  const aktive = new Set(unike);
  const kjente = kanonisk.filter((id) => aktive.has(id));
  const kjentSett = new Set(kjente);
  return [...kjente, ...unike.filter((id) => !kjentSett.has(id))];
}

/** Slår en kolonne av eller på. En kolonne som slås på, havner sist. */
export function vekslKolonne(rekkefolge: readonly string[], id: string): string[] {
  return rekkefolge.includes(id) ? rekkefolge.filter((k) => k !== id) : [...rekkefolge, id];
}

/** Flytter `fraId` til plassen der `tilId` står (samme semantikk som dnd-kit `arrayMove`). */
export function flyttKolonne(rekkefolge: readonly string[], fraId: string, tilId: string): string[] {
  const fra = rekkefolge.indexOf(fraId);
  const til = rekkefolge.indexOf(tilId);
  if (fra === -1 || til === -1 || fra === til) return [...rekkefolge];
  const ny = [...rekkefolge];
  const [flyttet] = ny.splice(fra, 1);
  ny.splice(til, 0, flyttet!);
  return ny;
}

