import { describe, it, expect } from "vitest";
import { deserialiserTin } from "../tin-fil";

/**
 * Låser at web-leseren forstår .stin-formatet slik serveren (apps/api tinFil.ts)
 * skriver det. Bygger en buffer for hånd etter den dokumenterte layouten:
 * magic "STIN" · uint32 versjon · uint32 nv · uint32 nt · float64×6 bbox ·
 * float32×3nv OFFSET-vertekser · uint32×3nt indekser.
 */
function byggStin(
  vertices: number[], // absolutte [x,y,z,...]
  triangles: number[],
  bbox: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number },
): ArrayBuffer {
  const nv = vertices.length / 3;
  const nt = triangles.length / 3;
  const buf = new ArrayBuffer(64 + nv * 12 + nt * 12);
  const dv = new DataView(buf);
  "STIN".split("").forEach((c, i) => dv.setUint8(i, c.charCodeAt(0)));
  dv.setUint32(4, 1, true);
  dv.setUint32(8, nv, true);
  dv.setUint32(12, nt, true);
  dv.setFloat64(16, bbox.minX, true);
  dv.setFloat64(24, bbox.minY, true);
  dv.setFloat64(32, bbox.minZ, true);
  dv.setFloat64(40, bbox.maxX, true);
  dv.setFloat64(48, bbox.maxY, true);
  dv.setFloat64(56, bbox.maxZ, true);
  let o = 64;
  for (let i = 0; i < nv; i++) {
    // Vertekser lagres som OFFSET fra bbox.min (float32)
    dv.setFloat32(o, vertices[i * 3]! - bbox.minX, true);
    dv.setFloat32(o + 4, vertices[i * 3 + 1]! - bbox.minY, true);
    dv.setFloat32(o + 8, vertices[i * 3 + 2]! - bbox.minZ, true);
    o += 12;
  }
  for (let i = 0; i < nt * 3; i++) {
    dv.setUint32(o, triangles[i]!, true);
    o += 4;
  }
  return buf;
}

describe("tin-fil (web) — leser serverens .stin-format", () => {
  const bbox = { minX: 600000.05, minY: 6700000.03, minZ: 12.34, maxX: 600000.35, maxY: 6700000.33, maxZ: 12.54 };
  const vertices = [600000.05, 6700000.03, 12.34, 600000.35, 6700000.03, 12.44, 600000.35, 6700000.33, 12.54];
  const triangles = [0, 1, 2];

  it("rekonstruerer absolutte UTM-koordinater med sub-mm presisjon", () => {
    const tin = deserialiserTin(byggStin(vertices, triangles, bbox));
    expect(Array.from(tin.triangles)).toEqual([0, 1, 2]);
    expect(tin.bbox).toEqual(bbox);
    for (let i = 0; i < vertices.length; i++) {
      expect(Math.abs(tin.vertices[i]! - vertices[i]!)).toBeLessThan(0.001);
    }
  });

  it("avviser buffer med feil magic", () => {
    const b = byggStin(vertices, triangles, bbox);
    new DataView(b).setUint8(0, 0x58); // 'X'
    expect(() => deserialiserTin(b)).toThrow(/magic/);
  });
});
