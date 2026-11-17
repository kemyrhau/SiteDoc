import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { flyttSnittpilerTilMidten } from "../tredSnittPil";

/** Minste verden SimplePlane (OBC 3.3.3) trenger: renderer.setPlane, scene, kamera, lerret */
function lagVerden() {
  const lerret = {
    addEventListener: () => {}, removeEventListener: () => {}, style: {},
    ownerDocument: { addEventListener: () => {}, removeEventListener: () => {} },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture: () => {}, releasePointerCapture: () => {},
  };
  return {
    renderer: { setPlane: () => {}, three: { domElement: lerret } },
    scene: { three: new THREE.Scene() },
    camera: { three: new THREE.PerspectiveCamera(), controls: undefined, enabled: true },
  };
}

function lagPlan(normal: THREE.Vector3, punkt: THREE.Vector3) {
  const components = new OBC.Components();
  const mat = new THREE.MeshBasicMaterial();
  return new OBC.SimplePlane(components, lagVerden() as never, punkt.clone(), normal.clone(), mat);
}

/** Håndtaket (pilen) er privat i OBC; testen leser det for å se hvor pilen står */
const pil = (p: OBC.SimplePlane) => (p as unknown as { _helper: THREE.Object3D })._helper;

describe("flyttSnittpilerTilMidten mot ekte OBC SimplePlane (3.3.3)", () => {
  it("pilen flyttes dit planet krysser skjermmidten; snittet (constant + normal) er uendret", () => {
    const plan = lagPlan(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(4, 2, 30));
    const før = { constant: plan.three.constant, normal: plan.three.normal.clone(), rot: pil(plan).quaternion.clone() };
    const n = flyttSnittpilerTilMidten([plan], new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(1, 0, 0));
    expect(n).toBe(1);
    expect(plan.three.constant).toBeCloseTo(før.constant, 9);
    expect(plan.three.normal.distanceTo(før.normal)).toBeLessThan(1e-9);
    expect(plan.normal.distanceTo(før.normal)).toBeLessThan(1e-9);
    expect(pil(plan).quaternion.angleTo(før.rot)).toBeLessThan(1e-9);
    expect(pil(plan).position.distanceTo(new THREE.Vector3(4, 1.6, 0))).toBeLessThan(1e-9);
    expect(Math.abs(plan.three.distanceToPoint(pil(plan).position))).toBeLessThan(1e-6);
  });

  it("skrått plan og skrått blikk: snittet uendret, pilen i planet", () => {
    const normal = new THREE.Vector3(1, -2, 0.5).normalize();
    const plan = lagPlan(normal, new THREE.Vector3(3, 1, -2));
    const før = { constant: plan.three.constant, normal: plan.three.normal.clone() };
    flyttSnittpilerTilMidten([plan], new THREE.Vector3(-5, 8, 4), new THREE.Vector3(0.6, -0.7, -0.3).normalize());
    expect(plan.three.constant).toBeCloseTo(før.constant, 9);
    expect(plan.three.normal.distanceTo(før.normal)).toBeLessThan(1e-9);
    expect(Math.abs(plan.three.distanceToPoint(pil(plan).position))).toBeLessThan(1e-6);
  });

  it("etter at pilen er dratt: det nye snittet beholdes, ikke punktet planet ble laget i", () => {
    const plan = lagPlan(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(4, 2, 30));
    // Slik OBC drar: håndtaket flyttes langs normalen, update() setter planet fra håndtaket
    pil(plan).position.set(6, 2, 30);
    plan.update();
    expect(plan.three.constant).toBeCloseTo(6, 9);
    flyttSnittpilerTilMidten([plan], new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(1, 0, 0));
    expect(plan.three.constant).toBeCloseTo(6, 9);
    expect(pil(plan).position.distanceTo(new THREE.Vector3(6, 1.6, 0))).toBeLessThan(1e-9);
  });

  it("skjult håndtak (etasjeklippet) og avslått plan røres ikke", () => {
    const skjult = lagPlan(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    skjult.visible = false;
    const av = lagPlan(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(4, 2, 30));
    av.enabled = false;
    const n = flyttSnittpilerTilMidten([skjult, av], new THREE.Vector3(5, 10, 5), new THREE.Vector3(0, -1, 0));
    expect(n).toBe(0);
    expect(pil(skjult).position.length()).toBe(0);
    expect(pil(av).position.distanceTo(new THREE.Vector3(4, 2, 30))).toBe(0);
  });
});

describe("snittpilen er koblet inn i begge visere", () => {
  for (const fil of ["../../kontekst/tred-viewer-kontekst.tsx", "../../app/mobil-viewer/page.tsx"]) {
    it(fil, () => {
      const kilde = readFileSync(resolve(__dirname, fil), "utf8");
      // Flyttes når kameraet har stoppet …
      expect(kilde).toContain('addEventListener("rest", flyttSnittpiler)');
      expect(kilde).toContain('addEventListener("sleep", flyttSnittpiler)');
      // … og når gesten slippes (rest/sleep kan ha kommet mens knappen var nede)
      expect(kilde).toContain('addEventListener("controlend", flyttSnittpiler)');
      // … men ikke mens pilen dras eller en knapp/finger er nede
      expect(kilde).toContain("clipper.onBeforeDrag.add(() => { snittDras = true; });");
      expect(kilde).toContain("clipper.onAfterDrag.add(() => { snittDras = false; });");
      expect(kilde).toMatch(/if \(snittDras \|\| !clipper\.enabled \|\| !ctrl \|\| ctrl\.currentAction !== 0\) return;/);
      expect(kilde).toContain("flyttSnittpilerTilMidten(clipper.list.values(), cam.position, cam.getWorldDirection(new THREE.Vector3()))");
    });
  }
});

describe("tredSnittPil laster ikke three statisk", () => {
  it("bare type-import av three (viserne importerer three dynamisk)", () => {
    const kilde = readFileSync(resolve(__dirname, "../tredSnittPil.ts"), "utf8");
    expect(kilde).toMatch(/^import type \* as THREE from "three";$/m);
    expect(kilde).not.toMatch(/^import (?!type)[^\n]*from "three";$/m);
  });
});
