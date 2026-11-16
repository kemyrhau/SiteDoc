import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { panTargetPaaModellDybde, MIN_PAN_DYBDE } from "../tredKamera";

/** W4 — pan-target legges på modellens dybde, ikke 2 enheter foran kamera. */
describe("panTargetPaaModellDybde", () => {
  it("bygning sett på avstand: target havner på senterets dybde langs blikket", () => {
    // Kamera 100 m unna langs -z, ser rett mot origo der modellen står.
    const t = panTargetPaaModellDybde({ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 });
    expect(t).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("senter ved siden av blikklinja: projiseres ned på blikklinja (kameraretning bevares)", () => {
    const t = panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 50, y: 30, z: -20 });
    expect(t).toEqual({ x: 50, y: 0, z: 0 });
  });

  it("dybden gir pan-fart i riktig størrelsesorden (50× mot 2 enheter foran)", () => {
    const kamera = { x: 0, y: 0, z: 100 };
    const t = panTargetPaaModellDybde(kamera, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 })!;
    const avstand = Math.hypot(t.x - kamera.x, t.y - kamera.y, t.z - kamera.z);
    expect(avstand / MIN_PAN_DYBDE).toBe(50);
  });

  it("senter bak kamera: target beholdes (null)", () => {
    expect(panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 10 })).toBeNull();
  });

  it("senter nærmere enn minstedybden: target beholdes (null)", () => {
    expect(panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: MIN_PAN_DYBDE, y: 0, z: 0 })).toBeNull();
  });
});

describe("kobling i tred-viewer-kontekst", () => {
  const kilde = readFileSync(resolve(__dirname, "../../kontekst/tred-viewer-kontekst.tsx"), "utf8");

  it("høyre/midtre knapp bruker pan-regelen, venstre beholder rotasjon rundt ståsted", () => {
    expect(kilde).toContain("if (e.button === 0) oppdaterTarget();");
    expect(kilde).toContain("else if (e.button === 1 || e.button === 2) settTargetPaaModellDybde();");
    expect(kilde).toContain("panTargetPaaModellDybde(cam.position, blikkretning(), modellSenter)");
  });

  it("modellsenteret settes fra samlet bbox når modellene er lastet", () => {
    expect(kilde).toContain("modellSenter = center.clone();");
  });
});
