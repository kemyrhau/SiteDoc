import { SUBDOMAIN_FORM } from "@sitedoc/shared";

/**
 * HM1 (Kenneth 2026-11-23): hvilke maler hver av de tre mallistene viser.
 *
 * `domain === "hms"` er HMS-markøren — ikke `category`. Standardmodulen «HMS-avvik»
 * (`PROSJEKT_MODULER`) lager HMS-avvik og RUH som `category: "oppgave"` og SJA som
 * `category: "sjekkliste"`, alle med `domain: "hms"`. Malene beholder kategorien sin
 * (oppgave-/sjekkliste-egenskapene); bare lista de står i, avgjøres av domenet:
 *  - HMS-maler: alle `domain === "hms"`, uansett kategori.
 *  - Oppgavemaler / Sjekklistemaler: riktig kategori og ikke `domain === "hms"`.
 */
export type MalListeKategori = "oppgave" | "sjekkliste" | "hms";

export function hørerTilMalListe(
  mal: { category: string; domain: string },
  kategori: MalListeKategori,
): boolean {
  const erHms = mal.domain === "hms";
  if (kategori === "hms") return erHms;
  return !erHms && mal.category === kategori;
}

/**
 * HM1 tillegg B (Kenneth 2026-11-23): kategorien rediger-dialogen lagrer.
 *
 * Dialogen viser «HMS» som type for alle `domain === "hms"`-maler. En seedet HMS-mal
 * (category oppgave/sjekkliste) skal beholde kategorien sin — ellers mister den
 * oppgave-/sjekkliste-egenskapene, og med dokumenter avviser `mal.oppdater` lagringen
 * («Kan ikke endre mal-type»). Skifter brukeren undertype, følger formen undertypen
 * (SJA → sjekkliste, avvik/RUH → oppgave), slik serveren krever.
 *  - Valgt type ikke HMS: valgt type lagres.
 *  - Valgt HMS, malen var domain hms med category oppgave/sjekkliste: form etter undertype.
 *  - Ellers: «hms» (eldre HMS-mal, eller byggmal gjort om til HMS).
 */
export function lagretMalKategori(
  valgt: MalListeKategori,
  opprinnelig: { category: string; domain: string },
  hmsSubdomain: "avvik" | "sja" | "ruh",
): MalListeKategori {
  if (valgt !== "hms") return valgt;
  const seedetHms =
    opprinnelig.domain === "hms" &&
    (opprinnelig.category === "oppgave" || opprinnelig.category === "sjekkliste");
  if (!seedetHms) return "hms";
  return SUBDOMAIN_FORM[hmsSubdomain];
}

/**
 * HM2 (Kenneth 2026-11-24): kategorien «Ny …-mal» lagrer.
 *
 * «Ny HMS-mal» lagrer formen undertypen tilsier — avvik/RUH → «oppgave», SJA →
 * «sjekkliste» — med `domain: "hms"`, så malen får oppgave-/sjekkliste-egenskapene og
 * står i HMS-lista (`hørerTilMalListe`). Oppgave-/sjekklistemaler lagres som valgt.
 * Bare nye maler: eldre maler med category «hms» røres ikke.
 */
export function nyMalKategori(
  kategori: MalListeKategori,
  hmsSubdomain: "avvik" | "sja" | "ruh",
): "oppgave" | "sjekkliste" {
  return kategori === "hms" ? SUBDOMAIN_FORM[hmsSubdomain] : kategori;
}

/**
 * HM2: forklaringslinja under undertypevalget i «Ny HMS-mal» — skifter med formen
 * undertypen gir (i18n-nøkkel).
 */
export function hmsFormForklaringNokkel(
  hmsSubdomain: "avvik" | "sja" | "ruh",
): "hms.subdomain.formOppgave" | "hms.subdomain.formSjekkliste" {
  return SUBDOMAIN_FORM[hmsSubdomain] === "sjekkliste"
    ? "hms.subdomain.formSjekkliste"
    : "hms.subdomain.formOppgave";
}
