/**
 * Append-only felt-låsing — delt kilde for OPPGAVE-hookene (web + mobil).
 *
 * Scope (vedtatt 2026-07-16): append-only gjelder KUN oppgave. Spec
 * (`dokumentflyt.md § 2`): oppgave = «Aldri redigerbar — append-only fra
 * opprettelse»; sjekkliste = «Redigerbar — den som har ballen + admin/registrator
 * alltid». `04f6d295` slo på låsen for alle fire hooks; det var riktig for
 * oppgave (mobil manglet den) men feil for sjekkliste (låste innsendte felt
 * permanent, også for admin). Sjekkliste-hookene bruker den derfor IKKE lenger.
 *
 * Bakgrunn: append-only redigering («felt med eksisterende verdi er låst, nye
 * felt kan fylles ut») ble opprinnelig bygget kun i web `useOppgaveSkjema`
 * (commit eb984d91). For å unngå kopi bor predikatet + lås-utledningen her, og
 * begge oppgave-hookene importerer den.
 *
 * VIKTIG (mobil): lås-settet skal ALLTID beregnes fra server-bekreftet data
 * (`Task.data` fra query), ALDRI fra lokal usynkronisert SQLite-verdi. Ellers
 * låses et felt brukeren nettopp fylte offline og ikke har sendt.
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
