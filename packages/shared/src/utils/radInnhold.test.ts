import { describe, it, expect } from "vitest";
import { radInnholdLikt, type RadInnhold } from "./radInnhold";

function base(over: Partial<RadInnhold> = {}): RadInnhold {
  return {
    projectId: "p1",
    byggeplassId: null,
    lonnsartId: "l1",
    aktivitetId: "a1",
    externalCostObjectId: null,
    vehicleId: null,
    timer: 8,
    fraTid: "07:00",
    tilTid: "15:00",
    beskrivelse: null,
    pauseMin: 0,
    ...over,
  };
}

describe("radInnholdLikt (V19.9.4)", () => {
  it("identisk innhold → likt", () => {
    expect(radInnholdLikt(base(), base())).toBe(true);
  });

  it("ulik timer → ulikt", () => {
    expect(radInnholdLikt(base({ timer: 8 }), base({ timer: 7.5 }))).toBe(false);
  });

  it("ulik tilTid → ulikt", () => {
    expect(radInnholdLikt(base(), base({ tilTid: "15:30" }))).toBe(false);
  });

  it("Decimal-streng (server) ≡ number (payload) — tapsfri", () => {
    expect(radInnholdLikt(base({ timer: "8.00" }), base({ timer: 8 }))).toBe(true);
    expect(radInnholdLikt(base({ timer: "7.50" }), base({ timer: 7.5 }))).toBe(true);
  });

  it("Decimal-objekt (Prisma) ≡ number", () => {
    const decimal = { toString: () => "8.00" };
    expect(radInnholdLikt(base({ timer: decimal }), base({ timer: 8 }))).toBe(true);
  });

  it("null ≡ undefined ≡ \"\" for strengfelt", () => {
    expect(radInnholdLikt(base({ beskrivelse: null }), base({ beskrivelse: "" }))).toBe(true);
    expect(radInnholdLikt(base({ beskrivelse: undefined }), base({ beskrivelse: null }))).toBe(true);
    expect(radInnholdLikt(base({ byggeplassId: "" }), base({ byggeplassId: null }))).toBe(true);
  });

  it("ulik beskrivelse → ulikt", () => {
    expect(radInnholdLikt(base({ beskrivelse: "graving" }), base({ beskrivelse: "pigging" }))).toBe(false);
  });

  it("pauseMin: null ≡ 0 (NOT NULL DEFAULT 0 på serveren)", () => {
    expect(radInnholdLikt(base({ pauseMin: null }), base({ pauseMin: 0 }))).toBe(true);
    expect(radInnholdLikt(base({ pauseMin: 30 }), base({ pauseMin: 0 }))).toBe(false);
  });

  it("ulik projectId/lonnsart/aktivitet/eco/vehicle → ulikt", () => {
    expect(radInnholdLikt(base(), base({ projectId: "p2" }))).toBe(false);
    expect(radInnholdLikt(base(), base({ lonnsartId: "l2" }))).toBe(false);
    expect(radInnholdLikt(base(), base({ aktivitetId: "a2" }))).toBe(false);
    expect(radInnholdLikt(base(), base({ externalCostObjectId: "eco2" }))).toBe(false);
    expect(radInnholdLikt(base(), base({ vehicleId: "v2" }))).toBe(false);
  });

  it("ignorerer reise-sporet (ikke del av V19.9.4) — ekstra felt påvirker ikke", () => {
    const a = { ...base(), erReise: true, reiseKilde: "matrise" } as RadInnhold;
    const b = { ...base(), erReise: false } as RadInnhold;
    expect(radInnholdLikt(a, b)).toBe(true);
  });
});
