import { describe, it, expect } from "vitest";
import { validerUtenProsjekt } from "./utenProsjekt";

// TF2/TF3 (ren del): regelen alle skriveveier deler.
describe("validerUtenProsjekt", () => {
  it("fravær-art uten prosjekt med flagg → ok", () => {
    expect(validerUtenProsjekt({ utenProsjekt: true, projectId: null }, "fravaer")).toEqual({ ok: true });
  });
  it("flagg med ordinær art → utenProsjektKreverFravaer", () => {
    expect(validerUtenProsjekt({ utenProsjekt: true }, "ordinaer")).toEqual({
      ok: false,
      grunn: "utenProsjektKreverFravaer",
    });
  });
  it("flagg med ukjent art → utenProsjektKreverFravaer", () => {
    expect(validerUtenProsjekt({ utenProsjekt: true }, null)).toEqual({
      ok: false,
      grunn: "utenProsjektKreverFravaer",
    });
  });
  it.each([
    { projectId: "p" },
    { byggeplassId: "b" },
    { externalCostObjectId: "e" },
    { vehicleId: "v" },
    { erReise: true },
  ])("flagg med knytning %o → utenProsjektMedKnytning", (knytning) => {
    expect(validerUtenProsjekt({ utenProsjekt: true, ...knytning }, "fravaer")).toEqual({
      ok: false,
      grunn: "utenProsjektMedKnytning",
    });
  });
  it("TF3: uten flagg og uten prosjekt → manglerProsjekt, også for fravær-art", () => {
    expect(validerUtenProsjekt({ projectId: null }, "fravaer")).toEqual({
      ok: false,
      grunn: "manglerProsjekt",
    });
    expect(validerUtenProsjekt({}, "ordinaer")).toEqual({ ok: false, grunn: "manglerProsjekt" });
  });
  it("uten flagg med prosjekt → ok (dagens vei, FM3 fravær med prosjekt står)", () => {
    expect(validerUtenProsjekt({ projectId: "p" }, "fravaer")).toEqual({ ok: true });
    expect(validerUtenProsjekt({ projectId: "p", utenProsjekt: false }, "ordinaer")).toEqual({ ok: true });
  });
});
