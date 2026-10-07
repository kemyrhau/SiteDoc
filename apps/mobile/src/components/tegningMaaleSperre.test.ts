import { describe, it, expect } from "vitest";
import { kanMale } from "@sitedoc/shared/utils";

/**
 * Mobil-låsen for måleverktøyet er den DELTE `kanMale` (ingen kopi): TegningsVisning
 * regner `kanMaleNaa = !!maleData && kanMale(scale, mmPrPiksel, scaleKilde)` og viser
 * «Målestokken må bekreftes på web» når den er usann (ordre § 3). Ingen kalibrering
 * på mobil → verktøyet er sperret til målestokken har en kjent, bekreftet kilde.
 */
describe("mobil måling — sperret når kanMale er usann", () => {
  const mmPrPiksel = 0.127;

  it("sperret uten tolkbar målestokk", () => {
    expect(kanMale(null, mmPrPiksel, "tittelfelt")).toBe(false);
    expect(kanMale("", mmPrPiksel, "tittelfelt")).toBe(false);
  });

  it("sperret uten mm/piksel", () => {
    expect(kanMale("1:50", null, "tittelfelt")).toBe(false);
  });

  it("sperret ved ukjent kilde (null)", () => {
    expect(kanMale("1:50", mmPrPiksel, null)).toBe(false);
  });

  it("åpen for tittelfelt/manuell/kalibrert (bekreftet kilde)", () => {
    expect(kanMale("1:50", mmPrPiksel, "tittelfelt")).toBe(true);
    expect(kanMale("1:50", mmPrPiksel, "manuell")).toBe(true);
    expect(kanMale("1:50", mmPrPiksel, "kalibrert")).toBe(true);
  });
});
