import { describe, it, expect } from "vitest";
import {
  startutsnittZoom,
  startutsnittRamme,
  STARTUTSNITT_MAKS_ZOOM,
} from "./tegning-startutsnitt";

/**
 * L4b: det første synlige utsnittet på mobil = startutsnittet (bygget), ikke rutenettet.
 * Verifiserer zoom-valget + at scroll sentrerer utsnittets midtpunkt i viewporten.
 * (Behavioral WebKit-bevis: relay/ezdxf-visning/l4b-mobil-startutsnitt.png.)
 */
describe("startutsnitt-ramme (L4b)", () => {
  it("zoom = 0,98/maks(w,h), klemt [1,50]", () => {
    // Bygget dekker ~75 % → modest innzoom.
    expect(startutsnittZoom({ x: 0.17, y: 0.18, w: 0.75, h: 0.76 })).toBeCloseTo(0.98 / 0.76, 6);
    // Lite tett utsnitt → klemt til maks.
    expect(startutsnittZoom({ x: 0.4, y: 0.4, w: 0.01, h: 0.01 })).toBe(STARTUTSNITT_MAKS_ZOOM);
    // Utsnitt = hele viewBox → ingen innzoom (gulv 1).
    expect(startutsnittZoom({ x: 0, y: 0, w: 1, h: 1 })).toBe(1);
  });

  it("scroll sentrerer utsnittets midtpunkt i viewporten", () => {
    const su = { x: 0.2, y: 0.25, w: 0.5, h: 0.5 };
    const cw = 390, ch = 844;
    const zoom = startutsnittZoom(su);
    // container-størrelse etter zoom (img fyller container-bredden; høyden følger aspekt).
    const innerW = cw * zoom, innerH = 2000 * zoom;
    const r = startutsnittRamme(su, cw, ch, innerW, innerH);
    // Senter av utsnittet skal havne midt i viewporten: scroll + halve viewporten = senter-px.
    expect(r.left + cw / 2).toBeCloseTo((su.x + su.w / 2) * innerW, 6);
    expect(r.top + ch / 2).toBeCloseTo((su.y + su.h / 2) * innerH, 6);
  });

  it("scroll klemmes til ≥ 0 (utsnitt nær origo)", () => {
    const su = { x: 0, y: 0, w: 0.3, h: 0.3 };
    const r = startutsnittRamme(su, 390, 844, 390 * startutsnittZoom(su), 2000);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });
});
