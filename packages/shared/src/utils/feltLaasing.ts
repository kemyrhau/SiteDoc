/**
 * Append-only felt-låsing — delt kilde for web + mobil, sjekkliste + oppgave.
 *
 * Bakgrunn: append-only redigering («felt med eksisterende verdi er låst, nye
 * felt kan fylles ut») ble opprinnelig bygget kun i web `useOppgaveSkjema`
 * (commit eb984d91). De tre andre skjema-hookene manglet den → et innsendt
 * felt kunne endres fra web-sjekkliste og fra mobil. For å unngå en fjerde
 * kopi bor predikatet + lås-utledningen her, og alle fire hooks importerer den.
 *
 * VIKTIG (mobil): lås-settet skal ALLTID beregnes fra server-bekreftet data
 * (`Checklist.data`/`Task.data` fra query), ALDRI fra lokal usynkronisert
 * SQLite-verdi. Ellers låses et felt brukeren nettopp fylte offline og ikke har
 * sendt. Da forblir egen usendt kladd redigerbar; et felt serveren alt har blir
 * låst ved neste åpning — samme semantikk som web.
 *
 * Merk: dette er en klient-lås (UI-håndhevelse). Server `oppdaterData` gjør i
 * dag shallow merge og håndhever IKKE append-only — se flytRolle.ts.
 */

/**
 * Har feltet en reell (ikke-tom) verdi? Tom streng, null/undefined og tom
 * array regnes som «ingen verdi» og låser derfor ikke.
 */
export function harFeltVerdi(verdi: unknown): boolean {
  return (
    verdi !== null &&
    verdi !== undefined &&
    verdi !== "" &&
    !(Array.isArray(verdi) && verdi.length === 0)
  );
}

/** Ett lagret felt slik det ligger i `Checklist.data`/`Task.data`. */
interface LagretFelt {
  verdi?: unknown;
}

/**
 * Beregn settet av objekt-IDer som er låst for verdi-endring (append-only):
 * felt som allerede har en server-bekreftet, ikke-tom verdi. Kommentar og
 * vedlegg låses ikke og skal håndteres separat i hooken.
 */
export function beregnLaasteFelter(
  serverData: Record<string, LagretFelt | undefined> | null | undefined,
): Set<string> {
  const laaste = new Set<string>();
  if (!serverData) return laaste;
  for (const [objektId, felt] of Object.entries(serverData)) {
    if (felt && harFeltVerdi(felt.verdi)) laaste.add(objektId);
  }
  return laaste;
}
