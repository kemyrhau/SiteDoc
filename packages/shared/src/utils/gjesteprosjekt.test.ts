import { describe, it, expect } from "vitest";
import { erGjesteprosjekt, skjulFirmaModulForGjest } from "./gjesteprosjekt";

/** POST 2026-11-15 (15) test (a): gjesteprosjekt-regelen som tabell. */
const A = "firma-a";
const B = "firma-b";

describe("erGjesteprosjekt — (15) test (a)", () => {
  const tilfeller: Array<[string, string | null, string[], boolean]> = [
    ["eget firma eier → ikke gjest", A, [A], false],
    ["🔴 annet firma eier, ingen ansettelse der → gjest", B, [A], true],
    ["ansatt i begge → ikke gjest", B, [A, B], false],
    ["standalone (ingen eier) → aldri gjest", null, [A], false],
    ["standalone uten ansettelser → aldri gjest", null, [], false],
    ["🔴 ingen aktive ansettelser, firmaprosjekt → gjest", A, [], true],
    // Deaktivert ansettelse i eier-firmaet står ikke i aktiv-lista → regnes som gjest
    // (serveren filtrerer slike prosjekter bort før klienten ser dem).
    ["deaktivert ansettelse i eier (ikke i aktiv-liste) → gjest", B, [A], true],
  ];
  it.each(tilfeller)("%s", (_navn, eier, mine, forventet) => {
    expect(erGjesteprosjekt({ primaryOrganizationId: eier }, mine)).toBe(forventet);
  });
});

describe("skjulFirmaModulForGjest — (15) test (e) regel", () => {
  it("ikke gjest → ingen modul skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: false, firmaKoblet: false })).toBe(false);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: false, firmaKoblet: false })).toBe(false);
  });
  it("🔴 gjest uten firmakobling → Timer og Vareforbruk skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: true, firmaKoblet: false })).toBe(true);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: true, firmaKoblet: false })).toBe(true);
  });
  it("gjest med eget firma koblet (ProjectOrganization) → Timer vises, Vareforbruk skjules", () => {
    expect(skjulFirmaModulForGjest("timer", { erGjest: true, firmaKoblet: true })).toBe(false);
    expect(skjulFirmaModulForGjest("varelager", { erGjest: true, firmaKoblet: true })).toBe(true);
  });
});
