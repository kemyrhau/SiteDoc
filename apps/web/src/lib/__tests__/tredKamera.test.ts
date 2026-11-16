import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flyttLangsBlikk, hjulAvstand, HJUL_STEG, orbitPunkt, panTargetPaaModellDybde, MIN_PAN_DYBDE } from "../tredKamera";

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

/** W6 — hjul-zoom følger blikket, også loddrett når kameraet ser skrått ned. */
describe("hjul-zoom langs blikket", () => {
  // Kamera over og ved siden av modellen, ser 45° ned mot origo
  const kamera = { x: 0, y: 10, z: 10 };
  const ned = { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 };

  it("innzoom skrått ovenfra senker kameraet mot det brukeren ser på", () => {
    const ny = flyttLangsBlikk(kamera, ned, hjulAvstand(-100));
    expect(ny.y).toBeLessThan(kamera.y);
    expect(ny.z).toBeLessThan(kamera.z);
    // Flyttet nøyaktig ett steg langs blikket
    const d = Math.hypot(ny.x - kamera.x, ny.y - kamera.y, ny.z - kamera.z);
    expect(d).toBeCloseTo(HJUL_STEG);
  });

  it("forflytningen er parallell med blikket (modellpunktet blir liggende midt i bildet)", () => {
    const ny = flyttLangsBlikk(kamera, ned, 4);
    // Origo ligger fortsatt på blikklinja fra ny posisjon: (origo - ny) × ned = 0
    const v = { x: -ny.x, y: -ny.y, z: -ny.z };
    const kryss = {
      x: v.y * ned.z - v.z * ned.y,
      y: v.z * ned.x - v.x * ned.z,
      z: v.x * ned.y - v.y * ned.x,
    };
    expect(Math.hypot(kryss.x, kryss.y, kryss.z)).toBeCloseTo(0);
  });

  it("hjul ned (positiv deltaY) zoomer ut, hjul opp zoomer inn", () => {
    expect(hjulAvstand(100)).toBeLessThan(0);
    expect(hjulAvstand(-100)).toBeGreaterThan(0);
  });
});

/** Rotasjon rundt skjermmidten (Kenneth 2026-11-17). */
describe("orbitPunkt", () => {
  const kamera = { x: 0, y: 10, z: 10 };
  const ned = { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 };

  it("treff i skjermmidten: punktet ligger på treffets avstand langs blikket", () => {
    const o = orbitPunkt(kamera, ned, Math.hypot(10, 10), 3);
    expect(o.avstand).toBeCloseTo(Math.hypot(10, 10));
    expect(o.punkt.x).toBeCloseTo(0);
    expect(o.punkt.y).toBeCloseTo(0);
    expect(o.punkt.z).toBeCloseTo(0);
  });

  it("ingen treff: samme avstand som sist", () => {
    const o = orbitPunkt(kamera, ned, null, 3);
    expect(o.avstand).toBe(3);
    expect(Math.hypot(o.punkt.x - kamera.x, o.punkt.y - kamera.y, o.punkt.z - kamera.z)).toBeCloseTo(3);
  });

  it("treff med avstand 0 regnes som bom", () => {
    expect(orbitPunkt(kamera, ned, 0, 3).avstand).toBe(3);
  });
});

describe("kobling i tred-viewer-kontekst", () => {
  const kilde = readFileSync(resolve(__dirname, "../../kontekst/tred-viewer-kontekst.tsx"), "utf8");

  it("høyre/midtre knapp bruker pan-regelen, venstre roterer rundt skjermmidten", () => {
    expect(kilde).toContain("if (e.button === 0) void settOrbitPunkt();");
    expect(kilde).toContain("else if (e.button === 1 || e.button === 2) settTargetPaaModellDybde();");
    expect(kilde).toContain("panTargetPaaModellDybde(cam.position, blikkretning(), modellSenter)");
  });

  it("W6: camera-controls' hjul-dolly er av, og hjulet flytter target langs blikket", () => {
    expect(kilde).toContain("ctrl.mouseButtons.wheel = 0;");
    expect(kilde).toContain("flyttLangsBlikk(t, retning, hjulAvstand(e.deltaY))");
    expect(kilde).not.toContain("ctrl.forward(");
  });

  it("rotasjon rundt ståsted er erstattet: ingen target 2 enheter foran, ingen controlend-nullstilling", () => {
    expect(kilde).not.toContain("oppdaterTarget");
    expect(kilde).not.toContain('addEventListener("controlend"');
  });

  it("orbit-punktet: først samme avstand som sist, så treffet fra skjermmidten", () => {
    expect(kilde).toContain("orbitPunkt(cam.position, blikkretning(), null, sisteOrbitAvstand)");
    expect(kilde).toContain("orbitPunkt(cam.position, blikkretning(), treff.distanceTo(kameraVedStart), sisteOrbitAvstand)");
    expect(kilde).toContain("sisteOrbitAvstand = o.avstand;");
    // Raycasten går fra midten av lerretet mot synlige modeller
    expect(kilde).toContain("new THREE.Vector2(rect.left + rect.width / 2, rect.top + rect.height / 2)");
    const fn = kilde.slice(kilde.indexOf("finnTreffISkjermmidten = async"), kilde.indexOf("let mouseDownPos"));
    expect(fn).toContain("if (!synligeModeller.has(mid)) continue;");
  });

  it("modellsenteret settes fra samlet bbox når modellene er lastet", () => {
    expect(kilde).toContain("modellSenter = center.clone();");
  });
});
