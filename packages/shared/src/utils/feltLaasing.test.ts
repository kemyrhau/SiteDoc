import { describe, it, expect } from "vitest";
import { harFeltVerdi, beregnLaasteFelter } from "./feltLaasing";

describe("harFeltVerdi", () => {
  it("returnerer false for tomme verdier", () => {
    expect(harFeltVerdi(null)).toBe(false);
    expect(harFeltVerdi(undefined)).toBe(false);
    expect(harFeltVerdi("")).toBe(false);
    expect(harFeltVerdi([])).toBe(false);
  });

  it("returnerer true for reelle verdier", () => {
    expect(harFeltVerdi("OK")).toBe(true);
    expect(harFeltVerdi(0)).toBe(true); // tallet 0 er en reell verdi
    expect(harFeltVerdi(false)).toBe(true); // boolean false er en reell verdi
    expect(harFeltVerdi(["a"])).toBe(true);
    expect(harFeltVerdi({ nested: 1 })).toBe(true);
  });
});

describe("beregnLaasteFelter", () => {
  it("låser kun felt med reell server-verdi", () => {
    const data = {
      a: { verdi: "OK" },
      b: { verdi: "" }, // tom → ikke låst
      c: { verdi: null }, // null → ikke låst
      d: { verdi: [] }, // tom array → ikke låst
      e: { verdi: ["valgt"] },
      f: { kommentar: "kun kommentar" }, // ingen verdi → ikke låst
    };
    const laaste = beregnLaasteFelter(data);
    expect([...laaste].sort()).toEqual(["a", "e"]);
  });

  it("returnerer tomt sett for tom/manglende data", () => {
    expect(beregnLaasteFelter(null).size).toBe(0);
    expect(beregnLaasteFelter(undefined).size).toBe(0);
    expect(beregnLaasteFelter({}).size).toBe(0);
  });
});
