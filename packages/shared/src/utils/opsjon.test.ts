import { describe, it, expect } from "vitest";
import { normaliserOpsjon } from "./opsjon";

describe("normaliserOpsjon", () => {
  it("streng-opsjon → value = label = strengen", () => {
    expect(normaliserOpsjon("Ja")).toEqual({ value: "Ja", label: "Ja" });
  });

  it("{ value, label } beholdes", () => {
    expect(normaliserOpsjon({ value: "green", label: "Godkjent" })).toEqual({
      value: "green",
      label: "Godkjent",
    });
  });

  it("{ value } uten label → label arver value", () => {
    expect(normaliserOpsjon({ value: "rod" })).toEqual({ value: "rod", label: "rod" });
  });

  it("{ label } uten value → value blir tom streng, label beholdes", () => {
    expect(normaliserOpsjon({ label: "Bare label" })).toEqual({ value: "", label: "Bare label" });
  });

  it("verdi med mellomrom bevares uendret", () => {
    expect(normaliserOpsjon("Ikke relevant")).toEqual({
      value: "Ikke relevant",
      label: "Ikke relevant",
    });
    expect(normaliserOpsjon({ value: "ikke ok", label: "Ikke OK" })).toEqual({
      value: "ikke ok",
      label: "Ikke OK",
    });
  });

  it("null/undefined → strengrepresentasjon (defensivt)", () => {
    expect(normaliserOpsjon(null)).toEqual({ value: "null", label: "null" });
    expect(normaliserOpsjon(undefined)).toEqual({ value: "undefined", label: "undefined" });
  });

  it("tom streng bevares", () => {
    expect(normaliserOpsjon("")).toEqual({ value: "", label: "" });
  });

  it("ikke-streng value coerces til streng", () => {
    expect(normaliserOpsjon({ value: 3, label: "Tre" })).toEqual({ value: "3", label: "Tre" });
  });
});
