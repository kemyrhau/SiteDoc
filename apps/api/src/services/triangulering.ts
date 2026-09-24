/**
 * Server-side Delaunay-triangulering av bakkerutepunkter → TIN
 *
 * Flyttet fra apps/web/src/lib/punktsky-triangulering.ts (web-versjonen slettes
 * IKKE i steg 1 — den har null kallere og ryddes når volumberegningen også er
 * flyttet til server, så vi ikke river to ting samtidig).
 *
 * 🔴 Ingen `subsample` her: punktene er allerede desimert til ett pr. rute av
 * bakkeOverflate-tjenesten. Punkttaket styres av malavstanden, ikke av et fast
 * antall. Vi beholder en HØY øvre grense som vern mot patologisk input.
 */

import Delaunator from "delaunator";

export interface TINResultat {
  /** [x0,y0,z0, x1,y1,z1, ...] */
  vertices: Float64Array;
  /** [i0,i1,i2, ...] */
  triangles: Uint32Array;
  bbox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
}

/**
 * Øvre vern-grense. Et 200×200 m felt på 0,15 m = ~1,78M ruter; taket ligger
 * godt over det, slik at malavstanden — ikke taket — bestemmer oppløsningen.
 * (Det gamle taket på 50 000 ga ~45 cm punktavstand på 100×100 m og gjorde
 * 10 cm umulig.)
 */
export const MAKS_VERTEKSER = 5_000_000;

export function triangulerRutepunkter(
  punkter: { x: number; y: number; z: number }[],
): TINResultat {
  if (punkter.length < 3) {
    throw new Error("Trenger minst 3 punkter for triangulering");
  }
  if (punkter.length > MAKS_VERTEKSER) {
    throw new Error(
      `For mange punkter (${punkter.length} > ${MAKS_VERTEKSER}). Øk malavstanden.`,
    );
  }

  const coords = new Float64Array(punkter.length * 2);
  const vertices = new Float64Array(punkter.length * 3);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < punkter.length; i++) {
    const p = punkter[i]!;
    coords[i * 2] = p.x;
    coords[i * 2 + 1] = p.y;
    vertices[i * 3] = p.x;
    vertices[i * 3 + 1] = p.y;
    vertices[i * 3 + 2] = p.z;

    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  const delaunay = new Delaunator(coords);
  const triangles = new Uint32Array(delaunay.triangles);

  return {
    vertices,
    triangles,
    bbox: { minX, minY, minZ, maxX, maxY, maxZ },
  };
}
