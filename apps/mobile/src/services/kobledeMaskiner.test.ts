import { describe, it, expect, vi } from "vitest";

vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));

import { maskinerOverRad } from "./kobledeMaskiner";

/**
 * NY BESLUTNING maskinkobling (Kenneth 2026-11-12) — rene regler. DB-effekten
 * (lagring rører ikke maskiner stille, ukoblet 3 t forblir 3 t) måles med ekte
 * SQLite i `radLagring.test.ts` § «maskinkobling».
 */

const time = () => "time";

describe("maskinerOverRad", () => {
  it("gravemaskin 8 t + bil 3 t på rad 8 t er gyldig", () => {
    expect(maskinerOverRad(8, [{ vehicleId: "g", timer: 8 }, { vehicleId: "b", timer: 3 }], time)).toEqual([]);
  });
  it("maskin over radens timer fanges; negativkontroll: lik er lov", () => {
    expect(maskinerOverRad(8, [{ vehicleId: "g", timer: 8.25 }, { vehicleId: "b", timer: 8 }], time)).toEqual([
      { vehicleId: "g", timer: 8.25 },
    ]);
    expect(maskinerOverRad(7.5, [{ vehicleId: "g", timer: 7.5 }], time)).toEqual([]);
  });
  it("🔴 D1 (Kenneth 2026-11-19): kun maskiner med fører — døgn-maskin over raden er lov", () => {
    const enhet = (v: string) => (v === "varme" ? "doegn" : v === "uten" ? null : "time");
    const linjer = [
      { vehicleId: "varme", timer: 24 },
      { vehicleId: "grave", timer: 9 },
      { vehicleId: "uten", timer: 10 },
    ];
    // Ikke satt enhet krever fører (H15) og fanges; døgn-maskinen slipper.
    expect(maskinerOverRad(8, linjer, enhet).map((l) => l.vehicleId)).toEqual(["grave", "uten"]);
  });
});
