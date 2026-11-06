import { describe, it, expect } from "vitest";
import { vareforbrukFilter, vareforbrukStartByggeplass } from "../vareforbrukByggeplass";

describe("ORDRE 29 #8: vareforbrukFilter", () => {
  const ider = ["bp1", "bp2"];
  it("🔴 starter på toppbarens aktive byggeplass", () => {
    expect(vareforbrukFilter({ valgt: null, aktiv: "bp2", byggeplassIder: ider })).toBe("bp2");
  });
  it("brukerens valg vinner — også «Alle» (tom streng)", () => {
    expect(vareforbrukFilter({ valgt: "", aktiv: "bp2", byggeplassIder: ider })).toBe("");
    expect(vareforbrukFilter({ valgt: "bp1", aktiv: "bp2", byggeplassIder: ider })).toBe("bp1");
  });
  it("aktiv som ikke hører til prosjektet (eller ingen) → «Alle»", () => {
    expect(vareforbrukFilter({ valgt: null, aktiv: "annen", byggeplassIder: ider })).toBe("");
    expect(vareforbrukFilter({ valgt: null, aktiv: null, byggeplassIder: ider })).toBe("");
    expect(vareforbrukFilter({ valgt: null, aktiv: "bp1", byggeplassIder: undefined })).toBe("");
  });
});

describe("ORDRE 29 #8: vareforbrukStartByggeplass", () => {
  it("🔴 ny rad forhåndsvelger toppbarens byggeplass", () => {
    expect(vareforbrukStartByggeplass(undefined, "bp1")).toBe("bp1");
  });
  it("redigert rad beholder sin egen — også ingen byggeplass", () => {
    expect(vareforbrukStartByggeplass({ byggeplassId: "bp2" }, "bp1")).toBe("bp2");
    expect(vareforbrukStartByggeplass({ byggeplassId: null }, "bp1")).toBe("");
  });
  it("ny rad uten aktiv byggeplass → tom", () => {
    expect(vareforbrukStartByggeplass(undefined, null)).toBe("");
  });
});
