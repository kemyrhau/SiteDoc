import { describe, it, expect } from "vitest";
import { malHorerTilFane, type ArkivFane } from "../arkiv-fane-filter";

/**
 * Negativkontroll for SiteDoc-fanens typefilter (ordre arkivmodal-typefilter, krav 2).
 *
 * 🔴 Poenget: en test som er grønn på et TOMT arkiv måler ingenting. Derfor blandes maler
 * av ALLE typer i ett datasett, og hver flate skal både SLIPPE INN riktig type OG STENGE UTE
 * feil type. Fjernes filteret (predikatet returnerer alltid true), FEILER ekskluderings-
 * assertene. Speiler `faneWhere` (`apps/api/src/routes/firmamal.ts:64-77`).
 */

// Blandet datasett — én mal i hver relevante (kategori × domene)-kombinasjon.
const MALER = [
  { id: "opg-kval", kategori: "oppgave", domene: "kvalitet" },
  { id: "opg-hms", kategori: "oppgave", domene: "hms" },
  { id: "sjekk-kval", kategori: "sjekkliste", domene: "kvalitet" },
  { id: "sjekk-bygg", kategori: "sjekkliste", domene: "bygg" },
  { id: "sjekk-hms", kategori: "sjekkliste", domene: "hms" },
];

function synlige(fane: ArkivFane | undefined): string[] {
  return MALER.filter((m) => malHorerTilFane(fane, m)).map((m) => m.id);
}

describe("malHorerTilFane — typefilter per flate", () => {
  it("oppgave-flaten viser kun kategori=oppgave (begge domener), ikke sjekklister", () => {
    const vist = synlige("oppgave");
    expect(vist).toEqual(expect.arrayContaining(["opg-kval", "opg-hms"]));
    // Negativkontroll: sjekklister slipper IKKE gjennom.
    expect(vist).not.toContain("sjekk-kval");
    expect(vist).not.toContain("sjekk-bygg");
    expect(vist).not.toContain("sjekk-hms");
    expect(vist).toHaveLength(2);
  });

  it("hms-flaten viser kun domene=hms (uansett kategori), ikke kvalitet/bygg", () => {
    const vist = synlige("hms");
    // Både oppgave-hms og sjekkliste-hms — domenet er aksen, ikke kategorien.
    expect(vist).toEqual(expect.arrayContaining(["opg-hms", "sjekk-hms"]));
    // Negativkontroll: ikke-hms slipper IKKE gjennom.
    expect(vist).not.toContain("opg-kval");
    expect(vist).not.toContain("sjekk-kval");
    expect(vist).not.toContain("sjekk-bygg");
    expect(vist).toHaveLength(2);
  });

  it("sjekkliste-flaten viser kategori=sjekkliste MINUS hms, ikke oppgaver", () => {
    const vist = synlige("sjekkliste");
    expect(vist).toEqual(expect.arrayContaining(["sjekk-kval", "sjekk-bygg"]));
    // Negativkontroll: oppgaver OG hms-sjekklister slipper IKKE gjennom (ellers dobbeltføring
    // med hms-flaten — «ekskludert HMS» er hele poenget).
    expect(vist).not.toContain("opg-kval");
    expect(vist).not.toContain("opg-hms");
    expect(vist).not.toContain("sjekk-hms");
    expect(vist).toHaveLength(2);
  });

  it("hms-sjekkliste dobbeltføres ikke: den er på HMS-flaten, ikke sjekkliste-flaten", () => {
    expect(malHorerTilFane("hms", { kategori: "sjekkliste", domene: "hms" })).toBe(true);
    expect(malHorerTilFane("sjekkliste", { kategori: "sjekkliste", domene: "hms" })).toBe(
      false,
    );
  });

  it("uten fane (prosjektsiden) slipper alle maler gjennom", () => {
    expect(synlige(undefined)).toHaveLength(MALER.length);
  });
});
