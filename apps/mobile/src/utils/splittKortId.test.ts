import { describe, it, expect } from "vitest";
import { normaliserKortIder, type LokalKortRad } from "./kortIdNormalisering";
import { splittDelVerdier } from "./splittFravaer";

/**
 * T13 (ORDRE (33) c1, spec § 9 / M18): «Del opp» — nye deler beholder radens byggeplass
 * og `kortId`, også etter normaliseringen (`sikreLokalKortId` kjøres etter skrivingen).
 * Sedelens byggeplass er b1; raden står på et kort med byggeplass b2 og egen id.
 */
const sedel = { userId: "u1", dato: "2026-11-16", projectId: "p1", byggeplass: { id: "b1", projectId: "p1" } };
const original: LokalKortRad = {
  id: "r1", type: "timer", kortId: "k-b2", projectId: "p1", byggeplassId: "b2", ecoId: null, erReise: false,
};

describe("T13 — «Del opp» på et kort med egen byggeplass", () => {
  it("delen havner i samme kort: samme byggeplass og samme kortId, ingen endring fra normaliseringen", () => {
    const v = splittDelVerdier(
      { utenProsjekt: false, byggeplassId: original.byggeplassId, kortId: original.kortId, externalCostObjectId: null },
      { lonnsartId: "l", aktivitetId: "a", externalCostObjectId: null, timer: 2 },
    );
    const del: LokalKortRad = { ...original, id: "r2", byggeplassId: v.byggeplassId, kortId: v.kortId };
    const endret = normaliserKortIder(sedel, [original, del]);
    expect(del.byggeplassId).toBe("b2");
    expect(endret.has("r1")).toBe(false);
    expect(endret.has("r2")).toBe(false);
  });

  it("negativkontroll (slik det var før): del uten byggeplass havner i et annet kort", () => {
    const del: LokalKortRad = { ...original, id: "r2", byggeplassId: null, kortId: null };
    const endret = normaliserKortIder(sedel, [original, del]);
    expect(endret.get("r2")).not.toBe("k-b2");
  });
});
