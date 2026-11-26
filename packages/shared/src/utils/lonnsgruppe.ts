/**
 * Lønnsgrupper — regelen ett sted (spec-lonnsgrupper.md § 3, Kenneth 2026-11-26):
 * «lønnsgruppe- må styre hvilke timerader den enkelte har tilgang på. Hvis lønnsgruppe ikke
 * er valgt, gjelder den for alle.»
 *
 * Server, web og mobil bruker de samme funksjonene.
 *  1. En katalograd (lønnsart, tillegg, utleggskategori) gjelder den ansatte når den ikke har
 *     noen gruppe, eller når den ansattes gruppe er blant dem.
 *  2. Alle ansatte har en gruppe («Ordinær» som standard) — en rad merket bare «Lærling» er
 *     skjult for alle i «Ordinær», og en rad merket bare «Ordinær» er skjult for lærlingen.
 *  3. Det er EIEREN av dagsseddelen som teller, ikke den som er logget inn: kalleren sender
 *     eierens gruppe (seddelsvarenes `eierLonnsgruppeId`), også når en leder retter i attesteringen.
 */

/** Katalograd slik katalogsvarene sender den: gruppene raden er merket med (tom = alle). */
export interface LonnsgruppeMerket {
  lonnsgruppeIder: readonly string[];
}

/** Regel 1: gjelder raden den ansatte med gruppa `ansattLonnsgruppeId`? */
export function gjelderLonnsgruppe(
  radLonnsgruppeIder: readonly string[],
  ansattLonnsgruppeId: string,
): boolean {
  return radLonnsgruppeIder.length === 0 || radLonnsgruppeIder.includes(ansattLonnsgruppeId);
}

/** Utvalget den ansatte (seddelens eier) har tilgang på. Rekkefølgen beholdes. */
export function filtrerForLonnsgruppe<T extends LonnsgruppeMerket>(
  rader: readonly T[],
  ansattLonnsgruppeId: string,
): T[] {
  return rader.filter((r) => gjelderLonnsgruppe(r.lonnsgruppeIder, ansattLonnsgruppeId));
}
