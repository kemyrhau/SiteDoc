/**
 * Kutt/fyll-analyse mellom to TIN-overflater
 *
 * 1. Finn overlappende bounding box
 * 2. Lag regulært rutenett
 * 3. Interpoler Z fra begge TIN med barycentric coordinates
 * 4. Beregn volum (kutt/fyll separat)
 */

import type { TINData } from "./landxml-parser";

export interface KuttFyllResultat {
  kuttVolum: number; // m³ (terreng fjernet, ΔZ < 0)
  fyllVolum: number; // m³ (masse tilført, ΔZ > 0)
  netto: number; // fyll - kutt
  /** Differanse-grid: ΔZ per celle (for visualisering) */
  diffGrid: Float32Array;
  /** Grid-dimensjoner */
  gridBredde: number;
  gridHoyde: number;
  /** Grid-origo og celle-størrelse */
  origoX: number;
  origoY: number;
  celleStr: number;
  /** Min/maks differanse for fargeskala */
  minDiff: number;
  maxDiff: number;
}

/**
 * Beregn kutt/fyll mellom toppflate og bunnflate
 * ΔZ = Z_topp - Z_bunn: positiv = fyll (rød), negativ = kutt (blå)
 */
export function beregnKuttFyll(
  topp: TINData,
  bunn: TINData,
  celleStr = 1.0,
): KuttFyllResultat {
  // 1. Finn overlappende bounding box
  const overlapMinX = Math.max(topp.bbox.minX, bunn.bbox.minX);
  const overlapMinY = Math.max(topp.bbox.minY, bunn.bbox.minY);
  const overlapMaxX = Math.min(topp.bbox.maxX, bunn.bbox.maxX);
  const overlapMaxY = Math.min(topp.bbox.maxY, bunn.bbox.maxY);

  if (overlapMinX >= overlapMaxX || overlapMinY >= overlapMaxY) {
    return {
      kuttVolum: 0,
      fyllVolum: 0,
      netto: 0,
      diffGrid: new Float32Array(0),
      gridBredde: 0,
      gridHoyde: 0,
      origoX: 0,
      origoY: 0,
      celleStr,
      minDiff: 0,
      maxDiff: 0,
    };
  }

  // 2. Lag rutenett
  const gridBredde = Math.ceil((overlapMaxX - overlapMinX) / celleStr);
  const gridHoyde = Math.ceil((overlapMaxY - overlapMinY) / celleStr);
  const diffGrid = new Float32Array(gridBredde * gridHoyde);

  // Bygg triangelindekser for rask lookup
  const toppTri = byggTriangelData(topp);
  const bunnTri = byggTriangelData(bunn);

  let kuttVolum = 0;
  let fyllVolum = 0;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  const celleAreal = celleStr * celleStr;

  // 3. For hvert rutepunkt: interpoler Z fra begge TIN-er
  for (let gy = 0; gy < gridHoyde; gy++) {
    for (let gx = 0; gx < gridBredde; gx++) {
      const px = overlapMinX + (gx + 0.5) * celleStr;
      const py = overlapMinY + (gy + 0.5) * celleStr;

      const zTopp = interpolerZ(toppTri, px, py);
      const zBunn = interpolerZ(bunnTri, px, py);

      if (zTopp === null || zBunn === null) {
        diffGrid[gy * gridBredde + gx] = 0;
        continue;
      }

      const dz = zTopp - zBunn;
      diffGrid[gy * gridBredde + gx] = dz;

      if (dz > 0) {
        fyllVolum += dz * celleAreal;
      } else if (dz < 0) {
        kuttVolum += Math.abs(dz) * celleAreal;
      }

      minDiff = Math.min(minDiff, dz);
      maxDiff = Math.max(maxDiff, dz);
    }
  }

  if (minDiff === Infinity) minDiff = 0;
  if (maxDiff === -Infinity) maxDiff = 0;

  return {
    kuttVolum,
    fyllVolum,
    netto: fyllVolum - kuttVolum,
    diffGrid,
    gridBredde,
    gridHoyde,
    origoX: overlapMinX,
    origoY: overlapMinY,
    celleStr,
    minDiff,
    maxDiff,
  };
}

/* ------------------------------------------------------------------ */
/*  Intern: Triangeldata-struktur for rask interpolasjon                */
/* ------------------------------------------------------------------ */

interface TriangelData {
  vertices: Float64Array;
  triangles: Uint32Array;
  antallTriangler: number;
}

