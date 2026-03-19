/**
 * DWG-konverteringstjeneste.
 *
 * Konverterer DWG-filer til:
 * 1. DXF (for koordinatekstraksjon via dxf-parser)
 * 2. SVG (for visning i nettleser)
 *
 * Krever at `dwg2dxf` og `dwg2SVG` fra libredwg er installert på serveren.
 */

import { execFile } from "node:child_process";
import { readFile, unlink, writeFile, access } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import DxfParser from "dxf-parser";
import {
  detekterKoordinatSystem,
  konverterTilWgs84,
} from "@sitedoc/shared/utils";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";

const execFileAsync = promisify(execFile);

interface DwgKonverteringsResultat {
  /** URL til konvertert visningsfil (SVG/PDF) */
  visningUrl: string;
  /** Filtype for visningsfilen */
  visningFilType: string;
  /** Detektert koordinatsystem */
  koordinatSystem: KoordinatSystem | null;
  /** Auto-generert georeferanse (null hvis ikke detekterbart) */
  geoReferanse: GeoReferanse | null;
  /** Feilmelding hvis noe gikk galt */
  feil: string | null;
}

/** Sjekk om libredwg er installert */
async function sjekkLibreDwg(): Promise<boolean> {
  try {
    await execFileAsync("dwg2dxf", ["--version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Ekstraher bounding box fra DXF-fil */
function beregnExtents(dxfInnhold: string): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfInnhold);
    if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    function oppdaterExtents(x: number, y: number) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    for (const entity of dxf.entities) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;

      // Punkt-baserte entiteter
      if (e.position) oppdaterExtents(e.position.x, e.position.y);
      if (e.startPoint) oppdaterExtents(e.startPoint.x, e.startPoint.y);
      if (e.endPoint) oppdaterExtents(e.endPoint.x, e.endPoint.y);
      if (e.center) oppdaterExtents(e.center.x, e.center.y);

      // Vertices (POLYLINE, LWPOLYLINE, etc.)
      if (e.vertices && Array.isArray(e.vertices)) {
        for (const v of e.vertices) {
          if (v.x !== undefined && v.y !== undefined) {
            oppdaterExtents(v.x, v.y);
          }
        }
      }

      // Insert-punkt (blokkinnlegg)
      if (e.insertionPoint) {
        oppdaterExtents(e.insertionPoint.x, e.insertionPoint.y);
      }
    }

    if (!isFinite(minX) || !isFinite(maxX)) return null;

    return { minX, maxX, minY, maxY };
  } catch (err) {
    console.error("[DWG] DXF-parsing feilet:", err);
    return null;
  }
}

/**
 * Konverter en DWG-fil til visningsformat + ekstraher georeferanse.
 *
 * @param dwgFilSti  Absolutt sti til DWG-filen på disk
 * @param filnavn    Originalt filnavn (for koordinatsystem-deteksjon)
 * @param uploadDir  Mappe der konverterte filer lagres
 */
export async function konverterDwg(
  dwgFilSti: string,
  filnavn: string,
  uploadDir: string,
): Promise<DwgKonverteringsResultat> {
  const harLibreDwg = await sjekkLibreDwg();
  if (!harLibreDwg) {
    return {
      visningUrl: "",
      visningFilType: "",
      koordinatSystem: null,
      geoReferanse: null,
      feil: "libredwg er ikke installert på serveren. Installer med: sudo apt install libredwg-utils eller bygg fra kilde.",
    };
  }

  const dwgDir = dirname(dwgFilSti);
  const dwgBase = basename(dwgFilSti, ".dwg");
  const dxfSti = join(dwgDir, `${dwgBase}.dxf`);
  const svgSti = join(dwgDir, `${dwgBase}.svg`);
  const visningId = randomUUID();

  try {
    // 1. DWG → DXF (for koordinatekstraksjon)
    console.log("[DWG] Konverterer til DXF:", dwgFilSti);
    await execFileAsync("dwg2dxf", [dwgFilSti], {
      timeout: 120000,
      cwd: dwgDir,
    });

    // 2. DWG → SVG (for visning) — dwg2SVG skriver til stdout
    console.log("[DWG] Konverterer til SVG:", dwgFilSti);
    let harSvg = false;
    try {
      const { stdout: svgOutput } = await execFileAsync("dwg2SVG", [dwgFilSti], {
        timeout: 120000,
        cwd: dwgDir,
        maxBuffer: 50 * 1024 * 1024, // 50 MB for store tegninger
      });
      if (svgOutput && svgOutput.includes("<svg")) {
        await writeFile(svgSti, svgOutput, "utf-8");
        harSvg = true;
      }
    } catch (svgErr) {
      console.warn("[DWG] SVG-konvertering feilet, bruker DXF som fallback:", svgErr);
    }

    // 3. Parse DXF for koordinater
    let extents: ReturnType<typeof beregnExtents> = null;
    try {
      const dxfInnhold = await readFile(dxfSti, "utf-8");
      extents = beregnExtents(dxfInnhold);
      if (extents) {
        console.log("[DWG] Extents:", JSON.stringify(extents));
      }
    } catch (dxfErr) {
      console.warn("[DWG] Kunne ikke lese DXF:", dxfErr);
    }

    // 4. Detekter koordinatsystem
    const system = detekterKoordinatSystem(filnavn, extents ?? undefined);
    console.log("[DWG] Detektert koordinatsystem:", system);

    // 5. Generer georeferanse
    let geoReferanse: GeoReferanse | null = null;
    if (system && system !== "wgs84" && extents) {
      const topVenstre = konverterTilWgs84(extents.maxY, extents.minX, system);
      const bunnHoyre = konverterTilWgs84(extents.minY, extents.maxX, system);

      if (topVenstre && bunnHoyre) {
        geoReferanse = {
          point1: {
            pixel: { x: 0, y: 0 },
            gps: { lat: topVenstre.lat, lng: topVenstre.lng },
          },
          point2: {
            pixel: { x: 100, y: 100 },
            gps: { lat: bunnHoyre.lat, lng: bunnHoyre.lng },
          },
        };
        console.log("[DWG] Auto-georeferanse:", JSON.stringify(geoReferanse));
      }
    }

    // 6. Kopier visningsfil til uploads
    let visningUrl = "";
    let visningFilType = "";

    if (harSvg) {
      const svgData = await readFile(svgSti);
      const svgFilnavn = `${visningId}.svg`;
      await writeFile(join(uploadDir, svgFilnavn), svgData);
      visningUrl = `/uploads/${svgFilnavn}`;
      visningFilType = "svg";
    }

    // 7. Rydd opp midlertidige filer
    try { await unlink(dxfSti); } catch { /* OK */ }
    try { if (harSvg) await unlink(svgSti); } catch { /* OK */ }

    return {
      visningUrl,
      visningFilType,
      koordinatSystem: system,
      geoReferanse,
      feil: null,
    };
  } catch (err) {
    console.error("[DWG] Konvertering feilet:", err);
    // Rydd opp
    try { await unlink(dxfSti); } catch { /* OK */ }
    try { await unlink(svgSti); } catch { /* OK */ }

    return {
      visningUrl: "",
      visningFilType: "",
      koordinatSystem: null,
      geoReferanse: null,
      feil: err instanceof Error ? err.message : "Ukjent konverteringsfeil",
    };
  }
}
