/**
 * M1–M3: kameraet i mobil-vieweren skal følge modellen, ikke en bounding box blåst opp
 * av utliggere, og minDistance skal skaleres med modellen i stedet for fast 6 m.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beregnInnramming,
  brukSomOrbitPunkt,
  gestPunkt,
  robustBoks,
  type Boks,
} from "../app/mobil-viewer/kameraInnramming";

const boks = (x: number, y: number, z: number, s = 1): Boks => ({
  min: { x, y, z },
  max: { x: x + s, y: y + s, z: z + s },
});

/** Bygg på 100 × 20 × 60 m (x, y=høyde, z) med objekter jevnt fordelt. */
function bygg(): Boks[] {
  const ut: Boks[] = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 12; k++) {
    ut.push(boks(i * 5, j * 5, k * 5, 4));
  }
  return ut;
}

describe("robustBoks", () => {
  it("ser bort fra ett objekt langt unna (H1)", () => {
    const r = robustBoks([...bygg(), boks(2000, 0, 1500)])!;
    expect(r.utliggere).toBe(1);
    expect(r.boks.max.x).toBeLessThanOrEqual(100);
    expect(r.boks.max.z).toBeLessThanOrEqual(60);
  });

  it("tar med hele bygget når det ikke finnes utliggere", () => {
    const r = robustBoks(bygg())!;
    expect(r.utliggere).toBe(0);
    expect(r.boks).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 99, y: 19, z: 59 } });
  });

  it("flat modell beholder et enkelt takobjekt (spenn 0 på høydeaksen)", () => {
    const flat: Boks[] = [];
    for (let i = 0; i < 50; i++) flat.push(boks(i * 2, 0, 0, 1));
    flat.push(boks(50, 6, 0, 1));
    const r = robustBoks(flat)!;
    expect(r.utliggere).toBe(0);
    expect(r.boks.max.y).toBe(7);
  });

  it("for få objekter: hele boksen", () => {
    const r = robustBoks([boks(0, 0, 0), boks(5000, 0, 0)])!;
    expect(r.utliggere).toBe(0);
    expect(r.boks.max.x).toBe(5001);
  });

  it("ugyldige bokser ignoreres; ingen gyldige gir null", () => {
    const tom = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
    expect(robustBoks([tom])).toBeNull();
    expect(robustBoks([])).toBeNull();
    expect(robustBoks([tom, boks(0, 0, 0)])!.antall).toBe(1);
  });
});

describe("beregnInnramming", () => {
  const b: Boks = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 20, z: 60 } };

  it("hele kula får plass i smaleste synsvinkel (stående telefon)", () => {
    const aspect = 0.46;
    const inn = beregnInnramming(b, 60, aspect);
    const radius = Math.sqrt(100 ** 2 + 20 ** 2 + 60 ** 2) / 2;
    const hfov = 2 * Math.atan(Math.tan(Math.PI / 6) * aspect);
    expect(inn.avstand).toBeCloseTo(radius / Math.sin(hfov / 2), 6);
    const d = Math.hypot(inn.posisjon.x - inn.target.x, inn.posisjon.y - inn.target.y, inn.posisjon.z - inn.target.z);
    expect(d).toBeCloseTo(inn.avstand, 6);
    expect(inn.target).toEqual({ x: 50, y: 10, z: 30 });
  });

  it("liggende skjerm: vertikal vinkel styrer", () => {
    const inn = beregnInnramming(b, 60, 2);
    const radius = Math.sqrt(100 ** 2 + 20 ** 2 + 60 ** 2) / 2;
    expect(inn.avstand).toBeCloseTo(radius / Math.sin(Math.PI / 6), 6);
  });

  it("near/far har samme forhold som z-fighting-fiksen (near = maks·0,001)", () => {
    const inn = beregnInnramming(b, 60, 0.46);
    expect(inn.near).toBeCloseTo(0.1, 9);
    expect(inn.far).toBeGreaterThanOrEqual(100 * 20);
    expect(inn.far).toBeGreaterThan(inn.avstand + 60);
  });

  it("minDistance skaleres med modellen, ikke fast 6 m (H2)", () => {
    expect(beregnInnramming(b, 60, 1).minDistance).toBeCloseTo(0.5, 9);
    const liten: Boks = { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 3, z: 4 } };
    expect(beregnInnramming(liten, 60, 1).minDistance).toBe(0.05);
    expect(beregnInnramming(liten, 60, 1).minDistance).toBeLessThan(6);
  });
});

describe("orbit-punkt under fingrene", () => {
  it("gestpunkt: én finger = fingeren, to = midtpunktet, ingen = null", () => {
    expect(gestPunkt([{ x: 10, y: 20 }])).toEqual({ x: 10, y: 20 });
    expect(gestPunkt([{ x: 0, y: 0 }, { x: 100, y: 50 }])).toEqual({ x: 50, y: 25 });
    expect(gestPunkt([])).toBeNull();
  });

  it("treff nærmere enn minDistance brukes ikke (kameraet ville hoppet bakover)", () => {
    const kamera = { x: 0, y: 0, z: 0 };
    expect(brukSomOrbitPunkt(kamera, { x: 0, y: 0, z: 10 }, 0.5)).toBe(true);
    expect(brukSomOrbitPunkt(kamera, { x: 0, y: 0, z: 0.6 }, 0.5)).toBe(false);
    expect(brukSomOrbitPunkt(kamera, { x: NaN, y: 0, z: 0 }, 0.5)).toBe(false);
  });
});

describe("mobil-viewer: vakt", () => {
  const kilde = readFileSync(resolve(__dirname, "../app/mobil-viewer/page.tsx"), "utf-8");

  it("innramming bruker robust boks og setter minDistance fra modellen", () => {
    expect(kilde).toContain("const robust = robustBoks(alle)");
    expect(kilde).toContain("ctrl.minDistance = inn.minDistance");
    expect(kilde).toContain("await rammInn()");
  });

  it("berøring setter orbit-punkt fra raycast", () => {
    expect(kilde).toContain("ctrl.setOrbitPoint(treff.point.x, treff.point.y, treff.point.z)");
    expect(kilde).toContain("void settOrbitPunkt()");
  });

  it("funksjonsinventar bevart: fragment-cache, råfil-lager, objektvalg med punkt, snitt, modellbytte", () => {
    expect(kilde).toContain("if (cachedFrag) {");
    expect(kilde).toContain("raadata.hentIBakgrunn(");
    expect(kilde).toContain("punkt: { x: hitResult.point.x, y: hitResult.point.y, z: hitResult.point.z }");
    expect(kilde).toContain("await clipper.create(world)");
    expect(kilde).toContain('msg.type === "toggleModell"');
  });
});
