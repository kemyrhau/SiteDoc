import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zoomSteg, ZOOM_MIN_STEG_M } from "@sitedoc/shared";
import { avstandEtterSteg, flyttLangsBlikk, hjulAvstand, orbitPunkt, panTargetPaaModellDybde, MIN_PAN_DYBDE } from "../tredKamera";

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
    const ny = flyttLangsBlikk(kamera, ned, hjulAvstand(-100, 14));
    expect(ny.y).toBeLessThan(kamera.y);
    expect(ny.z).toBeLessThan(kamera.z);
    // Flyttet nøyaktig ett steg langs blikket
    const d = Math.hypot(ny.x - kamera.x, ny.y - kamera.y, ny.z - kamera.z);
    expect(d).toBeCloseTo(zoomSteg(14));
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
    expect(hjulAvstand(100, 14)).toBeLessThan(0);
    expect(hjulAvstand(-100, 14)).toBeGreaterThan(0);
  });
});

/** § 3b punkt 2 — zoom-farten følger avstanden til flaten midt på skjermen (kurve felles med mobil). */
describe("zoom-fart etter avstand", () => {
  it("ett hjulhakk = zoomSteg(avstand) fra @sitedoc/shared", () => {
    for (const d of [0.1, 1, 5, 20, 100, 2000]) expect(hjulAvstand(-100, d)).toBeCloseTo(zoomSteg(d));
  });

  it("rask langt unna, sakte nær", () => {
    expect(hjulAvstand(-100, 200)).toBeGreaterThan(hjulAvstand(-100, 20));
    expect(hjulAvstand(-100, 20)).toBeGreaterThan(hjulAvstand(-100, 2));
    // Nær en vegg (1 m) er steget under 1 cm-skala ganger fem — man går ikke gjennom den
    expect(hjulAvstand(-100, 1)).toBeLessThan(0.05);
  });

  it("halvt hakk (styreflate) gir halvt steg", () => {
    expect(hjulAvstand(-50, 20)).toBeCloseTo(zoomSteg(20) / 2);
  });

  it("avstanden trekkes ned med steget til raycasten svarer, aldri under minstesteget", () => {
    expect(avstandEtterSteg(20, 1)).toBe(19);
    expect(avstandEtterSteg(20, -1)).toBe(21);
    expect(avstandEtterSteg(0.01, 1)).toBe(ZOOM_MIN_STEG_M);
  });

  it("innzoom mot en vegg 10 m unna bremser ned nær veggen, og kommer gjennom med minstesteget", () => {
    let avstand = 10;
    let gått = 0;
    const steg: number[] = [];
    for (let i = 0; i < 100; i++) {
      const s = hjulAvstand(-100, avstand);
      steg.push(s);
      gått += s;
      avstand = avstandEtterSteg(avstand, s);
    }
    expect(steg[0]).toBeCloseTo(zoomSteg(10));
    // 100 hakk: nesten fram (målt 8,6 m), ikke forbi
    expect(gått).toBeGreaterThan(8);
    expect(gått).toBeLessThan(10);
    // Steget avtar for hvert hakk og ender ved minstesteget — kontrollert inn mot/gjennom veggen
    for (let i = 1; i < steg.length; i++) expect(steg[i]).toBeLessThanOrEqual(steg[i - 1]!);
    expect(steg[99]).toBeLessThan(steg[0]! / 10);
    expect(steg[99]).toBeGreaterThanOrEqual(ZOOM_MIN_STEG_M);
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
    expect(kilde).toContain("flyttLangsBlikk(t, retning, steg)");
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

  it("zoom-fart: hjulsteget regnes fra avstanden til flaten midt på skjermen, som måles på nytt", () => {
    expect(kilde).toContain("const steg = hjulAvstand(e.deltaY, sisteOrbitAvstand);");
    expect(kilde).toContain("sisteOrbitAvstand = avstandEtterSteg(sisteOrbitAvstand, steg);");
    const hjul = kilde.slice(kilde.indexOf('addEventListener("wheel"'), kilde.indexOf("function maalAvstandTilMidten"));
    expect(hjul).toContain("maalAvstandTilMidten();");
    const maal = kilde.slice(kilde.indexOf("function maalAvstandTilMidten"));
    expect(maal.slice(0, 600)).toContain("if (treff) sisteOrbitAvstand = treff.distanceTo(cam.position);");
  });

  it("modellsenteret settes fra samlet bbox når modellene er lastet", () => {
    expect(kilde).toContain("modellSenter = center.clone();");
  });
});
