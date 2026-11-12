import { describe, it, expect, vi } from "vitest";

vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));

import { maskinerOverRad, radForMaskin } from "./kobledeMaskiner";

/**
 * NY BESLUTNING maskinkobling (Kenneth 2026-11-12) — rene regler. DB-effekten
 * (lagring rører ikke maskiner stille, ukoblet 3 t forblir 3 t) måles med ekte
 * SQLite i `radLagring.test.ts` § «maskinkobling».
 */

describe("maskinerOverRad", () => {
  it("gravemaskin 8 t + bil 3 t på rad 8 t er gyldig", () => {
    expect(maskinerOverRad(8, [{ timer: 8 }, { timer: 3 }])).toEqual([]);
  });
  it("maskin over radens timer fanges; negativkontroll: lik er lov", () => {
    expect(maskinerOverRad(8, [{ timer: 8.25 }, { timer: 8 }])).toEqual([{ timer: 8.25 }]);
    expect(maskinerOverRad(7.5, [{ timer: 7.5 }])).toEqual([]);
  });
});

describe("radForMaskin (Bekreft dag)", () => {
  const rad = (id: string, ekstra: Partial<{ projectId: string; byggeplassId: string | null; externalCostObjectId: string | null; fraTid: string | null; tilTid: string | null }> = {}) => ({
    id,
    projectId: "p1",
    byggeplassId: null as string | null,
    externalCostObjectId: null as string | null,
    fraTid: "07:00" as string | null,
    tilTid: "11:00" as string | null,
    ...ekstra,
  });
  const maskin = (fraTid: string | null, tilTid: string | null, ekstra = {}) => ({
    projectId: "p1",
    byggeplassId: null,
    externalCostObjectId: null,
    fraTid,
    tilTid,
    ...ekstra,
  });

  it("kobler når nøyaktig én rad med samme bøtte dekker maskinens fra–til", () => {
    expect(radForMaskin(maskin("08:00", "10:00"), [rad("r1"), rad("r2", { fraTid: "11:30", tilTid: "15:00" })])).toBe("r1");
  });

  it("tvetydig (to rader dekker) → null («Uten rad»); negativkontroll: én av dem alene → kobles", () => {
    const rader = [rad("r1"), rad("r2", { fraTid: "06:00", tilTid: "12:00" })];
    expect(radForMaskin(maskin("08:00", "10:00"), rader)).toBeNull();
    expect(radForMaskin(maskin("08:00", "10:00"), [rader[1]!])).toBe("r2");
  });

  it("uten fra/til (dagens Bekreft dag-maskin) → null", () => {
    expect(radForMaskin(maskin(null, null), [rad("r1")])).toBeNull();
  });

  it("annen bøtte (prosjekt/byggeplass/ECO) eller utenfor tid → null", () => {
    expect(radForMaskin(maskin("08:00", "10:00", { projectId: "p2" }), [rad("r1")])).toBeNull();
    expect(radForMaskin(maskin("08:00", "10:00", { byggeplassId: "bp1" }), [rad("r1")])).toBeNull();
    expect(radForMaskin(maskin("08:00", "10:00", { externalCostObjectId: "e1" }), [rad("r1")])).toBeNull();
    expect(radForMaskin(maskin("10:00", "12:00"), [rad("r1")])).toBeNull();
    expect(radForMaskin(maskin("08:00", "10:00"), [rad("r1", { fraTid: null })])).toBeNull();
  });
});
