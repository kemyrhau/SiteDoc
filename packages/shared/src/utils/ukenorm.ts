// ============================================================================
//  Ukenorm — avledet, ALDRI lagret verdi (ORDRE 2 STEG 1, designnotat § D1).
//
//  37,5 t (vinter) / 40 t (sommer) forekommer ALDRI som literal. Ukenormen er
//  emergent: summen av EFFEKTIV dagsnorm for ukens arbeidsdager (man–fre).
//  Sesong, halvdager og helligdager virker automatisk fordi de allerede bor i
//  ArbeidstidsKalender og reflekteres i dagsnorm-oppslaget.
//
//  Dagsnorm-oppslaget er en INJISERT avhengighet — samme regnestykke, to
//  datakilder:
//    · server: hentEffektivArbeidstid(orgId, dato).dagsnorm
//    · mobil:  hentEffektivArbeidstidLokal(orgId, dato).dagsnorm
//  Injektoren fanger organizationId i en closure og returnerer den effektive
//  normen for datoen (0 for helligdag/firma_fri, redusert for halvdag). Denne
//  funksjonen er ren aritmetikk over de per-dag-verdiene — ingen regel-kunnskap,
//  ingen ny lagring, ingen ny innstilling.
//
//  Overgangsuker regnes BLANDET: en uke der sommertid starter onsdag får norm =
//  2 vinterdager + 3 sommerdager. Det er en konsekvens av modellen, ikke et
//  valg — og skal vises per uke i UI, aldri som fast tall.
// ============================================================================

export interface UkenormDag {
  /** ISO-dato YYYY-MM-DD. */
  dato: string;
  /** Effektiv dagsnorm i timer for denne datoen (fra injisert oppslag). */
  dagsnorm: number;
}

export interface UkenormResultat {
  /** Ukenorm i timer = Σ dagsnorm for arbeidsdagene (man–fre). */
  norm: number;
  /** Per-dag-nedbryting for de fem arbeidsdagene (transparens i UI). */
  perDag: UkenormDag[];
}

/** Legg `n` dager til en ISO-dato (YYYY-MM-DD) i UTC. Ren, tidssone-nøytral. */
function leggTilDager(isoDato: string, n: number): string {
  const [aar, mnd, dag] = isoDato.split("-").map(Number);
  const d = new Date(Date.UTC(aar ?? 1970, (mnd ?? 1) - 1, dag ?? 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Beregn ukenorm fra ukestart (mandag, YYYY-MM-DD) ved å summere effektiv
 * dagsnorm for man–fre via det injiserte oppslaget.
 *
 * @param ukestart      Mandagens ISO-dato (YYYY-MM-DD).
 * @param hentDagsnorm  Injisert: dato (YYYY-MM-DD) → effektiv dagsnorm i timer.
 *                      Skal returnere 0 for helligdag/firma_fri og redusert
 *                      norm for halvdag — kalender-kunnskapen bor i injektoren.
 * @param arbeidsdager  Antall arbeidsdager fra ukestart (default 5 = man–fre).
 */
export function beregnUkenorm(
  ukestart: string,
  hentDagsnorm: (dato: string) => number,
  arbeidsdager = 5,
): UkenormResultat {
  const perDag: UkenormDag[] = [];
  for (let i = 0; i < arbeidsdager; i++) {
    const dato = leggTilDager(ukestart, i);
    const dagsnorm = Math.max(0, hentDagsnorm(dato));
    perDag.push({ dato, dagsnorm });
  }
  const norm = Math.round(perDag.reduce((sum, d) => sum + d.dagsnorm, 0) * 100) / 100;
  return { norm, perDag };
}
