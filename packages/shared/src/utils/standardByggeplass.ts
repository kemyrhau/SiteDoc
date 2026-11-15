/**
 * (18) Standardvalg av byggeplass når et prosjekt åpnes (mobil + web).
 *
 * Et prosjekt med byggeplasser skal stå på en byggeplass, ikke på «Hele prosjektet»,
 * når brukeren ikke har valgt noe selv. Rekkefølge når det ikke finnes et lagret valg:
 *   (a) sist brukte byggeplass på prosjektet (brukerminne `sistBruktByggeplass`),
 *   (b) nærmeste byggeplass etter GPS (kun mobil, eksisterende logikk),
 *   (c) første byggeplass i lista.
 * «Hele prosjektet» velges bare når brukeren har valgt det selv — da er det et lagret
 * valg (sentinel) og respekteres. Et lagret valg røres aldri. 0 byggeplasser → null
 * (uendret: prosjektet har ingen byggeplass å stå på).
 */

/** Sentinel for et eksplisitt valgt «Hele prosjektet». Samme verdi på mobil og web. */
export const HELE_PROSJEKTET_VALG = "__hele_prosjektet__";

export interface StandardByggeplassInput {
  /** Prosjektets byggeplass-id-er i visningsrekkefølge (sortert på nummer). */
  byggeplassIder: readonly string[];
  /** Brukerens lagrede valg for prosjektet (byggeplass-id eller sentinel), null = intet. */
  lagret: string | null | undefined;
  /** Sist brukte byggeplass på prosjektet fra brukerminnet (kan være sentinel). */
  sistBrukt?: string | null;
  /** Nærmeste byggeplass etter GPS (kun mobil). */
  gpsNaermeste?: string | null;
}

/**
 * Byggeplassen prosjektet skal stå på: en byggeplass-id, `HELE_PROSJEKTET_VALG`, eller
 * null når prosjektet ikke har byggeplasser. Et lagret valg som ikke lenger finnes i lista
 * (slettet byggeplass) faller videre til (a)→(b)→(c).
 */
export function velgStandardByggeplass(input: StandardByggeplassInput): string | null {
  const { byggeplassIder, lagret, sistBrukt, gpsNaermeste } = input;
  if (byggeplassIder.length === 0) return null;
  const finnes = (id: string | null | undefined): id is string =>
    !!id && byggeplassIder.includes(id);

  if (lagret === HELE_PROSJEKTET_VALG) return HELE_PROSJEKTET_VALG;
  if (finnes(lagret)) return lagret;

  // (a) Brukerminnet. Et eksplisitt «Hele prosjektet» fra en annen enhet er også brukerens valg.
  if (sistBrukt === HELE_PROSJEKTET_VALG) return HELE_PROSJEKTET_VALG;
  if (finnes(sistBrukt)) return sistBrukt;
  // (b) GPS.
  if (finnes(gpsNaermeste)) return gpsNaermeste;
  // (c) Første i lista.
  return byggeplassIder[0]!;
}

/**
 * (18) RETUR, GATE (42) vilkår 2: byggeplassen timer-/innsjekk-forbrukerne (mobil Bekreft dag,
 * innsjekk, ny timer-rad) får. Samme som før (18): lagret valg eller GPS, ellers null —
 * ALDRI (c) «første byggeplass». Et gjett som destinasjon for reise/km bryter
 * «Bekreft dag påvirkes ikke» og `velgDestinasjon` (`sted.ts`: «ALDRI prosjekter[0]»).
 * Visning og listefilter bruker `velgStandardByggeplass` (med (c)).
 */
export function velgTimerByggeplass(input: StandardByggeplassInput): string | null {
  const { byggeplassIder, lagret, gpsNaermeste } = input;
  if (lagret === HELE_PROSJEKTET_VALG) return null;
  // Ukjent/tom liste: lagret verdi som før (ingen validering mulig).
  if (byggeplassIder.length === 0) return lagret ?? null;
  if (lagret && byggeplassIder.includes(lagret)) return lagret;
  if (gpsNaermeste && byggeplassIder.includes(gpsNaermeste)) return gpsNaermeste;
  return null;
}

/**
 * (20) Nøytralt navn på samme regel for dokumentopprettelse (sjekkliste/oppgave, mobil + web):
 * lagret valg → GPS (kun mobil) → ingen. Samme funksjon, ingen kopi — opprett-vinduet gjetter
 * aldri (c) «første byggeplass»; dokumentet får byggeplass bare når brukeren har valgt en.
 */
export const velgByggeplassUtenGjett = velgTimerByggeplass;

/**
 * (22) Byggeplassfilteret i toppen (web + mobil) — Kenneth 2026-11-15: «Hele prosjektet» er
 * ikke et alternativ; «velg fra gps hvis tilgjengelig, neste sist valgte, tredje, be bruker
 * velge byggeplass» + TILLEGG «sjekker inn på ny byggeplass -> da åpnes det innsjekkede
 * byggeplassen først».
 *
 * Nyeste hendelse vinner:
 *   1. Innsjekk (timer-besøk eller PSI) som er NYERE enn det manuelle valget.
 *   2. GPS-treff på en ANNEN byggeplass enn GPS viste da det manuelle valget ble gjort
 *      (ellers ville GPS overstyre brukerens bevisste valg ved hver lasting).
 *   3. Sist manuelle valg.
 *   4. null → «Velg byggeplass» (brukeren velger). Aldri «første», aldri «Hele prosjektet».
 * Uten manuelt valg: innsjekk → GPS → null. Id-er som ikke finnes i prosjektet (slettet
 * byggeplass, annet prosjekt, gammel «Hele prosjektet»-sentinel) teller ikke.
 * Timer/Bekreft dag/innsjekk bruker fortsatt `velgTimerByggeplass` (urørt).
 */
export interface FilterByggeplassInput {
  /** Prosjektets byggeplass-id-er. */
  byggeplassIder: readonly string[];
  /** Nyeste innsjekk på prosjektet (`tid` i ms). */
  innsjekk?: { id: string | null; tid: number } | null;
  /** Nærmeste byggeplass etter GPS nå (kun mobil). */
  gps?: string | null;
  /** Sist manuelle valg: `tid` i ms, `gpsVedValg` = GPS-treffet da valget ble gjort. */
  manuelt?: { id: string; tid: number; gpsVedValg?: string | null } | null;
}

export function velgFilterByggeplass(input: FilterByggeplassInput): string | null {
  const { byggeplassIder, innsjekk, gps, manuelt } = input;
  if (byggeplassIder.length === 0) return null;
  const finnes = (id: string | null | undefined): id is string =>
    !!id && byggeplassIder.includes(id);

  const m = manuelt && finnes(manuelt.id) ? manuelt : null;
  if (innsjekk && finnes(innsjekk.id) && (!m || innsjekk.tid > m.tid)) return innsjekk.id;
  if (finnes(gps) && (!m || gps !== (m.gpsVedValg ?? null))) return gps;
  if (m) return m.id;
  return null;
}
