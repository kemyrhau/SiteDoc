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

/** Finn full sti til libredwg-verktøy (PM2 har ofte begrenset PATH) */
const DWG2DXF = process.env.DWG2DXF_PATH ?? "/usr/local/bin/dwg2dxf";
const DWG2SVG = process.env.DWG2SVG_PATH ?? "/usr/local/bin/dwg2SVG";

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
    await execFileAsync(DWG2DXF, ["--version"], { timeout: 5000 });
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

/** Generer SVG fra parsed DXF-entiteter */
function dxfTilSvg(dxfInnhold: string): string | null {
  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfInnhold);
    if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths: string[] = [];

    function upd(x: number, y: number) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    for (const entity of dxf.entities) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;
      const color = e.color ?? 7;
      const stroke = color === 7 || color === 0 ? "#000" : `hsl(${(color * 37) % 360}, 70%, 40%)`;

      if (e.type === "LINE" && e.startPoint && e.endPoint) {
        upd(e.startPoint.x, e.startPoint.y);
        upd(e.endPoint.x, e.endPoint.y);
        paths.push(`<line x1="${e.startPoint.x}" y1="${-e.startPoint.y}" x2="${e.endPoint.x}" y2="${-e.endPoint.y}" stroke="${stroke}" stroke-width="0.5" />`);
      } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices?.length > 1) {
        const pts = e.vertices.map((v: { x: number; y: number }) => { upd(v.x, v.y); return `${v.x},${-v.y}`; }).join(" ");
        const closed = e.shape || e.closed ? " Z" : "";
        paths.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="0.5"${closed ? ` fill="none"` : ""} />`);
      } else if (e.type === "CIRCLE" && e.center) {
        upd(e.center.x - (e.radius ?? 0), e.center.y - (e.radius ?? 0));
        upd(e.center.x + (e.radius ?? 0), e.center.y + (e.radius ?? 0));
        paths.push(`<circle cx="${e.center.x}" cy="${-e.center.y}" r="${e.radius ?? 1}" fill="none" stroke="${stroke}" stroke-width="0.5" />`);
      } else if (e.type === "ARC" && e.center) {
        const r = e.radius ?? 1;
        upd(e.center.x - r, e.center.y - r);
        upd(e.center.x + r, e.center.y + r);
        const sa = ((e.startAngle ?? 0) * Math.PI) / 180;
        const ea = ((e.endAngle ?? 360) * Math.PI) / 180;
        const x1 = e.center.x + r * Math.cos(sa);
        const y1 = -(e.center.y + r * Math.sin(sa));
        const x2 = e.center.x + r * Math.cos(ea);
        const y2 = -(e.center.y + r * Math.sin(ea));
        const large = ((e.endAngle ?? 360) - (e.startAngle ?? 0) + 360) % 360 > 180 ? 1 : 0;
        paths.push(`<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="0.5" />`);
      } else if (e.type === "POINT" && e.position) {
        upd(e.position.x, e.position.y);
        paths.push(`<circle cx="${e.position.x}" cy="${-e.position.y}" r="1" fill="${stroke}" />`);
      } else if (e.type === "INSERT" && e.insertionPoint) {
        upd(e.insertionPoint.x, e.insertionPoint.y);
      } else {
        // Fallback: samle alle kjente punkter
        if (e.position) upd(e.position.x, e.position.y);
        if (e.startPoint) upd(e.startPoint.x, e.startPoint.y);
        if (e.endPoint) upd(e.endPoint.x, e.endPoint.y);
        if (e.center) upd(e.center.x, e.center.y);
        if (e.vertices) for (const v of e.vertices) { if (v.x !== undefined) upd(v.x, v.y); }
        if (e.insertionPoint) upd(e.insertionPoint.x, e.insertionPoint.y);
      }
    }

    if (!isFinite(minX) || !isFinite(maxX) || paths.length === 0) return null;

    const margin = Math.max(maxX - minX, maxY - minY) * 0.02;
    const vbX = minX - margin;
    const vbY = -(maxY + margin);
    const vbW = (maxX - minX) + 2 * margin;
    const vbH = (maxY - minY) + 2 * margin;

    // Faste pikseldimensjoner for å sikre at <img> har intrinsic størrelse
    const svgBredde = 2000;
    const svgHoyde = Math.round(svgBredde * (vbH / vbW));

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${svgBredde}" height="${svgHoyde}">
<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="white"/>
${paths.join("\n")}
</svg>`;
  } catch (err) {
    console.error("[DWG] DXF→SVG feilet:", err);
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
    // Rydd opp eventuelle gamle konverteringsfiler
    try { await unlink(dxfSti); } catch { /* OK */ }
    try { await unlink(svgSti); } catch { /* OK */ }

    // 1. DWG → DXF (for koordinatekstraksjon)
    console.log("[DWG] Konverterer til DXF:", dwgFilSti);
    await execFileAsync(DWG2DXF, ["-y", dwgFilSti], {
      timeout: 120000,
      cwd: dwgDir,
    });

    // 2. Les DXF for koordinater og SVG-generering
    let dxfInnhold: string | null = null;
    let extents: ReturnType<typeof beregnExtents> = null;
    try {
      dxfInnhold = await readFile(dxfSti, "utf-8");
      extents = beregnExtents(dxfInnhold);
      if (extents) {
        console.log("[DWG] Extents:", JSON.stringify(extents));
      }
    } catch (dxfErr) {
      console.warn("[DWG] Kunne ikke lese DXF:", dxfErr);
    }

    // 3. Generer SVG — prøv egen DXF→SVG først, dwg2SVG som fallback
    console.log("[DWG] Genererer SVG fra DXF...");
    let harSvg = false;

    // Primær: egen DXF→SVG (mer pålitelig enn dwg2SVG)
    if (dxfInnhold) {
      const egentSvg = dxfTilSvg(dxfInnhold);
      if (egentSvg) {
        await writeFile(svgSti, egentSvg, "utf-8");
        harSvg = true;
        console.log("[DWG] SVG generert fra DXF-parser");
      }
    }

    // Fallback: dwg2SVG fra libredwg
    if (!harSvg) {
      try {
        const { stdout: svgOutput } = await execFileAsync(DWG2SVG, [dwgFilSti], {
          timeout: 120000,
          cwd: dwgDir,
          maxBuffer: 50 * 1024 * 1024,
        });
        if (svgOutput && svgOutput.includes("<svg")) {
          await writeFile(svgSti, svgOutput, "utf-8");
          harSvg = true;
          console.log("[DWG] SVG generert via dwg2SVG");
        }
      } catch (svgErr) {
        console.warn("[DWG] dwg2SVG feilet:", svgErr);
      }
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
