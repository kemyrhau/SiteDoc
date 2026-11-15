/**
 * ORDRE (20) linja + (20b) (Kenneth-vedtak 2026-11-15): «Byggeplass ikke valgt · Velg» øverst i
 * sjekkliste/oppgave (mobil + web).
 *
 * «Hele prosjektet» er kun et visningsfilter — aldri en verdi på dokumentet. I et prosjekt med
 * byggeplasser hører hvert dokument til én byggeplass; mangler den, ber linja om valg.
 */
export interface ByggeplassIkkeValgtInput {
  byggeplassId: string | null | undefined;
  /** Antall byggeplasser på prosjektet. */
  antallByggeplasser: number;
  /** Brukeren kan redigere dokumentet (ikke lesemodus/låst). */
  kanRedigere: boolean;
}

/** Linja vises når byggeplass mangler, prosjektet har byggeplasser og brukeren kan redigere. */
export function visByggeplassIkkeValgt(d: ByggeplassIkkeValgtInput): boolean {
  return !d.byggeplassId && d.antallByggeplasser > 0 && d.kanRedigere;
}

/**
 * ORDRE 29 #6: bytte av byggeplass (web-sjekklistechipen; (20b) også mobilens byggeplassvalg). Tegningen fjernes alltid (den hører til
 * den gamle byggeplassen). Et område hører også til den gamle byggeplassen, så omfang «omrade»
 * nullstilles sammen med `omradeId` — ellers ville serveren avvise omfang «omrade» uten område.
 * Omfang «punkt» mister tegningen og nullstilles, og pinnen tømmes (en pin uten tegning er
 * meningsløs). «Hele byggeplassen» (+ fritekst) gjelder like godt den nye byggeplassen og beholdes.
 */
export function byggeplassByttInput(
  naavaerendeOmfang: "punkt" | "byggeplass" | "omrade" | null | undefined,
  nyByggeplassId: string | null,
): {
  byggeplassId: string | null;
  drawingId: null;
  positionX: null;
  positionY: null;
  omradeId: null;
  lokasjonOmfang?: null;
} {
  const base = {
    byggeplassId: nyByggeplassId,
    drawingId: null,
    positionX: null,
    positionY: null,
    omradeId: null,
  } as const;
  return naavaerendeOmfang === "omrade" || naavaerendeOmfang === "punkt"
    ? { ...base, lokasjonOmfang: null }
    : { ...base };
}
