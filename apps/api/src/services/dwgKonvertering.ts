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
import { readFile, unlink, writeFile, access, mkdir, readdir, copyFile, rm } from "node:fs/promises";
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

/** Finn full sti til konverteringsverktøy */
const DWG2DXF = process.env.DWG2DXF_PATH ?? "/usr/local/bin/dwg2dxf";
const DWG2SVG = process.env.DWG2SVG_PATH ?? "/usr/local/bin/dwg2SVG";
const ODA_CONVERTER = process.env.ODA_CONVERTER_PATH ?? "/usr/bin/ODAFileConverter";
const XVFB_RUN = "xvfb-run";

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
  /** Layout-tegninger (tom array = ingen ekstra layouts) */
  layouts: DwgLayoutResultat[];
}

interface DwgLayoutResultat {
  /** Layout-navn fra DWG-filen */
  navn: string;
  /** Tab-rekkefølge (0 = Model) */
  tabOrder: number;
  /** URL til konvertert SVG for denne layouten */
  visningUrl: string;
  /** Filtype for visningsfilen */
  visningFilType: string;
}

/** Intern type for layout-info parsed fra DXF */
interface DxfLayoutInfo {
  navn: string;
  tabOrder: number;
  blokkNavn: string;
  /** Hovedviewportens model space bounds */
  modelBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

/** Sjekk om ODA File Converter er installert */
async function sjekkOda(): Promise<boolean> {
  try {
    await access(ODA_CONVERTER);
    return true;
  } catch {
    return false;
  }
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

/**
 * Konverter DWG til DXF via ODA File Converter.
 * ODA opererer på mapper, ikke enkeltfiler.
 * Returnerer sti til generert DXF-fil, eller null ved feil.
 */
async function konverterMedOda(dwgFilSti: string): Promise<string | null> {
  const tmpId = randomUUID();
  const tmpInDir = join("/tmp", `oda-in-${tmpId}`);
  const tmpOutDir = join("/tmp", `oda-out-${tmpId}`);

  try {
    await mkdir(tmpInDir, { recursive: true });
    await mkdir(tmpOutDir, { recursive: true });

    // Kopier DWG-filen til input-mappen
    const dwgNavn = basename(dwgFilSti);
    await copyFile(dwgFilSti, join(tmpInDir, dwgNavn));

    // Kjør ODA med xvfb (headless) — --auto-servernum unngår display-konflikter
    console.log("[DWG] Konverterer med ODA File Converter...");
    await execFileAsync(XVFB_RUN, [
      "--auto-servernum", ODA_CONVERTER, tmpInDir, tmpOutDir, "ACAD2018", "DXF", "0", "1",
    ], {
      timeout: 300000, // 5 min for store filer
      maxBuffer: 10 * 1024 * 1024,
    });

    // Finn generert DXF-fil
    const filer = await readdir(tmpOutDir);
    const dxfFil = filer.find(f => f.toLowerCase().endsWith(".dxf"));
    if (!dxfFil) {
      console.warn("[DWG] ODA ga ingen DXF-output");
      return null;
    }

    const dxfSti = join(tmpOutDir, dxfFil);
    console.log("[DWG] ODA konvertering ferdig:", dxfSti);
    return dxfSti;
  } catch (err) {
    console.warn("[DWG] ODA konvertering feilet:", err);
    return null;
  } finally {
    // Rydd opp input-mappe (output-mappen ryddes etter DXF er lest)
    try {
      await rm(tmpInDir, { recursive: true, force: true });
    } catch { /* OK */ }
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
    if (!dxf) return null;

    // Bruk DXF header $EXTMIN/$EXTMAX hvis tilgjengelig (model space extents)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const header = (dxf as any).header;
    const extMin = header?.$EXTMIN;
    const extMax = header?.$EXTMAX;
    if (extMin && extMax && isFinite(extMin.x) && isFinite(extMax.x)) {
      return { minX: extMin.x, maxX: extMax.x, minY: extMin.y, maxY: extMax.y };
    }

    // Fallback: beregn fra model space-entiteter
    if (!dxf.entities || dxf.entities.length === 0) return null;

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
      if (e.inPaperSpace) continue; // Kun model space

      if (e.position) oppdaterExtents(e.position.x, e.position.y);
      if (e.startPoint) oppdaterExtents(e.startPoint.x, e.startPoint.y);
      if (e.endPoint) oppdaterExtents(e.endPoint.x, e.endPoint.y);
      if (e.center) oppdaterExtents(e.center.x, e.center.y);

      if (e.vertices && Array.isArray(e.vertices)) {
        for (const v of e.vertices) {
          if (v.x !== undefined && v.y !== undefined) {
            oppdaterExtents(v.x, v.y);
          }
        }
      }

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
 * Parse layout-informasjon fra rå DXF-tekst.
 * Ekstraherer layout-navn, tab-rekkefølge, og viewport-bounds for model space.
 * dxf-parser støtter ikke LAYOUT- eller VIEWPORT-entiteter, så vi parser rå tekst.
 */
function parseLayouts(dxfInnhold: string): DxfLayoutInfo[] {
  const linjer = dxfInnhold.split("\n");

  // 1. Parse BLOCK_RECORD tabell: handle → blokknavn
  const blockRecords: Record<string, string> = {};
  let i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code !== "0" || value !== "BLOCK_RECORD") continue;

    let brHandle = "";
    let brName = "";
    while (i < linjer.length - 1) {
      const gc = parseInt(linjer[i]!.trim(), 10);
      const gv = linjer[i + 1]!.trim();
      i += 2;
      if (gc === 0) { i -= 2; break; }
      if (gc === 5 && !brHandle) brHandle = gv;
      if (gc === 2 && !brName) brName = gv;
    }
    if (brHandle && brName) blockRecords[brHandle] = brName;
  }

  // 2. Parse LAYOUT-objekter: layout-navn → block record handle
  const layouts: DxfLayoutInfo[] = [];
  i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code !== "0" || value !== "LAYOUT") continue;

    let inLayout = false;
    let layoutName = "";
    let tabOrder = -1;
    let blockRecordHandle = "";

    while (i < linjer.length - 1) {
      const gc = parseInt(linjer[i]!.trim(), 10);
      const gv = linjer[i + 1]!.trim();
      i += 2;
      if (gc === 0) { i -= 2; break; }

      if (gc === 100 && gv === "AcDbLayout") inLayout = true;
      if (gc === 100 && gv !== "AcDbLayout") inLayout = false;

      if (inLayout) {
        if (gc === 1 && !layoutName) layoutName = gv;
        if (gc === 71) tabOrder = parseInt(gv, 10);
        if (gc === 330) blockRecordHandle = gv;
      }
    }

    const blokkNavn = blockRecords[blockRecordHandle] ?? "";
    if (layoutName && layoutName !== "Model") {
      layouts.push({ navn: layoutName, tabOrder, blokkNavn, modelBounds: null });
    }
  }

