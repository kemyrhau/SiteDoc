import { describe, expect, it } from "vitest";
import { finnUtliggere, MIN_OBJEKTER_FOR_UTLIGGERE, type Boks3 } from "./utliggere";

const boks = (x: number, y: number, z: number, s = 1): Boks3 => ({
  min: { x, y, z },
  max: { x: x + s, y: y + s, z: z + s },
});

/** Bygg på 100 × 20 × 60 m (x, y=høyde, z) med 960 objekter jevnt fordelt. */
function bygg(): Boks3[] {
  const ut: Boks3[] = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 12; k++) {
    ut.push(boks(i * 5, j * 5, k * 5, 4));
  }
  return ut;
}

describe("finnUtliggere", () => {
  it("objekt langt unna (informasjonsfil 2 km unna) er utligger; boksen er bygget", () => {
    const b = bygg();
    const r = finnUtliggere([...b, boks(2000, 0, 1500)])!;
    expect(r.utliggere).toEqual([b.length]);
    expect(r.boks).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 99, y: 19, z: 59 } });
  });

  it("flere utliggere i ulike retninger, også under bygget", () => {
    const b = bygg();
    const r = finnUtliggere([boks(-800, 0, 0), ...b, boks(0, -500, 0), boks(50, 0, 900)])!;
    expect(r.utliggere).toEqual([0, b.length + 1, b.length + 2]);
  });

  it("bygg uten utliggere: ingen skjules", () => {
    expect(finnUtliggere(bygg())!.utliggere).toEqual([]);
  });

  it("flat modell beholder et enkelt takobjekt (spenn 0 på høydeaksen)", () => {
    const flat: Boks3[] = [];
    for (let i = 0; i < 50; i++) flat.push(boks(i * 2, 0, 0, 1));
    flat.push(boks(50, 6, 0, 1));
    const r = finnUtliggere(flat)!;
    expect(r.utliggere).toEqual([]);
    expect(r.boks.max.y).toBe(7);
  });

  it("lang konstruksjon (rør/linje) beholder endene", () => {
    const linje: Boks3[] = [];
    for (let i = 0; i <= 100; i++) linje.push(boks(i * 10, 0, 0, 1));
    expect(finnUtliggere(linje)!.utliggere).toEqual([]);
  });

  it(`færre enn ${MIN_OBJEKTER_FOR_UTLIGGERE} objekter: ingen utliggere, hele boksen`, () => {
    const r = finnUtliggere([boks(0, 0, 0), boks(5000, 0, 0)])!;
    expect(r.utliggere).toEqual([]);
    expect(r.boks.max.x).toBe(5001);
  });

  it("ugyldige bokser er aldri utliggere og telles ikke; ingen gyldige gir null", () => {
    const tom: Boks3 = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
    expect(finnUtliggere([tom])).toBeNull();
    expect(finnUtliggere([])).toBeNull();
    const r = finnUtliggere([tom, ...bygg()])!;
    expect(r.antall).toBe(960);
    expect(r.utliggere).toEqual([]);
  });
});
