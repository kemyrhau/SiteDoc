/**
 * Årsvelgeren ved ukevalget i firmaets attestering (w1, plan web-timeføring tillegget til B7,
 * WM72). Datoen i tabellen står som «17.11.»; året står her og byttes i én handling i stedet for
 * å bla uke for uke. Ren regning (ingen DOM) så den kan testes.
 *
 * Ukene er ISO-uker (mandag–søndag), som sidens `ukeNummer`. Datoene regnes som kalenderdager
 * (Y/M/D lest lokalt, regnet i UTC) så sommertid aldri flytter en dag.
 */

const DAG_MS = 86_400_000;

/** Kalenderdag nr. (dager siden 1970-01-01) for datoens lokale Y/M/D. */
function dagNr(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAG_MS);
}

/** ISO-uke og ISO-år for en dato (uka hører til året torsdagen ligger i). */
export function isoUke(d: Date): { aar: number; uke: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const ukedag = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - ukedag);
  const aar = tmp.getUTCFullYear();
  const aarStart = Date.UTC(aar, 0, 1);
  return { aar, uke: Math.ceil(((tmp.getTime() - aarStart) / DAG_MS + 1) / 7) };
}

/** Antall ISO-uker i året (52 eller 53): uka 28. desember ligger i, er årets siste. */
export function ukerIAar(aar: number): number {
  return isoUke(new Date(aar, 11, 28)).uke;
}

/** Kalenderdag nr. for mandagen i ISO-uke `uke` i ISO-år `aar`. */
function mandagNr(aar: number, uke: number): number {
  const jan4 = Math.round(Date.UTC(aar, 0, 4) / DAG_MS);
  const ukedag = new Date(jan4 * DAG_MS).getUTCDay() || 7;
  return jan4 - (ukedag - 1) + (uke - 1) * 7;
}

/**
 * Ny `ukeOffset` (uker fra denne uka) når året byttes: samme ukenummer i det nye året.
 * Har det nye året færre uker (uke 53 → et år med 52), blir det årets siste uke.
 */
export function ukeOffsetForAar(ukestart: Date, nyttAar: number, idag: Date = new Date()): number {
  const uke = Math.min(isoUke(ukestart).uke, ukerIAar(nyttAar));
  const iDagMandag = dagNr(idag) - ((new Date(dagNr(idag) * DAG_MS).getUTCDay() || 7) - 1);
  return Math.round((mandagNr(nyttAar, uke) - iDagMandag) / 7);
}

/** Årene i velgeren: fem år tilbake til i år, og året som vises om det ligger utenfor. */
export function aarValg(idag: Date, valgtAar: number): number[] {
  const iAar = idag.getFullYear();
  const aar = new Set<number>([valgtAar]);
  for (let a = iAar - 5; a <= iAar; a++) aar.add(a);
  return [...aar].sort((a, b) => b - a);
}
