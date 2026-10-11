import { describe, it, expect } from "vitest";
import { STREK_SKALERING, beregnStrekVars } from "./strek-skalering";

/**
 * RETUR 1 TILLEGG C1: dempet strekskalering. Viseren måler `displayScale` (rendret
 * SVG-bredde / viewBox-bredde) pr. zoom; den skalerer selv med zoom (SVG-bredden er
 * `zoom × 100 %`), så `displayScale = zoom × baseScale`. Testen modellerer det og
 * verifiserer at SKJERMBREDDEN følger `lw_px × zoom^k` klemt til [minPx, maksPx × lw-faktor].
 */
const { k, minPx, maksPx } = STREK_SKALERING;

/** Skjermbredde (px) for en strek med lineweight `lw` ved gitt zoom, slik CSS-regelen
 * (clamp i viewBox-enheter × displayScale) ender opp. */
function skjermBredde(lw: number, zoom: number, baseScale: number, lwBase: number): number {
  const displayScale = zoom * baseScale;
  const { strekSkala, strekMin, strekMaksK } = beregnStrekVars(zoom, displayScale, lwBase);
  const userUnits = Math.min(
    Math.max(strekMin, lw * strekSkala), // clamp nedre
    lw * strekMaksK,                      // clamp øvre
  );
  return userUnits * displayScale;
}

describe("beregnStrekVars — dempet strekskalering", () => {
  it("strekSkala = zoom^(k−1)", () => {
    expect(beregnStrekVars(1, 0.01, 1).strekSkala).toBeCloseTo(1, 10);
    expect(beregnStrekVars(4, 0.01, 1).strekSkala).toBeCloseTo(Math.pow(4, k - 1), 10);
    expect(beregnStrekVars(0.25, 0.01, 1).strekSkala).toBeCloseTo(Math.pow(0.25, k - 1), 10);
  });

  it("skjermbredde følger lw_px × zoom^k mellom gulv og tak", () => {
    // baseScale valgt så grunnbredden (zoom 1) ligger trygt inne i klemmen.
    const lwBase = 173.57, baseScale = 1.15 / lwBase; // grunnbredde ≈ 1,15 px ved zoom 1
    const base = skjermBredde(lwBase, 1, baseScale, lwBase);
    expect(base).toBeGreaterThan(minPx);
    expect(base).toBeLessThan(maksPx);
    // zoom 4 → base × 4^k ; zoom 0.25 → base × 0.25^k (begge innenfor klemmen)
    expect(skjermBredde(lwBase, 4, baseScale, lwBase)).toBeCloseTo(base * Math.pow(4, k), 6);
    expect(skjermBredde(lwBase, 0.25, baseScale, lwBase)).toBeCloseTo(base * Math.pow(0.25, k), 6);
  });

  it("taket klemmer ved stor innzoom (maksPx × lw-faktor)", () => {
    const lwBase = 173.57, baseScale = 1.15 / lwBase;
    // zoom 1000 ville gitt base × 1000^0,5 ≈ 36 px uklemt → skal klemmes til maksPx for lw=lwBase.
    expect(skjermBredde(lwBase, 1000, baseScale, lwBase)).toBeCloseTo(maksPx, 6);
    // dobbelt så tykk strek (lw-faktor 2) får dobbelt tak.
    expect(skjermBredde(lwBase * 2, 1000, baseScale, lwBase)).toBeCloseTo(maksPx * 2, 6);
  });

  it("gulvet klemmer ved stor utzooming (minPx)", () => {
    const lwBase = 173.57, baseScale = 1.15 / lwBase;
    // zoom 0,001 ville gitt ~0,036 px uklemt → skal løftes til minPx.
    expect(skjermBredde(lwBase, 0.001, baseScale, lwBase)).toBeCloseTo(minPx, 6);
  });

  it("bevarer forholdet mellom lineweights (uklemt)", () => {
    const lwBase = 100, baseScale = 1 / lwBase;
    // Ved zoom 1, innenfor klemmen: tykk/tynn-forhold = lw-forhold.
    const tynn = skjermBredde(100, 1, baseScale, lwBase);
    const tykk = skjermBredde(300, 1, baseScale, lwBase);
    expect(tykk / tynn).toBeCloseTo(3, 6);
  });
});
