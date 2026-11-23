import { describe, expect, it } from "vitest";
import { hørerTilMalListe, type MalListeKategori } from "../mal-liste-filter";

// Malene et nytt prosjekt får av standardmodulen «HMS-avvik» (PROSJEKT_MODULER), pluss
// en HMS-mal laget fra «Ny HMS-mal» (category "hms") og vanlige byggmaler.
const maler = [
  { navn: "HMS-avvik", category: "oppgave", domain: "hms" },
  { navn: "RUH", category: "oppgave", domain: "hms" },
  { navn: "SJA", category: "sjekkliste", domain: "hms" },
  { navn: "Egen HMS", category: "hms", domain: "hms" },
  { navn: "Befaring", category: "oppgave", domain: "bygg" },
  { navn: "Kontroll", category: "sjekkliste", domain: "bygg" },
];

function liste(kategori: MalListeKategori): string[] {
  return maler.filter((m) => hørerTilMalListe(m, kategori)).map((m) => m.navn);
}

describe("HM1 — hvilken malliste en mal står i", () => {
  it("HMS-maler viser alle maler med domain hms, uansett kategori", () => {
    expect(liste("hms")).toEqual(["HMS-avvik", "RUH", "SJA", "Egen HMS"]);
  });

  it("Oppgavemaler viser ikke HMS-avvik og RUH", () => {
    expect(liste("oppgave")).toEqual(["Befaring"]);
  });

  it("Sjekklistemaler viser ikke SJA", () => {
    expect(liste("sjekkliste")).toEqual(["Kontroll"]);
  });

  it("hver mal står i nøyaktig én liste", () => {
    for (const m of maler) {
      const treff = (["oppgave", "sjekkliste", "hms"] as const).filter((k) =>
        hørerTilMalListe(m, k),
      );
      expect(treff, m.navn).toHaveLength(1);
    }
  });
});
