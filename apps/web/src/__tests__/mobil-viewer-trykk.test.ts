import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  DOBBELT_MAKS_AVSTAND_PX, DOBBELT_VINDU_MS, TRYKK_MAKS_FLYTT_PX, TRYKK_MAKS_VARIGHET_MS, lagTrykkTolk,
} from "../app/mobil-viewer/trykkTolk";
import { PIL_TREFF_RADIUS, forstørrPilTreff, pilTreffMesher } from "../app/mobil-viewer/snittPilTreff";

/** Ett trykk: ned ved t, opp ved t+varighet (samme punkt med mindre `til` er gitt) */
function trykk(
  tolk: ReturnType<typeof lagTrykkTolk>, t: number,
  o: { x?: number; y?: number; id?: number; varighet?: number; til?: { x: number; y: number }; påPil?: boolean } = {},
) {
  const x = o.x ?? 100, y = o.y ?? 200, id = o.id ?? 1;
  const løst = tolk.ned(id, x, y, t);
  const ut = tolk.opp(id, o.til?.x ?? x, o.til?.y ?? y, t + (o.varighet ?? 80), o.påPil ?? false);
  return { løst, ut };
}

describe("trykk-tolk med saksen aktiv (ORDRE 3D-mobil 10)", () => {
  it("enkelttrykk utenfor pilen venter vinduet ut og blir objektvalg", () => {
    const tolk = lagTrykkTolk();
    const { ut } = trykk(tolk, 0);
    expect(ut).toEqual({ type: "venter", x: 100, y: 200, fristMs: DOBBELT_VINDU_MS });
    expect(tolk.utløp(80 + DOBBELT_VINDU_MS - 1)).toBeNull();
    expect(tolk.utløp(80 + DOBBELT_VINDU_MS)).toEqual({ type: "enkelt", x: 100, y: 200 });
    expect(tolk.utløp(5000)).toBeNull(); // bare én gang
  });

  it("dobbelttrykk blir snitt og gir ikke objektvalg", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0);
    const { løst, ut } = trykk(tolk, 80 + 200, { x: 110, y: 205 });
    expect(løst).toBeNull();
    expect(ut).toEqual({ type: "dobbelt", x: 110, y: 205, mellomromMs: 200 });
    expect(tolk.utløp(10_000)).toBeNull();
  });

  it("andre trykk ned innen vinduet men slipp etter fristen er fortsatt dobbelt (timer fyrer ikke enkelt)", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0); // slipp ved 80
    tolk.ned(1, 100, 200, 80 + DOBBELT_VINDU_MS - 10);
    expect(tolk.utløp(80 + DOBBELT_VINDU_MS + 20)).toBeNull();
    expect(tolk.opp(1, 100, 200, 80 + DOBBELT_VINDU_MS + 100, false).type).toBe("dobbelt");
  });

  it("andre trykk for sent: første blir enkelt straks, andre venter på nytt", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0);
    const { løst, ut } = trykk(tolk, 80 + DOBBELT_VINDU_MS + 1);
    expect(løst).toEqual({ type: "enkelt", x: 100, y: 200 });
    expect(ut.type).toBe("venter");
  });

  it("andre trykk for langt unna er ikke dobbelt", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0);
    const { løst, ut } = trykk(tolk, 200, { x: 100 + DOBBELT_MAKS_AVSTAND_PX + 1 });
    expect(løst).toEqual({ type: "enkelt", x: 100, y: 200 });
    expect(ut.type).toBe("venter");
  });

  it("trykk på pilen gir verken objektvalg eller snitt, heller ikke som andre trykk", () => {
    const tolk = lagTrykkTolk();
    expect(trykk(tolk, 0, { påPil: true }).ut).toEqual({ type: "pil" });
    expect(tolk.utløp(10_000)).toBeNull();
    trykk(tolk, 1000);
    expect(trykk(tolk, 1200, { påPil: true }).ut).toEqual({ type: "pil" });
    expect(tolk.utløp(10_000)).toBeNull();
  });

  it("flytting, langt trykk og to fingre er ikke trykk (pan, hold, pinch)", () => {
    const tolk = lagTrykkTolk();
    expect(trykk(tolk, 0, { til: { x: 100 + TRYKK_MAKS_FLYTT_PX + 1, y: 200 } }).ut)
      .toEqual({ type: "ingen", grunn: "flyttet" });
    expect(trykk(tolk, 1000, { varighet: TRYKK_MAKS_VARIGHET_MS + 1 }).ut)
      .toEqual({ type: "ingen", grunn: "langt trykk" });
    tolk.ned(1, 100, 200, 3000);
    tolk.ned(2, 300, 200, 3010);
    expect(tolk.opp(2, 300, 200, 3050, false)).toEqual({ type: "ingen", grunn: "fingre igjen" });
    expect(tolk.opp(1, 100, 200, 3060, false)).toEqual({ type: "ingen", grunn: "flere fingre" });
    expect(tolk.utløp(10_000)).toBeNull();
  });

  it("pinch rett etter et trykk sletter ikke trykket før fristen, men avbrutt gest gjør", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0);
    tolk.ned(5, 100, 200, 200);
    tolk.avbryt(5);
    expect(tolk.utløp(10_000)).toBeNull();
  });

  it("flytt-toleransen er minst like romslig som click-sperren uten saks (5 px)", () => {
    expect(TRYKK_MAKS_FLYTT_PX).toBeGreaterThanOrEqual(5);
  });
});

