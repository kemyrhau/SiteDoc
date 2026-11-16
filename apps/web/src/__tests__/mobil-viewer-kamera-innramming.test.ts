/**
 * M1–M3 + RETUR 3 (§ 3b): kameraet i mobil-vieweren rammer inn bygget uten objekter langt
 * unna, minDistance skaleres med modellen, orbit-punktet er flaten midt på skjermen, og
 * zoom-farten følger avstanden dit. Utligger-regelen og zoom-kurven testes i
 * packages/shared/src/tred/*.test.ts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { beregnInnramming, orbitAvstand, type Boks } from "../app/mobil-viewer/kameraInnramming";

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
    expect(kilde).toContain("orbitAvstand(treffAvstand, sisteOrbitAvstand || ctrl.distance, minDistanceNå)");
    expect(kilde).toContain("ctrl.setOrbitPoint(punkt.x, punkt.y, punkt.z)");
    expect(kilde).toContain("void settOrbitPunkt()");
    expect(kilde).not.toContain("gestPunkt");
  });

  it("zoom-fart følger avstanden til orbit-punktet", () => {
    expect(kilde).toContain("ctrl.dollySpeed = dollyFartForAvstand(ctrl.distance)");
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
    expect(kilde).toContain('get("diag") === "1"');
    expect(kilde).toContain("rendererDom.addEventListener(\"pointerdown\"");
  });
});