function byggTriangelData(tin: TINData): TriangelData {
  return {
    vertices: tin.vertices,
    triangles: tin.triangles,
    antallTriangler: tin.triangles.length / 3,
  };
}

/**
 * Interpoler Z-verdi ved punkt (px, py) fra TIN
 * Bruker barycentric coordinates for å finne trekant og interpolere
 */
function interpolerZ(data: TriangelData, px: number, py: number): number | null {
  const { vertices, triangles, antallTriangler } = data;

  for (let t = 0; t < antallTriangler; t++) {
    const i0 = triangles[t * 3]!;
    const i1 = triangles[t * 3 + 1]!;
    const i2 = triangles[t * 3 + 2]!;

    const x0 = vertices[i0 * 3]!;
    const y0 = vertices[i0 * 3 + 1]!;
    const z0 = vertices[i0 * 3 + 2]!;

    const x1 = vertices[i1 * 3]!;
    const y1 = vertices[i1 * 3 + 1]!;
    const z1 = vertices[i1 * 3 + 2]!;

    const x2 = vertices[i2 * 3]!;
    const y2 = vertices[i2 * 3 + 1]!;
    const z2 = vertices[i2 * 3 + 2]!;

    // Barycentric coordinates
    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(denom) < 1e-12) continue;

    const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom;
    const w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom;
    const w2 = 1 - w0 - w1;

    // Sjekk om punktet er innenfor trekanten (med litt toleranse)
    if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) {
      return w0 * z0 + w1 * z1 + w2 * z2;
    }
  }

  return null;
}

/**
 * Generer Three.js-kompatible vertices og farger for kutt/fyll-visualisering
 * Returnerer en flate (grid mesh) farget etter differanse
 */
export function genererDiffMesh(resultat: KuttFyllResultat): {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
} {
  const { diffGrid, gridBredde, gridHoyde, origoX, origoY, celleStr, minDiff, maxDiff } = resultat;

  const antallVertices = gridBredde * gridHoyde;
  const positions = new Float32Array(antallVertices * 3);
  const colors = new Float32Array(antallVertices * 3);

  const maksDiff = Math.max(Math.abs(minDiff), Math.abs(maxDiff), 0.01);

  for (let gy = 0; gy < gridHoyde; gy++) {
    for (let gx = 0; gx < gridBredde; gx++) {
      const idx = gy * gridBredde + gx;
      const dz = diffGrid[idx] ?? 0;

      // Posisjon
      positions[idx * 3] = origoX + (gx + 0.5) * celleStr;
      positions[idx * 3 + 1] = origoY + (gy + 0.5) * celleStr;
      positions[idx * 3 + 2] = dz * 0.5; // Litt høyde for visualisering

      // Farge: rød (fyll, ΔZ > 0) eller blå (kutt, ΔZ < 0)
      const intensitet = Math.min(1, Math.abs(dz) / maksDiff);
      if (dz > 0) {
        // Rød (fyll)
        colors[idx * 3] = 0.3 + 0.7 * intensitet;
        colors[idx * 3 + 1] = 0.3 * (1 - intensitet);
        colors[idx * 3 + 2] = 0.3 * (1 - intensitet);
      } else if (dz < 0) {
        // Blå (kutt)
        colors[idx * 3] = 0.3 * (1 - intensitet);
        colors[idx * 3 + 1] = 0.3 * (1 - intensitet);
        colors[idx * 3 + 2] = 0.3 + 0.7 * intensitet;
      } else {
        // Nøytral (grå)
        colors[idx * 3] = 0.5;
        colors[idx * 3 + 1] = 0.5;
        colors[idx * 3 + 2] = 0.5;
      }
    }
  }

  // Generer triangle-indices for grid
  const antallTri = (gridBredde - 1) * (gridHoyde - 1) * 6;
  const indices = new Uint32Array(antallTri);
  let triIdx = 0;

  for (let gy = 0; gy < gridHoyde - 1; gy++) {
    for (let gx = 0; gx < gridBredde - 1; gx++) {
      const tl = gy * gridBredde + gx;
      const tr = tl + 1;
      const bl = (gy + 1) * gridBredde + gx;
      const br = bl + 1;

      indices[triIdx++] = tl;
      indices[triIdx++] = bl;
      indices[triIdx++] = tr;

      indices[triIdx++] = tr;
      indices[triIdx++] = bl;
      indices[triIdx++] = br;
    }
  }

  return { positions, colors, indices };
}
