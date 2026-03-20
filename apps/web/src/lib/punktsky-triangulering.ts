/**
 * Punktsky → Delaunay TIN-triangulering
 * Subsample punkter og trianguler med delaunator
 */

import type { TINData } from "./landxml-parser";

export interface PunktData {
  x: number;
  y: number;
  z: number;
}

/**
 * Subsample punkter jevnt fordelt til maks N punkter
 */
export function subsample(punkter: PunktData[], maksAntall: number): PunktData[] {
  if (punkter.length <= maksAntall) return punkter;

  const steg = Math.ceil(punkter.length / maksAntall);
  const resultat: PunktData[] = [];
  for (let i = 0; i < punkter.length; i += steg) {
    resultat.push(punkter[i]!);
  }
  return resultat;
}

/**
 * Trianguler punkter med Delaunay-triangulering
 * Projiserer til XY-plan, beholder Z-verdier
 */
export async function triangulerPunkter(
  punkter: PunktData[],
  maksAntall = 50_000,
): Promise<TINData> {
  const { default: Delaunator } = await import("delaunator");

  const subsamplet = subsample(punkter, maksAntall);

  if (subsamplet.length < 3) {
    throw new Error("Trenger minst 3 punkter for triangulering");
  }

  // Bygg flat koordinat-array for delaunator (2D: x, y)
  const coords = new Float64Array(subsamplet.length * 2);
  const vertices = new Float64Array(subsamplet.length * 3);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < subsamplet.length; i++) {
    const p = subsamplet[i]!;
    coords[i * 2] = p.x;
    coords[i * 2 + 1] = p.y;

    vertices[i * 3] = p.x;
    vertices[i * 3 + 1] = p.y;
    vertices[i * 3 + 2] = p.z;

    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }

  const delaunay = new Delaunator(coords);
  const triangles = new Uint32Array(delaunay.triangles);

  return {
    vertices,
    triangles,
    bbox: { minX, minY, minZ, maxX, maxY, maxZ },
    navn: null,
  };
}
