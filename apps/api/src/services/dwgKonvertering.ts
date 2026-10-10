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
import { readFile, unlink, writeFile } from "node:fs/promises";
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

/** Finn full sti til konverteringsverktøy. libredwg er eneste konverterer (DWG-1,
 * 2026-10-08): ODA File Converter er valgt bort (lukket lisens), så ODA-/xvfb-sporet
 * er fjernet fra både kode og Docker-bildene. */
const DWG2DXF = process.env.DWG2DXF_PATH ?? "/usr/local/bin/dwg2dxf";
const DWG2SVG = process.env.DWG2SVG_PATH ?? "/usr/local/bin/dwg2SVG";

/**
 * Måling rett fra tegningens enheter (DWG-2, D5). Felles form for hovedtegning og
 * hver layout: mm/piksel utledet av viewBox-bredden (tegningsenheter) × mm pr. enhet
 * ($INSUNITS) ÷ 2000 (SVG-ens pikselbredde). `scaleKilde = "dwg"` → måling aktiv
 * direkte; `null` ($INSUNITS ukjent) → låst til kalibrering.
 */
interface DwgMaaling {
  mmPrPiksel: number | null;
  scale: string | null;
  scaleKilde: "dwg" | null;
  /** SVG-ens pikselbredde/-høyde. null på dwg2SVG-fallbacken (ukjente dimensjoner). */
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface DwgKonverteringsResultat extends DwgMaaling {
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
  /** RETUR 2 (vedtak A): auto-detektert rotasjon (grader) bakt inn i hovedtegningens SVG.
   * null = ikke rotert (gyldig: ingen tydelig veggrid, f.eks. kartdata). */
  autoRotasjon: number | null;
  /** RETUR 2 §3: startutsnitt som brøk [0,1] av viewBox — vieweren åpner zoomet hit. */
  startutsnitt: { x: number; y: number; w: number; h: number } | null;
  /** RETUR 4 (fullstendighet): parset-vs-tegnet-rapport for hovedtegningen. */
  rapport: KonverteringRapport | null;
}

interface DwgLayoutResultat extends DwgMaaling {
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

/** Sjekk om libredwg er installert (eneste vakt etter DWG-1). */
async function sjekkLibreDwg(): Promise<boolean> {
  try {
    await execFileAsync(DWG2DXF, ["--version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Konverterer-kapasitet for klienten (D2): er libredwg tilgjengelig i DENNE
 * containeren, og hvilken versjon. Cachet 60 s — `dwg2dxf --version` er et billig,
 * men ikke gratis, child-process-kall og kalles fra hver opplastingsdialog.
 *
 * Merk D-M2: tRPC kjører in-process i web-containeren også, så denne kjører der
 * opplastingen faktisk skjer (web for nettleser-opplasting). Begge bilder har libredwg.
 */
export interface KonverteringKapasitet {
  dwg: boolean;
  versjon: string | null;
}

/** Hent første x.y(.z) fra `dwg2dxf --version`-utskriften («dwg2dxf 0.14 ...»). Ren → testbar. */
export function parseDwgVersjon(tekst: string): string | null {
  const m = tekst.match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
  return m ? m[1]! : null;
}

let kapasitetCache: { verdi: KonverteringKapasitet; utloper: number } | null = null;
const KAPASITET_TTL_MS = 60_000;

/** Nullstill kapasitets-cachen (kun for test). */
export function _nullstillKapasitetCache(): void {
  kapasitetCache = null;
}

export async function hentKonverteringKapasitet(naa: number = Date.now()): Promise<KonverteringKapasitet> {
  if (kapasitetCache && kapasitetCache.utloper > naa) return kapasitetCache.verdi;
  let verdi: KonverteringKapasitet = { dwg: false, versjon: null };
  try {
    const { stdout, stderr } = await execFileAsync(DWG2DXF, ["--version"], { timeout: 5000 });
    verdi = { dwg: true, versjon: parseDwgVersjon(`${stdout}\n${stderr}`) };
  } catch {
    verdi = { dwg: false, versjon: null };
  }
  kapasitetCache = { verdi, utloper: naa + KAPASITET_TTL_MS };
  return verdi;
}

/**
 * D3 — extents-vakt (1e20-saken). En koordinat er bare brukbar når den er endelig
 * og under 1e12 i absoluttverdi. AutoCADs «tomme» model space-extents er ±1e20
 * (endelig, men meningsløs) → uten denne vakta ble ±1e20 godtatt som header, min
 * ble > max, og hele tegningen filtrert bort (Ålesund-saken). Grensa 1e12 er langt
 * over enhver reell tegning i mm/m og langt under 1e20-sentinelen.
 */
export const MAKS_KOORDINAT = 1e12;

/** Er én koordinatverdi endelig og innenfor |v| < 1e12? */
export function gyldigKoordinat(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v) < MAKS_KOORDINAT;
}

/**
 * Godtas disse extents? Alle fire endelige og `|v| < 1e12`, og `min < max` i begge
 * akser (gir `w, h > 0`). Brukes på DXF-header-extents i både `beregnExtents` (georef)
 * og `dxfTilSvg` (visning) — samme vakt begge steder (D3).
 */
export function gyldigeExtents(minX: number, maxX: number, minY: number, maxY: number): boolean {
  return (
    gyldigKoordinat(minX) && gyldigKoordinat(maxX) &&
    gyldigKoordinat(minY) && gyldigKoordinat(maxY) &&
    maxX > minX && maxY > minY
  );
}

/**
 * Er en resulterende viewBox brukbar? Endelig, `w, h > 0`, og sideforholdet
 * innenfor [1/1000, 1000] (en strek-tynn eller ekstremt avlang «tegning» er et
 * tegn på degenererte extents, ikke en ekte plan — da heller `failed` enn en
 * ubrukelig SVG). D3.
 */
export function gyldigViewBox(w: number, h: number): boolean {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  const ratio = w / h;
  return ratio >= 1 / 1000 && ratio <= 1000;
}

/**
 * D5 — mm pr. tegningsenhet fra DXF `$INSUNITS`. 1 tomme=25,4 · 2 fot=304,8 ·
 * 4 mm=1 · 5 cm=10 · 6 m=1000. 0/ukjent → null (måling låses til kalibrering).
 */
export function insunitsTilMm(insunits: number | undefined | null): number | null {
  switch (insunits) {
    case 1: return 25.4;   // tommer
    case 2: return 304.8;  // fot
    case 4: return 1;      // mm
    case 5: return 10;     // cm
    case 6: return 1000;   // m
    default: return null;  // 0/ukjent/udefinert
  }
}

/**
 * Les `$INSUNITS` fra DXF-headeren via lett rå-tekst-skann (unngår en ekstra full
 * dxf-parser-kjøring på store filer). `$INSUNITS` etterfølges av gruppekode 70 og
 * verdien. Fant ikke → null (behandles som ukjent enhet).
 */
export function lesInsunits(dxfInnhold: string): number | null {
  const linjer = dxfInnhold.split("\n");
  for (let i = 0; i < linjer.length - 1; i++) {
    if (linjer[i]!.trim() !== "$INSUNITS") continue;
    for (let j = i + 1; j + 1 < Math.min(i + 8, linjer.length); j += 2) {
      if (linjer[j]!.trim() === "70") {
        const n = parseInt(linjer[j + 1]!.trim(), 10);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  }
  return null;
}

/**
 * D5 — måling fra viewBox-bredden (tegningsenheter) og mm/enhet. SVG-en lages med
 * `width = 2000`, så `mmPrPiksel = vbW · mmPrEnhet / 2000`, `scale = "1:1"`,
 * `scaleKilde = "dwg"`. Ukjent enhet (mmPrEnhet = null) → `mmPrPiksel = vbW/2000`
 * (1 enhet = 1 mm som antakelse), men `scale`/`scaleKilde = null` → måling LÅST til
 * brukeren kalibrerer (kalibrering utleder enhetsfaktoren via nevneren).
 */
export function utledDwgMaaling(
  vbW: number,
  svgWidth: number,
  svgHeight: number,
  mmPrEnhet: number | null,
): DwgMaaling {
  if (mmPrEnhet != null) {
    return {
      mmPrPiksel: (vbW * mmPrEnhet) / svgWidth,
      scale: "1:1",
      scaleKilde: "dwg",
      imageWidth: svgWidth,
      imageHeight: svgHeight,
    };
  }
  return {
    mmPrPiksel: vbW / svgWidth,
    scale: null,
    scaleKilde: null,
    imageWidth: svgWidth,
    imageHeight: svgHeight,
  };
}

/** Ekstraher bounding box fra DXF-fil */
export function beregnExtents(dxfInnhold: string): {
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
    // D3: godta header-extents bare når de passerer 1e20-vakta (endelig, |v|<1e12,
    // min<max). ±1e20-sentinelen faller gjennom til entitets-fallbacken under.
    if (extMin && extMax && gyldigeExtents(extMin.x, extMax.x, extMin.y, extMax.y)) {
      return { minX: extMin.x, maxX: extMax.x, minY: extMin.y, maxY: extMax.y };
    }

    // Fallback: beregn fra model space-entiteter
    if (!dxf.entities || dxf.entities.length === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    function oppdaterExtents(x: number, y: number) {
      // D3: forkast koordinater |v| ≥ 1e12 (sentinel-/søppelpunkter) før de utvider boksen.
      if (!gyldigKoordinat(x) || !gyldigKoordinat(y)) return;
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

    // D3: entitets-boksen må også passere vakta (ellers er den degenerert/tom).
    if (!gyldigeExtents(minX, maxX, minY, maxY)) return null;

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

/** Lag-navn → farge fra DXF LAYER-tabellen, for BYLAYER-oppslag (RETUR 1 pkt 1). */
export type LagFarger = Record<string, { color?: number; colorIndex?: number }>;

/**
 * Normaliser én rå farge (resolved 24-bit RGB > 255, eller ACI-indeks ≤ 255) til en
 * SVG-farge (RETUR 1 pkt 1/9). På hvit visningsbakgrunn tegnes hvit/nesten-hvit og
 * ACI 7/0 («white/black») som SVART — ellers forsvinner BYLAYER-tegninger der laget
 * har fargeindeks 7 (fallplan-saken: dxf-parser resolver ACI 7 til 0xFFFFFF = hvit).
 * Ekte RGB-farger (f.eks. Ålesund) beholdes.
 */
export function fargeFraRaa(rawColor: number): string {
  if (rawColor > 255) {
    const r = (rawColor >> 16) & 0xFF;
    const g = (rawColor >> 8) & 0xFF;
    const b = rawColor & 0xFF;
    if (r > 245 && g > 245 && b > 245) return "#000"; // hvit/nesten-hvit → svart
    return `rgb(${r},${g},${b})`;
  }
  if (rawColor === 7 || rawColor === 0) return "#000";
  return `hsl(${(rawColor * 37) % 360}, 70%, 40%)`;
}

/**
 * Beregn farge fra DXF-entity. Entitetens egen farge har forrang; mangler den
 * (BYLAYER, `color/colorIndex = undefined`) slås lagets farge opp fra LAYER-tabellen
 * (RETUR 1 pkt 1). Ingen treff → svart.
 */
function dxfFarge(e: { color?: number; colorIndex?: number; layer?: string }, lagFarger?: LagFarger): string {
  if (typeof e.color === "number") return fargeFraRaa(e.color);
  if (typeof e.colorIndex === "number") return fargeFraRaa(e.colorIndex);
  if (e.layer && lagFarger && lagFarger[e.layer]) {
    const l = lagFarger[e.layer]!;
    if (typeof l.color === "number") return fargeFraRaa(l.color);
    if (typeof l.colorIndex === "number") return fargeFraRaa(l.colorIndex);
  }
  return "#000";
}

/**
 * HATCH pseudo-entitet (RETUR 1 pkt 3). dxf-parser@1.1.2 dropper HATCH fullstendig,
 * så kundetegninger mister all veggskravering (fallplanen: 12 550 HATCH, 0 parset).
 * Vi parser dem fra rå DXF-tekst og mater dem gjennom samme render-/transform-rør som
 * øvrige entiteter. `hatchLoops` er grensebanene (ytre + evt. hull) i tegningsenheter.
 */
export interface HatchPseudo {
  type: "HATCH";
  layer: string;
  /** DXF-kode 70: true = ekte solid-fyll; false = mønster-hatch (tegnes som grått fyll). */
  solid: boolean;
  colorIndex?: number;
  color?: number;
  hatchLoops: { x: number; y: number }[][];
}

/** Les punkt-par (f.eks. [[10,20],[11,21]]) fra en par-liste fra peker `p`. */
function lesHatchPunkter(
  pairs: Array<[number, string]>,
  p: number,
  koder: Array<[number, number]>,
): { punkter: { x: number; y: number }[]; p: number } {
  const punkter: { x: number; y: number }[] = [];
  for (const [cx, cy] of koder) {
    while (p < pairs.length && pairs[p]![0] !== cx) {
      if (pairs[p]![0] === 92 || pairs[p]![0] === 97) return { punkter, p };
      p++;
    }
    if (p >= pairs.length || pairs[p]![0] !== cx) break;
    const x = parseFloat(pairs[p]![1]); p++;
    let y = NaN;
    if (p < pairs.length && pairs[p]![0] === cy) { y = parseFloat(pairs[p]![1]); p++; }
    if (Number.isFinite(x) && Number.isFinite(y)) punkter.push({ x, y });
  }
  return { punkter, p };
}

/** Tolk én HATCH-record (par fra like etter `0/HATCH` til neste `0`). */
function parseEnHatch(linjer: string[], start: number): { hatch: HatchPseudo | null; neste: number } {
  const pairs: Array<[number, string]> = [];
  let i = start;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    if (code === "0") break;
    const nc = parseInt(code, 10);
    if (!Number.isNaN(nc)) pairs.push([nc, linjer[i + 1]!.trim()]);
    i += 2;
  }
  const neste = i;

  let layer = "0";
  let solid = false;
  let colorIndex: number | undefined;
  let color: number | undefined;
  let nPaths = 0;
  const loops: { x: number; y: number }[][] = [];

  let p = 0;
  for (; p < pairs.length; p++) {
    const [c, v] = pairs[p]!;
    if (c === 8) layer = v;
    else if (c === 62) colorIndex = parseInt(v, 10);
    else if (c === 420) color = parseInt(v, 10);
    else if (c === 70) solid = v === "1";
    else if (c === 91) { nPaths = parseInt(v, 10) || 0; p++; break; }
  }

  for (let path = 0; path < nPaths && p < pairs.length; path++) {
    while (p < pairs.length && pairs[p]![0] !== 92) p++;
    if (p >= pairs.length) break;
    const flag = parseInt(pairs[p]![1], 10) || 0; p++;
    const loop: { x: number; y: number }[] = [];

    if ((flag & 2) !== 0) {
      // Polyline-grense: 72 (bulge), 73 (lukket), 93 (antall), så n × (10,20[,42]).
      while (p < pairs.length && pairs[p]![0] !== 93) { if (pairs[p]![0] === 92) break; p++; }
      let nVerts = 0;
      if (p < pairs.length && pairs[p]![0] === 93) { nVerts = parseInt(pairs[p]![1], 10) || 0; p++; }
      for (let k = 0; k < nVerts && p < pairs.length; k++) {
        while (p < pairs.length && pairs[p]![0] !== 10) { if (pairs[p]![0] === 92) break; p++; }
        if (p >= pairs.length || pairs[p]![0] !== 10) break;
        const x = parseFloat(pairs[p]![1]); p++;
        let y = NaN;
        if (p < pairs.length && pairs[p]![0] === 20) { y = parseFloat(pairs[p]![1]); p++; }
        if (Number.isFinite(x) && Number.isFinite(y)) loop.push({ x, y });
        if (p < pairs.length && pairs[p]![0] === 42) p++;
      }
    } else {
      // Edge-grense: 93 (antall kanter), hver kant 72 (type) + data.
      while (p < pairs.length && pairs[p]![0] !== 93) { if (pairs[p]![0] === 92) break; p++; }
      let nEdges = 0;
      if (p < pairs.length && pairs[p]![0] === 93) { nEdges = parseInt(pairs[p]![1], 10) || 0; p++; }
      for (let e = 0; e < nEdges && p < pairs.length; e++) {
        while (p < pairs.length && pairs[p]![0] !== 72) { if (pairs[p]![0] === 92 || pairs[p]![0] === 97) break; p++; }
        if (p >= pairs.length || pairs[p]![0] !== 72) break;
        const edgeType = parseInt(pairs[p]![1], 10); p++;
        if (edgeType === 1) {
          const r = lesHatchPunkter(pairs, p, [[10, 20], [11, 21]]); p = r.p;
          for (const pt of r.punkter) loop.push(pt);
        } else if (edgeType === 2) {
          // Bue: 10,20 sentrum; 40 radius; 50/51 vinkler (grader). Tessellér grovt (12 segm).
          const c = lesHatchPunkter(pairs, p, [[10, 20]]); p = c.p;
          let radius = NaN, a0 = 0, a1 = 360;
          while (p < pairs.length && ![72, 92, 97].includes(pairs[p]![0])) {
            const [cc, vv] = pairs[p]!;
            if (cc === 40) radius = parseFloat(vv);
            else if (cc === 50) a0 = parseFloat(vv);
            else if (cc === 51) a1 = parseFloat(vv);
            p++;
          }
          const senter = c.punkter[0];
          if (senter && Number.isFinite(radius)) {
            const span = ((a1 - a0 + 360) % 360) || 360;
            for (let s = 0; s <= 12; s++) {
              const ang = ((a0 + (span * s) / 12) * Math.PI) / 180;
              loop.push({ x: senter.x + radius * Math.cos(ang), y: senter.y + radius * Math.sin(ang) });
            }
          }
        } else {
          // Ellipse/spline-kant: hopp frem til neste kant/path (sjelden i vegg-hatch).
          while (p < pairs.length && ![72, 92, 97].includes(pairs[p]![0])) p++;
        }
      }
    }

    if (loop.length >= 2) loops.push(loop);
    while (p < pairs.length && pairs[p]![0] !== 92) p++; // forbi 97/330-trailer til neste path
  }

  if (loops.length === 0) return { hatch: null, neste };
  return { hatch: { type: "HATCH", layer, solid, colorIndex, color, hatchLoops: loops }, neste };
}

/**
 * Parse alle HATCH fra rå DXF. Model-space-HATCH (ENTITIES-seksjonen) returneres som
 * `model` (verdenskoordinater, tegnes direkte); HATCH inne i blokk-definisjoner
 * returneres per blokknavn i `perBlokk` slik at INSERT-utfoldelsen transformerer dem.
 */
export function parseHatcher(dxfInnhold: string): {
  model: HatchPseudo[];
  perBlokk: Record<string, HatchPseudo[]>;
} {
  const linjer = dxfInnhold.split("\n");
  const model: HatchPseudo[] = [];
  const perBlokk: Record<string, HatchPseudo[]> = {};
  let sec = "";
  let blokkNavn = "";

  let i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code === "2" && ["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"].includes(value)) {
      sec = value; blokkNavn = ""; continue;
    }
    if (code !== "0") continue;
    if (value === "BLOCK") {
      blokkNavn = "";
      for (let j = i; j < linjer.length - 1; j += 2) {
        const gc = linjer[j]!.trim();
        if (gc === "0") break;
        if (gc === "2") { blokkNavn = linjer[j + 1]!.trim(); break; }
      }
      continue;
    }
    if (value === "ENDBLK") { blokkNavn = ""; continue; }
    if (value === "HATCH") {
      const res = parseEnHatch(linjer, i);
      i = res.neste;
      if (res.hatch) {
        if (sec === "ENTITIES") model.push(res.hatch);
        else if (sec === "BLOCKS" && blokkNavn) (perBlokk[blokkNavn] ??= []).push(res.hatch);
      }
    }
  }
  return { model, perBlokk };
}

/** SVG-fyllfarge for en HATCH: ekte solid → lagets/entitetens farge; mønster → lys grå. */
function hatchFyll(h: HatchPseudo, lagFarger?: LagFarger): string {
  if (h.solid) return dxfFarge(h, lagFarger);
  return "#c8c8c8"; // mønster-hatch tegnes som lys grå flate («minst solid fill»)
}

/**
 * LEADER pseudo-entitet (RETUR 2 TILLEGG). dxf-parser@1.1.2 dropper LEADER fullstendig
 * (kundefila: 24 LEADER, 0 parset) — det er nettopp fall-pilene som peker fra sluk/koter.
 * Vi parser dem fra rå DXF og mater dem gjennom samme render-/transform-rør som HATCH:
 * `vertices` er knekkpunktene (verden eller blokk-lokalt), `harPil` = DXF kode 71.
 */
export interface LeaderPseudo {
  type: "LEADER";
  layer: string;
  colorIndex?: number;
  color?: number;
  /** DXF kode 71: pilhode på (tegnes som liten trekant ved første knekkpunkt). */
  harPil: boolean;
  vertices: { x: number; y: number }[];
}

/** Tolk én LEADER-record (par fra like etter `0/LEADER` til neste `0`). */
function parseEnLeader(linjer: string[], start: number): { leader: LeaderPseudo | null; neste: number } {
  let i = start;
  let layer = "0";
  let colorIndex: number | undefined;
  let color: number | undefined;
  let harPil = false;
  const vertices: { x: number; y: number }[] = [];
  let ventX: number | null = null;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    if (code === "0") break;
    const nc = parseInt(code, 10);
    const v = linjer[i + 1]!.trim();
    i += 2;
    if (nc === 8) layer = v;
    else if (nc === 62) colorIndex = parseInt(v, 10);
    else if (nc === 420) color = parseInt(v, 10);
    else if (nc === 71) harPil = v === "1";
    else if (nc === 10) ventX = parseFloat(v);
    else if (nc === 20 && ventX !== null) {
      const y = parseFloat(v);
      if (Number.isFinite(ventX) && Number.isFinite(y)) vertices.push({ x: ventX, y });
      ventX = null;
    }
  }
  if (vertices.length < 2) return { leader: null, neste: i };
  return { leader: { type: "LEADER", layer, colorIndex, color, harPil, vertices }, neste: i };
}

/**
 * Parse alle LEADER fra rå DXF. Model-space-LEADER returneres som `model`
 * (verdenskoordinater, tegnes direkte); LEADER inne i blokk-definisjoner per blokknavn
 * i `perBlokk` slik at INSERT-utfoldelsen transformerer dem — samme mønster som HATCH.
 */
export function parseLeadere(dxfInnhold: string): {
  model: LeaderPseudo[];
  perBlokk: Record<string, LeaderPseudo[]>;
} {
  const linjer = dxfInnhold.split("\n");
  const model: LeaderPseudo[] = [];
  const perBlokk: Record<string, LeaderPseudo[]> = {};
  let sec = "";
  let blokkNavn = "";

  let i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code === "2" && ["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"].includes(value)) {
      sec = value; blokkNavn = ""; continue;
    }
    if (code !== "0") continue;
    if (value === "BLOCK") {
      blokkNavn = "";
      for (let j = i; j < linjer.length - 1; j += 2) {
        const gc = linjer[j]!.trim();
        if (gc === "0") break;
        if (gc === "2") { blokkNavn = linjer[j + 1]!.trim(); break; }
      }
      continue;
    }
    if (value === "ENDBLK") { blokkNavn = ""; continue; }
    if (value === "LEADER") {
      const res = parseEnLeader(linjer, i);
      i = res.neste;
      if (res.leader) {
        if (sec === "ENTITIES") model.push(res.leader);
        else if (sec === "BLOCKS" && blokkNavn) (perBlokk[blokkNavn] ??= []).push(res.leader);
      }
    }
  }
  return { model, perBlokk };
}

/**
 * ATTRIB pseudo-entitet (RETUR 4 / fullstendighet). dxf-parser@1.1.2 dropper ATTRIB
 * fullstendig — verken som egen entitet eller på `INSERT.attributes` (fallplanen: 503
 * ATTRIB, 0 parset). Det er blokk-attributtenes synlige verdi-tekst (vindus-ID, sill-
 * prefiks, merketekst). Vi parser dem fra rå DXF og tegner dem som TEXT: `position`/
 * `textHeight`/`rotation`/`text` i tegningsenheter. Usynlige attributter (kode 70 bit 1)
 * hoppes over — bare det som er synlig i model space skal med.
 */
export interface AttribPseudo {
  type: "ATTRIB";
  layer: string;
  colorIndex?: number;
  color?: number;
  position: { x: number; y: number };
  textHeight: number;
  rotation: number;
  text: string;
}

/** Tolk én ATTRIB-record (par fra like etter `0/ATTRIB` til neste `0`). */
function parseEnAttrib(linjer: string[], start: number): { attrib: AttribPseudo | null; neste: number } {
  let i = start;
  let layer = "0";
  let colorIndex: number | undefined;
  let color: number | undefined;
  let text = "";
  let height = 0;
  let rotation = 0;
  const p10: { x?: number; y?: number } = {};
  const p11: { x?: number; y?: number } = {};
  let just = 0; // kode 72/74 ≠ 0 → tekst plasseres på justeringspunktet (11/21)
  let flags: number | null = null; // kode 70: bit 1 = usynlig
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    if (code === "0") break;
    const nc = parseInt(code, 10);
    const v = linjer[i + 1]!.trim();
    i += 2;
    if (nc === 8) layer = v;
    else if (nc === 62) colorIndex = parseInt(v, 10);
    else if (nc === 420) color = parseInt(v, 10);
    else if (nc === 1) text = v;
    else if (nc === 40) height = parseFloat(v);
    else if (nc === 50) rotation = parseFloat(v);
    else if (nc === 10) p10.x = parseFloat(v);
    else if (nc === 20) p10.y = parseFloat(v);
    else if (nc === 11) p11.x = parseFloat(v);
    else if (nc === 21) p11.y = parseFloat(v);
    else if (nc === 72 || nc === 74) { if (parseInt(v, 10) !== 0) just = 1; }
    else if (nc === 70 && flags === null) flags = parseInt(v, 10);
  }
  const neste = i;
  // Usynlig attributt (bit 1) eller tom verdi → ikke synlig i model space.
  if ((flags !== null && (flags & 1) === 1) || !text) return { attrib: null, neste };
  // Justert tekst (senter/høyre/midtstilt) sitter på justeringspunktet (11/21).
  const pos = just && p11.x !== undefined && p11.y !== undefined
    ? { x: p11.x, y: p11.y }
    : { x: p10.x ?? 0, y: p10.y ?? 0 };
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return { attrib: null, neste };
  return { attrib: { type: "ATTRIB", layer, colorIndex, color, position: pos, textHeight: height || 0, rotation, text }, neste };
}

/**
 * Parse alle ATTRIB fra rå DXF. Samme model/perBlokk-mønster som HATCH/LEADER:
 * model-ATTRIB (verdenskoordinater) tegnes direkte; ATTRIB i blokk-definisjoner
 * transformeres av INSERT-utfoldelsen.
 */
export function parseAttrib(dxfInnhold: string): {
  model: AttribPseudo[];
  perBlokk: Record<string, AttribPseudo[]>;
} {
  const linjer = dxfInnhold.split("\n");
  const model: AttribPseudo[] = [];
  const perBlokk: Record<string, AttribPseudo[]> = {};
  let sec = "";
  let blokkNavn = "";

  let i = 0;
  while (i < linjer.length - 1) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    i += 2;
    if (code === "2" && ["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"].includes(value)) {
      sec = value; blokkNavn = ""; continue;
    }
    if (code !== "0") continue;
    if (value === "BLOCK") {
      blokkNavn = "";
      for (let j = i; j < linjer.length - 1; j += 2) {
        const gc = linjer[j]!.trim();
        if (gc === "0") break;
        if (gc === "2") { blokkNavn = linjer[j + 1]!.trim(); break; }
      }
      continue;
    }
    if (value === "ENDBLK") { blokkNavn = ""; continue; }
    if (value === "ATTRIB") {
      const res = parseEnAttrib(linjer, i);
      i = res.neste;
      if (res.attrib) {
        if (sec === "ENTITIES") model.push(res.attrib);
        else if (sec === "BLOCKS" && blokkNavn) (perBlokk[blokkNavn] ??= []).push(res.attrib);
      }
    }
  }
  return { model, perBlokk };
}

/**
 * Fullstendighetsrapport (RETUR 4, Kenneth «skal ikke alle streker gjenskapes?»).
 * Teller entiteter pr. type i den rå DXF-en (model space + blokk-definisjoner, som
 * INSERT utfolder) — men IKKE paper space (vedtak B) eller strukturmarkører. Typer som
 * er bevisst ikke-visuelle eller foldet inn i en annen type står i ALLOWLIST og regnes
 * ikke som manglende. `dwg_ikke_tegnet` = typer i DXF-en uten noen tegnet representasjon.
 */
export const RAPPORT_ALLOWLIST: ReadonlySet<string> = new Set([
  "INSERT",   // utfoldes til barn-entitetene (tegnes); referansen selv tegnes ikke
  "SEQEND",   // sekvens-slutt-markør for POLYLINE/INSERT
  "VERTEX",   // POLYLINE-underrecord, foldet inn i POLYLINE.vertices
  "ATTDEF",   // attributt-DEFINISJON i blokk (mal, ikke instans) — ATTRIB bærer verdien
  "VIEWPORT", // paper space-viewport, ikke model-geometri
  "DICTIONARY",
]);

/** Strukturmarkører i DXF som aldri er entiteter. */
const DXF_STRUKTUR: ReadonlySet<string> = new Set([
  "SECTION", "ENDSEC", "TABLE", "ENDTAB", "BLOCK", "ENDBLK", "EOF",
  "LAYER", "LTYPE", "STYLE", "VIEW", "UCS", "VPORT", "APPID", "DIMSTYLE",
  "BLOCK_RECORD", "CLASS",
]);

/**
 * Tell entiteter pr. type i den rå DXF-teksten (ENTITIES + BLOCKS, uten paper space
 * og uten strukturmarkører). Robust par-for-par-skanning (DXF er strengt kode/verdi).
 */
export function tellDxfInventar(dxfInnhold: string): Record<string, number> {
  const linjer = dxfInnhold.split(/\r?\n/);
  const inventar: Record<string, number> = {};
  let sec = "";
  let iBlock = false;
  let blokkPaperSpace = false;
  for (let i = 0; i + 1 < linjer.length; i += 2) {
    const code = linjer[i]!.trim();
    const value = linjer[i + 1]!.trim();
    if (code === "2" && ["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"].includes(value)) {
      sec = value; iBlock = false; continue;
    }
    if (code !== "0") continue;
    if (value === "BLOCK") {
      iBlock = true; blokkPaperSpace = false;
      // Blokknavn (kode 2) avgjør om det er paper space (hoppes over).
      for (let j = i + 2; j + 1 < linjer.length; j += 2) {
        const gc = linjer[j]!.trim();
        if (gc === "0") break;
        if (gc === "2") { const bn = linjer[j + 1]!.trim(); blokkPaperSpace = bn.startsWith("*Paper_Space") || bn.startsWith("*D"); break; }
      }
      continue;
    }
    if (value === "ENDBLK") { iBlock = false; blokkPaperSpace = false; continue; }
    if (DXF_STRUKTUR.has(value)) continue;
    if (sec === "ENTITIES") inventar[value] = (inventar[value] ?? 0) + 1;
    else if (sec === "BLOCKS" && iBlock && !blokkPaperSpace) inventar[value] = (inventar[value] ?? 0) + 1;
  }
  return inventar;
}

/** Fullstendighetsrapport som lagres i tegningens metadata (`konverteringRapport`). */
export interface KonverteringRapport {
  /** Entiteter pr. type i den rå DXF-en (model + blokker). */
  parsetPrType: Record<string, number>;
  /** Tegnede SVG-elementer pr. `data-type`. */
  tegnetPrType: Record<string, number>;
  /** Typer i DXF-en uten noen tegnet representasjon, utenom ALLOWLIST → antall i DXF-en. */
  ikkeTegnet: Record<string, number>;
}

/**
 * Bygg fullstendighetsrapporten: parset (rå DXF) vs. tegnet (data-type i SVG). En type
 * havner i `ikkeTegnet` bare når den finnes i DXF-en, ikke er på ALLOWLIST, og har NULL
 * tegnede elementer. Antalls-avvik (f.eks. 38 981 vs 38 982 LINE) er IKKE mangler.
 */
export function byggRapport(inventar: Record<string, number>, tegnet: Record<string, number>): KonverteringRapport {
  const ikkeTegnet: Record<string, number> = {};
  for (const [type, antall] of Object.entries(inventar)) {
    if (RAPPORT_ALLOWLIST.has(type)) continue;
    if (!tegnet[type]) ikkeTegnet[type] = antall;
  }
  return { parsetPrType: inventar, tegnetPrType: tegnet, ikkeTegnet };
}

// ---------------------------------------------------------------------------
// RETUR 2 (vedtak A) — automatisk rotasjon: to signaler. Veggvinkelen (mod 90°)
// gir aksejevnhet, tekstrotasjonene løser 90°-kvadrant-tvetydigheten. Rotasjonen
// lagres som transform og BAKES inn i SVG-koordinatene, mens tekst motroteres så
// den står vannrett (som arkitektens PDF). Rene funksjoner → testbare.
// ---------------------------------------------------------------------------

export interface Segment { x1: number; y1: number; x2: number; y2: number; }

/** Normaliser en vinkel i grader til halvåpent intervall (-180, 180]. */
export function normaliser180(grader: number): number {
  let d = ((grader % 360) + 360) % 360; // 0..360
  if (d > 180) d -= 360;                 // (-180, 180]
  return d;
}

/**
 * Lengdevektet vinkelhistogram mod 90° (1°-binner) over veggkandidat-segmenter.
 * Returnerer den dominante vinkelen (lengdevektet snitt rundt toppen, 0..90) og
 * andelen av total segmentlengde innenfor ±1° av toppen. `null` når grunnlaget er
 * for tynt (< 20 segmenter) — et par streker definerer ingen bygningsgrid.
 */
export function dominantVeggvinkel(segmenter: Segment[]): { grader: number; andel: number } | null {
  const bins = new Array(90).fill(0);
  let tot = 0;
  let antall = 0;
  for (const s of segmenter) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a % 90) + 90) % 90; // 0..90
    bins[Math.min(89, Math.floor(a))] += len;
    tot += len;
    antall++;
  }
  if (antall < 20 || tot <= 0) return null;

  let topp = 0;
  for (let i = 1; i < 90; i++) if (bins[i]! > bins[topp]!) topp = i;
  let naer = 0;
  for (let d = -1; d <= 1; d++) naer += bins[((topp + d) % 90 + 90) % 90]!;

  // Sub-grad presisjon: lengdevektet snitt av segmentvinkler innenfor ±1,5° av toppen.
  let sum = 0;
  let vekt = 0;
  for (const s of segmenter) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a % 90) + 90) % 90;
    let diff = a - topp;
    if (diff > 45) diff -= 90;
    if (diff < -45) diff += 90;
    if (Math.abs(diff) <= 1.5) { sum += (topp + diff) * len; vekt += len; }
  }
  const presis = vekt > 0 ? ((sum / vekt) % 90 + 90) % 90 : topp;
  return { grader: presis, andel: naer / tot };
}

