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
