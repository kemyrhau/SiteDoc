/**
 * Delt tabell-filterpredikat (dokumentsøk-mobil trinn 0, 2026-09-06).
 *
 * Én filterkilde for webs kolonnetrakter OG mobilens filter-sheet — «to flater,
 * én filterkilde, aldri ulik filtrering» (fabel-designlås). Erstatter tre
 * håndspeilede løkker: `sjekklister/page.tsx`, `oppgaver/page.tsx`,
 * `hms/tabeller.tsx` (som alle itererte `Object.entries(filterVerdier)`).
 *
 * IKKE brukt av `kontrollplan/ListeVisning.tsx`: den har et annet konsept (egne
 * Set-states + kontrollplan-avledet tilstand, `filterVerdier`-propen er
 * dropdown-ALTERNATIVER, ikke aktive valg) — bevisst utelatt, ikke en kopi.
 *
 * Kun LØKKEN deles. Verdi-uthentingen (`hentVerdi`) er per flate: `prioritet` vs
 * `dokumentflyt`, byggeplass direkte vs via `drawing` er ekte forskjeller mellom
 * flatene, ikke drift — å slå dem sammen ville laget en funksjon som må kjenne
 * alle flater.
 */

export interface TabellFilterConfig<T> {
  /**
   * Enkel likhets-verdi for en kolonne. `undefined` = ukjent kolonne → ingen
   * filtrering (speiler gammel `default: return true` / `if (!hentFelt) continue`).
   * Kjente kolonner returnerer "" for tom verdi — aldri `undefined`.
   */
  hentVerdi: (rad: T, kolId: string) => string | undefined;
  /** Dynamiske mal-felt: kolId på formen `felt:<objektId>`. */
  hentFeltVerdi?: (rad: T, objektId: string) => string;
  /** «frist»-kolonnen: multiselect forfalt / har_frist / ingen_frist. */
  hentFrist?: (rad: T) => { dueDate: string | Date | null; ferdig: boolean };
}

const FELT_PREFIKS = "felt:";

/**
 * Frist-multiselect — eksakt delt logikk fra sjekkliste- og oppgave-løkkene.
 * `ferdig` = statusen er avsluttet (approved/closed) → aldri «forfalt».
 */
export function matcherFristFilter(
  frist: { dueDate: string | Date | null; ferdig: boolean },
  valgteSet: Set<string>,
): boolean {
  const harFrist = !!frist.dueDate;
  const forfalt =
    harFrist && new Date(frist.dueDate!) < new Date() && !frist.ferdig;
  if (valgteSet.has("forfalt")) return forfalt;
  if (valgteSet.has("har_frist") && valgteSet.has("ingen_frist")) return true;
  if (valgteSet.has("har_frist")) return harFrist;
  if (valgteSet.has("ingen_frist")) return !harFrist;
  return true;
}

/** Sann hvis raden matcher ALLE aktive filtre (`filterVerdier`). */
export function radMatcherFilter<T>(
  rad: T,
  filterVerdier: Record<string, string>,
  config: TabellFilterConfig<T>,
): boolean {
  for (const [kolId, verdi] of Object.entries(filterVerdier)) {
    if (!verdi) continue;
    const valgteSet = new Set(verdi.split(","));

    if (kolId.startsWith(FELT_PREFIKS)) {
      if (!config.hentFeltVerdi) continue;
      const objektId = kolId.slice(FELT_PREFIKS.length);
      if (!valgteSet.has(config.hentFeltVerdi(rad, objektId))) return false;
      continue;
    }

    if (kolId === "frist" && config.hentFrist) {
      if (!matcherFristFilter(config.hentFrist(rad), valgteSet)) return false;
      continue;
    }

    const radVerdi = config.hentVerdi(rad, kolId);
    if (radVerdi === undefined) continue; // ukjent kolonne → ikke filtrer
    if (!valgteSet.has(radVerdi)) return false;
  }
  return true;
}

/** Filtrerer en rad-liste på `filterVerdier` via {@link radMatcherFilter}. */
export function filtrerRader<T>(
  rader: T[],
  filterVerdier: Record<string, string>,
  config: TabellFilterConfig<T>,
): T[] {
  return rader.filter((rad) => radMatcherFilter(rad, filterVerdier, config));
}
