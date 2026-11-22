import { describe, it, expect } from "vitest";
import { medTillagteKolonner } from "@/lib/kolonneRekkefolge";

/** O13 (R3): Reise og Overtid settes inn i et lagret oppsett én gang, rett etter Timer. */
const KANONISK = ["dato", "ansatt", "timer", "reisetimer", "overtid", "maskin"];
const T = { ider: ["reisetimer", "overtid"], etter: "timer" };

describe("O13 R3 — medTillagteKolonner", () => {
  it("innsetting: oppsett med rekkefølge får kolonnene rett etter Timer og i tillagt", () => {
    expect(medTillagteKolonner({ kolonner: ["timer", "ansatt"], rekkefolge: true, tillagt: [] }, KANONISK, T))
      .toEqual({ kolonner: ["timer", "reisetimer", "overtid", "ansatt"], rekkefolge: true, tillagt: ["reisetimer", "overtid"] });
  });

  it("eldre oppsett uten tillagt og uten rekkefølge: kanonisk rekkefølge skrives ut, innsatt etter Timer", () => {
    expect(medTillagteKolonner({ kolonner: ["maskin", "timer", "dato"] }, KANONISK, T))
      .toEqual({ kolonner: ["dato", "timer", "reisetimer", "overtid", "maskin"], rekkefolge: true, tillagt: ["reisetimer", "overtid"] });
  });

  it("skjult respekteres: står i tillagt men ikke i kolonner → settes ikke inn igjen", () => {
    const lagret = { kolonner: ["timer", "overtid", "ansatt"], rekkefolge: true, tillagt: ["reisetimer", "overtid"] };
    expect(medTillagteKolonner(lagret, KANONISK, T)).toEqual(lagret);
  });

  it("alt synlig uten tillagt (slått på for hånd): føres i tillagt, rekkefølgen urørt", () => {
    expect(medTillagteKolonner({ kolonner: ["overtid", "timer", "reisetimer"], rekkefolge: true }, KANONISK, T))
      .toEqual({ kolonner: ["overtid", "timer", "reisetimer"], rekkefolge: true, tillagt: ["reisetimer", "overtid"] });
  });

  it("uten Timer i oppsettet: kolonnene settes inn sist", () => {
    expect(medTillagteKolonner({ kolonner: ["ansatt", "dato"], rekkefolge: true }, KANONISK, T).kolonner)
      .toEqual(["ansatt", "dato", "reisetimer", "overtid"]);
  });
});
