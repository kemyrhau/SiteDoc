/**
 * ORDRE (20) punkt 2, alternativ A (2026-11-15): «Byggeplass ikke valgt · Velg» øverst i
 * sjekkliste/oppgave (mobil + web).
 *
 * `lokasjonOmfang = "prosjekt"` betyr at brukeren selv valgte «Hele prosjektet». null betyr
 * «ikke valgt» — også alle dokumenter fra før verdien fantes. Kolonnen er String; ingen migrering.
 */
export const LOKASJON_OMFANG_PROSJEKT = "prosjekt";

export interface ByggeplassIkkeValgtInput {
  byggeplassId: string | null | undefined;
  /** Antall byggeplasser på prosjektet. */
  antallByggeplasser: number;
  lokasjonOmfang: string | null | undefined;
  /** Brukeren kan redigere dokumentet (ikke lesemodus/låst). */
  kanRedigere: boolean;
}

/** Linja vises når byggeplass mangler, prosjektet har byggeplasser, ingen bevisst «Hele prosjektet», og brukeren kan redigere. */
export function visByggeplassIkkeValgt(d: ByggeplassIkkeValgtInput): boolean {
  return (
    !d.byggeplassId &&
    d.antallByggeplasser > 0 &&
    d.lokasjonOmfang !== LOKASJON_OMFANG_PROSJEKT &&
    d.kanRedigere
  );
}

/**
 * Omfanget et nytt dokument skal få fra brukerens kontekstvalg: «prosjekt» kun når brukeren
 * selv har valgt «Hele prosjektet» på et prosjekt med byggeplasser. Ellers `undefined` (urørt).
 */
export function opprettLokasjonOmfang(
  erHeleProsjektet: boolean,
  antallByggeplasser: number,
): typeof LOKASJON_OMFANG_PROSJEKT | undefined {
  return erHeleProsjektet && antallByggeplasser > 0 ? LOKASJON_OMFANG_PROSJEKT : undefined;
}
