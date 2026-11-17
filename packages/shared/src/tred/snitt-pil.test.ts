import { describe, expect, it } from "vitest";
import { snittPilPunkt, SNITT_PIL_PARALLELL } from "./snitt-pil";
import type { Punkt3 } from "./utliggere";

/** Avstand fra punktet til planet (normal n, punkt p) */
function avstandTilPlan(q: Punkt3, n: Punkt3, p: Punkt3): number {
  const l = Math.hypot(n.x, n.y, n.z);
  return Math.abs((n.x * (q.x - p.x) + n.y * (q.y - p.y) + n.z * (q.z - p.z)) / l);
}

const nær = (a: Punkt3, b: Punkt3) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe("snittPilPunkt", () => {
  // Vertikalt snitt x = 4 (normal −x, som Clipper lager det fra en vegg sett fra −x)
  const normal = { x: -1, y: 0, z: 0 };
  const iPlan = { x: 4, y: 2, z: 30 };

  it("strålen fra skjermmidten krysser planet foran kameraet → krysningspunktet", () => {
    const q = snittPilPunkt(normal, iPlan, { x: 0, y: 1.6, z: 0 }, { x: 1, y: 0, z: 0 })!;
    nær(q, { x: 4, y: 1.6, z: 0 });
    expect(avstandTilPlan(q, normal, iPlan)).toBeLessThan(1e-6);
  });

  it("skrått blikk: punktet ligger på strålen og i planet", () => {
    const kamera = { x: 0, y: 5, z: 0 };
    const retning = { x: 2, y: -1, z: 1 }; // normaliseres
    const q = snittPilPunkt(normal, iPlan, kamera, retning)!;
    nær(q, { x: 4, y: 3, z: 2 });
    expect(avstandTilPlan(q, normal, iPlan)).toBeLessThan(1e-6);
  });

  it("planet bak kameraet → kameraets nærmeste punkt på planet", () => {
    const kamera = { x: 0, y: 1.6, z: 7 };
    const q = snittPilPunkt(normal, iPlan, kamera, { x: -1, y: 0, z: 0 })!;
    nær(q, { x: 4, y: 1.6, z: 7 });
    expect(avstandTilPlan(q, normal, iPlan)).toBeLessThan(1e-6);
  });

  it("strålen parallell med planet → nærmeste punkt på planet", () => {
    const kamera = { x: 1, y: 3, z: -2 };
    const q = snittPilPunkt(normal, iPlan, kamera, { x: 0, y: 0, z: 1 })!;
    nær(q, { x: 4, y: 3, z: -2 });
  });

  it("nesten parallell (under terskelen) regnes som parallell", () => {
    const kamera = { x: 1, y: 3, z: -2 };
    const q = snittPilPunkt(normal, iPlan, kamera, { x: SNITT_PIL_PARALLELL / 10, y: 0, z: 1 })!;
    nær(q, { x: 4, y: 3, z: -2 });
  });

  it("kameraet står i planet og ser langs det → kameraets posisjon", () => {
    const kamera = { x: 4, y: 1, z: 1 };
    nær(snittPilPunkt(normal, iPlan, kamera, { x: 0, y: 0, z: 1 })!, kamera);
  });

  it("normalen trenger ikke være enhetsvektor; vannrett plan (gulvsnitt)", () => {
    const n = { x: 0, y: -3, z: 0 }; // y = 2,5, skjuler alt over
    const p = { x: 10, y: 2.5, z: 10 };
    const q = snittPilPunkt(n, p, { x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 1 })!;
    nær(q, { x: 0, y: 2.5, z: 7.5 });
    expect(avstandTilPlan(q, n, p)).toBeLessThan(1e-6);
  });

  it("ingen retning → fotpunktet", () => {
    nær(snittPilPunkt(normal, iPlan, { x: 0, y: 1, z: 2 }, { x: 0, y: 0, z: 0 })!, { x: 4, y: 1, z: 2 });
  });

  it("ugyldig normal eller punkt → null", () => {
    expect(snittPilPunkt({ x: 0, y: 0, z: 0 }, iPlan, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
    expect(snittPilPunkt(normal, { x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
    expect(snittPilPunkt(normal, iPlan, { x: 0, y: Infinity, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
  });

  it("feiler hvis normalen endres: punktet ligger i planet med SAMME normal, ikke i et annet", () => {
    const kamera = { x: 0, y: 5, z: 0 };
    const retning = { x: 2, y: -1, z: 1 };
    const q = snittPilPunkt(normal, iPlan, kamera, retning)!;
    expect(avstandTilPlan(q, normal, iPlan)).toBeLessThan(1e-6);
    // Et annet plan gjennom samme punkt gir et annet svar, og det svaret ligger ikke i vårt plan
    const annen = snittPilPunkt({ x: -1, y: 0, z: -1 }, iPlan, kamera, retning)!;
    expect(avstandTilPlan(annen, normal, iPlan)).toBeGreaterThan(1);
  });
});
