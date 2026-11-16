import { describe, expect, it } from "vitest";
import { dollyFartForAvstand, zoomSteg, ZOOM_MIN_STEG_M } from "./zoom-fart";

describe("zoomSteg — avstand til flaten midt på skjermen → meter pr. zoom-enhet", () => {
  // Tabellen i zoom-fart.ts: rask langt unna, sakte nær (hyperbel), gulv 2 cm.
  const tabell: [number, number][] = [
    [200, 9.756], [50, 2.273], [20, 0.8], [10, 0.333], [5, 0.125], [2, 0.029], [1, 0.02], [0.5, 0.02],
  ];
  it.each(tabell)("d = %s m → %s m", (d, steg) => {
    expect(zoomSteg(d)).toBeCloseTo(steg, 3);
  });

  it("langt unna: nær 5 % av avstanden (som før)", () => {
    expect(zoomSteg(1000) / 1000).toBeGreaterThan(0.049);
  });

  it("nær: under halvparten av før (5 % av avstanden) fra 5 m og innover", () => {
    for (const d of [5, 3, 2]) expect(zoomSteg(d)).toBeLessThanOrEqual(0.05 * d * 0.5);
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