/**
 * Velg geometri-rotasjon (grader, verden CCW) som gjør veggene aksejevne. Veggvinkelen
 * gir bare «mod 90°»; tekstrotasjonene løser hvilken av de fire kvadrantene som er rett:
 * den som gjør flest tekster lesbare (|sluttvinkel| ≤ 45° mod 360, vektet). Ingen/ingen
 * lesbar tekst → minste |rotasjon| (≤ 45°). Returnert verdi er i (-180, 180].
 */
export function velgAutoRotasjon(
  veggVinkel: number,
  tekstRotasjoner: { grader: number; vekt: number }[],
): number {
  const base = -veggVinkel; // bringer veggen til 0
  const kandidater = [base, base + 90, base + 180, base + 270].map(normaliser180);
  function skaar(R: number): { lesbare: number; absR: number } {
    let lesbare = 0;
    for (const t of tekstRotasjoner) {
      if (Math.abs(normaliser180(t.grader + R)) <= 45) lesbare += t.vekt;
    }
    return { lesbare, absR: Math.abs(R) };
  }
  let best = kandidater[0]!;
  let bestS = skaar(best);
  for (const R of kandidater.slice(1)) {
    const s = skaar(R);
    if (s.lesbare > bestS.lesbare || (s.lesbare === bestS.lesbare && s.absR < bestS.absR)) {
      best = R;
      bestS = s;
    }
  }
  return best;
}

