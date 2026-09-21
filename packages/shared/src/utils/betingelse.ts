/**
 * Betinget synlighet — utløsere PER BARN (2026-09-21).
 *
 * Bakgrunn: `conditionValues` er en egenskap ved FORELDEREN. Ett enkeltvalg som
 * forelder ga derfor ETT utløsersett delt av alle barna: «vis A når svaret er 1,
 * og B når svaret er 2» var ikke uttrykkbart. Logikken lå duplisert i fire
 * synlighets-hooks (web+mobil × sjekkliste+oppgave) — og det er slik grensen fikk
 * ligge uoppdaget. Denne funksjonen er ÉN kilde de fire kaller.
 *
 * Semantikk:
 *   - Har barnet et eget utløsersett (`config.conditionOwnValues` med ≥1 verdi):
 *     bruk BARNETS sett.
 *   - Ellers: bruk forelderens `config.conditionValues`, nøyaktig som før.
 *
 * 🔴 EGEN NØKKEL, ikke `conditionValues`: en kontainer som SELV er betinget barn
 * bruker allerede `conditionValues` i FORELDER-rollen (styrer SINE barn). Å lese
 * barn-rollen fra samme nøkkel ville kollidere i nøstede kontainere (eske-i-eske,
 * som malbyggeren støtter). `conditionOwnValues` er en ny, adskilt nøkkel.
 *
 * Bakoverkompatibelt: ingen eksisterende mal har `conditionOwnValues`, så alt som
 * finnes i dag arver forelderens sett → uendret oppførsel. En lånt, flat malkopi
 * (barn uten eget sett) er derfor upåvirket.
 *
 * Dekker KUN verdimatch-utløseren (`conditionType` fravær/"verdi"). `utenfor_krav`
 * (avviksfelt, `utenforKravOppfylt`), `conditionActive`, repeater-barn og
 * foreldrekjede-rekursjonen eies fortsatt av hooken.
 */

/** Nøkkelen for barnets EGET utløsersett i `config`. Adskilt fra forelderens `conditionValues`. */
export const BETINGELSE_EGEN_NOKKEL = "conditionOwnValues";

/** Har barnet et eget utløsersett (minst én verdi)? Tomt/fraværende → arver forelderen. */
export function harEgetUtloserSett(barn: { config: Record<string, unknown> }): boolean {
  const egne = barn.config[BETINGELSE_EGEN_NOKKEL];
  return Array.isArray(egne) && egne.length > 0;
}

/**
 * Er BARNET synlig gitt forelderens verdi? Barnets eget sett vinner når det finnes,
 * ellers arves forelderens. `forelderVerdi` er forelderens valgte verdi (streng =
 * enkeltvalg, array = flervalg). Sammenligningen er rå `includes`, identisk med den
 * fire-doblede blokken den erstatter.
 */
export function erBetingelseOppfylt(
  forelder: { config: Record<string, unknown> },
  barn: { config: Record<string, unknown> },
  forelderVerdi: unknown,
): boolean {
  const triggerVerdier = (harEgetUtloserSett(barn)
    ? (barn.config[BETINGELSE_EGEN_NOKKEL] as unknown[])
    : (forelder.config.conditionValues as unknown[])) ?? [];

  if (typeof forelderVerdi === "string") return triggerVerdier.includes(forelderVerdi);
  if (Array.isArray(forelderVerdi)) return forelderVerdi.some((v) => triggerVerdier.includes(v));
  return false;
}

/**
 * Malbygger-tre-transform: sett forelderens `conditionValues` UTEN å røre noe barn.
 * Ren funksjon (ny array, uendrede objekt-referanser for alle andre). Brukes av
 * MalByggerens `handleOppdaterBetingelseVerdier` — og er beviset for at redigering av
 * forelderens utløsersett ALDRI sletter et barns eget `conditionOwnValues`.
 */
export function settForelderBetingelseVerdier<
  T extends { id: string; config: Record<string, unknown> },
>(objekter: T[], parentId: string, verdier: string[]): T[] {
  return objekter.map((o) =>
    o.id === parentId ? { ...o, config: { ...o.config, conditionValues: verdier } } : o,
  );
}
