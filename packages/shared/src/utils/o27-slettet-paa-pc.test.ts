import { describe, it, expect } from "vitest";
import { finnSedlerÅSlette, type Slettevindu } from "./timerSyncSletting";

// O27 SLETTET-ER-SLETTET (Kenneth 2026-11-26): «det er noen gamle sedler som er slettet ->
// men kommer tilbake … Når en timerad slettes -> da må den slettes helt». En sedel serveren
// har sporet som slettet på PC, fjernes fra telefonen også med usendte endringer og utenfor
// vinduet — ellers lager neste push den på nytt.
const vindu: Slettevindu = { fraDato: "2026-11-01", tilDato: null };

describe("O27 — finnSedlerÅSlette med slettet på PC", () => {
  it("pending sedel slettet på PC slettes lokalt", () => {
    const lokale = [{ id: "s1", dato: "2026-11-20", syncStatus: "pending" }];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu, new Set(["s1"]))).toEqual(["s1"]);
  });

  it("avvist sedel slettet på PC slettes lokalt", () => {
    const lokale = [{ id: "s1", dato: "2026-11-20", syncStatus: "avvist" }];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu, new Set(["s1"]))).toEqual(["s1"]);
  });

  it("gammel sedel utenfor vinduet, slettet på PC, slettes lokalt", () => {
    const lokale = [{ id: "s-gammel", dato: "2026-06-01", syncStatus: "synced" }];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu, new Set(["s-gammel"]))).toEqual(["s-gammel"]);
  });

  it("vakt: pending sedel som IKKE er slettet på PC, røres ikke", () => {
    const lokale = [{ id: "s1", dato: "2026-11-20", syncStatus: "pending" }];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu, new Set(["annen"]))).toEqual([]);
  });

  it("vakt: en sedel som står levende på serveren, røres ikke selv om den har spor", () => {
    const lokale = [{ id: "s1", dato: "2026-11-20", syncStatus: "pending" }];
    expect(finnSedlerÅSlette(lokale, new Set(["s1"]), vindu, new Set(["s1"]))).toEqual([]);
  });
});
