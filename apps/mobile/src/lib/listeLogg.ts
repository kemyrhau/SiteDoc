// Logg for sjekklistelistas henting (ORDRE 5, 2026-10-29): spinneren i lista etter KD11 kunne ikke
// måles i kode. Én `console.warn` ved start og slutt, med varighet og utfall. Skrives bare i
// `__DEV__` (M2, 2026-10-30). Aldri URL-er eller persondata, bare antall rader.

export interface ListeLoggInn {
  henter: boolean;
  naa: number;
  /** Skjermen som eier spørringen (sjekklister, hjem, innboks). */
  sted: string;
  antall?: number;
  feilet?: boolean;
}

/** Neste tilstand (starttid for pågående henting) og eventuell logglinje ved en overgang. */
export function nesteListeLogg(start: number | null, inn: ListeLoggInn): { start: number | null; linje: string | null } {
  if (inn.henter) {
    if (start !== null) return { start, linje: null };
    return { start: inn.naa, linje: `[liste] sjekkliste.hentForProsjekt start (${inn.sted})` };
  }
  if (start === null) return { start: null, linje: null };
  const utfall = inn.feilet ? "feil" : `ok, ${inn.antall ?? 0} rader`;
  return { start: null, linje: `[liste] sjekkliste.hentForProsjekt slutt ${inn.naa - start} ms, ${utfall} (${inn.sted})` };
}
