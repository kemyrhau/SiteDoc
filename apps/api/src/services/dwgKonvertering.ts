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

/** Beregn farge fra DXF entity */
function dxfFarge(e: { color?: number; colorIndex?: number }): string {
  const rawColor = e.color ?? e.colorIndex ?? 7;
  if (rawColor > 255) {
    const r = (rawColor >> 16) & 0xFF;
    const g = (rawColor >> 8) & 0xFF;
    const b = rawColor & 0xFF;
    return `rgb(${r},${g},${b})`;
  } else if (rawColor === 7 || rawColor === 0) {
    return "#000";
  } else {
    return `hsl(${(rawColor * 37) % 360}, 70%, 40%)`;
  }
}

/** Evaluer kubisk B-spline med kontrollpunkter og knot-vektor */
function evaluerSpline(
  kontrollPunkter: { x: number; y: number }[],
  knotVerdier: number[],
  grad: number,
  antallPunkter: number
): { x: number; y: number }[] {
  const n = kontrollPunkter.length;
  if (n < 2) return kontrollPunkter;

  // De Boor's algoritme for B-spline evaluering
  const resultat: { x: number; y: number }[] = [];
  const knots = knotVerdier.length > 0 ? knotVerdier : genererUniformKnots(n, grad);

  const tStart = knots[grad];
  const tEnd = knots[n];
  if (tStart === undefined || tEnd === undefined || tStart >= tEnd) {
    // Fallback: returner kontrollpunktene som polyline
    return kontrollPunkter;
  }

  for (let i = 0; i < antallPunkter; i++) {
    const t = tStart + (i / (antallPunkter - 1)) * (tEnd - tStart);
    const pt = deBoor(grad, knots, kontrollPunkter, t);
    resultat.push(pt);
  }
  return resultat;
}

function genererUniformKnots(n: number, grad: number): number[] {
  const m = n + grad + 1;
  const knots: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i <= grad) knots.push(0);
    else if (i >= m - grad - 1) knots.push(1);
    else knots.push((i - grad) / (m - 2 * grad));
  }
  return knots;
}

function deBoor(
  p: number,
  knots: number[],
  kontrollPunkter: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  // Finn knot-span
  const n = kontrollPunkter.length;
  let k = p;
  for (let i = p; i < n; i++) {
    if (t >= (knots[i] ?? 0) && t < (knots[i + 1] ?? 1)) {
      k = i;
      break;
    }
  }
  // Klamp t til siste segment
  if (t >= (knots[n] ?? 1)) k = n - 1;

  // Kopier relevante kontrollpunkter
  const d: { x: number; y: number }[] = [];
  for (let j = 0; j <= p; j++) {
    const idx = Math.min(Math.max(k - p + j, 0), n - 1);
    d.push({ x: kontrollPunkter[idx]!.x, y: kontrollPunkter[idx]!.y });
  }

  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const ki = k - p + j;
      const denom = (knots[ki + p - r + 1] ?? 1) - (knots[ki] ?? 0);
      const alpha = denom === 0 ? 0 : (t - (knots[ki] ?? 0)) / denom;
      d[j] = {
        x: (1 - alpha) * d[j - 1]!.x + alpha * d[j]!.x,
        y: (1 - alpha) * d[j - 1]!.y + alpha * d[j]!.y,
      };
    }
  }

  return d[p] ?? { x: 0, y: 0 };
}

