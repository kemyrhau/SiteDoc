/**
 * Binær TIN-fil på disk — kompakt lagring av en overflate (§ D).
 *
 * Ingen JSON: en 15 cm TIN i JSON er titalls MB tekst. Layout (little-endian):
 *
 *   OFFSET  TYPE            FELT
 *   0       char[4]         magic = "STIN"
 *   4       uint32          versjon = 1
 *   8       uint32          antallVertekser (nv)
 *   12      uint32          antallTrekanter (nt)   — indekser = nt * 3
 *   16      float64 × 6     bbox: minX,minY,minZ,maxX,maxY,maxZ (ABSOLUTT)
 *   64      float32 × 3nv   vertekser som OFFSET fra (minX,minY,minZ)
 *   ...     uint32 × 3nt    trekantindekser
 *
 * 🔴 Verteksene lagres som float32 OFFSET fra bbox-origo, ikke absolutt. Absolutt
 * UTM (~6 700 000) i float32 har bare ~0,5 m oppløsning — ubrukelig for 10–20 cm.
 * Offset innenfor et site (<~1 km) er < 1000 → float32 gir < 0,1 mm. bbox i headeren
 * er float64 og bærer den absolutte posisjonen. Ved lesing rekonstrueres absolutt =
 * bbox.min + offset, som Float64Array (det kutt/fyll interpolerer i).
 */

import { writeFile, readFile } from "fs/promises";

const MAGIC = "STIN";
const VERSJON = 1;
const HEADER_BYTES = 64;

export interface TinData {
  /** Absolutte koordinater [x0,y0,z0, ...] */
  vertices: Float64Array;
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

/** Serialiser en TIN til binærbuffer (float32 offset-vertekser). */
export function serialiserTin(tin: TinData): Buffer {
  const nv = tin.vertices.length / 3;
  const nt = tin.triangles.length / 3;
  if (!Number.isInteger(nv)) throw new Error("vertices.length må være delelig på 3");
  if (!Number.isInteger(nt)) throw new Error("triangles.length må være delelig på 3");

  const buf = Buffer.alloc(HEADER_BYTES + nv * 3 * 4 + nt * 3 * 4);
  buf.write(MAGIC, 0, "ascii");
  buf.writeUInt32LE(VERSJON, 4);
  buf.writeUInt32LE(nv, 8);
  buf.writeUInt32LE(nt, 12);

  const { minX, minY, minZ, maxX, maxY, maxZ } = tin.bbox;
  buf.writeDoubleLE(minX, 16);
  buf.writeDoubleLE(minY, 24);
  buf.writeDoubleLE(minZ, 32);
  buf.writeDoubleLE(maxX, 40);
  buf.writeDoubleLE(maxY, 48);
  buf.writeDoubleLE(maxZ, 56);

  let o = HEADER_BYTES;
  for (let i = 0; i < nv; i++) {
    buf.writeFloatLE(tin.vertices[i * 3]! - minX, o);
    buf.writeFloatLE(tin.vertices[i * 3 + 1]! - minY, o + 4);
    buf.writeFloatLE(tin.vertices[i * 3 + 2]! - minZ, o + 8);
    o += 12;
  }
  for (let i = 0; i < nt * 3; i++) {
    buf.writeUInt32LE(tin.triangles[i]!, o);
    o += 4;
  }
  return buf;
}

/** Deserialiser en TIN fra binærbuffer → absolutte float64-vertekser. */
export function deserialiserTin(buf: Buffer): TinData {
  const magic = buf.toString("ascii", 0, 4);
  if (magic !== MAGIC) throw new Error(`Ugyldig TIN-fil: magic "${magic}" (forventet "${MAGIC}")`);
  const versjon = buf.readUInt32LE(4);
  if (versjon !== VERSJON) throw new Error(`Ustøttet TIN-versjon ${versjon}`);

  const nv = buf.readUInt32LE(8);
  const nt = buf.readUInt32LE(12);
  const minX = buf.readDoubleLE(16);
  const minY = buf.readDoubleLE(24);
  const minZ = buf.readDoubleLE(32);
  const maxX = buf.readDoubleLE(40);
  const maxY = buf.readDoubleLE(48);
  const maxZ = buf.readDoubleLE(56);

  const vertices = new Float64Array(nv * 3);
  let o = HEADER_BYTES;
  for (let i = 0; i < nv; i++) {
    vertices[i * 3] = buf.readFloatLE(o) + minX;
    vertices[i * 3 + 1] = buf.readFloatLE(o + 4) + minY;
    vertices[i * 3 + 2] = buf.readFloatLE(o + 8) + minZ;
    o += 12;
  }
  const triangles = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++) {
    triangles[i] = buf.readUInt32LE(o);
    o += 4;
  }

  return { vertices, triangles, bbox: { minX, minY, minZ, maxX, maxY, maxZ } };
}

export async function skrivTinFil(sti: string, tin: TinData): Promise<void> {
  await writeFile(sti, serialiserTin(tin));
}

export async function lesTinFil(sti: string): Promise<TinData> {
  return deserialiserTin(await readFile(sti));
}
