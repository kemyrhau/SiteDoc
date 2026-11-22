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


/** O13 (R3): kolonner lagt til standardutvalget etter at oppsett er lagret. */
export interface TillagteKolonner {
  ider: readonly string[];
  /** Kolonnen de settes inn rett etter. Er den ikke synlig, settes de inn sist. */
  etter: string;
}

/**
 * O13 (R3): et lagret oppsett leses med kolonnene i `tillegg` satt inn én gang. En kolonne som
 * verken er synlig eller står i `tillagt`, settes inn rett etter `tillegg.etter` og føres i
 * `tillagt`. Står den i `tillagt` men ikke i `kolonner`, har brukeren skjult den — den står
 * skjult. Rekkefølgen ellers er den brukeren hadde (gammelt oppsett uten `rekkefolge` får
 * `kanonisk`-rekkefølgen skrevet ut, så innsettingen har en plass).
 */
export function medTillagteKolonner(
  lagret: LagretKolonner & { tillagt?: readonly string[] },
  kanonisk: readonly string[],
  tillegg: TillagteKolonner,
): LagretKolonner & { tillagt: string[] } {
  const synlige = new Set(lagret.kolonner);
  // En tillagt kolonne som alt er synlig, føres i `tillagt`, så den står skjult om brukeren skjuler den.
  const tillagt = [...(lagret.tillagt ?? [])];
  for (const id of tillegg.ider) if (synlige.has(id) && !tillagt.includes(id)) tillagt.push(id);
  const nye = tillegg.ider.filter((id) => !synlige.has(id) && !tillagt.includes(id));
  if (nye.length === 0) return { kolonner: lagret.kolonner, rekkefolge: lagret.rekkefolge, tillagt };
  const rekkefolge = effektivRekkefolge(lagret, kanonisk);
  const plass = rekkefolge.indexOf(tillegg.etter);
  const kolonner = plass === -1 ? [...rekkefolge, ...nye] : [...rekkefolge.slice(0, plass + 1), ...nye, ...rekkefolge.slice(plass + 1)];
  return { kolonner, rekkefolge: true, tillagt: [...tillagt, ...nye] };
}
