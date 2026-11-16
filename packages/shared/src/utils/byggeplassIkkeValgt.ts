/**
 * ORDRE (20) linja + (20b) (Kenneth-vedtak 2026-11-15): «Byggeplass ikke valgt · Velg» øverst i
 * sjekkliste/oppgave (mobil + web).
 *
 * I et prosjekt med byggeplasser hører hvert dokument til én byggeplass; mangler den, ber linja om valg.
 */
export interface ByggeplassIkkeValgtInput {
  byggeplassId: string | null | undefined;
  /** Antall byggeplasser på prosjektet. */
  antallByggeplasser: number;
  /** Brukeren kan redigere dokumentet (ikke lesemodus/låst). */
  kanRedigere: boolean;
  /** Dokumentets tegning (ORDRE (21)): med tegning velges byggeplass via tegningen, ikke direkte. */
  drawingId?: string | null;
}

/**
 * ORDRE (21) (Kenneth-vedtak 2026-11-15): byggeplassen følger tegningen. To veier å bytte
 * byggeplass fra et dokument: (1) velg byggeplass før tegning er valgt, (2) velg en tegning fra en
 * annen byggeplass. Med tegning kan byggeplass derfor ikke velges direkte — chip/rad viser
 * tegningens byggeplass uten byttevalg. Serveren håndhever det samme (`velgTaskByggeplass`).
 */
export function kanVelgeByggeplassDirekte(drawingId: string | null | undefined): boolean {
  return !drawingId;
}

/**
 * Linja vises når byggeplass mangler, prosjektet har byggeplasser, brukeren kan redigere og
 * byggeplassen kan velges direkte (ingen tegning — ORDRE (21)).
 */
export function visByggeplassIkkeValgt(d: ByggeplassIkkeValgtInput): boolean {
  return (
    !d.byggeplassId &&
    d.antallByggeplasser > 0 &&
    d.kanRedigere &&
    kanVelgeByggeplassDirekte(d.drawingId)
  );
}

/**
 * ORDRE 29 #6: bytte av byggeplass (web-sjekklistechipen; (20b) også mobilens byggeplassvalg).
 * Brukes kun når dokumentet er uten tegning (ORDRE (21), `kanVelgeByggeplassDirekte`). Tegningen fjernes alltid (den hører til
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