/** Kamera som ser rett ned −Z mot en pil i origo, pila langs X (snittnormal på skrå mot kameraet) */
function lagPilScene() {
  const kamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  kamera.position.set(0, 0, 10);
  kamera.lookAt(0, 0, 0);
  kamera.updateMatrixWorld();
  const lerret = {
    addEventListener: () => {}, removeEventListener: () => {}, style: {},
    ownerDocument: { addEventListener: () => {}, removeEventListener: () => {} },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture: () => {}, releasePointerCapture: () => {},
  };
  const kontroller = new TransformControls(kamera, lerret as never);
  const objekt = new THREE.Object3D();
  objekt.lookAt(new THREE.Vector3(1, 0, 0)); // som OBC: helper.lookAt(normal) → lokal Z = normal
  new THREE.Scene().add(objekt);
  objekt.updateMatrixWorld();
  kontroller.attach(objekt);
  kontroller.showX = false;
  kontroller.showY = false;
  kontroller.setSpace("local");
  kontroller.getHelper().updateMatrixWorld(true);
  return kontroller;
}

/** Treffer et trykk (normaliserte koordinater) pilen? */
function treffer(kontroller: TransformControls, x: number, y: number) {
  kontroller.getHelper().updateMatrixWorld(true);
  kontroller.pointerHover({ x, y, button: 0 } as unknown as PointerEvent);
  const axis = kontroller.axis;
  kontroller.axis = null;
  return axis === "Z";
}

describe("trykk-tolken glemmer trykk fra før saksen (RETUR 1, ORDRE 3D-mobil 10)", () => {
  it("trykk uten saks gir ikke enkelttrykk etter at saksen slås på", () => {
    const tolk = lagTrykkTolk();
    // Trykk uten saks: tolken mates også da (pointerup), og setter et ventende trykk
    expect(trykk(tolk, 0, { x: 100, y: 200 }).ut.type).toBe("venter");
    tolk.nullstill(); // saksen slås på (handleMessage «klippmodus»)
    // Nytt trykk et annet sted, utenfor dobbelttrykk-avstanden
    const { løst, ut } = trykk(tolk, 200, { x: 300, y: 500 });
    expect(løst).toBeNull(); // det gamle punktet blir ikke objektvalg
    expect(ut).toEqual({ type: "venter", x: 300, y: 500, fristMs: DOBBELT_VINDU_MS });
    expect(tolk.utløp(280 + DOBBELT_VINDU_MS)).toEqual({ type: "enkelt", x: 300, y: 500 });
  });

  it("trykk uten saks blir ikke første halvdel av et dobbelttrykk etter at saksen slås på", () => {
    const tolk = lagTrykkTolk();
    trykk(tolk, 0);
    tolk.nullstill();
    const { løst, ut } = trykk(tolk, 80 + 150, { x: 105, y: 200 });
    expect(løst).toBeNull();
    expect(ut.type).toBe("venter");
  });

  it("finger som var nede da saksen ble slått på, gir ikke et trykk", () => {
    const tolk = lagTrykkTolk();
    tolk.ned(1, 100, 200, 0);
    tolk.nullstill();
    expect(tolk.opp(1, 100, 200, 80, false)).toEqual({ type: "ingen", grunn: "ukjent finger" });
  });
});

