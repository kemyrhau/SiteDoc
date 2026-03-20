/**
 * LandXML TIN-parser
 * Parser <Surface> → <Definition> → <Pnts> + <Faces> fra LandXML-filer
 */

export interface TINData {
  vertices: Float64Array; // [x0, y0, z0, x1, y1, z1, ...]
  triangles: Uint32Array; // [i0, i1, i2, ...]
  bbox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  navn: string | null;
}

export async function parseLandXML(xmlText: string): Promise<TINData> {
  const { XMLParser } = await import("fast-xml-parser");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) => ["P", "F", "Surface"].includes(tagName),
  });

  const doc = parser.parse(xmlText);

  // Naviger til Surface → Definition → Pnts/Faces
  const landxml = doc.LandXML;
  if (!landxml) throw new Error("Ugyldig LandXML: mangler <LandXML>");

  const surfaces = landxml.Surfaces?.Surface ?? landxml.Surface;
  if (!surfaces) throw new Error("Ugyldig LandXML: mangler <Surface>");

  const surface = Array.isArray(surfaces) ? surfaces[0] : surfaces;
  const navn = surface["@_name"] ?? null;

  const definition = surface.Definition ?? surface.SourceData?.Definition;
  if (!definition) throw new Error("Ugyldig LandXML: mangler <Definition>");

  // Parse punkter
  const pnts = definition.Pnts?.P;
  if (!pnts || !Array.isArray(pnts)) throw new Error("Ugyldig LandXML: mangler <Pnts>/<P>");

  // Bygg id→indeks-mapping og vertices-array
  const idTilIndeks = new Map<string, number>();
  const vertexList: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < pnts.length; i++) {
    const p = pnts[i];
    const id = String(p["@_id"] ?? (i + 1));
    const tekst = typeof p === "string" ? p : (p["#text"] ?? "");
    const deler = String(tekst).trim().split(/\s+/);

    if (deler.length < 3) continue;

    // LandXML: Y N E (northing easting elevation) eller X Y Z
    const y = parseFloat(deler[0]!); // northing
    const x = parseFloat(deler[1]!); // easting
    const z = parseFloat(deler[2]!); // elevation

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    idTilIndeks.set(id, vertexList.length / 3);
    vertexList.push(x, y, z);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  // Parse triangler (faces)
  const faces = definition.Faces?.F;
  if (!faces || !Array.isArray(faces)) throw new Error("Ugyldig LandXML: mangler <Faces>/<F>");

  const triangleList: number[] = [];

  for (const f of faces) {
    const tekst = typeof f === "string" ? f : (f["#text"] ?? "");
    const deler = String(tekst).trim().split(/\s+/);

    if (deler.length < 3) continue;

    const i0 = idTilIndeks.get(deler[0]!);
    const i1 = idTilIndeks.get(deler[1]!);
    const i2 = idTilIndeks.get(deler[2]!);

    if (i0 === undefined || i1 === undefined || i2 === undefined) continue;

    triangleList.push(i0, i1, i2);
  }

  return {
    vertices: new Float64Array(vertexList),
    triangles: new Uint32Array(triangleList),
    bbox: { minX, minY, minZ, maxX, maxY, maxZ },
    navn,
  };
}
