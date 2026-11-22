import { describe, expect, it } from "vitest";
import { erArbeidstidReise } from "./arbeidstidReise";

describe("erArbeidstidReise", () => {
  it("arbeidsrad med retning er arbeidstid-reise; reisetid og vanlig arbeid er det ikke", () => {
    expect(erArbeidstidReise({ erReise: false, arbeidReiseRetning: "ut" })).toBe(true);
    expect(erArbeidstidReise({ erReise: true, arbeidReiseRetning: "ut" })).toBe(false);
    expect(erArbeidstidReise({ erReise: false, arbeidReiseRetning: null })).toBe(false);
    expect(erArbeidstidReise({})).toBe(false);
  });
});
