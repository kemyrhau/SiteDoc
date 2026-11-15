/**
 * Leser dokument-lokasjon (tegningsmarkør) fra et RÅ dokument-query-resultat (checklist/task fra
 * `hentMedId` — har `drawingId`/`positionX`/`positionY` + `drawing`-relasjonen med byggeplass).
 *
 * 🔴 Bakgrunn (2026-08-23): oppgave-detaljsiden viste «Lokasjon: Ikke satt» selv når oppgaven HADDE
 * drawingId + posisjon. Rotårsak: den leste fra det OMFORMEDE `oppgave`-objektet fra
 * `useOppgaveSkjema`, som dropper `drawingId`/`positionX`/`positionY`/`drawing` — og `as unknown as`
 * skjulte de manglende feltene. Denne helperen tar det RÅ query-resultatet (fullOppgaveRå/
 * fullSjekklisteRå), så feltene faktisk finnes. Byggeplass (ORDRE 28): dokumentets egen byggeplass
 * først, tegningens som reserve (eldre Task-rader uten egen verdi).
 */
export type LokasjonOmfangVerdi = "punkt" | "byggeplass" | "omrade" | "prosjekt";

export interface DokumentLokasjon {
  tegningId: string | null;
  tegningNavn: string | null;
  bygningNavn: string | null;
  positionX: number | null;
  positionY: number | null;
  /** Lokasjonsomfang (2026-09-04): "punkt" | "byggeplass" | "omrade" (steg 2b) | "prosjekt"
   * (ORDRE (20), 2026-11-15: brukeren valgte selv «Hele prosjektet») | null. */
  lokasjonOmfang: LokasjonOmfangVerdi | null;
  /** Fritekst-sted (2026-09-06) — påheng på byggeplass når tegning mangler. */
  lokasjonFritekst: string | null;
  /** Område-referanse (steg 2b, 2026-09-23) — satt når lokasjonOmfang="omrade". */
  omradeId: string | null;
}

export function lesDokumentLokasjon(raaDok: unknown): DokumentLokasjon {
  const d = raaDok as
    | {
        drawingId?: string | null;
        positionX?: number | null;
        positionY?: number | null;
        lokasjonOmfang?: LokasjonOmfangVerdi | null;
        lokasjonFritekst?: string | null;
        omradeId?: string | null;
        drawing?: { name?: string | null; byggeplass?: { name?: string | null } | null } | null;
        byggeplass?: { name?: string | null } | null;
      }
    | undefined;
  return {
    tegningId: d?.drawingId ?? null,
    tegningNavn: d?.drawing?.name ?? null,
    bygningNavn: d?.byggeplass?.name ?? d?.drawing?.byggeplass?.name ?? null,
    positionX: d?.positionX ?? null,
    positionY: d?.positionY ?? null,
    lokasjonOmfang: d?.lokasjonOmfang ?? null,
    lokasjonFritekst: d?.lokasjonFritekst ?? null,
    omradeId: d?.omradeId ?? null,
  };
}

/**
 * ORDRE 29 #1: områdelista i lokasjonsvelgeren viser bare områdene på valgt byggeplass. Uten
 * valgt byggeplass («Alle») vises alle. Hvert område hører til nøyaktig én byggeplass (påkrevd i
 * skjemaet), så et område fra en annen byggeplass kan ikke velges inn på dokumentet.
 */
export function filtrerOmrader<T extends { byggeplassId: string }>(
  omrader: readonly T[],
  byggeplassId: string | null | undefined,
): T[] {
  return byggeplassId ? omrader.filter((o) => o.byggeplassId === byggeplassId) : [...omrader];
}

/**
 * ORDRE 29 #1/#5: byggeplassen et lokasjonsvalg uten tegning (hele byggeplassen, fritekst) skal
 * bære. Rekkefølge: byggeplassen valgt i velgeren → dokumentets egen → toppbarens aktive. Returnerer
 * `undefined` (ikke null) når ingen finnes, så serveren lar dokumentets byggeplass stå urørt — et
 * lokasjonsvalg tømmer aldri byggeplassen.
 */
export function byggeplassForLokasjon(kilder: {
  valgt?: string | null;
  dokument?: string | null;
  aktiv?: string | null;
}): string | undefined {
  return kilder.valgt || kilder.dokument || kilder.aktiv || undefined;
}

/**
 * ORDRE 29 #6: bytte av byggeplass via sjekkliste-chipen. Tegningen fjernes alltid (den hører til
 * den gamle byggeplassen). Et område hører også til den gamle byggeplassen, så omfang «omrade»
 * nullstilles sammen med `omradeId` — ellers ville serveren avvise omfang «omrade» uten område.
 * Omfang «punkt» mister tegningen og nullstilles, og pinnen tømmes (en pin uten tegning er
 * meningsløs). «Hele byggeplassen» (+ fritekst) gjelder like godt den nye byggeplassen og beholdes.
 * ORDRE (20) linja: tomvalget («Hele prosjektet», `nyByggeplassId` null) er brukerens eget valg og
 * lagres som omfang «prosjekt», så «Byggeplass ikke valgt» ikke vises. Valg av en byggeplass
 * nullstiller «prosjekt» (serveren gjør det samme).
 */
export function byggeplassByttInput(
  naavaerendeOmfang: LokasjonOmfangVerdi | null | undefined,
  nyByggeplassId: string | null,
): {
  byggeplassId: string | null;
  drawingId: null;
  positionX: null;
  positionY: null;
  omradeId: null;
  lokasjonOmfang?: null | "prosjekt";
} {
  const base = {
    byggeplassId: nyByggeplassId,
    drawingId: null,
    positionX: null,
    positionY: null,
    omradeId: null,
  } as const;
  if (nyByggeplassId === null) return { ...base, lokasjonOmfang: "prosjekt" };
  return naavaerendeOmfang === "omrade" || naavaerendeOmfang === "punkt" || naavaerendeOmfang === "prosjekt"
    ? { ...base, lokasjonOmfang: null }
    : { ...base };
}
