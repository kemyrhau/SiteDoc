/**
 * M1–M3 + RETUR 3 (§ 3b): kameraet i mobil-vieweren rammer inn bygget uten objekter langt
 * unna, minDistance skaleres med modellen, orbit-punktet er flaten midt på skjermen, og
 * zoom-farten følger avstanden dit. Utligger-regelen og zoom-kurven testes i
 * packages/shared/src/tred/*.test.ts.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dollyFartForAvstand, zoomSteg } from "@sitedoc/shared/tred";
import {
  beregnInnramming, dollyFartMobil, FYLL_MARGIN, orbitAvstand, PINCH_KOMPENSASJON,
  type Boks, type Innramming, type Punkt,
} from "../app/mobil-viewer/kameraInnramming";

/** Skjermkoordinat (−1..1) for et punkt sett fra innrammingens kamera. */
function projiser(inn: Innramming, p: Punkt, vfovGrader: number, aspect: number) {
  const f = { x: inn.target.x - inn.posisjon.x, y: inn.target.y - inn.posisjon.y, z: inn.target.z - inn.posisjon.z };
  const fl = Math.hypot(f.x, f.y, f.z);
  const fn = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
  const hl = Math.hypot(fn.x, fn.z);
  const h = { x: -fn.z / hl, y: 0, z: fn.x / hl };
  const o = { x: h.y * fn.z - h.z * fn.y, y: h.z * fn.x - h.x * fn.z, z: h.x * fn.y - h.y * fn.x };
  const r = { x: p.x - inn.posisjon.x, y: p.y - inn.posisjon.y, z: p.z - inn.posisjon.z };
  const dot = (a: Punkt, b: Punkt) => a.x * b.x + a.y * b.y + a.z * b.z;
  const tv = Math.tan((vfovGrader * Math.PI) / 360);
  return { x: dot(r, h) / dot(r, fn) / (tv * aspect), y: dot(r, o) / dot(r, fn) / tv };
}

