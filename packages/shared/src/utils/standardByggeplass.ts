/**
 * Byggeplassvalg for et prosjekt (mobil + web).
 *
 * TILLEGG (22) — Kenneth 2026-11-15: «fjern "hele prosjektet" fra alle referanser». Det finnes
 * ikke lenger et valg som betyr «hele prosjektet»; et prosjekt med byggeplasser står på én
 * byggeplass eller på intet valg («Velg byggeplass»).
 */

/**
 * Verdien eldre app-versjoner (før (22)) lagret for et valgt «hele prosjektet», lokalt og i
 * brukerminnet. Den kan fortsatt ligge lagret hos brukere; den leses som intet valg.
 */
const UTGAATT_LAGRET_VALG = "__hele_prosjektet__";

/** Lagret byggeplassvalg renset for den utgåtte verdien: utgått → null («intet valg»). */
export function rensLagretByggeplassValg(id: string | null | undefined): string | null {
  if (!id || id === UTGAATT_LAGRET_VALG) return null;
  return id;
}

export interface StandardByggeplassInput {
  /** Prosjektets byggeplass-id-er i visningsrekkefølge (sortert på nummer). */
  byggeplassIder: readonly string[];
  /** Brukerens lagrede valg for prosjektet, null = intet. */
  lagret: string | null | undefined;
  /** Nærmeste byggeplass etter GPS (kun mobil). */
  gpsNaermeste?: string | null;
}

/**
 * (18) RETUR, GATE (42) vilkår 2: byggeplassen timer-/innsjekk-forbrukerne (mobil Bekreft dag,
 * innsjekk, ny timer-rad) får: lagret valg eller GPS, ellers null — ALDRI «første byggeplass».
 * Et gjett som destinasjon for reise/km bryter «Bekreft dag påvirkes ikke» og `velgDestinasjon`
 * (`sted.ts`: «ALDRI prosjekter[0]»). Den utgåtte lagrede verdien er intet valg
 * (`rensLagretByggeplassValg`).
 */
export function velgTimerByggeplass(input: StandardByggeplassInput): string | null {
  const { byggeplassIder, gpsNaermeste } = input;
  const lagret = rensLagretByggeplassValg(input.lagret);
  // Ukjent/tom liste: lagret verdi som før (ingen validering mulig).
  if (byggeplassIder.length === 0) return lagret;
  if (lagret && byggeplassIder.includes(lagret)) return lagret;
  if (gpsNaermeste && byggeplassIder.includes(gpsNaermeste)) return gpsNaermeste;
  return null;
}

/**
 * (20) Nøytralt navn på samme regel for dokumentopprettelse (sjekkliste/oppgave, mobil + web):
 * lagret valg → GPS (kun mobil) → ingen. Samme funksjon, ingen kopi — opprett-vinduet gjetter
 * aldri «første byggeplass»; dokumentet får byggeplass bare når brukeren har valgt en.
 */
export const velgByggeplassUtenGjett = velgTimerByggeplass;

/**
 * (22) Byggeplassfilteret i toppen (web + mobil) — Kenneth 2026-11-15: én byggeplass eller intet valg; «velg fra gps hvis tilgjengelig, neste sist valgte, tredje, be bruker
 * velge byggeplass» + TILLEGG «sjekker inn på ny byggeplass -> da åpnes det innsjekkede
 * byggeplassen først».
 *
 * Nyeste hendelse vinner:
 *   1. Innsjekk (timer-besøk eller PSI) som er NYERE enn det manuelle valget.
 *   2. GPS-treff på en ANNEN byggeplass enn GPS viste da det manuelle valget ble gjort
 *      (ellers ville GPS overstyre brukerens bevisste valg ved hver lasting).
 *   3. Sist manuelle valg.
 *   4. null → «Velg byggeplass» (brukeren velger). Aldri «første».
 * Uten manuelt valg: innsjekk → GPS → null. Id-er som ikke finnes i prosjektet (slettet
 * byggeplass, annet prosjekt, utgått lagret verdi) teller ikke.
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
