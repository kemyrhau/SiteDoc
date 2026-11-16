import { describe, it, expect } from "vitest";
import { prosjektFeltFraServer, prosjektFeltTilServer } from "./utenProsjektSynk";

/**
 * Fraværskortet over synk (prosjektkort-kortid-spec § 11.2–11.3, ordre c2):
 * push sender `utenProsjekt: true` og intet prosjekt, byggeplass eller
 * underprosjekt; pull lagrer raden uten prosjekt i stedet for å la den arve
 * sedelens. Prosjektrader er uendret (dagens fallback, F4-4).
 */
describe("push — prosjektFeltTilServer", () => {
  it("fraværsrad: utenProsjekt true, ingen prosjekt, byggeplass eller underprosjekt", () => {
    expect(
      prosjektFeltTilServer({ projectId: null, utenProsjekt: true, byggeplassId: null, externalCostObjectId: null }, "sedel-p"),
    ).toEqual({ projectId: undefined, utenProsjekt: true, byggeplassId: null, externalCostObjectId: null });
  });

  it("fraværsrad som (feilaktig) bærer prosjekt sendes likevel uten", () => {
    expect(
      prosjektFeltTilServer({ projectId: "p1", utenProsjekt: true, byggeplassId: "b1", externalCostObjectId: "e1" }, "sedel-p"),
    ).toEqual({ projectId: undefined, utenProsjekt: true, byggeplassId: null, externalCostObjectId: null });
  });

  it("prosjektrad: dagens fallback, utenProsjekt utelates (eldre server stripper uansett)", () => {
    expect(
      prosjektFeltTilServer({ projectId: null, utenProsjekt: false, byggeplassId: "b1", externalCostObjectId: null }, "sedel-p"),
    ).toEqual({ projectId: "sedel-p", byggeplassId: "b1", externalCostObjectId: null });
    expect(
      prosjektFeltTilServer({ projectId: null, utenProsjekt: false, byggeplassId: null, externalCostObjectId: null }, ""),
    ).toEqual({ projectId: undefined, byggeplassId: null, externalCostObjectId: null });
  });
});

describe("pull — prosjektFeltFraServer", () => {
  it("serverrad med utenProsjekt lagres uten prosjekt, også når sedelen har ett", () => {
    expect(prosjektFeltFraServer({ projectId: null, utenProsjekt: true }, "sedel-p")).toEqual({
      projectId: null,
      utenProsjekt: true,
    });
  });

  it("prosjektrad og eldre server (feltet mangler): dagens fallback", () => {
    expect(prosjektFeltFraServer({ projectId: "p1" }, "sedel-p")).toEqual({ projectId: "p1", utenProsjekt: false });
    expect(prosjektFeltFraServer({ projectId: null }, "sedel-p")).toEqual({ projectId: "sedel-p", utenProsjekt: false });
  });
});