function hjørnerAv(b: Boks): Punkt[] {
  const p: Punkt[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.push({ x, y, z });
  return p;
}

/** Største |x| og |y| på skjermen for alle hjørner. */
function fyll(inn: Innramming, bokser: Boks[], vfov: number, aspect: number) {
  let x = 0, y = 0;
  for (const b of bokser) for (const p of hjørnerAv(b)) {
    const s = projiser(inn, p, vfov, aspect);
    x = Math.max(x, Math.abs(s.x)); y = Math.max(y, Math.abs(s.y));
  }
  return { x, y };
}

describe("beregnInnramming", () => {
  const b: Boks = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 20, z: 60 } };

  it("ORDRE 8 (v): boksen fyller skjermen — alle hjørner innenfor, kanten nås på én akse (stående)", () => {
    const aspect = 0.46;
    const inn = beregnInnramming(b, 60, aspect);
    const s = fyll(inn, [b], 60, aspect);
    expect(Math.max(s.x, s.y)).toBeCloseTo(1 - FYLL_MARGIN, 6);
    expect(s.x).toBeLessThanOrEqual(1 - FYLL_MARGIN + 1e-9);
    expect(s.y).toBeLessThanOrEqual(1 - FYLL_MARGIN + 1e-9);
    const d = Math.hypot(inn.posisjon.x - inn.target.x, inn.posisjon.y - inn.target.y, inn.posisjon.z - inn.target.z);
    expect(d).toBeCloseTo(inn.avstand, 6);
  });

  it("ORDRE 8 (v): nærmere enn den gamle kula (som ga ~68 % bredde på E3 ARK)", () => {
    const aspect = 390 / 844;
    const e3: Boks = { min: { x: -28, y: -3, z: -104.6 }, max: { x: 17.5, y: 8.2, z: 4.4 } };
    const inn = beregnInnramming(e3, 60, aspect);
    const radius = Math.hypot(45.5, 11.2, 109) / 2;
    const hfov = 2 * Math.atan(Math.tan(Math.PI / 6) * aspect);
    expect(inn.avstand).toBeLessThan(radius / Math.sin(hfov / 2));
  });

  it("ORDRE 8 (v): objektboksene styrer — L-form rammes tettere enn samlet boks", () => {
    const aspect = 0.46;
    const l: Boks[] = [
      { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 10, z: 10 } },
      { min: { x: 90, y: 0, z: 0 }, max: { x: 100, y: 10, z: 100 } },
    ];
    const samlet: Boks = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 10, z: 100 } };
    const medObjekter = beregnInnramming(samlet, 60, aspect, l);
    const kunBoks = beregnInnramming(samlet, 60, aspect);
    expect(medObjekter.avstand).toBeLessThan(kunBoks.avstand);
    const s = fyll(medObjekter, l, 60, aspect);
    expect(Math.max(s.x, s.y)).toBeCloseTo(1 - FYLL_MARGIN, 6);
  });

  it("liggende skjerm: høyden kan styre, fortsatt innenfor", () => {
    const flat: Boks = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 40, z: 10 } };
    const inn = beregnInnramming(flat, 60, 2);
    const s = fyll(inn, [flat], 60, 2);
    expect(s.y).toBeCloseTo(1 - FYLL_MARGIN, 6);
    expect(s.x).toBeLessThan(1 - FYLL_MARGIN);
  });

  it("degenerert modell (ett punkt) faller tilbake til kula", () => {
    const punkt: Boks = { min: { x: 5, y: 5, z: 5 }, max: { x: 5, y: 5, z: 5 } };
    const inn = beregnInnramming(punkt, 60, 1);
    expect(inn.avstand).toBeCloseTo(0.005 / Math.sin(Math.PI / 6), 9);
    expect(inn.target).toEqual({ x: 5, y: 5, z: 5 });
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

describe("orbitAvstand — punktet midt på skjermen", () => {
  it("treff i midten: treffavstanden blir orbit-avstand", () => {
    expect(orbitAvstand(12.5, 40, 0.5)).toBe(12.5);
  });

  it("treff nærmere enn 1,5·minDistance kappes (kameraet ville hoppet bakover)", () => {
    expect(orbitAvstand(0.3, 40, 0.5)).toBe(0.75);
  });

  it("ingen treff: samme avstand som sist", () => {
    expect(orbitAvstand(null, 40, 0.5)).toBe(40);
    expect(orbitAvstand(NaN, 40, 0.5)).toBe(40);
  });

  it("ingen treff og ingen gyldig forrige avstand: minste tillatte", () => {
    expect(orbitAvstand(null, 0, 0.5)).toBe(0.75);
    expect(orbitAvstand(null, NaN, 0.5)).toBe(0.75);
  });
});

describe("mobil-viewer: vakt", () => {
  const kilde = readFileSync(resolve(__dirname, "../app/mobil-viewer/page.tsx"), "utf-8");

  it("innramming bruker boksen uten objekter langt unna og minDistance fra modellen", () => {
    expect(kilde).toContain("const robust = finnUtliggere(alle)");
    expect(kilde).toContain("ctrl.minDistance = inn.minDistance");
    expect(kilde).toContain("await rammInn()");
  });

  it("orbit-punkt fra raycast midt på skjermen, ikke fra fingrene", () => {
    expect(kilde).toContain("raycastSynlige(rect.left + rect.width / 2, rect.top + rect.height / 2)");
    expect(kilde).toContain("orbitAvstandIBygg(kamera, retning, treffAvstand, forrige, byggBoks)");
    expect(kilde).toContain("orbitAvstand(iBygg, forrige, minDistanceNå)");
    // Bom bruker gjeldende radius (ikke avstanden fra før siste zoom)
    expect(kilde).toContain("const forrige = Number.isFinite(ctrl.distance) && ctrl.distance > 0 ? ctrl.distance : sisteOrbitAvstand;");
    expect(kilde).not.toContain("sisteOrbitAvstand || ctrl.distance");
    expect(kilde).toContain("byggBoks = { min: { x: boks.min.x");
    expect(kilde).toContain("ctrl.setOrbitPoint(punkt.x, punkt.y, punkt.z)");
    expect(kilde).toContain("void settOrbitPunkt()");
    expect(kilde).not.toContain("gestPunkt");
  });

  it("zoom-fart følger avstanden til orbit-punktet, pinch kompensert", () => {
    expect(kilde).toContain("ctrl.dollySpeed = dollyFartMobil(ctrl.distance, fingre.size)");
    expect(kilde).toContain('if (e.pointerType === "touch") fingre.add(e.pointerId)');
    expect(kilde).toContain('rendererDom.addEventListener("pointerup", slippFinger)');
    expect(kilde).toContain('rendererDom.addEventListener("pointercancel", slippFinger)');
  });

  it("innramming får objektboksene uten utliggere", () => {
    expect(kilde).toContain("beregnInnramming(boks, threeCamera.fov, threeCamera.aspect || 1, med)");
    expect(kilde).toContain("!utliggerSett.has(i) && erGyldigBoks(b)");
  });

  it("diagnose: usynlig uten flagget; levende linje med flate, radius, steg, trykk og kilde", () => {
    expect(kilde).toContain("diagPåRef.current = diagFraUrlEllerLager(window.location.search)");
    expect(kilde).toContain("{diagPå && (");
    expect(kilde).toContain("if (!diagPåRef.current) return;");
    expect(kilde).toContain("klikk · objektValgt");
    expect(kilde).toContain('kildeTekst = "lagret kopi feilet → IFC"');
    expect(kilde).toContain('window.addEventListener("pointerdown", vedHemmeligTrykk, true)');
    expect(kilde).toContain('window.removeEventListener("pointerdown", vedHemmeligTrykk, true)');
  });

  it("pinch zoomer mot skjermmidten, ikke fingrene (prøve § 3b punkt 2b)", () => {
    expect(kilde).toContain("world.camera.controls.dollyToCursor = false");
  });

  it("objekter langt unna skjult som standard; bryter viser dem, rom/åpninger forblir skjult", () => {
    expect(kilde).toContain("const [visUtliggere, setVisUtliggere] = useState(false)");
    expect(kilde).toContain("let utliggereSynlige = false");
    expect(kilde).toContain("await settUtliggerSynlighet(utliggereSynlige)");
    expect(kilde).toContain("ids.filter((id) => !rom.has(id))");
    expect(kilde).toContain('t("3d.visObjekterLangtUnna")');
  });

  it("funksjonsinventar bevart: fragment-cache, råfil-lager, objektvalg med punkt, snitt, modellbytte", () => {
    expect(kilde).toContain("if (cachedFrag) {");
    expect(kilde).toContain("raadata.hentIBakgrunn(");
    expect(kilde).toContain("punkt: { x: hitResult.point.x, y: hitResult.point.y, z: hitResult.point.z }");
    expect(kilde).toContain("await clipper.create(world)");
    expect(kilde).toContain('msg.type === "toggleModell"');
    expect(kilde).toContain("diagFraUrlEllerLager(window.location.search)");
    expect(kilde).toContain("rendererDom.addEventListener(\"pointerdown\"");
  });
});

describe("ORDRE 8 (i): pinch i riktig fart", () => {
  it("to fingre: dobbel dollySpeed; én finger/hjul: kurven uendret", () => {
    for (const d of [200, 50, 10, 2, 0.5]) {
      expect(dollyFartMobil(d, 0)).toBe(dollyFartForAvstand(d));
      expect(dollyFartMobil(d, 1)).toBe(dollyFartForAvstand(d));
      expect(dollyFartMobil(d, 2)).toBeCloseTo(dollyFartForAvstand(d) * PINCH_KOMPENSASJON, 12);
    }
  });

  it("8 px endret fingeravstand gir zoomSteg — slik camera-controls 3.1.2 regner pinch", () => {
    // camera-controls: delta = (halv fingeravstand) · 1/8 pr. px, flytt = radius · (1 − 0,95^(delta·fart))
    for (const d of [100, 20, 5, 1]) {
      const delta = (8 / 2) * (1 / 8);
      const flytt = d * (1 - Math.pow(0.95, delta * dollyFartMobil(d, 2)));
      expect(flytt).toBeCloseTo(Math.min(zoomSteg(d), d / 2), 9);
    }
  });

  it("vakt: premisset i camera-controls (halv fingeravstand, 1/8 pr. px) står", () => {
    const krev = createRequire(import.meta.url);
    const obc = krev.resolve("@thatopen/components");
    // package.json er ikke eksportert — gå opp fra hovedfila til pakkemappa
    let ccMappe = dirname(createRequire(obc).resolve("camera-controls"));
    while (!ccMappe.endsWith("camera-controls")) ccMappe = dirname(ccMappe);
    const ccPakke = resolve(ccMappe, "package.json");
    const versjon = (JSON.parse(readFileSync(ccPakke, "utf-8")) as { version: string }).version;
    expect(versjon).toBe("3.1.2");
    const cc = readFileSync(resolve(dirname(ccPakke), "dist/camera-controls.module.js"), "utf-8");
    expect(cc).toContain("const TOUCH_DOLLY_FACTOR = 1 / 8;");
    expect(cc).toContain("const dx = _v2.x - this._activePointers[1].clientX;");
    expect(cc).toContain("this._dollyInternal(dollyDelta * TOUCH_DOLLY_FACTOR, dollyX, dollyY);");
  });
});
