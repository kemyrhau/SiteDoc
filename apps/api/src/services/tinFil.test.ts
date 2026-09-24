import { describe, it, expect } from "vitest";
import { serialiserTin, deserialiserTin, type TinData } from "./tinFil";

describe("tinFil — binær serialisering", () => {
  const tin: TinData = {
    // Absolutt UTM — den vanskelige saken for float32
    vertices: new Float64Array([
      600000.05, 6700000.03, 12.34,
      600000.35, 6700000.03, 12.44,
      600000.35, 6700000.33, 12.54,
    ]),
    triangles: new Uint32Array([0, 1, 2]),
    bbox: { minX: 600000.05, minY: 6700000.03, minZ: 12.34, maxX: 600000.35, maxY: 6700000.33, maxZ: 12.54 },
  };

  it("round-trip bevarer trekanter og bbox eksakt", () => {
    const tilbake = deserialiserTin(serialiserTin(tin));
    expect(Array.from(tilbake.triangles)).toEqual([0, 1, 2]);
    expect(tilbake.bbox).toEqual(tin.bbox);
  });

  it("🔴 bevarer absolutt UTM med sub-mm presisjon (offset-fra-origo, ikke rå float32)", () => {
    const tilbake = deserialiserTin(serialiserTin(tin));
    for (let i = 0; i < tin.vertices.length; i++) {
      // Rå float32 på 6,7M ville gitt ~0,5 m feil. Offset-fra-origo gir < 1 mm.
      expect(Math.abs(tilbake.vertices[i]! - tin.vertices[i]!)).toBeLessThan(0.001);
    }
  });

  it("avviser buffer med feil magic", () => {
    const b = serialiserTin(tin);
    b.write("XXXX", 0, "ascii");
    expect(() => deserialiserTin(b)).toThrow(/magic/);
  });

  it("negativ kontroll: rå absolutt float32 ville tapt presisjon (viser hvorfor offset-trikset trengs)", () => {
    const raa = Math.fround(600000.05); // slik en naiv float32-lagring ville gjort
    // Rå float32 bommer med mer enn en mm på 6-sifret UTM
    expect(Math.abs(raa - 600000.05)).toBeGreaterThan(0.001);
  });
});