describe("snittpilens treffflate (ORDRE 3D-mobil 10)", () => {
  it("bytter begge treffkjeglene ut med sylindre med fast radius; synlig pil uendret", () => {
    const kontroller = lagPilScene();
    const gizmo = kontroller.getHelper().children[0] as unknown as { gizmo: { translate: THREE.Object3D } };
    const synligFør = gizmo.gizmo.translate.children.map((c) => (c as THREE.Mesh).geometry?.uuid);
    expect(pilTreffMesher(kontroller)).toHaveLength(2);
    expect(forstørrPilTreff(kontroller)).toBe(2);
    expect(forstørrPilTreff(kontroller)).toBe(0); // idempotent
    for (const m of pilTreffMesher(kontroller)) {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!;
      expect(b.max.x - b.min.x).toBeCloseTo(2 * PIL_TREFF_RADIUS, 2);
    }
    expect(gizmo.gizmo.translate.children.map((c) => (c as THREE.Mesh).geometry?.uuid)).toEqual(synligFør);
  });

  it("trykk litt ved siden av pilens rot bommer før og treffer etter", () => {
    const kontroller = lagPilScene();
    // Like ved roten (x = 0,03 langs pila), 0,035 til siden: utenfor kjeglespissen, innenfor sylinderen
    expect(treffer(kontroller, 0.03, 0.035)).toBe(false);
    forstørrPilTreff(kontroller);
    expect(treffer(kontroller, 0.03, 0.035)).toBe(true);
    // Langt unna pila treffer fortsatt ikke (objektvalg der)
    expect(treffer(kontroller, 0.5, 0.5)).toBe(false);
  });
});

describe("mobil-viewer bruker trykk-tolken med saksen aktiv", () => {
  const kilde = readFileSync(resolve(__dirname, "../app/mobil-viewer/page.tsx"), "utf-8");
  it("ingen dblclick-lytter (ga click + click + dblclick) og click sperres når saksen er aktiv", () => {
    expect(kilde).not.toMatch(/addEventListener\("dblclick"/);
    expect(kilde).toMatch(/if \(clipper\.enabled\) return;/);
    expect(kilde).toMatch(/forstørrPilTreff\(plan\.controls\)/);
    expect(kilde).toMatch(/trykkTolk\.opp\(/);
  });
  it("saksen av/på i handleMessage nullstiller tolken og ventende enkelttrykk (RETUR 1)", () => {
    const start = kilde.indexOf('msg.type === "klippmodus"');
    expect(start).toBeGreaterThan(-1);
    const gren = kilde.slice(start, kilde.indexOf("msg.type ===", start + 10));
    expect(gren).toMatch(/trykkTolk\.nullstill\(\);/);
    expect(gren).toMatch(/clearTimeout\(enkeltTimer\)/);
  });
  it("raycasteren for clipper.create opprettes ved oppsett, før første trykk", () => {
    const oppsett = kilde.indexOf("components.get(OBC.Raycasters).get(world)");
    expect(oppsett).toBeGreaterThan(-1);
    expect(oppsett).toBeLessThan(kilde.indexOf('addEventListener("pointerdown"'));
  });
});
