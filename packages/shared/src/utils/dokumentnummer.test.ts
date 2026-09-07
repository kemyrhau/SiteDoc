import { describe, it, expect } from "vitest";
import { formaterNummer } from "./dokumentnummer";

describe("formaterNummer", () => {
  it("setter sammen prefix og nummer", () => {
    expect(formaterNummer("SJA", 12)).toBe("SJA12");
  });

  it("returnerer null når prefix mangler", () => {
    expect(formaterNummer(null, 12)).toBeNull();
    expect(formaterNummer(undefined, 12)).toBeNull();
    expect(formaterNummer("", 12)).toBeNull();
  });

  it("returnerer null når nummer mangler", () => {
    expect(formaterNummer("SJA", null)).toBeNull();
    expect(formaterNummer("SJA", undefined)).toBeNull();
  });

  it("slipper 0 gjennom (tilsiktet — «SJA0» er gyldig, nummer == null fanger ikke 0)", () => {
    expect(formaterNummer("SJA", 0)).toBe("SJA0");
  });
});
