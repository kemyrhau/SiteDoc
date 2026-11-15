import { describe, expect, it } from "vitest";
import { opprettLokasjonOmfang, visByggeplassIkkeValgt } from "./byggeplassIkkeValgt";

const basis = { byggeplassId: null, antallByggeplasser: 1, lokasjonOmfang: null, kanRedigere: true };

describe("(20) visByggeplassIkkeValgt", () => {
  it("null byggeplass + minst én byggeplass → vis", () => {
    expect(visByggeplassIkkeValgt(basis)).toBe(true);
  });
  it("eldre dokument (omfang undefined) → vis", () => {
    expect(visByggeplassIkkeValgt({ ...basis, lokasjonOmfang: undefined })).toBe(true);
  });
  it("0 byggeplasser → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, antallByggeplasser: 0 })).toBe(false);
  });
  it("bevisst «Hele prosjektet» → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, lokasjonOmfang: "prosjekt" })).toBe(false);
  });
  it("byggeplass satt → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, byggeplassId: "b1" })).toBe(false);
  });
  it("kan ikke redigere → skjul", () => {
    expect(visByggeplassIkkeValgt({ ...basis, kanRedigere: false })).toBe(false);
  });
  it("negativkontroll: annet omfang («byggeplass») skjuler ikke", () => {
    expect(visByggeplassIkkeValgt({ ...basis, lokasjonOmfang: "byggeplass" })).toBe(true);
  });
});

describe("(20) opprettLokasjonOmfang", () => {
  it("eget valg «Hele prosjektet» på prosjekt med byggeplasser → «prosjekt»", () => {
    expect(opprettLokasjonOmfang(true, 2)).toBe("prosjekt");
  });
  it("negativkontroll: ingen «Hele prosjektet» → undefined", () => {
    expect(opprettLokasjonOmfang(false, 2)).toBeUndefined();
  });
  it("0 byggeplasser → undefined", () => {
    expect(opprettLokasjonOmfang(true, 0)).toBeUndefined();
  });
});
