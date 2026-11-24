import { describe, expect, it } from "vitest";
import { dollyFartForAvstand, zoomSteg, ZOOM_MIN_STEG_M, ZOOM_NAERHET_M } from "./zoom-fart";

describe("zoomSteg — avstand til flaten midt på skjermen → meter pr. zoom-enhet", () => {
  // Vedtak § 3c (ii): nærhet 1 m, gulv 5 cm. Stegene låses med to desimaler som i vedtaket.
  const vedtak: [number, number][] = [[50, 2.45], [20, 0.95], [10, 0.45], [5, 0.21], [2, 0.07], [1, 0.05]];
  it.each(vedtak)("d = %s m → %s m (vedtak § 3c)", (d, steg) => {
    expect(Math.round(zoomSteg(d) * 100) / 100).toBe(steg);
  });

  it("konstantene er vedtakets", () => {
    expect(ZOOM_NAERHET_M).toBe(1);
    expect(ZOOM_MIN_STEG_M).toBe(0.05);
  });

  const tabell: [number, number][] = [
    [200, 9.95], [50, 2.451], [20, 0.952], [10, 0.455], [5, 0.208], [2, 0.067], [1, 0.05], [0.5, 0.05],
  ];
  it.each(tabell)("tabellen i zoom-fart.ts: d = %s m → %s m", (d, steg) => {
    expect(zoomSteg(d)).toBeCloseTo(steg, 3);
  });

  it("langt unna: nær 5 % av avstanden (som før)", () => {
    expect(zoomSteg(1000) / 1000).toBeGreaterThan(0.049);
  });

  it("nær: saktere enn 5 % av avstanden, men ikke under gulvet", () => {
    for (const d of [5, 3, 2]) {
      expect(zoomSteg(d)).toBeLessThan(0.05 * d);
      expect(zoomSteg(d)).toBeGreaterThanOrEqual(ZOOM_MIN_STEG_M);
    }
  });

  it("monotont voksende med avstanden", () => {
    let forrige = 0;
    for (let d = 0.1; d < 500; d *= 1.3) {
      const s = zoomSteg(d);
      expect(s).toBeGreaterThanOrEqual(forrige);
      forrige = s;
    }
  });

  it("gulv: man kommer alltid videre (også gjennom en vegg), også ved 0/NaN", () => {
    expect(zoomSteg(0.01)).toBe(ZOOM_MIN_STEG_M);
    expect(zoomSteg(0)).toBe(ZOOM_MIN_STEG_M);
    expect(zoomSteg(Number.NaN)).toBe(ZOOM_MIN_STEG_M);
  });
});

describe("dollyFartForAvstand — camera-controls flytter radius·(1−0,95^fart) pr. enhet", () => {
  it.each([200, 50, 10, 2, 1])("gir zoomSteg(%s) pr. enhet", (r) => {
    const flytt = r * (1 - Math.pow(0.95, dollyFartForAvstand(r)));
    expect(flytt).toBeCloseTo(zoomSteg(r), 6);
  });

  it("kapper ved halve radiusen svært nær (gulvet større enn radiusen)", () => {
    const r = 0.01;
    expect(r * (1 - Math.pow(0.95, dollyFartForAvstand(r)))).toBeCloseTo(r / 2, 9);
  });

  it("ugyldig radius gir standardfart 1", () => {
    expect(dollyFartForAvstand(0)).toBe(1);
    expect(dollyFartForAvstand(Number.NaN)).toBe(1);
  });
});
