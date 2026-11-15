import { describe, expect, it } from "vitest";
import { visByggeplassIkkeValgt, kanVelgeByggeplassDirekte } from "./byggeplassIkkeValgt";

const basis = { byggeplassId: null, antallByggeplasser: 1, kanRedigere: true };

describe("(20b) visByggeplassIkkeValgt", () => {
  it("null byggeplass + minst én byggeplass → vis", () => {
    expect(visByggeplassIkkeValgt(basis)).toBe(true);
  });
  it("undefined byggeplass → vis", () => {
    expect(visByggeplassIkkeValgt({ ...basis, byggeplassId: undefined })).toBe(true);
  });
  it("0 byggeplasser → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, antallByggeplasser: 0 })).toBe(false);
  });
  it("byggeplass satt → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, byggeplassId: "b1" })).toBe(false);
  });
  it("kan ikke redigere → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, kanRedigere: false })).toBe(false);
  });
});

describe("ORDRE (21) byggeplassen følger tegningen", () => {
  it("🔴 uten tegning kan byggeplass velges direkte", () => {
    expect(kanVelgeByggeplassDirekte(null)).toBe(true);
    expect(kanVelgeByggeplassDirekte(undefined)).toBe(true);
  });
  it("🔴 med tegning kan byggeplass ikke velges direkte", () => {
    expect(kanVelgeByggeplassDirekte("t1")).toBe(false);
  });
  it("🔴 linja «Byggeplass ikke valgt · Velg» skjules når dokumentet har tegning", () => {
    expect(visByggeplassIkkeValgt({ ...basis, drawingId: "t1" })).toBe(false);
    expect(visByggeplassIkkeValgt({ ...basis, drawingId: null })).toBe(true);
  });
});
