import { describe, expect, it } from "vitest";
import { visByggeplassIkkeValgt } from "./byggeplassIkkeValgt";

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
