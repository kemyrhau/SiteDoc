import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Telefontest B funn 4 (Kenneth 2026-11-13): «hele dagen»-knappene markerer aktivt
// valg (fylt + hake + tilgjengelig tilstand) med SAMME regel på web og mobil —
// `aktivtHelhetsvalg` i @sitedoc/shared. Vakten feiler hvis en flate slutter å bruke
// den delte regelen, mister markeringen, eller (web) går tilbake til kun parede slots.

const her = dirname(fileURLToPath(import.meta.url));
const MOBIL = readFileSync(join(her, "DagskortSammenligning.tsx"), "utf-8");
const WEB = readFileSync(
  join(her, "../../../../web/src/components/timer/ForslagValgSeksjon.tsx"),
  "utf-8",
);
const DAGSKORT = readFileSync(join(her, "../../../app/timer/[id].tsx"), "utf-8");

describe("helhetsvalg-markering (funn 4)", () => {
  it("mobil bruker delt regel og markerer valgt knapp", () => {
    expect(MOBIL).toContain("aktivtHelhetsvalg<Side>(helhetNokler, valg, \"server\")");
    expect(MOBIL).toMatch(/accessibilityState=\{\{ selected: aktivt === "lokal" \}\}/);
    expect(MOBIL).toMatch(/accessibilityState=\{\{ selected: aktivt === "server" \}\}/);
  });

  it("web bruker delt regel, alle valgbare slots og aria-pressed", () => {
    expect(WEB).toContain("helhetsvalgNokler(slots)");
    expect(WEB).toContain("aktivtHelhetsvalg<ForsonSide>(helhetNokler, valg, \"sedel\")");
    expect(WEB).toContain("aria-pressed={aktivt === \"sedel\"}");
    expect(WEB).toContain("aria-pressed={aktivt === \"forslag\"}");
    // Negativkontroll: gammel regel (kun parede) er borte.
    expect(WEB).not.toMatch(/s\.valgbar && s\.forslag && s\.sedel/);
  });

  it("dagskortet er urørt — ingen helhetsvalg-logikk der", () => {
    expect(DAGSKORT).not.toContain("aktivtHelhetsvalg");
  });
});
