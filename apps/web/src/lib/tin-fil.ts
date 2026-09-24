/**
 * Klient-leser for binær TIN-fil (.stin) lagret av serveren.
 *
 * MÅ matche apps/api/src/services/tinFil.ts (serialiserTin) eksakt. Layout
 * (little-endian): magic "STIN" · uint32 versjon · uint32 nv · uint32 nt ·
 * float64×6 bbox (absolutt) · float32×3nv vertekser (OFFSET fra bbox.min) ·
 * uint32×3nt trekantindekser.
 *
 * Verteksene rekonstrueres til ABSOLUTTE float64-koordinater (bbox.min + offset)
 * — det kutt/fyll og OverflateViewer forventer.
 */

import type { TINData } from "./landxml-parser";

const MAGIC = "STIN";
const HEADER_BYTES = 64;

export function deserialiserTin(buf: ArrayBuffer): TINData {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== MAGIC) throw new Error(`Ugyldig TIN-fil: magic "${magic}"`);
  const versjon = dv.getUint32(4, true);
  if (versjon !== 1) throw new Error(`Ustøttet TIN-versjon ${versjon}`);

  const nv = dv.getUint32(8, true);
  const nt = dv.getUint32(12, true);
  const minX = dv.getFloat64(16, true);
  const minY = dv.getFloat64(24, true);
  const minZ = dv.getFloat64(32, true);
  const maxX = dv.getFloat64(40, true);
  const maxY = dv.getFloat64(48, true);
  const maxZ = dv.getFloat64(56, true);

  const vertices = new Float64Array(nv * 3);
  let o = HEADER_BYTES;
  for (let i = 0; i < nv; i++) {
    vertices[i * 3] = dv.getFloat32(o, true) + minX;
    vertices[i * 3 + 1] = dv.getFloat32(o + 4, true) + minY;
    vertices[i * 3 + 2] = dv.getFloat32(o + 8, true) + minZ;
    o += 12;
  }
  const triangles = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++) {
    triangles[i] = dv.getUint32(o, true);
    o += 4;
  }

  return { vertices, triangles, bbox: { minX, minY, minZ, maxX, maxY, maxZ }, navn: null };
}

/** Hent og parse en lagret TIN fra dens /uploads-URL. */
export async function hentTin(filUrl: string): Promise<TINData> {
  const res = await fetch(filUrl);
  if (!res.ok) throw new Error(`Kunne ikke hente overflate (${res.status})`);
  return deserialiserTin(await res.arrayBuffer());
}