/**
 * Roter et punkt (verden CCW, grader) om et senter. Brukes til å bake auto-rotasjonen inn i
 * geometri-koordinatene (bygningsplaner UTEN koordinatsystem) og — via `roterProsentMarkor` —
 * til å flytte markør-/område-posisjoner når en re-konvertering endrer rotasjonen (RETUR 3 §2).
 * Georefererte tegninger roteres ALDRI (CRS funnet → rotasjon 0, RETUR 3 §1), så georef-hjørnene
 * og de uroterte extentene forblir konsistente uten at punktet her trenger å røres for georef.
 */
export function roterPunkt(
  p: { x: number; y: number },
  grader: number,
  senter: { x: number; y: number },
): { x: number; y: number } {
  if (!grader) return { x: p.x, y: p.y };
  const r = (grader * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - senter.x;
  const dy = p.y - senter.y;
  return { x: senter.x + dx * c - dy * s, y: senter.y + dx * s + dy * c };
}

/**
 * RETUR 3 §2 — roter en markør-/område-prosentposisjon om bildesenteret (50,50) når en
 * re-konvertering endrer den inn-bakte auto-rotasjonen med `grader` (ny − gammel, verden CCW).
 * SVG-rommet er y-ned (`ny(y) = -(y-oY)`), så samme vinkel om senteret flytter prosentpunktet
 * i takt med den roterte geometrien. Klemmes til [0,100] (et hjørne kan havne akkurat på kanten).
 */
export function roterProsentMarkor(
  p: { x: number; y: number },
  grader: number,
): { x: number; y: number } {
  if (!grader) return { x: p.x, y: p.y };
  const r = roterPunkt(p, grader, { x: 50, y: 50 });
  const klem = (v: number) => Math.max(0, Math.min(100, v));
  return { x: klem(r.x), y: klem(r.y) };
}

/**
 * RETUR 2 §3 — startutsnitt: tettest klynge. Persentil [p, 1-p] pr. akse fjerner spredte
 * uteliggere (tittelfelt/tegnforklaring/én punktmarkør langt unna), så visningen åpner
 * der innholdet er tett. Alt annet er fortsatt med i viewBox og synlig når man zoomer ut.
 * Punktene er i samme rom kalleren gir (her: SVG-piksel). Returnerer {x,y,w,h} eller null.
 */
export function beregnStartutsnitt(
  punkter: { x: number; y: number }[],
  p: number = 0.01,
): { x: number; y: number; w: number; h: number } | null {
  if (punkter.length < 50) return null;
  const xs = punkter.map((q) => q.x).sort((a, b) => a - b);
  const ys = punkter.map((q) => q.y).sort((a, b) => a - b);
  const kv = (arr: number[], f: number) =>
    arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))]!;
  const x0 = kv(xs, p), x1 = kv(xs, 1 - p);
  const y0 = kv(ys, p), y1 = kv(ys, 1 - p);
  const w = x1 - x0, h = y1 - y0;
  if (!(w > 0) || !(h > 0)) return null;
  return { x: x0, y: y0, w, h };
}

