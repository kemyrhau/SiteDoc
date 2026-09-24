import { describe, it, expect } from "vitest";
import { triangulerRutepunkter, MAKS_VERTEKSER } from "./triangulering";

describe("triangulerRutepunkter", () => {
  it("triangulerer et enkelt kvadrat til to trekanter", () => {
    const punkter = [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 2 },
      { x: 1, y: 1, z: 3 },
      { x: 0, y: 1, z: 4 },
    ];
    const tin = triangulerRutepunkter(punkter);
    // 4 punkter i konveks posisjon → 2 trekanter → 6 indekser
    expect(tin.triangles.length).toBe(6);
    expect(tin.vertices.length).toBe(12);
    // Z bevares i vertices
    expect(tin.vertices[2]).toBe(1);
    expect(tin.vertices[11]).toBe(4);
  });

  it("beregner korrekt bbox", () => {
    const tin = triangulerRutepunkter([
      { x: -5, y: 10, z: 0 },
      { x: 3, y: -2, z: 7 },
      { x: 8, y: 4, z: 2 },
    ]);
    expect(tin.bbox).toEqual({ minX: -5, minY: -2, minZ: 0, maxX: 8, maxY: 10, maxZ: 7 });
  });

  it("krever minst 3 punkter", () => {
    expect(() => triangulerRutepunkter([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }])).toThrow(/minst 3/);
  });

  it("vern-taket er høyt nok til at malavstanden bestemmer oppløsningen", () => {
    // 200×200 m på 0,15 m = ~1,78M ruter — godt under taket
    expect(MAKS_VERTEKSER).toBeGreaterThan(1_800_000);
  });
});
