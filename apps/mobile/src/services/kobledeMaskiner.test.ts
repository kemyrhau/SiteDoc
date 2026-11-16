import { describe, it, expect, vi } from "vitest";

vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));

import { maskinerOverRad } from "./kobledeMaskiner";

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