/**
 * SVAR RETUR 6 spor 2 — robust ytre grense pr. akse. Trimmer bort isolerte ytter-
 * klynger (modullinje-«bobler», enslige snitt-/nordmarkører, andre løse elementer
 * langt fra hovedmassen) som ellers blåser opp extents og dermed krymper selve
 * bygget i startvisningen. Ren, testbar funksjon — ingen lagnavn-heuristikk.
 *
 * Metode (tetthet + gap, ikke lengdevekting — en LANG modullinje ville dratt
 * lengdevekt-persentilen MOT seg, se leveransen): binn verdiene, og «skrell» fra
 * hver ende isolerte klynger som (a) er skilt fra resten med et tomt gap ≥ `gapAndel`
 * av spennet OG (b) til sammen utgjør ≤ `maksTrimAndel` av punktene. Treffer vi ikke
 * et slikt gap, stopper vi — hovedmassens egen kant bevares (RETUR 1 pkt 7: aldri
 * klipp ekte kantgeometri). Ingen kvalifiserende gap ⇒ full min/max uendret, så rene
 * tegninger (Ålesund) er en no-op.
 */
export function robustGrense(
  verdier: number[],
  opts: { gapAndel?: number; maksTrimAndel?: number; bins?: number } = {},
): { lo: number; hi: number } {
  const gapAndel = opts.gapAndel ?? 0.03;
  const maksTrim = opts.maksTrimAndel ?? 0.02;
  const K = opts.bins ?? 512;
  const n = verdier.length;
  if (n === 0) return { lo: 0, hi: 0 };
  let lo = Infinity, hi = -Infinity;
  for (const v of verdier) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo;
  if (!(span > 0)) return { lo, hi };

  const bw = span / K;
  const bins = new Array<number>(K).fill(0);
  for (const v of verdier) {
    if (!Number.isFinite(v)) continue;
    let i = Math.floor((v - lo) / bw);
    if (i < 0) i = 0;
    if (i >= K) i = K - 1;
    bins[i] = (bins[i] ?? 0) + 1;
  }
  const minGapBins = Math.max(1, Math.ceil(gapAndel * K));
  const maksTrimN = maksTrim * n;

  // Skrell isolerte ytter-klynger fra lav ende.
  let loBin = 0;
  {
    let trimmet = 0, i = 0;
    while (i < K) {
      if (bins[i] === 0) { i++; continue; }            // ledende tomme bins
      let j = i, klynge = 0;
      while (j < K && bins[j]! > 0) { klynge += bins[j]!; j++; }   // klynge [i..j)
      let g = j; while (g < K && bins[g] === 0) g++;               // gap [j..g)
      if (g < K && (g - j) >= minGapBins && (trimmet + klynge) <= maksTrimN) {
        trimmet += klynge; loBin = g; i = g;            // isolert → trim, hopp forbi gapet
      } else break;                                     // hovedmasse nådd
    }
  }
  // Skrell isolerte ytter-klynger fra høy ende.
  let hiBin = K - 1;
  {
    let trimmet = 0, i = K - 1;
    while (i >= 0) {
      if (bins[i] === 0) { i--; continue; }
      let j = i, klynge = 0;
      while (j >= 0 && bins[j]! > 0) { klynge += bins[j]!; j--; }
      let g = j; while (g >= 0 && bins[g] === 0) g--;
      if (g >= 0 && (j - g) >= minGapBins && (trimmet + klynge) <= maksTrimN) {
        trimmet += klynge; hiBin = g; i = g;
      } else break;
    }
  }
  if (loBin > hiBin) return { lo, hi };                 // degenerert → full min/max
  return { lo: lo + loBin * bw, hi: lo + (hiBin + 1) * bw };
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

/** Resultat fra `dxfTilSvg`: SVG-teksten + viewBox-bredden i TEGNINGSENHETER (vbW),
 * som D5 trenger for å utlede mm/piksel, pluss SVG-ens pikseldimensjoner. */
export interface DxfSvgResultat {
  svg: string;
  /** viewBox-bredde i tegningsenheter (inkl. 2 % marg) — inn i mmPrPiksel-utledningen. */
  vbW: number;
  vbH: number;
  /** SVG-ens faste pikselbredde (2000) og utledede høyde. */
  width: number;
  height: number;
  /** RETUR 2 (vedtak A): auto-detektert geometri-rotasjon (grader, verden CCW) som er
   * BAKT inn i SVG-koordinatene. null = ingen tydelig veggrid → urotert (gyldig). */
  autoRotasjon: number | null;
  /** RETUR 2 §3: startutsnitt som brøk [0,1] av viewBox (x,y,w,h) — der innholdet er
   * tett. Vieweren åpner zoomet hit. null = for lite grunnlag → vis hele. */
  startutsnitt: { x: number; y: number; w: number; h: number } | null;
  /** RETUR 4 (fullstendighet): parset-vs-tegnet pr. type. null for layout-klipp
   * (inventaret gjelder hele DXF-en, ikke klippet). */
  rapport: KonverteringRapport | null;
}

/**
 * SVAR RETUR 6 pkt 2 — teksthøyde. DXF-/CAD-tekst­høyden (gruppe 40) ER versal­høyden
 * (cap height): en tekst med høyde 100 har 100 enheter høye STORE bokstaver, slik
 * TrueView tegner den. SVG `font-size` er derimot EM-kvadratet; for en sans-serif er
 * versalhøyden bare ~0,716 · em. Satte vi `font-size = høyde` ble versalene ~72 % av
 * CAD (målt mot TrueView: kote-tekst vs. sluk-diameter, begge 100 i DXF → vår ~0,72).
 * Deler vi på cap-ratio blir SVG-versalhøyden lik CAD-høyden. */
export const CAP_RATIO = 0.716;
export function fontStr(hoyde: number): number { return hoyde / CAP_RATIO; }

/**
 * SVAR RETUR 6 pkt 3 — MTEXT innfestingspunkt (gruppe 71, 1–9). Posisjonen (gruppe 10)
 * er ett av ni ankerpunkter, ikke alltid venstre grunnlinje. Uten dette ble topp-
 * forankret tekst (att=1, f.eks. areal «9,54 m²») tegnet som grunnlinje-venstre, dvs.
 * skjøvet ~én tekstlinje OPP — opp i romnavnet over (Teknisk rom-kollisjonen). Vi
 * mapper kolonne→`text-anchor` og rad→`dominant-baseline` så ankeret havner på (x,y).
 *   1 TL 2 TC 3 TR · 4 ML 5 MC 6 MR · 7 BL 8 BC 9 BR
 */
export function mtekstForankring(att: number | undefined): string {
  // Default (udefinert eller 7 = bunn-venstre) gir TOM streng → identisk med gammel
  // utskrift (grunnlinje-venstre). Bare ikke-default forankring får attributter, så
  // vanlige tegninger (inkl. Ålesunds bunn-venstre tekst) er uendret.
  if (typeof att !== "number" || att < 1 || att > 9 || att === 7) return "";
  const kol = (att - 1) % 3;                  // 0=venstre 1=senter 2=høyre
  const rad = Math.floor((att - 1) / 3);      // 0=topp 1=midt 2=bunn
  let s = "";
  if (kol === 1) s += ` text-anchor="middle"`;
  else if (kol === 2) s += ` text-anchor="end"`;
  if (rad === 0) s += ` dominant-baseline="text-before-edge"`;
  else if (rad === 1) s += ` dominant-baseline="central"`;
  // rad === 2 (bunn): grunnlinje ≈ posisjon → ingen baseline-attributt (default).
  return s;
}

/** Generer SVG fra parsed DXF-entiteter (normaliserte koordinater) */
export function dxfTilSvg(
  dxfInnhold: string,
  klippBounds?: { minX: number; maxX: number; minY: number; maxY: number },
  opsjoner?: { ingenAutoRotasjon?: boolean },
): DxfSvgResultat | null {
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

    // RETUR 1 pkt 1: lag-farger fra LAYER-tabellen, for BYLAYER-oppslag i dxfFarge.
    const lagFarger: LagFarger = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lagTabell = (dxf as any).tables?.layer?.layers;
    if (lagTabell) {
      for (const [navn, l] of Object.entries(lagTabell)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lg = l as any;
        lagFarger[navn] = { color: lg.color, colorIndex: lg.colorIndex };
      }
    }

    // RETUR 1 pkt 3: HATCH parses fra rå tekst (dxf-parser dropper dem). Blokk-HATCH
    // legges i blokk-kartet så INSERT-utfoldelsen transformerer dem; model-HATCH mates
    // inn i køen direkte (verdenskoordinater).
    const { model: hatchModel, perBlokk: hatchPerBlokk } = parseHatcher(dxfInnhold);
    for (const [bn, hs] of Object.entries(hatchPerBlokk)) {
      if (bn.startsWith("*Paper_Space") || bn.startsWith("*D")) continue;
      if (blokker[bn]) blokker[bn].push(...hs);
      else blokker[bn] = [...hs];
    }
    const antHatchBlokk = Object.values(hatchPerBlokk).reduce((s, a) => s + a.length, 0);
    if (hatchModel.length + antHatchBlokk > 0) {
      console.log(`[DWG] HATCH parset fra rå DXF: ${hatchModel.length} model + ${antHatchBlokk} i blokker`);
    }

    // RETUR 2 TILLEGG: LEADER parses fra rå tekst (dxf-parser dropper dem) — fall-pilene.
    // Samme mønster som HATCH: blokk-LEADER inn i blokk-kartet, model-LEADER i køen.
    const { model: leaderModel, perBlokk: leaderPerBlokk } = parseLeadere(dxfInnhold);
    for (const [bn, ls] of Object.entries(leaderPerBlokk)) {
      if (bn.startsWith("*Paper_Space") || bn.startsWith("*D")) continue;
      if (blokker[bn]) blokker[bn].push(...ls);
      else blokker[bn] = [...ls];
    }
    const antLeaderBlokk = Object.values(leaderPerBlokk).reduce((s, a) => s + a.length, 0);
    if (leaderModel.length + antLeaderBlokk > 0) {
      console.log(`[DWG] LEADER parset fra rå DXF: ${leaderModel.length} model + ${antLeaderBlokk} i blokker`);
    }

    // RETUR 4 (fullstendighet): ATTRIB parses fra rå tekst (dxf-parser dropper dem) —
    // blokk-attributtenes synlige verditekst. Samme mønster: blokk-ATTRIB inn i blokk-
    // kartet (INSERT-utfoldelsen transformerer dem), model-ATTRIB i køen.
    const { model: attribModel, perBlokk: attribPerBlokk } = parseAttrib(dxfInnhold);
    for (const [bn, as] of Object.entries(attribPerBlokk)) {
      if (bn.startsWith("*Paper_Space") || bn.startsWith("*D")) continue;
      if (blokker[bn]) blokker[bn].push(...as);
      else blokker[bn] = [...as];
    }
    const antAttribBlokk = Object.values(attribPerBlokk).reduce((s, a) => s + a.length, 0);
    if (attribModel.length + antAttribBlokk > 0) {
      console.log(`[DWG] ATTRIB parset fra rå DXF: ${attribModel.length} model + ${antAttribBlokk} i blokker`);
    }

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
    type ArbeidsItem = { entity: any; transforms: Array<{ base: { x: number; y: number }; pos: { x: number; y: number }; sx: number; sy: number; cosR: number; sinR: number }> };
    const kø: ArbeidsItem[] = [...modelEntiteter, ...hatchModel, ...leaderModel, ...attribModel].map(e => ({ entity: e, transforms: [] }));

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
        // RETUR 1: trekk fra blokkens base-punkt (DXF BLOCK kode 10). INSERT plasserer
        // blokken slik at base-punktet lander på innsettings-punktet. Uten fradraget
        // dobbel-forskyves verdens-autorerte IFC-blokker (base = innsettingspunkt ≠ 0)
        // — både linjer og HATCH havnet utenfor extents og forsvant. No-op når base=0.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blokkBase = ((dxf as any).blocks?.[e.name]?.position) ?? { x: 0, y: 0 };
        const base = { x: blokkBase.x ?? 0, y: blokkBase.y ?? 0 };
        const nyTransform = { base, pos, sx, sy, cosR: Math.cos(rot), sinR: Math.sin(rot) };
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
            tf: { base: { x: number; y: number }; pos: { x: number; y: number }; sx: number; sy: number; cosR: number; sinR: number }
          ): { x: number; y: number } {
            const bx = punkt.x - tf.base.x;
            const by = punkt.y - tf.base.y;
            const rx = bx * tf.sx * tf.cosR - by * tf.sy * tf.sinR + tf.pos.x;
            const ry = bx * tf.sx * tf.sinR + by * tf.sy * tf.cosR + tf.pos.y;
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
          if (e.hatchLoops) kopi.hatchLoops = e.hatchLoops.map((loop: { x: number; y: number }[]) => loop.map(applyAll));
          if (e.insertionPoint) kopi.insertionPoint = applyAll(e.insertionPoint);
          if (e.controlPoints) kopi.controlPoints = e.controlPoints.map((v: { x: number; y: number }) => applyAll(v));
          if (e.fitPoints) kopi.fitPoints = e.fitPoints.map((v: { x: number; y: number }) => applyAll(v));
          if (e.points) kopi.points = e.points.map((v: { x: number; y: number }) => applyAll(v));
          // D-M12-fiks: skalarstørrelser (sirkel-/bue-radius, teksthøyde) må følge
          // INSERT-skalaen, ellers tegnes en 2×-skalert sirkel med uendret radius.
          // Uniform skala = geometrisk snitt av |sx·sy| gjennom alle nivåer.
          let skala = 1;
          for (const tf of item.transforms) skala *= Math.sqrt(Math.abs(tf.sx * tf.sy));
          if (skala > 0 && skala !== 1) {
            if (typeof e.radius === "number") kopi.radius = e.radius * skala;
            if (typeof e.textHeight === "number") kopi.textHeight = e.textHeight * skala;
            if (typeof e.height === "number") kopi.height = e.height * skala;
          }
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

    // RETUR 2 (vedtak A) — auto-rotasjon. To signaler: veggvinkel (lengdevektet histogram
    // mod 90°) gir aksejevnhet; tekstrotasjonene løser 90°-kvadranten. Rotasjonen BAKES inn
    // i koordinatene under, mens TEXT/MTEXT beholder sin egen rotasjon (motroteres → står
    // vannrett, som arkitektens PDF). Hoppes over ved layout-klipp (klippBounds).
    // RETUR 3 §1: georefererte tegninger (koordinatsystem detektert) skal stå nord-opp —
    // kalleren setter `ingenAutoRotasjon` og veggrid-rotasjonen kobles ut. Uten dette ville
    // en bygning tegnet i UTM/NTM med akse-nær veggrid blitt skjevstilt mot sin egen georef.
    let autoRotasjon: number | null = null;
    if (!klippBounds && !opsjoner?.ingenAutoRotasjon) {
      const segmenter: Segment[] = [];
      const tekstRot: { grader: number; vekt: number }[] = [];
      let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
      const utvid = (x: number, y: number) => {
        if (!gyldigKoordinat(x) || !gyldigKoordinat(y)) return;
        if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x;
        if (y < rMinY) rMinY = y; if (y > rMaxY) rMaxY = y;
      };
      for (const entity of alleEntiteter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = entity as any;
        if (e.type === "INSERT") continue;
        if (e.type === "LINE" && e.startPoint && e.endPoint) {
          segmenter.push({ x1: e.startPoint.x, y1: e.startPoint.y, x2: e.endPoint.x, y2: e.endPoint.y });
        } else if (e.type === "LINE" && e.vertices?.length >= 2) {
          segmenter.push({ x1: e.vertices[0].x, y1: e.vertices[0].y, x2: e.vertices[1].x, y2: e.vertices[1].y });
        } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices?.length > 1) {
          for (let i = 0; i + 1 < e.vertices.length; i++) {
            segmenter.push({ x1: e.vertices[i].x, y1: e.vertices[i].y, x2: e.vertices[i + 1].x, y2: e.vertices[i + 1].y });
          }
        } else if ((e.type === "TEXT" || e.type === "MTEXT") && (e.text || e.startPoint || e.position)) {
          tekstRot.push({ grader: e.rotation ?? 0, vekt: 1 });
        }
        if (e.position) utvid(e.position.x, e.position.y);
        if (e.startPoint) utvid(e.startPoint.x, e.startPoint.y);
        if (e.endPoint) utvid(e.endPoint.x, e.endPoint.y);
        if (e.center) utvid(e.center.x, e.center.y);
        if (e.vertices) for (const v of e.vertices) utvid(v.x, v.y);
      }
      const rotSenter = isFinite(rMinX) ? { x: (rMinX + rMaxX) / 2, y: (rMinY + rMaxY) / 2 } : { x: 0, y: 0 };
      const vegg = dominantVeggvinkel(segmenter);
      if (vegg && vegg.andel >= 0.6) {
        const R = velgAutoRotasjon(vegg.grader, tekstRot);
        if (Math.abs(R) >= 0.5) autoRotasjon = R;
      }
      console.log(`[DWG] Veggvinkel: ${vegg ? `${vegg.grader.toFixed(1)}° (andel ${(vegg.andel * 100).toFixed(0)}%)` : "ingen (for tynt grunnlag/ingen par)"} → auto-rotasjon ${autoRotasjon != null ? autoRotasjon.toFixed(1) + "°" : "null"}`);

      // Bak rotasjonen inn i entitetenes koordinater. TEXT/MTEXT-rotasjonen BEVISST urørt.
      if (autoRotasjon) {
        const rot = (pt: { x: number; y: number }) => roterPunkt(pt, autoRotasjon!, rotSenter);
        const rotVec = (pt: { x: number; y: number }) => roterPunkt(pt, autoRotasjon!, { x: 0, y: 0 });
        const Rrad = (autoRotasjon * Math.PI) / 180;
        for (let i = 0; i < alleEntiteter.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = { ...alleEntiteter[i] };
          if (e.position) e.position = rot(e.position);
          if (e.startPoint) e.startPoint = rot(e.startPoint);
          if (e.endPoint) e.endPoint = rot(e.endPoint);
          if (e.center) e.center = rot(e.center);
          if (e.insertionPoint) e.insertionPoint = rot(e.insertionPoint);
          if (e.vertices) e.vertices = e.vertices.map(rot);
          if (e.hatchLoops) e.hatchLoops = e.hatchLoops.map((l: { x: number; y: number }[]) => l.map(rot));
          if (e.points) e.points = e.points.map(rot);
          if (e.controlPoints) e.controlPoints = e.controlPoints.map(rot);
          if (e.fitPoints) e.fitPoints = e.fitPoints.map(rot);
          // ARC-vinkler (radianer i dxf-parser) følger rotasjonen; ELLIPSE-majoraksen er en
          // vektor relativt senteret → roteres om origo. TEXT/MTEXT e.rotation urørt.
          if (e.type === "ARC") {
            if (typeof e.startAngle === "number") e.startAngle += Rrad;
            if (typeof e.endAngle === "number") e.endAngle += Rrad;
          }
          if (e.type === "ELLIPSE" && e.majorAxisEndPoint) e.majorAxisEndPoint = rotVec(e.majorAxisEndPoint);
          alleEntiteter[i] = e;
        }
      }
    }

    // Pass 1: Finn extents — bruk klippBounds, DXF header, eller persentil-fallback
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
    // D3: godta header-extents bare når de passerer 1e20-vakta; ellers persentil-fallback.
    // RETUR 2: når geometrien er rotert er header-extents (urotert rom) ubrukelige →
    // alltid full min/max på de roterte koordinatene.
    if (!autoRotasjon && extMin && extMax && gyldigeExtents(extMin.x, extMax.x, extMin.y, extMax.y)) {
      minX = extMin.x;
      maxX = extMax.x;
      minY = extMin.y;
      maxY = extMax.y;
      console.log(`[DWG] Bruker DXF header extents: (${minX}, ${minY}) → (${maxX}, ${maxY})`);
    } else {
      // RETUR 1 pkt 7: extents skal dekke ALL gyldig geometri. Tidligere klippet
      // p1/p99-persentilen ekte kantgeometri bort (Ålesund: vegger/kantstein kuttet).
      // Nå tas full min/max; kun sentinel-/søppelkoordinater (|v| ≥ 1e12) kastes.
      let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
      let antall = 0;
      // SVAR RETUR 6 spor 2: samle koordinatene så den robuste grensen kan skrelle
      // bort isolerte ytter-klynger (modullinjer, løse markører) fra extents.
      const samX: number[] = [];
      const samY: number[] = [];

      function saml(x: number, y: number) {
        if (!gyldigKoordinat(x) || !gyldigKoordinat(y)) return;
        if (x < fMinX) fMinX = x;
        if (x > fMaxX) fMaxX = x;
        if (y < fMinY) fMinY = y;
        if (y > fMaxY) fMaxY = y;
        samX.push(x); samY.push(y);
        antall++;
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
        if (e.hatchLoops && Array.isArray(e.hatchLoops)) {
          for (const loop of e.hatchLoops) for (const v of loop) saml(v.x, v.y);
        }
        if (e.insertionPoint) saml(e.insertionPoint.x, e.insertionPoint.y);
      }

      if (antall === 0) return null;
      // SVAR RETUR 6 spor 2: robust grense pr. akse. No-op uten isolerte ytter-klynger
      // (Ålesund uendret); på fallplanen skrelles modullinje-boblene og snittmarkøren.
      // Elementene tegnes fortsatt (de ligger innenfor margin-bounds under) — de styrer
      // bare ikke lenger utstrekningen/startutsnittet.
      const gx = robustGrense(samX);
      const gy = robustGrense(samY);
      minX = gx.lo; maxX = gx.hi; minY = gy.lo; maxY = gy.hi;
      const trimX = ((fMaxX - fMinX) - (maxX - minX));
      const trimY = ((fMaxY - fMinY) - (maxY - minY));
      console.log(`[DWG] Robust extents (${antall} pkt): (${minX.toFixed(0)}, ${minY.toFixed(0)}) → (${maxX.toFixed(0)}, ${maxY.toFixed(0)})` +
        (trimX > 0 || trimY > 0 ? ` [skrelt X ${trimX.toFixed(0)}, Y ${trimY.toFixed(0)} fra full min/max]` : " [full min/max, ingen ytter-klynger]"));
    }
    } // lukk if (!klippBounds)

    if (!isFinite(minX) || !isFinite(maxX)) return null;

    // Beregn dimensjoner og geometri-skala
    const w = maxX - minX;
    const h = maxY - minY;
    const svgBredde = 2000;
    const vbPerPx = w / svgBredde;
    // `sw` er GEOMETRI-skalaen (viewBox-enheter ≈ 1,5 px ved standard visning). Brukes til
    // størrelser som ER geometri og skal skalere med tegningen: pilhoder, punkt-radius og
    // font-fallback. IKKE til stroke-width — se `strekBredde`.
    const sw = vbPerPx * 1.5;
    // RETUR 5 TILLEGG 2 (reparasjon): stroke-width skal være en KONSTANT skjermtykkelse,
    // ikke viewBox-enheter. `vector-effect: non-scaling-stroke` (SVG-ens egen <style>)
    // realiserer stroke-width i SKJERMPIKSLER uansett zoom/viewBox — målt mot kundefila
    // og sharp/librsvg. Da ga `stroke-width = sw` (= vbPerPx·1,5, ~94 enheter på fallplan)
    // ~94 px strek → hele tegningen ble en svart klump i ren <img> (georef-editor, eksport,
    // mobil-WebView). Innholds-extents (startutsnittet, 68 % av vbW) ville gitt ~68 px —
    // fortsatt klump. Målt årsak er altså ikke oppblåste extents, men at et verdensenhet-
    // tall tolkes som skjermpiksler. Fast 1,5 px gir knivskarp strek overalt, og matcher
    // gulvet viewerne allerede injiserer (`calc(1.5 / var(--svg-zoom))`).
    const strekBredde = 1.5;

    // Normalisering: flytt alle koordinater til å starte nær 0. Avrund til ~0,05 px
    // presisjon (adaptivt etter tegningens skala) — kutter SVG-størrelsen kraftig på
    // store planer med full-presisjons IFC-koordinater (fallplan ~14 MB → ~6 MB) uten
    // synlig tap, og beholder desimaler for små tegninger (Ålesund, ~200 enheter brede).
    const koordDesimaler = Math.min(6, Math.max(0, Math.ceil(-Math.log10(Math.max(vbPerPx, 1e-9) * 0.05))));
    const rundFaktor = 10 ** koordDesimaler;
    const rund = (v: number) => Math.round(v * rundFaktor) / rundFaktor;
    const oX = minX;
    const oY = minY;
    function nx(x: number) { return rund(x - oX); }
    function ny(y: number) { return rund(-(y - oY)); }

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
    // HATCH tegnes bak linjene (fyll under kontur), derfor egen bunke som legges først.
    const hatchPaths: string[] = [];
    let ubehandlede = 0;
    let utenforBounds = 0;
    // RETUR 2 §3: punkter (SVG-piksel) fra det som faktisk tegnes → startutsnitt.
    const startPkt: { x: number; y: number }[] = [];

    // Hjelpefunksjon for å legge til lag- og type-attributter på SVG-elementer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function dataAttr(e: any): string {
      const lag = e.layer ? ` data-layer="${escapeXml(String(e.layer))}"` : "";
      return `${lag} data-type="${escapeXml(String(e.type))}"`;
    }

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
      else if (e.hatchLoops && Array.isArray(e.hatchLoops) && e.hatchLoops.some((loop: { x: number; y: number }[]) => loop.some(v => erInnenforBounds(v.x, v.y)))) innenfor = true;
      if (!innenfor) { utenforBounds++; continue; }

      // Samle tegnede punkter (SVG-piksel) for startutsnitt-tettheten.
      if (e.position) startPkt.push({ x: nx(e.position.x), y: ny(e.position.y) });
      if (e.startPoint) startPkt.push({ x: nx(e.startPoint.x), y: ny(e.startPoint.y) });
      if (e.endPoint) startPkt.push({ x: nx(e.endPoint.x), y: ny(e.endPoint.y) });
      if (e.center) startPkt.push({ x: nx(e.center.x), y: ny(e.center.y) });
      if (e.vertices) for (const v of e.vertices) startPkt.push({ x: nx(v.x), y: ny(v.y) });

      const stroke = dxfFarge(e, lagFarger);

      const da = dataAttr(e);
      if (e.type === "HATCH" && e.hatchLoops?.length) {
        // RETUR 1 pkt 3: fyll grensebanene (evenodd gir hull). Mønster-hatch → lys grå,
        // ekte solid → lagfarge. Tegnes bak linjene (hatchPaths).
        const d = e.hatchLoops
          .filter((loop: { x: number; y: number }[]) => loop.length >= 2)
          .map((loop: { x: number; y: number }[]) =>
            "M " + loop.map(v => `${nx(v.x)},${ny(v.y)}`).join(" L ") + " Z")
          .join(" ");
        if (d) hatchPaths.push(`<path d="${d}" fill="${hatchFyll(e, lagFarger)}" fill-rule="evenodd" stroke="none"${da} />`);
      } else if (e.type === "LEADER" && e.vertices?.length >= 2) {
        // RETUR 2 TILLEGG: fall-pil. Tegn knekklinjen + et lite pilhode ved første
        // knekkpunkt (der pilen peker) når kode 71 er satt.
        const pts = e.vertices.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        paths.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
        if (e.harPil) {
          const a = e.vertices[0];
          const b = e.vertices[1];
          const ax = nx(a.x), ay = ny(a.y);
          const dx = ax - nx(b.x), dy = ay - ny(b.y);
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;              // retning pilen peker
          const pilLen = sw * 8, pilBredde = sw * 3;
          const bx = ax - ux * pilLen, by = ay - uy * pilLen; // basis for pilhodet
          const px = -uy, py = ux;                          // normal
          paths.push(`<polygon points="${ax},${ay} ${bx + px * pilBredde},${by + py * pilBredde} ${bx - px * pilBredde},${by - py * pilBredde}" fill="${stroke}" stroke="none"${da} />`);
        }
      } else if (e.type === "LINE" && e.startPoint && e.endPoint) {
        paths.push(`<line x1="${nx(e.startPoint.x)}" y1="${ny(e.startPoint.y)}" x2="${nx(e.endPoint.x)}" y2="${ny(e.endPoint.y)}" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
      } else if (e.type === "LINE" && e.vertices?.length >= 2) {
        const v0 = e.vertices[0];
        const v1 = e.vertices[1];
        paths.push(`<line x1="${nx(v0.x)}" y1="${ny(v0.y)}" x2="${nx(v1.x)}" y2="${ny(v1.y)}" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
      } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices?.length > 1) {
        const pts = e.vertices.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        const lukket = e.shape ? " " + `${nx(e.vertices[0].x)},${ny(e.vertices[0].y)}` : "";
        paths.push(`<polyline points="${pts}${lukket}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
      } else if (e.type === "CIRCLE" && e.center) {
        paths.push(`<circle cx="${nx(e.center.x)}" cy="${ny(e.center.y)}" r="${e.radius ?? 1}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
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
        paths.push(`<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
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
          paths.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
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
          paths.push(`<ellipse cx="${nx(e.center.x)}" cy="${ny(e.center.y)}" rx="${majorLen}" ry="${minorLen}" transform="rotate(${-rotDeg} ${nx(e.center.x)} ${ny(e.center.y)})" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
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
          paths.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
        }
      } else if (e.type === "SOLID" && e.points?.length >= 3) {
        // SOLID: fylt polygon med 3 eller 4 punkter
        // DXF SOLID har spesiell punktrekkefølge: p1, p2, p4, p3 (krysset)
        const p = e.points;
        const pts = p.length === 4
          ? `${nx(p[0].x)},${ny(p[0].y)} ${nx(p[1].x)},${ny(p[1].y)} ${nx(p[3].x)},${ny(p[3].y)} ${nx(p[2].x)},${ny(p[2].y)}`
          : p.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        paths.push(`<polygon points="${pts}" fill="${stroke}" stroke="${stroke}" stroke-width="${strekBredde * 0.5}"${da} />`);
      } else if (e.type === "3DFACE" && e.vertices?.length >= 3) {
        const pts = e.vertices.map((v: { x: number; y: number }) => `${nx(v.x)},${ny(v.y)}`).join(" ");
        paths.push(`<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strekBredde}"${da} />`);
      } else if (e.type === "POINT" && e.position) {
        // RETUR 1 pkt 4: CAD-POINT er en liten node-markør, ikke en stor fylt skive.
        // `r=sw*2` ga en «stor svart prikk» større enn teksten på oppblåste viewBox-er.
        paths.push(`<circle cx="${nx(e.position.x)}" cy="${ny(e.position.y)}" r="${sw * 0.5}" fill="${stroke}"${da} />`);
      } else if (e.type === "TEXT" && e.startPoint && e.text) {
        // SVAR RETUR 6 pkt 2: versalhøyde = CAD-høyde (fontStr deler på cap-ratio).
        const fontSize = fontStr(e.textHeight ?? sw * 10);
        const x = nx(e.startPoint.x);
        const y = ny(e.startPoint.y);
        const rot = e.rotation ? ` transform="rotate(${-e.rotation} ${x} ${y})"` : "";
        paths.push(`<text x="${x}" y="${y}" font-size="${fontSize}" fill="${stroke}"${rot} font-family="sans-serif"${da}>${escapeXml(e.text)}</text>`);
      } else if (e.type === "MTEXT" && e.position && e.text) {
        const fontSize = fontStr(e.height ?? sw * 10);
        const x = nx(e.position.x);
        const y = ny(e.position.y);
        const rot = e.rotation ? ` transform="rotate(${-e.rotation} ${x} ${y})"` : "";
        // SVAR RETUR 6 pkt 3: forankre etter gruppe 71 så ankeret havner på (x,y).
        const forankring = mtekstForankring(e.attachmentPoint);
        // MTEXT kan ha formatering — strip basic DXF formatting codes
        const renTekst = e.text.replace(/\\[A-Za-z][^;]*;/g, "").replace(/\{|\}/g, "");
        paths.push(`<text x="${x}" y="${y}" font-size="${fontSize}" fill="${stroke}"${forankring}${rot} font-family="sans-serif"${da}>${escapeXml(renTekst)}</text>`);
      } else if (e.type === "ATTRIB" && e.position && e.text) {
        // RETUR 4 (fullstendighet): blokk-attributt-verdi. Tegnes som TEXT. Som MTEXT/TEXT
        // beholdes e.rotation urørt av auto-rotasjonen og motroteres rundt eget punkt, så
        // teksten står lesbart (jf. arkitektens PDF). Egen rotasjon mater IKKE kvadrant-
        // histogrammet — det ville flyttet den verifiserte veggrid-rotasjonen.
        const fontSize = fontStr(e.textHeight && e.textHeight > 0 ? e.textHeight : sw * 10);
        const x = nx(e.position.x);
        const y = ny(e.position.y);
        const rot = e.rotation ? ` transform="rotate(${-e.rotation} ${x} ${y})"` : "";
        paths.push(`<text x="${x}" y="${y}" font-size="${fontSize}" fill="${stroke}"${rot} font-family="sans-serif"${da}>${escapeXml(e.text)}</text>`);
      } else if (e.type === "DIMENSION") {
        // Dimensjoner — tegn som linjer mellom punktene
        if (e.anchorPoint && e.middleOfText) {
          paths.push(`<line x1="${nx(e.anchorPoint.x)}" y1="${ny(e.anchorPoint.y)}" x2="${nx(e.middleOfText.x)}" y2="${ny(e.middleOfText.y)}" stroke="${stroke}" stroke-width="${strekBredde * 0.5}"${da} />`);
        }
        if (e.text && e.middleOfText) {
          const fontSize = fontStr(sw * 8);
          paths.push(`<text x="${nx(e.middleOfText.x)}" y="${ny(e.middleOfText.y)}" font-size="${fontSize}" fill="${stroke}" text-anchor="middle" font-family="sans-serif"${da}>${escapeXml(e.text)}</text>`);
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
    console.log(`[DWG] Genererte ${paths.length} SVG-elementer (+ ${hatchPaths.length} HATCH-fyll)`);

    if (paths.length === 0 && hatchPaths.length === 0) return null;

    const svgMargin = Math.max(w, h) * 0.02;
    const vbX = -svgMargin;
    const vbY = -(h + svgMargin);
    const vbW = w + 2 * svgMargin;
    const vbH = h + 2 * svgMargin;

    // D3: en resulterende viewBox som er uendelig, null-stor eller ekstremt avlang
    // (sideforhold utenfor [1/1000, 1000]) er et tegn på degenererte extents → ingen
    // SVG (kalleren setter `failed: ugyldige extents`), aldri en ubrukelig tegneflate.
    if (!gyldigViewBox(vbW, vbH)) {
      console.warn(`[DWG] Ugyldig viewBox (w=${vbW}, h=${vbH}) — avbryter SVG-generering`);
      return null;
    }

    // Faste pikseldimensjoner for å sikre at <img> har intrinsic størrelse
    const svgHoyde = Math.round(svgBredde * (vbH / vbW));

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${svgBredde}" height="${svgHoyde}">
<style>line,polyline,circle,path,ellipse,polygon{vector-effect:non-scaling-stroke}</style>
<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="white"/>
${hatchPaths.join("\n")}
${paths.join("\n")}
</svg>`;

    // RETUR 2 §3: startutsnitt (tettest klynge) som brøk [0,1] av viewBox. Vieweren
    // åpner zoomet hit; resten er fortsatt med og synlig når man zoomer ut.
    const suPix = beregnStartutsnitt(startPkt);
    const startutsnitt = suPix
      ? {
          x: (suPix.x - vbX) / vbW,
          y: (suPix.y - vbY) / vbH,
          w: suPix.w / vbW,
          h: suPix.h / vbH,
        }
      : null;
    if (startutsnitt) {
      console.log(`[DWG] Startutsnitt (brøk): x=${startutsnitt.x.toFixed(2)} y=${startutsnitt.y.toFixed(2)} w=${startutsnitt.w.toFixed(2)} h=${startutsnitt.h.toFixed(2)}`);
    }

    // RETUR 4 (fullstendighet): rapport parset-vs-tegnet. Kun for hovedtegningen —
    // et layout-klipp har hele DXF-ens inventar, men bare klippets geometri tegnet.
    let rapport: KonverteringRapport | null = null;
    if (!klippBounds) {
      const tegnetPrType: Record<string, number> = {};
      for (const m of svg.matchAll(/data-type="([^"]+)"/g)) tegnetPrType[m[1]!] = (tegnetPrType[m[1]!] ?? 0) + 1;
      rapport = byggRapport(tellDxfInventar(dxfInnhold), tegnetPrType);
      const mangler = Object.keys(rapport.ikkeTegnet);
      if (mangler.length) console.warn(`[DWG] FULLSTENDIGHET: typer parset men ikke tegnet: ${JSON.stringify(rapport.ikkeTegnet)}`);
      else console.log(`[DWG] FULLSTENDIGHET: alle ${Object.keys(rapport.parsetPrType).length} DXF-typer tegnet (eller på allowlist)`);
    }

    return { svg, vbW, vbH, width: svgBredde, height: svgHoyde, autoRotasjon, startutsnitt, rapport };
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
 * Konverter en DWG- eller DXF-fil til visnings-SVG + enheter + georeferanse + layouts.
 *
 * D4: `.dxf` leses direkte (hopper over `dwg2dxf`). D5: `$INSUNITS` → mm/piksel,
 * `scale="1:1"`, `scaleKilde="dwg"`. D6: hver layout med viewport/modelBounds
 * KLIPPES til sin egen SVG (aldri samme SVG to ganger).
 *
 * @param filSti    Absolutt sti til DWG/DXF-filen på disk
 * @param filnavn   Originalt filnavn (for koordinatsystem-deteksjon)
 * @param uploadDir Mappe der konverterte filer lagres
 * @param fileType  "dwg" (default) eller "dxf"
 */
export async function konverterDwg(
  filSti: string,
  filnavn: string,
  uploadDir: string,
  fileType: string = "dwg",
): Promise<DwgKonverteringsResultat> {
  const erDxf = fileType.toLowerCase() === "dxf";
  const tomMaaling: DwgMaaling = { mmPrPiksel: null, scale: null, scaleKilde: null, imageWidth: null, imageHeight: null };

  // DXF trenger ingen libredwg-konverterer (leses direkte); DWG gjør det.
  if (!erDxf && !(await sjekkLibreDwg())) {
    return {
      ...tomMaaling,
      visningUrl: "", visningFilType: "", koordinatSystem: null, geoReferanse: null,
      feil: "DWG-konvertering (libredwg) er ikke tilgjengelig på denne serveren.",
      layouts: [],
      autoRotasjon: null,
      startutsnitt: null,
      rapport: null,
    };
  }

  const filDir = dirname(filSti);
  // libredwg legger DXF-en ved siden av kildefila med samme base + .dxf
  const libreDxfSti = join(filDir, `${basename(filSti).replace(/\.[^.]+$/, "")}.dxf`);
  let ryddDxf = false;

  try {
    // 1. Skaff DXF-tekst. D4: DXF leses direkte; DWG konverteres via libredwg.
    let dxfInnhold: string | null = null;
    if (erDxf) {
      dxfInnhold = await readFile(filSti, "utf-8");
      console.log(`[DWG] DXF lest direkte (${(dxfInnhold.length / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      try { await unlink(libreDxfSti); } catch { /* OK */ }
      try {
        // NB (DWG-2, målt 2026-10-08): IKKE `--as r2000`. Nedgraderingen fra AC1032
        // (AutoCAD 2018) til r2000 DROPPER model space-entitetene i libredwg 0.14 for
        // Ålesund-fixturene (tom ENTITIES-seksjon → dxf-parser fikk 0 entiteter → fall
        // til dwg2SVG som hang i minutter). Native DXF beholder alle 761 entitetene og
        // dxf-parser leser dem på ~40 ms. Behold versjonen libredwg velger selv.
        await execFileAsync(DWG2DXF, ["-y", filSti], {
          timeout: 300000, cwd: filDir, maxBuffer: 200 * 1024 * 1024,
        });
        dxfInnhold = await readFile(libreDxfSti, "utf-8");
        ryddDxf = true;
        console.log(`[DWG] DXF lest via libredwg (${(dxfInnhold.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        console.warn("[DWG] libredwg konvertering feilet:", err);
      }
    }

    // 2. Extents (georef) + enheter (D5)
    const extents = dxfInnhold ? beregnExtents(dxfInnhold) : null;
    if (extents) console.log("[DWG] Extents:", JSON.stringify(extents));
    const mmPrEnhet = dxfInnhold ? insunitsTilMm(lesInsunits(dxfInnhold)) : null;
    console.log(`[DWG] $INSUNITS → mm/enhet: ${mmPrEnhet ?? "ukjent (måling låses til kalibrering)"}`);

    // RETUR 3 §1: CRS-deteksjon og veggrid-rotasjon kobles. Detekteres et koordinatsystem
    // (filnavn eller norske koordinatverdier), er tegningen i verdenskoordinater og skal stå
    // nord-opp — auto-rotasjonen fra veggrid kobles ut (`ingenAutoRotasjon`), så den uroterte
    // geometrien og den uroterte-extents-baserte georefen (under) forblir konsistente.
    const system = dxfInnhold ? detekterKoordinatSystem(filnavn, extents ?? undefined) : null;
    console.log("[DWG] Detektert koordinatsystem:", system);

    // 3. SVG fra egen DXF-parser → hovedtegningens måling (D5)
    let visningUrl = "";
    let visningFilType = "";
    let maaling: DwgMaaling = tomMaaling;
    let autoRotasjon: number | null = null;
    let startutsnitt: { x: number; y: number; w: number; h: number } | null = null;
    let rapport: KonverteringRapport | null = null;
    const svgRes = dxfInnhold ? dxfTilSvg(dxfInnhold, undefined, { ingenAutoRotasjon: !!system }) : null;
    if (svgRes) {
      const svgFilnavn = `${randomUUID()}.svg`;
      await writeFile(join(uploadDir, svgFilnavn), svgRes.svg, "utf-8");
      visningUrl = `/uploads/${svgFilnavn}`;
      visningFilType = "svg";
      maaling = utledDwgMaaling(svgRes.vbW, svgRes.width, svgRes.height, mmPrEnhet);
      autoRotasjon = svgRes.autoRotasjon;
      startutsnitt = svgRes.startutsnitt;
      rapport = svgRes.rapport;
      console.log(`[DWG] SVG generert (mm/px=${maaling.mmPrPiksel ?? "null"}, scaleKilde=${maaling.scaleKilde ?? "null"}, rotasjon=${autoRotasjon ?? "null"})`);
    }

    // Fallback: dwg2SVG (kun DWG). Ingen måling/inspeksjon (visningKilde=dwg2SVG) — D5/§6.
    if (!visningUrl && !erDxf) {
      try {
        const { stdout } = await execFileAsync(DWG2SVG, [filSti], {
          timeout: 120000, cwd: filDir, maxBuffer: 50 * 1024 * 1024,
        });
        if (stdout && stdout.includes("<svg")) {
          const svgFilnavn = `${randomUUID()}.svg`;
          await writeFile(join(uploadDir, svgFilnavn), stdout, "utf-8");
          visningUrl = `/uploads/${svgFilnavn}`;
          visningFilType = "svg";
          console.log("[DWG] SVG generert via dwg2SVG (fallback, uten måling)");
        }
      } catch (svgErr) {
        console.warn("[DWG] dwg2SVG feilet:", svgErr);
      }
    }

    // 4. Layouts (D6): KUN layouts med viewport/modelBounds, hver KLIPPET til egen SVG
    // (aldri samme SVG to ganger). Layouts uten viewport er tomme paper space-faner —
    // hoppes over (modelspace er tegningen, Kenneth Q1).
    const layoutResultater: DwgLayoutResultat[] = [];
    if (dxfInnhold && visningFilType === "svg" && svgRes) {
      for (const layout of parseLayouts(dxfInnhold)) {
        if (!layout.modelBounds) {
          console.log(`[DWG] Hopper over layout "${layout.navn}" (ingen viewport/modelBounds)`);
          continue;
        }
        const klippet = dxfTilSvg(dxfInnhold, layout.modelBounds);
        if (!klippet) {
          console.warn(`[DWG] Layout "${layout.navn}" ga ingen SVG (ugyldig klipp) — hoppet over`);
          continue;
        }
        const svgFilnavn = `${randomUUID()}.svg`;
        await writeFile(join(uploadDir, svgFilnavn), klippet.svg, "utf-8");
        layoutResultater.push({
          navn: layout.navn,
          tabOrder: layout.tabOrder,
          visningUrl: `/uploads/${svgFilnavn}`,
          visningFilType: "svg",
          ...utledDwgMaaling(klippet.vbW, klippet.width, klippet.height, mmPrEnhet),
        });
        console.log(`[DWG] Layout "${layout.navn}" opprettet (klippet SVG)`);
      }
    }

    // 5. Georeferanse (D7 forbedrer hjørnene senere). `system` er detektert over (RETUR 3 §1),
    // og auto-rotasjon er da koblet ut → SVG-en er urotert, konsistent med disse hjørnene.
    let geoReferanse: GeoReferanse | null = null;
    if (system && system !== "wgs84" && extents) {
      const topVenstre = konverterTilWgs84(extents.maxY, extents.minX, system);
      const bunnHoyre = konverterTilWgs84(extents.minY, extents.maxX, system);
      if (topVenstre && bunnHoyre) {
        geoReferanse = {
          point1: { pixel: { x: 0, y: 0 }, gps: { lat: topVenstre.lat, lng: topVenstre.lng } },
          point2: { pixel: { x: 100, y: 100 }, gps: { lat: bunnHoyre.lat, lng: bunnHoyre.lng } },
        };
        console.log("[DWG] Auto-georeferanse:", JSON.stringify(geoReferanse));
      }
    }

    if (ryddDxf) { try { await unlink(libreDxfSti); } catch { /* OK */ } }

    const feil = visningUrl
      ? null
      : dxfInnhold
        ? "Kunne ikke utlede et gyldig tegningsområde (ugyldige extents eller ingen gjenkjent geometri)."
        : "Kunne ikke lese DXF fra filen.";

    return {
      ...maaling,
      visningUrl,
      visningFilType,
      koordinatSystem: system,
      geoReferanse,
      feil,
      layouts: layoutResultater,
      autoRotasjon,
      startutsnitt,
      rapport,
    };
  } catch (err) {
    console.error("[DWG] Konvertering feilet:", err);
    if (ryddDxf) { try { await unlink(libreDxfSti); } catch { /* OK */ } }
    return {
      ...tomMaaling,
      visningUrl: "", visningFilType: "", koordinatSystem: null, geoReferanse: null,
      feil: err instanceof Error ? err.message : "Ukjent konverteringsfeil",
      layouts: [],
      autoRotasjon: null,
      startutsnitt: null,
      rapport: null,
    };
  }
}
