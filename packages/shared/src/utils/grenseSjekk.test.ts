import { describe, it, expect } from "vitest";
import {
  normaliserGrense,
  harGrense,
  grenseStatus,
  formaterGrense,
} from "./grenseSjekk";

describe("normaliserGrense — norsk kanonisk + engelsk fallback", () => {
  it("leser norske nøkler (seed NS3420)", () => {
    expect(normaliserGrense({ enhet: "mm", toleranse: 3 })).toEqual({
      min: null,
      maks: null,
      toleranse: 3,
      desimaler: null,
      enhet: "mm",
    });
  });

  it("leser engelske nøkler som fallback (MalBygger-bygde maler)", () => {
    expect(normaliserGrense({ unit: "%", max: 10, decimals: 2 })).toEqual({
      min: null,
      maks: 10,
      toleranse: null,
      desimaler: 2,
      enhet: "%",
    });
  });

  it("norsk vinner over engelsk når begge finnes", () => {
    const g = normaliserGrense({ maks: 5, max: 99, enhet: "m", unit: "km" });
    expect(g.maks).toBe(5);
    expect(g.enhet).toBe("m");
  });

  it("tolererer tall-streng og komma-desimal", () => {
    expect(normaliserGrense({ min: "2,5" }).min).toBe(2.5);
  });

  it("tom/ugyldig verdi blir null", () => {
    expect(normaliserGrense({ min: "", maks: "abc" })).toMatchObject({
      min: null,
      maks: null,
    });
  });
});

describe("harGrense", () => {
  it("false uten grense", () => {
    expect(harGrense(normaliserGrense({ enhet: "mm" }))).toBe(false);
  });
  it("true med toleranse", () => {
    expect(harGrense(normaliserGrense({ toleranse: 3 }))).toBe(true);
  });
});

describe("grenseStatus", () => {
  it("min: verdi under grensen → under (Fall ≥ 2%)", () => {
    const g = normaliserGrense({ min: 2, enhet: "%" });
    expect(grenseStatus(1.5, g)).toBe("under");
    expect(grenseStatus(2, g)).toBe("ok");
    expect(grenseStatus(3, g)).toBe("ok");
  });

  it("maks: verdi over grensen → over (Vertikalt sprang maks 2mm)", () => {
    const g = normaliserGrense({ maks: 2, enhet: "mm" });
    expect(grenseStatus(3, g)).toBe("over");
    expect(grenseStatus(2, g)).toBe("ok");
  });

  it("toleranse: |verdi| over båndet → utenfor_toleranse (Planhet ±3mm)", () => {
    const g = normaliserGrense({ toleranse: 3, enhet: "mm" });
    expect(grenseStatus(4, g)).toBe("utenfor_toleranse");
    expect(grenseStatus(-4, g)).toBe("utenfor_toleranse");
    expect(grenseStatus(3, g)).toBe("ok");
    expect(grenseStatus(-2, g)).toBe("ok");
  });

  it("min+maks kombinert (2–10)", () => {
    const g = normaliserGrense({ min: 2, maks: 10 });
    expect(grenseStatus(1, g)).toBe("under");
    expect(grenseStatus(11, g)).toBe("over");
    expect(grenseStatus(5, g)).toBe("ok");
  });

  it("null når verdi ikke er tall eller ingen grense", () => {
    expect(grenseStatus(null, normaliserGrense({ maks: 2 }))).toBeNull();
    expect(grenseStatus(5, normaliserGrense({ enhet: "mm" }))).toBeNull();
  });
});

describe("formaterGrense — språknøytral", () => {
  it("kun min", () => {
    expect(formaterGrense(normaliserGrense({ min: 2, enhet: "%" }))).toBe("≥ 2 %");
  });
  it("kun maks", () => {
    expect(formaterGrense(normaliserGrense({ maks: 2, enhet: "mm" }))).toBe("≤ 2 mm");
  });
  it("toleranse", () => {
    expect(formaterGrense(normaliserGrense({ toleranse: 3, enhet: "mm" }))).toBe("± 3 mm");
  });
  it("min+maks spenn", () => {
    expect(formaterGrense(normaliserGrense({ min: 2, maks: 10, enhet: "mm" }))).toBe("2–10 mm");
  });
  it("uten enhet", () => {
    expect(formaterGrense(normaliserGrense({ min: 5 }))).toBe("≥ 5");
  });
  it("tom når ingen grense", () => {
    expect(formaterGrense(normaliserGrense({ enhet: "mm" }))).toBe("");
  });
});
