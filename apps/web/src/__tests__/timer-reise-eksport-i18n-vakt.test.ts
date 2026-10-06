import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// LAG 2-C D2 gate (c): arknavn + kolonne-overskrifter i timer-eksporten skal gå
// gjennom t() — ALDRI hardkodet norsk (i18n gjelder også ikke-JSX: Excel-arknavn
// og overskrifter, CLAUDE.md § Språk). FEILER hvis et addWorksheet-kall får en
// strengliteral, eller hvis en ny reise-kolonnenøkkel mangler i nb/en.

function les(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf-8");
}

describe("LAG 2-C D2 — eksport-arknavn og reise-kolonner via i18n", () => {
  const kilde = les("../lib/timer-rapport-eksport.ts");

  it("ingen addWorksheet() får en hardkodet strengliteral (arknavn via t())", () => {
    // Treffer wb.addWorksheet("Detaljer") o.l. — skal ALDRI finnes.
    expect(kilde).not.toMatch(/addWorksheet\(\s*["'`]/);
  });

  it("hvert addWorksheet-kall sender en t()-oversatt verdi", () => {
    const kall = kilde.match(/addWorksheet\([^)]*\)/g) ?? [];
    expect(kall.length).toBeGreaterThan(0);
    for (const k of kall) expect(k).toContain("t(");
  });

  // Fails rødt uten i18n-tilføyelsene (D2 + D1). Dekker relikvi-/paritetsregelen:
  // en synlig nøkkel som finnes i nb men ikke en (eller omvendt) er en bug.
  const nyeNokler = [
    "timer.eksport.kolReise",
    "timer.eksport.kolRetning",
    "timer.eksport.kolFraSted",
    "timer.eksport.kolTilSted",
    "timer.eksport.kolAvstandKm",
    "timer.eksport.kolKjoretidMin",
    "timer.eksport.kolReiseKilde",
    "timer.eksport.kolTidKilde",
    "timer.eksport.kolNormStatus",
    "timer.eksport.kolLonnsartType",
    "timer.eksport.kolSatsEnhet",
    "timer.reise.retning.ut",
    "timer.reise.kilde.matrise",
    "timer.reise.tidKilde.utledet",
    "timer.reise.norm.cachet",
    "timer.attestering.reise.merkeUt",
    "timer.attestering.reise.kildeUkjent",
    "timer.attestering.norm.ukjent",
    "timer.attestering.arbeidReiseSplit",
  ];
  const nbObj = JSON.parse(
    les("../../../../packages/shared/src/i18n/nb.json"),
  ) as Record<string, string>;
  const enObj = JSON.parse(
    les("../../../../packages/shared/src/i18n/en.json"),
  ) as Record<string, string>;

  it.each(nyeNokler)("nøkkel finnes i BÅDE nb og en: %s", (n) => {
    expect(nbObj[n], `mangler i nb: ${n}`).toBeTruthy();
    expect(enObj[n], `mangler i en: ${n}`).toBeTruthy();
  });
});
