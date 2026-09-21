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

import { utenforKravOppfylt } from "./grenseSjekk";

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
 * Strukturell form for et synlighetsobjekt. Bevisst løsere enn appenes `RapportObjekt`
 * (som bor per-app), slik at `@sitedoc/shared` ikke må avhenge av dem. `parentId` er
 * valgfri fordi et rot-objekt ikke har forelder; `null`/fravær behandles likt.
 */
export interface SynlighetsObjekt {
  id: string;
  type: string;
  config: Record<string, unknown>;
  parentId?: string | null;
}

/**
 * Er OBJEKTET synlig? Hele synlighetsspørsmålet i ÉN funksjon, lagt OVER
 * `erBetingelseOppfylt` (som svarer på verdimatchen alene). Rekursjonen oppover,
 * `conditionActive`, repeater-unntaket og `utenfor_krav`-avviksregelen lå tidligere
 * firedoblet i synlighets-hookene (web+mobil × sjekkliste+oppgave) — nå er dette
 * ÉN kilde de fire kaller, så rapporten (dokgen) svarer likt som skjermen.
 *
 * `hentVerdi(feltId)` gir det utfylte svaret for et felt (verdien direkte, ikke et
 * FeltVerdi-objekt). Kallstedet velger hvordan verdien hentes (web vs. lokal SQLite);
 * denne funksjonen kjenner bare verdien.
 *
 * 🔴 Ren flytting av hookenes `sjekkSynlighet` — ingen ny regel. Målt 2026-09-21:
 * de fire hookenes ytre logikk var linje-for-linje identisk (web/oppgave manglet kun
 * kommentarene). `erBetingelseOppfylt` og `utenforKravOppfylt` er URØRT.
 */
export function erObjektSynlig(
  objekt: SynlighetsObjekt,
  alleObjekter: SynlighetsObjekt[],
  hentVerdi: (feltId: string) => unknown,
): boolean {
  function sjekkSynlighet(obj: SynlighetsObjekt, dybde: number): boolean {
    if (dybde > 10) return true; // Sikkerhetsvakt mot uendelig rekursjon

    // Bruk parentId fra DB-kolonne (ny) med fallback til config (gammel)
    const parentId = obj.parentId ?? (obj.config.conditionParentId as string | undefined);
    if (!parentId) return true;

    const forelder = alleObjekter.find((o) => o.id === parentId);
    if (!forelder) return true; // Sikkerhets-fallback

    // Sjekk at forelderen selv er synlig (rekursivt)
    if (!sjekkSynlighet(forelder, dybde + 1)) return false;

    // Repeater-barn er alltid synlige (ingen betingelseslogikk)
    if (forelder.type === "repeater") return true;

    // Sjekk at forelderens betingelse er oppfylt
    if (!forelder.config.conditionActive) return true;

    // Avviksfelt-utløser (trinn 3 del C): tallfelt-forelder → vis barn når verdien bryter kravet.
    if (forelder.config.conditionType === "utenfor_krav") {
      return utenforKravOppfylt(forelder, hentVerdi(parentId), hentVerdi);
    }

    // Verdimatch-utløser — delt funksjon (per-barn: barnets eget sett vinner, ellers arves forelderens).
    const forelderVerdi = hentVerdi(parentId);
    return erBetingelseOppfylt(forelder, obj, forelderVerdi);
  }
  return sjekkSynlighet(objekt, 0);
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