  if (layouts.length === 0) return [];

  // 3. Parse VIEWPORT-entiteter: finn model space bounds per paper space blokk
  const viewportsPerBlokk: Record<string, Array<{
    viewCenterX: number; viewCenterY: number;
    viewWidth: number; viewHeight: number;
    area: number;
  }>> = {};

  i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code !== "0" || value !== "VIEWPORT") continue;

    let ownerHandle = "";
    let inViewport = false;
    let paperWidth = 0, paperHeight = 0;
    let viewCenterX = 0, viewCenterY = 0;
    let viewHeight = 0;

    while (i < linjer.length - 1) {
      const gc = parseInt(linjer[i]!.trim(), 10);
      const gv = linjer[i + 1]!.trim();
      i += 2;
      if (gc === 0) { i -= 2; break; }

      if (gc === 330) ownerHandle = gv;
      if (gc === 100 && gv === "AcDbViewport") inViewport = true;

      if (inViewport) {
        if (gc === 40) paperWidth = parseFloat(gv);
        if (gc === 41) paperHeight = parseFloat(gv);
        if (gc === 12) viewCenterX = parseFloat(gv);
        if (gc === 22) viewCenterY = parseFloat(gv);
        if (gc === 45) viewHeight = parseFloat(gv);
      }
    }

    if (viewHeight > 0 && paperWidth > 0 && paperHeight > 0) {
      const ownerBlock = blockRecords[ownerHandle] ?? "";
      if (!ownerBlock) continue;
      const aspect = paperWidth / paperHeight;
      const viewWidth = viewHeight * aspect;
      if (!viewportsPerBlokk[ownerBlock]) viewportsPerBlokk[ownerBlock] = [];
      viewportsPerBlokk[ownerBlock].push({
        viewCenterX, viewCenterY, viewWidth, viewHeight,
        area: viewWidth * viewHeight,
      });
    }
  }

  // 4. Koble layouts til viewports — bruk den største viewporten (hovedvisningen)
  for (const layout of layouts) {
    const vps = viewportsPerBlokk[layout.blokkNavn];
    if (!vps || vps.length === 0) continue;
    const hovedVp = vps.reduce((a, b) => a.area > b.area ? a : b);
    layout.modelBounds = {
      minX: hovedVp.viewCenterX - hovedVp.viewWidth / 2,
      maxX: hovedVp.viewCenterX + hovedVp.viewWidth / 2,
      minY: hovedVp.viewCenterY - hovedVp.viewHeight / 2,
      maxY: hovedVp.viewCenterY + hovedVp.viewHeight / 2,
    };
  }

  layouts.sort((a, b) => a.tabOrder - b.tabOrder);
  console.log(`[DWG] Fant ${layouts.length} layouts: ${layouts.map(l => `"${l.navn}" (${l.modelBounds ? "med viewport" : "uten viewport"})`).join(", ")}`);
  return layouts;
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
function dxfTilSvg(dxfInnhold: string, klippBounds?: { minX: number; maxX: number; minY: number; maxY: number }): string | null {
  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfInnhold);
    if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blokker: Record<string, any[]> = {};
    if (dxf.blocks) {
      for (const [blokkNavn, blokk] of Object.entries(dxf.blocks)) {
        // Hopp over paper space-blokker og dimensjons-blokker
        if (blokkNavn.startsWith("*Paper_Space") || blokkNavn.startsWith("*D")) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = blokk as any;
        if (b.entities && Array.isArray(b.entities) && b.entities.length > 0) {
          blokker[blokkNavn] = b.entities;
        }
      }
    }
    console.log(`[DWG] Blokker funnet: ${Object.keys(blokker).length} (${Object.entries(blokker).map(([n, e]) => `${n}:${e.length}`).join(", ")})`);

    // Filtrer bort paper space entiteter — kun model space vises
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelEntiteter = dxf.entities.filter((e: any) => !e.inPaperSpace);
    const paperCount = dxf.entities.length - modelEntiteter.length;
    if (paperCount > 0) {
      console.log(`[DWG] Filtrerte bort ${paperCount} paper space entiteter, ${modelEntiteter.length} model space gjenstår`);
    }

    // Utfold INSERT-entiteter iterativt (unngår stack overflow ved store blokker)
    // Begrenser til maks 500 000 entiteter totalt for å unngå minne-problemer
    const MAKS_ENTITETER = 500_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alleEntiteter: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ArbeidsItem = { entity: any; transforms: Array<{ pos: { x: number; y: number }; sx: number; sy: number; cosR: number; sinR: number }> };
    const kø: ArbeidsItem[] = modelEntiteter.map(e => ({ entity: e, transforms: [] }));

    while (kø.length > 0 && alleEntiteter.length < MAKS_ENTITETER) {
      const item = kø.shift()!;
      const e = item.entity;

      if (e.type === "INSERT" && e.name && blokker[e.name]) {
        const blokkEntiteter = blokker[e.name]!;
        // Begrens utfoldelse av veldig store blokker (f.eks. "benk" med 300k+ entiteter)
        if (blokkEntiteter.length > 10_000) {
          console.log(`[DWG] Hopper over stor blokk "${e.name}" (${blokkEntiteter.length} entiteter)`);
          // Legg til INSERT-punktet som en markør
          alleEntiteter.push(e);
          continue;
        }
        // Maksimalt 5 nivåer med nesting
        if (item.transforms.length >= 5) {
          alleEntiteter.push(e);
          continue;
        }

        const pos = e.position ?? { x: 0, y: 0 };
        const sx = e.xScale ?? 1;
        const sy = e.yScale ?? 1;
        const rot = ((e.rotation ?? 0) * Math.PI) / 180;
        const nyTransform = { pos, sx, sy, cosR: Math.cos(rot), sinR: Math.sin(rot) };
        const transforms = [...item.transforms, nyTransform];

        for (const be of blokkEntiteter) {
          kø.push({ entity: be, transforms });
        }
      } else {
        // Anvend alle transforms (fra ytterst til innerst)
        if (item.transforms.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let kopi: any = { ...e };

          function applyTransform(
            punkt: { x: number; y: number },
            tf: { pos: { x: number; y: number }; sx: number; sy: number; cosR: number; sinR: number }
          ): { x: number; y: number } {
            const rx = punkt.x * tf.sx * tf.cosR - punkt.y * tf.sy * tf.sinR + tf.pos.x;
            const ry = punkt.x * tf.sx * tf.sinR + punkt.y * tf.sy * tf.cosR + tf.pos.y;
            return { x: rx, y: ry };
          }

          function applyAll(punkt: { x: number; y: number }): { x: number; y: number } {
            let p = punkt;
            for (const tf of item.transforms) {
              p = applyTransform(p, tf);
            }
            return p;
          }

          if (e.position) kopi.position = applyAll(e.position);
          if (e.startPoint) kopi.startPoint = applyAll(e.startPoint);
          if (e.endPoint) kopi.endPoint = applyAll(e.endPoint);
          if (e.center) kopi.center = applyAll(e.center);
          if (e.vertices) kopi.vertices = e.vertices.map((v: { x: number; y: number }) => applyAll(v));
          if (e.insertionPoint) kopi.insertionPoint = applyAll(e.insertionPoint);
          if (e.controlPoints) kopi.controlPoints = e.controlPoints.map((v: { x: number; y: number }) => applyAll(v));
          if (e.fitPoints) kopi.fitPoints = e.fitPoints.map((v: { x: number; y: number }) => applyAll(v));
          if (e.points) kopi.points = e.points.map((v: { x: number; y: number }) => applyAll(v));
          alleEntiteter.push(kopi);
        } else {
          alleEntiteter.push(e);
        }
      }
    }

    if (kø.length > 0) {
      console.log(`[DWG] Stoppet utfoldelse ved ${MAKS_ENTITETER} entiteter (${kø.length} gjenstår i kø)`);
    }
    console.log(`[DWG] Totalt entiteter (inkl. blokker): ${alleEntiteter.length} (opprinnelig: ${dxf.entities.length})`);

    // Logg entitetstyper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeTelling: Record<string, number> = {};
    for (const e of alleEntiteter) {
      typeTelling[e.type] = (typeTelling[e.type] ?? 0) + 1;
    }
    console.log(`[DWG] Entitetstyper: ${JSON.stringify(typeTelling)}`);

    // Pass 1: Finn extents — bruk klippBounds hvis oppgitt, ellers DXF header
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (klippBounds) {
      minX = klippBounds.minX;
      maxX = klippBounds.maxX;
      minY = klippBounds.minY;
      maxY = klippBounds.maxY;
      console.log(`[DWG] Bruker klippbounds: (${minX.toFixed(0)}, ${minY.toFixed(0)}) → (${maxX.toFixed(0)}, ${maxY.toFixed(0)})`);
    } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const header = (dxf as any).header;
    const extMin = header?.$EXTMIN;
    const extMax = header?.$EXTMAX;
    if (extMin && extMax && isFinite(extMin.x) && isFinite(extMax.x)) {
      minX = extMin.x;
      maxX = extMax.x;
      minY = extMin.y;
      maxY = extMax.y;
      console.log(`[DWG] Bruker DXF header extents: (${minX}, ${minY}) → (${maxX}, ${maxY})`);
    } else {
      // Fallback: beregn fra entiteter med IQR-basert outlier-filtrering
      const alleX: number[] = [];
      const alleY: number[] = [];

      function saml(x: number, y: number) {
        if (isFinite(x) && isFinite(y)) { alleX.push(x); alleY.push(y); }
      }

      for (const entity of alleEntiteter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = entity as any;
        if (e.type === "INSERT") continue;
        if (e.position) saml(e.position.x, e.position.y);
        if (e.startPoint) saml(e.startPoint.x, e.startPoint.y);
        if (e.endPoint) saml(e.endPoint.x, e.endPoint.y);
        if (e.center) saml(e.center.x, e.center.y);
        if (e.vertices && Array.isArray(e.vertices)) {
          for (const v of e.vertices) {
            if (v.x !== undefined && v.y !== undefined) saml(v.x, v.y);
          }
        }
        if (e.insertionPoint) saml(e.insertionPoint.x, e.insertionPoint.y);
      }

      if (alleX.length === 0) return null;

      // Bruk 1. og 99. persentil for å fjerne outliers
      alleX.sort((a, b) => a - b);
      alleY.sort((a, b) => a - b);
      const p1 = Math.floor(alleX.length * 0.01);
      const p99 = Math.ceil(alleX.length * 0.99) - 1;
      minX = alleX[p1]!;
      maxX = alleX[p99]!;
      minY = alleY[p1]!;
      maxY = alleY[p99]!;
      console.log(`[DWG] Beregnet extents fra entiteter (persentil): (${minX}, ${minY}) → (${maxX}, ${maxY})`);
    }
    } // lukk if (!klippBounds)

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

    // Grenser for å filtrere bort entiteter langt utenfor tegningen (50% margin)
    const margin = Math.max(w, h) * 0.5;
    const boundMinX = minX - margin;
    const boundMaxX = maxX + margin;
    const boundMinY = minY - margin;
    const boundMaxY = maxY + margin;

    function erInnenforBounds(x: number, y: number): boolean {
      return x >= boundMinX && x <= boundMaxX && y >= boundMinY && y <= boundMaxY;
    }

    // Pass 2: Generer SVG-elementer fra alle entiteter (unntatt INSERT som allerede er utfoldet)
    const paths: string[] = [];
    let ubehandlede = 0;
    let utenforBounds = 0;

    for (const entity of alleEntiteter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;
      if (e.type === "INSERT") continue; // Allerede utfoldet

      // Sjekk om entiteten er innenfor tegningens extents
      let innenfor = false;
      if (e.position && erInnenforBounds(e.position.x, e.position.y)) innenfor = true;
      else if (e.startPoint && erInnenforBounds(e.startPoint.x, e.startPoint.y)) innenfor = true;
      else if (e.endPoint && erInnenforBounds(e.endPoint.x, e.endPoint.y)) innenfor = true;
      else if (e.center && erInnenforBounds(e.center.x, e.center.y)) innenfor = true;
      else if (e.insertionPoint && erInnenforBounds(e.insertionPoint.x, e.insertionPoint.y)) innenfor = true;
      else if (e.vertices && Array.isArray(e.vertices) && e.vertices.some((v: { x: number; y: number }) => erInnenforBounds(v.x, v.y))) innenfor = true;
      else if (e.controlPoints && Array.isArray(e.controlPoints) && e.controlPoints.some((v: { x: number; y: number }) => erInnenforBounds(v.x, v.y))) innenfor = true;
      if (!innenfor) { utenforBounds++; continue; }

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
    if (utenforBounds > 0) {
      console.log(`[DWG] Filtrerte bort ${utenforBounds} entiteter utenfor tegningens extents`);
    }
    console.log(`[DWG] Genererte ${paths.length} SVG-elementer`);

    if (paths.length === 0) return null;

    const svgMargin = Math.max(w, h) * 0.02;
    const vbX = -svgMargin;
    const vbY = -(h + svgMargin);
    const vbW = w + 2 * svgMargin;
    const vbH = h + 2 * svgMargin;

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
  const harOda = await sjekkOda();
  const harLibre = await sjekkLibreDwg();

  if (!harOda && !harLibre) {
    return {
      visningUrl: "",
      visningFilType: "",
      koordinatSystem: null,
      geoReferanse: null,
      feil: "Ingen DWG-konverterer installert. Installer ODA File Converter eller libredwg.",
      layouts: [],
    };
  }

  const dwgDir = dirname(dwgFilSti);
  const dwgBase = basename(dwgFilSti, ".dwg");
  const svgSti = join(dwgDir, `${dwgBase}.svg`);
  const visningId = randomUUID();
  // Midlertidig DXF-sti (brukes av libredwg-fallback)
  const libreDxfSti = join(dwgDir, `${dwgBase}.dxf`);
  // ODA lager DXF i egen mappe, sti settes dynamisk
  let odaDxfSti: string | null = null;

  try {
    // Rydd opp eventuelle gamle filer
    try { await unlink(libreDxfSti); } catch { /* OK */ }
    try { await unlink(svgSti); } catch { /* OK */ }

    // 1. DWG → DXF — prøv ODA først (bedre kvalitet), libredwg som fallback
    let dxfInnhold: string | null = null;
    let dxfKilde = "";

    if (harOda) {
      odaDxfSti = await konverterMedOda(dwgFilSti);
      if (odaDxfSti) {
        try {
          dxfInnhold = await readFile(odaDxfSti, "utf-8");
          dxfKilde = "ODA";
          console.log(`[DWG] DXF lest via ODA (${(dxfInnhold.length / 1024 / 1024).toFixed(1)} MB)`);
        } catch (err) {
          console.warn("[DWG] Kunne ikke lese ODA DXF:", err);
        }
      }
    }

    if (!dxfInnhold && harLibre) {
      console.log("[DWG] Fallback: konverterer med libredwg...");
      try {
        await execFileAsync(DWG2DXF, ["-y", "--as", "r2000", dwgFilSti], {
          timeout: 300000,
          cwd: dwgDir,
          maxBuffer: 50 * 1024 * 1024, // Store DWG-filer gir mye stderr-warnings
        });
        dxfInnhold = await readFile(libreDxfSti, "utf-8");
        dxfKilde = "libredwg";
        console.log(`[DWG] DXF lest via libredwg (${(dxfInnhold.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        console.warn("[DWG] libredwg konvertering feilet:", err);
      }
    }

    // 2. Beregn extents fra DXF
    let extents: ReturnType<typeof beregnExtents> = null;
    if (dxfInnhold) {
      extents = beregnExtents(dxfInnhold);
      if (extents) {
        console.log("[DWG] Extents:", JSON.stringify(extents));
      }
    }

    // 3. Generer SVG fra DXF
    let harSvg = false;

    if (dxfInnhold) {
      console.log(`[DWG] Genererer SVG fra DXF (${dxfKilde})...`);
      const egentSvg = dxfTilSvg(dxfInnhold);
      if (egentSvg) {
        await writeFile(svgSti, egentSvg, "utf-8");
        harSvg = true;
        console.log("[DWG] SVG generert fra DXF-parser");
      }
    }

    // Fallback: dwg2SVG fra libredwg
    if (!harSvg && harLibre) {
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

    // 4. Parse layouts — opprett separate tegninger med layoutnavn
    // Alle layouts bruker samme model space SVG (viewport-klipping krever UCS-data
    // som ikke er tilgjengelig i DXF)
    const layoutResultater: DwgLayoutResultat[] = [];
    if (dxfInnhold && harSvg) {
      const detekterteLayouts = parseLayouts(dxfInnhold);
      if (detekterteLayouts.length > 0) {
        // Alle layouts deler samme SVG (model space rendering)
        const svgData = await readFile(svgSti, "utf-8");
        for (const layout of detekterteLayouts) {
          const layoutId = randomUUID();
          const layoutFilnavn = `${layoutId}.svg`;
          await writeFile(join(uploadDir, layoutFilnavn), svgData, "utf-8");
          layoutResultater.push({
            navn: layout.navn,
            tabOrder: layout.tabOrder,
            visningUrl: `/uploads/${layoutFilnavn}`,
            visningFilType: "svg",
          });
          console.log(`[DWG] Layout "${layout.navn}" opprettet (delt SVG)`);
        }
      }
    }

    // 5. Detekter koordinatsystem
    const system = detekterKoordinatSystem(filnavn, extents ?? undefined);
    console.log("[DWG] Detektert koordinatsystem:", system);

    // 6. Generer georeferanse
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

    // 7. Kopier visningsfil til uploads
    let visningUrl = "";
    let visningFilType = "";

    if (harSvg) {
      const svgData = await readFile(svgSti);
      const svgFilnavn = `${visningId}.svg`;
      await writeFile(join(uploadDir, svgFilnavn), svgData);
      visningUrl = `/uploads/${svgFilnavn}`;
      visningFilType = "svg";
    }

    // 8. Rydd opp midlertidige filer
    try { await unlink(libreDxfSti); } catch { /* OK */ }
    if (odaDxfSti) {
      try { await rm(dirname(odaDxfSti), { recursive: true, force: true }); } catch { /* OK */ }
    }
    try { if (harSvg) await unlink(svgSti); } catch { /* OK */ }

    return {
      visningUrl,
      visningFilType,
      koordinatSystem: system,
      geoReferanse,
      feil: harSvg ? null : "Kunne ikke generere SVG fra DWG-filen",
      layouts: layoutResultater,
    };
  } catch (err) {
    console.error("[DWG] Konvertering feilet:", err);
    try { await unlink(libreDxfSti); } catch { /* OK */ }
    if (odaDxfSti) {
      try { await rm(dirname(odaDxfSti), { recursive: true, force: true }); } catch { /* OK */ }
    }
    try { await unlink(svgSti); } catch { /* OK */ }

    return {
      visningUrl: "",
      visningFilType: "",
      koordinatSystem: null,
      geoReferanse: null,
      feil: err instanceof Error ? err.message : "Ukjent konverteringsfeil",
      layouts: [],
    };
  }
}
