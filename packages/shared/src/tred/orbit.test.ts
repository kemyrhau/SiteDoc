import { describe, expect, it } from "vitest";
import { avstandUtAvBoks, orbitAvstandIBygg } from "./orbit";
import { ZOOM_MIN_STEG_M } from "./zoom-fart";

// Bygg 40 × 10 × 20 m; kameraet står inne, 10 m fra veggen x = 30 og ser mot +x.
const bygg = { min: { x: -10, y: 0, z: -10 }, max: { x: 30, y: 10, z: 10 } };
const inne = { x: 20, y: 1.6, z: 0 };
const ute = { x: 100, y: 1.6, z: 0 };
const motX = { x: 1, y: 0, z: 0 };
const motMinusX = { x: -1, y: 0, z: 0 };

describe("orbitAvstandIBygg — orbit-punktet holdes innenfor bygget (§ 3c (iv))", () => {
  it("treff inne: godtas", () => {
    expect(orbitAvstandIBygg(inne, motX, 4, 50, bygg)).toBe(4);
  });

  it("treff ute (gjennom en åpning): kortes til veggen", () => {
    expect(orbitAvstandIBygg(inne, motX, 35, 50, bygg)).toBeCloseTo(10, 9);
  });

  it("bom inne med stor forrige avstand: kortes til veggen", () => {
    expect(orbitAvstandIBygg(inne, motX, null, 80, bygg)).toBeCloseTo(10, 9);
  });

  it("bom inne med kort forrige avstand: beholdes", () => {
    expect(orbitAvstandIBygg(inne, motX, null, 3, bygg)).toBe(3);
  });

  it("bom ute: forrige avstand som før", () => {
    expect(orbitAvstandIBygg(ute, motMinusX, null, 80, bygg)).toBe(80);
  });

  it("treff ute fra kamera ute: som før", () => {
    expect(orbitAvstandIBygg(ute, motMinusX, 70, 80, bygg)).toBe(70);
  });

  it("ingen boks (ikke lastet ennå): som før", () => {
    expect(orbitAvstandIBygg(inne, motX, 35, 50, null)).toBe(35);
    expect(orbitAvstandIBygg(inne, motX, null, 50, null)).toBe(50);
  });

  it("skrått blikk: veggen i blikkretningen, ikke nærmeste vegg", () => {
    const skraa = { x: 1, y: 0, z: 1 }; // treffer z = 10 etter 10·√2
    expect(orbitAvstandIBygg(inne, skraa, null, 80, bygg)).toBeCloseTo(10 * Math.SQRT2, 9);
  });

  it("kamera på veggen: aldri under minstesteget", () => {
    expect(orbitAvstandIBygg({ x: 30, y: 1.6, z: 0 }, motX, null, 80, bygg)).toBe(ZOOM_MIN_STEG_M);
  });

  it("tom boks (THREE.Box3 uten innhold): som før", () => {
    const tom = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
    expect(orbitAvstandIBygg(inne, motX, null, 50, tom)).toBe(50);
  });
});

describe("avstandUtAvBoks", () => {
  it("null når kameraet står utenfor, eller retningen er null", () => {
    expect(avstandUtAvBoks(ute, motMinusX, bygg)).toBeNull();
    expect(avstandUtAvBoks(inne, { x: 0, y: 0, z: 0 }, bygg)).toBeNull();
  });

  it("retningen normaliseres", () => {
    expect(avstandUtAvBoks(inne, { x: 5, y: 0, z: 0 }, bygg)).toBeCloseTo(10, 9);
  });
});
