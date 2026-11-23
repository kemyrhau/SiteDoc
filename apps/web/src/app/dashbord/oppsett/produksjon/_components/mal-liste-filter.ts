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
