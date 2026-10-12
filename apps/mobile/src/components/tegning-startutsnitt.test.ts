import { describe, it, expect } from "vitest";
import {
  startutsnittZoom,
  startutsnittRamme,
  STARTUTSNITT_MAKS_ZOOM,
} from "./tegning-startutsnitt";

/**
 * L4b: det første synlige utsnittet på mobil = startutsnittet (bygget), ikke rutenettet.
 * Verifiserer zoom-valget (begge akser) + at scroll sentrerer utsnittets midtpunkt.
 * (Behavioral WebKit-bevis: relay/ezdxf-visning/l4b-mobil-startutsnitt.png.)
 */
describe("startutsnitt-ramme (L4b)", () => {
  // iPhone-aktig viewport.
  const cw = 390,
    ch = 844;

  it("stående tegning: hele utsnittet får plass i høyden (su.h·innerH ≤ ch)", () => {
    // Høy, smal tegning (fallplan etter rotasjon) — innerflate høyere enn portrett-
    // viewporten (forhold 2,5 > ch/cw ≈ 2,16), høyt utsnitt. Her sprenger den gamle
    // kun-bredde-formelen høyden selv på et høyt telefon-viewport.
    const forhold = 2.5;
    const su = { x: 0.1, y: 0.1, w: 0.15, h: 0.3 };
    const z = startutsnittZoom(su, cw, ch, forhold);
    const innerH = cw * z * forhold;
    expect(su.h * innerH).toBeLessThanOrEqual(ch);
    // Gammel formel (kun bredde) sprengte høyden — kontroll på at dette var en ekte feil.
    const zGammel = Math.min(50, Math.max(1, 0.98 / Math.max(su.w, su.h)));
    expect(su.h * (cw * zGammel * forhold)).toBeGreaterThan(ch);
  });

  it("liggende tegning er uendret: bredden er bindende (0,98/w)", () => {
    const forhold = 0.6;
    const su = { x: 0.1, y: 0.2, w: 0.75, h: 0.2 };
    expect(startutsnittZoom(su, cw, ch, forhold)).toBeCloseTo(0.98 / 0.75, 6);
  });

  it("zoom klemt [1,50]", () => {
    // Lite tett utsnitt → klemt til maks.
    expect(startutsnittZoom({ x: 0.4, y: 0.4, w: 0.01, h: 0.01 }, cw, ch, 1)).toBe(
      STARTUTSNITT_MAKS_ZOOM,
    );
    // Utsnitt = hele viewBox → ingen innzoom (gulv 1).
    expect(startutsnittZoom({ x: 0, y: 0, w: 1, h: 1 }, cw, ch, 1)).toBe(1);
  });

  it("scroll sentrerer utsnittets midtpunkt i viewporten", () => {
    const su = { x: 0.2, y: 0.25, w: 0.5, h: 0.5 };
    const forhold = 1.4;
    const r = startutsnittRamme(su, cw, ch, forhold);
    const innerW = cw * r.zoom,
      innerH = innerW * forhold;
    expect(r.left + cw / 2).toBeCloseTo((su.x + su.w / 2) * innerW, 6);
    expect(r.top + ch / 2).toBeCloseTo((su.y + su.h / 2) * innerH, 6);
  });

  it("scroll klemmes til ≥ 0 (utsnitt nær origo)", () => {
    const r = startutsnittRamme({ x: 0, y: 0, w: 0.3, h: 0.3 }, cw, ch, 1.2);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });
});
