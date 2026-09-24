/**
 * LandXML TIN-parser (server).
 *
 * Portet fra apps/web/src/lib/landxml-parser.ts slik at LandXML-overflater kan
 * parses og LAGRES på server (§ E) — så de overlever reload. Web-versjonen blir
 * stående til steg 2, som med punktsky-trianguleringen.
 *
 * Parser <Surface> → <Definition> → <Pnts> + <Faces>.
 */

import { XMLParser } from "fast-xml-parser";
import type { TinData } from "./tinFil";

export interface LandXmlResultat {
  tin: TinData;
  navn: string | null;
}

export function parseLandXML(xmlText: string): LandXmlResultat {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) => ["P", "F", "Surface"].includes(tagName),
  });

  const doc = parser.parse(xmlText);

  const landxml = doc.LandXML;
  if (!landxml) throw new Error("Ugyldig LandXML: mangler <LandXML>");

  const surfaces = landxml.Surfaces?.Surface ?? landxml.Surface;
  if (!surfaces) throw new Error("Ugyldig LandXML: mangler <Surface>");

  const surface = Array.isArray(surfaces) ? surfaces[0] : surfaces;
  const navn: string | null = surface["@_name"] ?? null;

  const definition = surface.Definition ?? surface.SourceData?.Definition;
  if (!definition) throw new Error("Ugyldig LandXML: mangler <Definition>");

  const pnts = definition.Pnts?.P;
  if (!pnts || !Array.isArray(pnts)) throw new Error("Ugyldig LandXML: mangler <Pnts>/<P>");

  const idTilIndeks = new Map<string, number>();
  const vertexList: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < pnts.length; i++) {
    const p = pnts[i];
    const id = String(p["@_id"] ?? i + 1);
    const tekst = typeof p === "string" ? p : p["#text"] ?? "";
    const deler = String(tekst).trim().split(/\s+/);
    if (deler.length < 3) continue;

    // LandXML: Y N E (northing easting elevation)
    const y = parseFloat(deler[0]!); // northing
    const x = parseFloat(deler[1]!); // easting
    const z = parseFloat(deler[2]!); // elevation
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    idTilIndeks.set(id, vertexList.length / 3);
    vertexList.push(x, y, z);

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const faces = definition.Faces?.F;
  if (!faces || !Array.isArray(faces)) throw new Error("Ugyldig LandXML: mangler <Faces>/<F>");

  const triangleList: number[] = [];
  for (const f of faces) {
    const tekst = typeof f === "string" ? f : f["#text"] ?? "";
    const deler = String(tekst).trim().split(/\s+/);
    if (deler.length < 3) continue;

    const i0 = idTilIndeks.get(deler[0]!);
    const i1 = idTilIndeks.get(deler[1]!);
    const i2 = idTilIndeks.get(deler[2]!);
    if (i0 === undefined || i1 === undefined || i2 === undefined) continue;

    triangleList.push(i0, i1, i2);
  }

  if (vertexList.length < 9) throw new Error("Ugyldig LandXML: for få gyldige punkter");

  return {
    tin: {
      vertices: new Float64Array(vertexList),
      triangles: new Uint32Array(triangleList),
      bbox: { minX, minY, minZ, maxX, maxY, maxZ },
    },
    navn,
  };
}