/** Generer SVG fra parsed DXF-entiteter (normaliserte koordinater) */
function dxfTilSvg(dxfInnhold: string): string | null {
  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfInnhold);
    if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blokker: Record<string, any[]> = {};
    if (dxf.blocks) {
      for (const [blokkNavn, blokk] of Object.entries(dxf.blocks)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = blokk as any;
        if (b.entities && Array.isArray(b.entities) && b.entities.length > 0) {
          blokker[blokkNavn] = b.entities;
        }
      }
    }
    console.log(`[DWG] Blokker funnet: ${Object.keys(blokker).length} (${Object.entries(blokker).map(([n, e]) => `${n}:${e.length}`).join(", ")})`);

    // Samle alle entiteter inkludert blokk-innhold (for extents-beregning)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function samleAlleEntiteter(entiteter: any[], dybde = 0): any[] {
      if (dybde > 10) return entiteter; // Hindre uendelig rekursjon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alle: any[] = [...entiteter];
      for (const e of entiteter) {
        if (e.type === "INSERT" && e.name && blokker[e.name]) {
          const blokkEntiteter = blokker[e.name]!;
          // Transformer blokkentiteter til verdenskoordinater
          const transformert = blokkEntiteter.map((be: { position?: { x: number; y: number }; startPoint?: { x: number; y: number }; endPoint?: { x: number; y: number }; center?: { x: number; y: number }; vertices?: { x: number; y: number }[]; insertionPoint?: { x: number; y: number }; controlPoints?: { x: number; y: number }[]; fitPoints?: { x: number; y: number }[]; points?: { x: number; y: number }[]; type: string }) => {
            const pos = e.position ?? { x: 0, y: 0 };
            const sx = e.xScale ?? 1;
            const sy = e.yScale ?? 1;
            const rot = ((e.rotation ?? 0) * Math.PI) / 180;
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);

            function transformPunkt(p: { x: number; y: number }): { x: number; y: number } {
              const rx = p.x * sx * cosR - p.y * sy * sinR + pos.x;
              const ry = p.x * sx * sinR + p.y * sy * cosR + pos.y;
              return { x: rx, y: ry };
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const kopi: any = { ...be };
            if (be.position) kopi.position = transformPunkt(be.position);
            if (be.startPoint) kopi.startPoint = transformPunkt(be.startPoint);
            if (be.endPoint) kopi.endPoint = transformPunkt(be.endPoint);
            if (be.center) kopi.center = transformPunkt(be.center);
            if (be.vertices) kopi.vertices = be.vertices.map(transformPunkt);
            if (be.insertionPoint) kopi.insertionPoint = transformPunkt(be.insertionPoint);
            if (be.controlPoints) kopi.controlPoints = be.controlPoints.map(transformPunkt);
            if (be.fitPoints) kopi.fitPoints = be.fitPoints.map(transformPunkt);
            if (be.points) kopi.points = be.points.map(transformPunkt);
            return kopi;
          });
          alle.push(...samleAlleEntiteter(transformert, dybde + 1));
        }
      }
      return alle;
    }

    const alleEntiteter = samleAlleEntiteter(dxf.entities);
    console.log(`[DWG] Totalt entiteter (inkl. blokker): ${alleEntiteter.length} (opprinnelig: ${dxf.entities.length})`);

    // Logg entitetstyper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeTelling: Record<string, number> = {};
    for (const e of alleEntiteter) {
      typeTelling[e.type] = (typeTelling[e.type] ?? 0) + 1;
    }
    console.log(`[DWG] Entitetstyper: ${JSON.stringify(typeTelling)}`);

    // Pass 1: Finn extents fra alle entiteter
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    function upd(x: number, y: number) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    for (const entity of alleEntiteter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;
      if (e.position) upd(e.position.x, e.position.y);
      if (e.startPoint) upd(e.startPoint.x, e.startPoint.y);
      if (e.endPoint) upd(e.endPoint.x, e.endPoint.y);
      if (e.center) {
        const r = e.radius ?? 0;
        upd(e.center.x - r, e.center.y - r);
        upd(e.center.x + r, e.center.y + r);
      }
      if (e.vertices && Array.isArray(e.vertices)) {
        for (const v of e.vertices) {
          if (v.x !== undefined && v.y !== undefined) upd(v.x, v.y);
        }
      }
      if (e.controlPoints && Array.isArray(e.controlPoints)) {
        for (const v of e.controlPoints) {
          if (v.x !== undefined && v.y !== undefined) upd(v.x, v.y);
        }
      }
      if (e.fitPoints && Array.isArray(e.fitPoints)) {
        for (const v of e.fitPoints) {
          if (v.x !== undefined && v.y !== undefined) upd(v.x, v.y);
        }
      }
      if (e.points && Array.isArray(e.points)) {
        for (const v of e.points) {
          if (v.x !== undefined && v.y !== undefined) upd(v.x, v.y);
        }
      }
      if (e.insertionPoint) upd(e.insertionPoint.x, e.insertionPoint.y);
      if (e.majorAxisEndPoint && e.center) {
        // Ellipse: estimat bounding basert på major + minor akse
        const mx = Math.abs(e.majorAxisEndPoint.x);
        const my = Math.abs(e.majorAxisEndPoint.y);
        const majorLen = Math.sqrt(mx * mx + my * my);
        upd(e.center.x - majorLen, e.center.y - majorLen);
        upd(e.center.x + majorLen, e.center.y + majorLen);
      }
    }

    if (!isFinite(minX) || !isFinite(maxX)) return null;

    // Normalisering: flytt alle koordinater til å starte nær 0
    const oX = minX;
    const oY = minY;
    function nx(x: number) { return x - oX; }
    function ny(y: number) { return -(y - oY); }

    // Beregn stroke-width proporsjonalt med tegningens størrelse
    const w = maxX - minX;
    const h = maxY - minY;
    const sw = Math.max(w, h) * 0.001;

    // Pass 2: Generer SVG-elementer fra alle entiteter (unntatt INSERT som allerede er utfoldet)
    const paths: string[] = [];
    let ubehandlede = 0;

    for (const entity of alleEntiteter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;
      if (e.type === "INSERT") continue; // Allerede utfoldet

      const stroke = dxfFarge(e);

      if (e.type === "LINE" && e.startPoint && e.endPoint) {
        paths.push(`<line x1="${nx(e.startPoint.x)}" y1="${ny(e.startPoint.y)}" x2="${nx(e.endPoint.x)}" y2="${ny(e.endPoint.y)}" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if (e.type === "LINE" && e.vertices?.length >= 2) {
        const v0 = e.vertices[0];
        const v1 = e.vertices[1];
        paths.push(`<line x1="${nx(v0.x)}" y1="${ny(v0.y)}" x2="${nx(v1.x)}" y2="${ny(v1.y)}" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices?.length > 1) {
        const pts = e.vertices.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        const lukket = e.shape ? " " + `${nx(e.vertices[0].x)},${ny(e.vertices[0].y)}` : "";
        paths.push(`<polyline points="${pts}${lukket}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if (e.type === "CIRCLE" && e.center) {
        paths.push(`<circle cx="${nx(e.center.x)}" cy="${ny(e.center.y)}" r="${e.radius ?? 1}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if (e.type === "ARC" && e.center) {
        const r = e.radius ?? 1;
        // dxf-parser konverterer ARC-vinkler til radianer
        const sa = e.startAngle ?? 0;
        const ea = e.endAngle ?? Math.PI * 2;
        const x1 = nx(e.center.x + r * Math.cos(sa));
        const y1 = ny(e.center.y + r * Math.sin(sa));
        const x2 = nx(e.center.x + r * Math.cos(ea));
        const y2 = ny(e.center.y + r * Math.sin(ea));
        let vinkelSpenn = ea - sa;
        if (vinkelSpenn < 0) vinkelSpenn += Math.PI * 2;
        const large = vinkelSpenn > Math.PI ? 1 : 0;
        // SVG arc sweep: 0 for DXF (counter-clockwise), men Y er flippa → bruk 0
        paths.push(`<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if (e.type === "SPLINE") {
        // B-spline kurve
        const cp = e.controlPoints ?? [];
        const fp = e.fitPoints ?? [];
        const grad = e.degreeOfSplineCurve ?? 3;
        const knots = e.knotValues ?? [];

        let punkter: { x: number; y: number }[] = [];
        if (cp.length >= 2) {
          // Evaluer B-spline fra kontrollpunkter
          const antPkt = Math.max(cp.length * 10, 50);
          punkter = evaluerSpline(cp, knots, grad, antPkt);
        } else if (fp.length >= 2) {
          // Bruk fit-punkter direkte som polyline
          punkter = fp;
        }

        if (punkter.length >= 2) {
          const pts = punkter.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
          paths.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
        }
      } else if (e.type === "ELLIPSE" && e.center && e.majorAxisEndPoint) {
        // Ellipse med major-akse endepunkt (relativt til sentrum) og aksforhold
        const mx = e.majorAxisEndPoint.x;
        const my = e.majorAxisEndPoint.y;
        const majorLen = Math.sqrt(mx * mx + my * my);
        const ratio = e.axisRatio ?? 1;
        const minorLen = majorLen * ratio;
        const rotDeg = (Math.atan2(my, mx) * 180) / Math.PI;

        // Start- og sluttvinkler (radianer i DXF)
        const sa = e.startAngle ?? 0;
        const ea = e.endAngle ?? Math.PI * 2;
        const erHel = Math.abs(ea - sa - Math.PI * 2) < 0.001 || (sa === 0 && ea === 0);

        if (erHel) {
          paths.push(`<ellipse cx="${nx(e.center.x)}" cy="${ny(e.center.y)}" rx="${majorLen}" ry="${minorLen}" transform="rotate(${-rotDeg} ${nx(e.center.x)} ${ny(e.center.y)})" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
        } else {
          // Delvis ellipse — approksimer med polyline
          const antPkt = 50;
          const pts: string[] = [];
          for (let i = 0; i <= antPkt; i++) {
            const t = sa + (i / antPkt) * (ea - sa);
            const px = e.center.x + majorLen * Math.cos(t) * Math.cos(rotDeg * Math.PI / 180) - minorLen * Math.sin(t) * Math.sin(rotDeg * Math.PI / 180);
            const py = e.center.y + majorLen * Math.cos(t) * Math.sin(rotDeg * Math.PI / 180) + minorLen * Math.sin(t) * Math.cos(rotDeg * Math.PI / 180);
            pts.push(`${nx(px)},${ny(py)}`);
          }
          paths.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
        }
      } else if (e.type === "SOLID" && e.points?.length >= 3) {
        // SOLID: fylt polygon med 3 eller 4 punkter
        // DXF SOLID har spesiell punktrekkefølge: p1, p2, p4, p3 (krysset)
        const p = e.points;
        const pts = p.length === 4
          ? `${nx(p[0].x)},${ny(p[0].y)} ${nx(p[1].x)},${ny(p[1].y)} ${nx(p[3].x)},${ny(p[3].y)} ${nx(p[2].x)},${ny(p[2].y)}`
          : p.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        paths.push(`<polygon points="${pts}" fill="${stroke}" stroke="${stroke}" stroke-width="${sw * 0.5}" />`);
      } else if (e.type === "3DFACE" && e.vertices?.length >= 3) {
        const pts = e.vertices.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        paths.push(`<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`);
      } else if (e.type === "POINT" && e.position) {
        paths.push(`<circle cx="${nx(e.position.x)}" cy="${ny(e.position.y)}" r="${sw * 2}" fill="${stroke}" />`);
      } else if (e.type === "TEXT" && e.startPoint && e.text) {
        const fontSize = (e.textHeight ?? sw * 10) * 1;
        const x = nx(e.startPoint.x);
        const y = ny(e.startPoint.y);
        const rot = e.rotation ? ` transform="rotate(${-e.rotation} ${x} ${y})"` : "";
        paths.push(`<text x="${x}" y="${y}" font-size="${fontSize}" fill="${stroke}"${rot} font-family="sans-serif">${escapeXml(e.text)}</text>`);
      } else if (e.type === "MTEXT" && e.position && e.text) {
        const fontSize = (e.height ?? sw * 10) * 1;
        const x = nx(e.position.x);
        const y = ny(e.position.y);
        const rot = e.rotation ? ` transform="rotate(${-e.rotation} ${x} ${y})"` : "";
        // MTEXT kan ha formatering — strip basic DXF formatting codes
        const renTekst = e.text.replace(/\\[A-Za-z][^;]*;/g, "").replace(/\{|\}/g, "");
        paths.push(`<text x="${x}" y="${y}" font-size="${fontSize}" fill="${stroke}"${rot} font-family="sans-serif">${escapeXml(renTekst)}</text>`);
      } else if (e.type === "DIMENSION") {
        // Dimensjoner — tegn som linjer mellom punktene
        if (e.anchorPoint && e.middleOfText) {
          paths.push(`<line x1="${nx(e.anchorPoint.x)}" y1="${ny(e.anchorPoint.y)}" x2="${nx(e.middleOfText.x)}" y2="${ny(e.middleOfText.y)}" stroke="${stroke}" stroke-width="${sw * 0.5}" />`);
        }
        if (e.text && e.middleOfText) {
          const fontSize = sw * 8;
          paths.push(`<text x="${nx(e.middleOfText.x)}" y="${ny(e.middleOfText.y)}" font-size="${fontSize}" fill="${stroke}" text-anchor="middle" font-family="sans-serif">${escapeXml(e.text)}</text>`);
        }
      } else if (e.type !== "ATTDEF") {
        ubehandlede++;
      }
    }

    if (ubehandlede > 0) {
      console.log(`[DWG] ${ubehandlede} entiteter ble ikke gjenkjent`);
    }
    console.log(`[DWG] Genererte ${paths.length} SVG-elementer`);

    if (paths.length === 0) return null;

    const margin = Math.max(w, h) * 0.02;
    const vbX = -margin;
    const vbY = -(h + margin);
    const vbW = w + 2 * margin;
    const vbH = h + 2 * margin;

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

/** Escape XML-spesialtegn for tekst */
function escapeXml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
