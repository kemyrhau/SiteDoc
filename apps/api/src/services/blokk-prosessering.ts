/**
 * Blokkbasert PDF-prosessering for flerspråklig dokumentvisning.
 *
 * Ekstraher ordnede blokker (heading, text, image, caption, table)
 * fra PDF-sider via pdfjs-dist. Bilder lagres til disk, tekst
 * lagres som FtdDocumentBlock med språk og rekkefølge.
 */
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@sitedoc/db";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Overskrift: nummerert (f.eks. "3.2.1 Betongarbeid") eller ALL CAPS med min 3 ord
const OVERSKRIFT_REGEX = /^(\d+(?:\.\d+)*)\s+(.+)/;

interface RåBlokk {
  type: "heading" | "text" | "image" | "caption" | "table";
  content: string;
  pageNumber: number;
  headingLevel?: number;
  imageUrl?: string;
}

/**
 * Generer blokker fra en PDF-buffer og lagre til database.
 */
export async function genererBlokker(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  _ext: string,
  sourceLanguage: string = "nb",
): Promise<number> {
  const blokker = await ekstraherBlokkerFraPdf(buffer, documentId);

  if (blokker.length === 0) return 0;

  // Slett eksisterende blokker for dette dokumentet (kildespråk)
  await prisma.ftdDocumentBlock.deleteMany({
    where: { documentId, language: sourceLanguage },
  });

  // Lagre blokker med kildespråk
  await prisma.ftdDocumentBlock.createMany({
    data: blokker.map((b, i) => ({
      id: randomUUID(),
      documentId,
      sortOrder: i,
      pageNumber: b.pageNumber,
      blockType: b.type,
      language: sourceLanguage,
      content: b.content,
      headingLevel: b.headingLevel ?? null,
      imageUrl: b.imageUrl ?? null,
      embeddingState: b.type === "image" ? "skipped" : "pending",
    })),
  });

  return blokker.length;
}

/**
 * Analyser PDF-side: er den skannet (bilde med OCR-lag) eller tekstbasert?
 *
 * Heuristikk:
 * - Skannet: 1 stort bilde som dekker >60% av sidearealet, lite tekst
 * - Tekstbasert: flere tekstelementer, bilder er illustrasjoner
 */
interface CachetBilde {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface SideAnalyse {
  type: "skannet" | "tekst";
  rader: Map<number, Array<{ x: number; tekst: string; fontSize: number }>>;
  bilder: CachetBilde[];
  viewport: { width: number; height: number };
}

async function analyserSide(
  page: { getTextContent: () => Promise<{ items: unknown[] }>; getViewport: (opts: { scale: number }) => { width: number; height: number }; getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>; objs: { get: (name: string, callback?: (data: unknown) => void) => unknown } },
  OPS: { paintImageXObject: number },
): Promise<SideAnalyse> {
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  // Grupper tekstelementer etter y-posisjon
  const rader = new Map<number, Array<{ x: number; tekst: string; fontSize: number }>>();
  let totaleTegn = 0;
  for (const item of content.items) {
    const el = item as { str?: string; transform?: number[]; height?: number };
    if (!el.str?.trim() || !el.transform) continue;
    totaleTegn += el.str.trim().length;
    const y = Math.round(el.transform[5]! / 3) * 3;
    const x = Math.round(el.transform[4]!);
    const fontSize = Math.abs(el.transform[0]!);
    if (!rader.has(y)) rader.set(y, []);
    rader.get(y)!.push({ x, tekst: el.str.trim(), fontSize });
  }

  // Finn bilder — cache data for å unngå dobbelt-henting
  const opList = await page.getOperatorList();
  const bilder: CachetBilde[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === OPS.paintImageXObject) {
      const imgName = opList.argsArray[i]![0] as string;
      const imgData = await hentBildeData(page, imgName);
      if (imgData && imgData.width > 150 && imgData.height > 150) {
        bilder.push(imgData);
      }
    }
  }

  // Avgjør type: skannet vs tekst
  const sideAreal = viewport.width * viewport.height;
  const størsteBilde = bilder.length > 0
    ? Math.max(...bilder.map((b) => b.width * b.height))
    : 0;
  const bildeDekning = sideAreal > 0 ? størsteBilde / sideAreal : 0;
  const erSkannet = bilder.length <= 2 && bildeDekning > 0.4 && totaleTegn < 1000;

  return { type: erSkannet ? "skannet" : "tekst", rader, bilder, viewport };
}

/**
 * Ekstraher ordnede blokker fra PDF via pdfjs-dist.
 * Analyserer hver side for å velge riktig strategi.
 */
async function ekstraherBlokkerFraPdf(
  buffer: Buffer,
  documentId: string,
): Promise<RåBlokk[]> {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const alleBlokker: RåBlokk[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const analyse = await analyserSide(page, OPS);

    if (analyse.type === "skannet") {
      await prosesserSkannetSide(analyse, alleBlokker, documentId, p);
    } else {
      await prosesserTekstSide(analyse, alleBlokker, documentId, p);
    }
  }

  await doc.destroy();
  return alleBlokker;
}

/**
 * Skannet side: lagre store bilder direkte, OCR-tekst som tekstblokker mellom bildene.
 */
async function prosesserSkannetSide(
  analyse: SideAnalyse,
  alleBlokker: RåBlokk[],
  documentId: string,
  sideNr: number,
): Promise<void> {
  // Lagre bilder (typisk 1 stort bilde per skannet side) — data allerede cachet
  let bildeNr = 0;
  for (const bilde of analyse.bilder) {
    try {
      const bildeUrl = await lagreBilde(documentId, sideNr, bildeNr++, bilde);
      alleBlokker.push({ type: "image", content: "", pageNumber: sideNr, imageUrl: bildeUrl });
    } catch (err) {
      console.error(`Bilde s${sideNr}_b${bildeNr - 1} feilet (${bilde.width}x${bilde.height}, data: ${bilde.data.length}):`, (err as Error).message);
    }
  }

  // OCR-tekst som enkelt tekstblokk (hvis noe finnes)
  const tekst = [...analyse.rader.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([_y, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.tekst).join(" "))
    .join("\n")
    .trim();

  if (tekst.length > 10) {
    alleBlokker.push({ type: "text", content: tekst, pageNumber: sideNr });
  }
}

/**
 * Tekstbasert side: ekstraher overskrifter, tekst, bilder og bildetekster.
 */
async function prosesserTekstSide(
  analyse: SideAnalyse,
  alleBlokker: RåBlokk[],
  documentId: string,
  sideNr: number,
): Promise<void> {
  // Sorter rader topp→bunn
  const sortertRader = [...analyse.rader.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([_y, items]) => {
      items.sort((a, b) => a.x - b.x);
      return items;
    });

  // Gjennomsnittlig fontstørrelse
  const fontStørrelser = sortertRader.flat().map((i) => i.fontSize).filter((f) => f > 0);
  const gjennomsnittFont = fontStørrelser.length > 0
    ? fontStørrelser.reduce((a, b) => a + b, 0) / fontStørrelser.length
    : 10;

  // Lagre illustrasjonsbilder — data allerede cachet
  let bildeNr = 0;
  for (const bilde of analyse.bilder) {
    try {
      const bildeUrl = await lagreBilde(documentId, sideNr, bildeNr++, bilde);
      alleBlokker.push({ type: "image", content: "", pageNumber: sideNr, imageUrl: bildeUrl });
    } catch (err) {
      console.error(`Bilde s${sideNr}_b${bildeNr - 1} feilet (${bilde.width}x${bilde.height}, data: ${bilde.data.length}):`, (err as Error).message);
    }
  }

  // Bygg tekst-blokker fra rader
  let currentText = "";
  let currentType: "heading" | "text" = "text";

  for (const items of sortertRader) {
    const linje = items.map((i) => i.tekst).join(" ").trim();
    if (!linje) continue;

    const maxFont = Math.max(...items.map((i) => i.fontSize));
    const erOverskrift = maxFont > gjennomsnittFont * 1.15 || OVERSKRIFT_REGEX.test(linje);

    if (erOverskrift) {
      if (currentText.trim()) {
        alleBlokker.push({ type: currentType, content: currentText.trim(), pageNumber: sideNr });
        currentText = "";
      }
      const match = linje.match(OVERSKRIFT_REGEX);
      const nivå = match ? match[1]!.split(".").length : 1;
      alleBlokker.push({
        type: "heading",
        content: linje,
        pageNumber: sideNr,
        headingLevel: Math.min(nivå, 6),
      });
      currentType = "text";
    } else {
      if (/^(Figur|Fig\.|Bilde|Tabell|Table|Figure)\s/i.test(linje) && linje.length < 200) {
        if (currentText.trim()) {
          alleBlokker.push({ type: "text", content: currentText.trim(), pageNumber: sideNr });
          currentText = "";
        }
        alleBlokker.push({ type: "caption", content: linje, pageNumber: sideNr });
      } else {
        currentText += (currentText ? "\n" : "") + linje;
      }
    }
  }

  if (currentText.trim()) {
    alleBlokker.push({ type: currentType, content: currentText.trim(), pageNumber: sideNr });
  }
}

/**
 * Hent bildedata fra en PDF-side via objekt-navn.
 * Bruker callback-mønster for å vente på asynkront lastede objekter.
 */
async function hentBildeData(
  page: { objs: { get: (name: string, callback?: (data: unknown) => void) => unknown } },
  imgName: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  try {
    const imgObj = await new Promise<{
      data?: Uint8ClampedArray;
      width?: number;
      height?: number;
    } | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10000);
      page.objs.get(imgName, (obj: unknown) => {
        clearTimeout(timeout);
        resolve(obj as { data?: Uint8ClampedArray; width?: number; height?: number } | null);
      });
    });
    if (imgObj?.data && imgObj.width && imgObj.height) {
      return { data: imgObj.data, width: imgObj.width, height: imgObj.height };
    }
  } catch {
    // Ignorer
  }
  return null;
}

/**
 * Lagre råbildedata som PNG til disk.
 * Returnerer relativ URL for S3/uploads.
 */
async function lagreBilde(
  documentId: string,
  sideNr: number,
  bildeNr: number,
  imgData: { data: Uint8ClampedArray; width: number; height: number },
): Promise<string> {
  // Konverter RGBA til enkel PNG via minimal header
  const pngBuffer = rgbaToPng(imgData.data, imgData.width, imgData.height);

  const mappeNavn = `documents/${documentId}/images`;
  const filnavn = `s${sideNr}_b${bildeNr}.png`;
  const fullSti = join(UPLOADS_DIR, mappeNavn);

  await mkdir(fullSti, { recursive: true });
  await writeFile(join(fullSti, filnavn), pngBuffer);

  return `/uploads/${mappeNavn}/${filnavn}`;
}

/**
 * Konverter bildedata til RGBA (pdfjs-dist kan returnere RGB eller RGBA).
 */
function tilRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const forventetRgba = width * height * 4;
  if (data.length >= forventetRgba) return data; // Allerede RGBA

  // RGB → RGBA
  const rgba = new Uint8ClampedArray(forventetRgba);
  const piksler = width * height;
  for (let i = 0; i < piksler; i++) {
    rgba[i * 4] = data[i * 3]!;
    rgba[i * 4 + 1] = data[i * 3 + 1]!;
    rgba[i * 4 + 2] = data[i * 3 + 2]!;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Skaler ned store bilder til maks 1600px bredde for å spare disk og minne.
 */
function skalerNed(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const MAKS_BREDDE = 1600;
  if (width <= MAKS_BREDDE) return { data, width, height };

  const skala = MAKS_BREDDE / width;
  const nyBredde = Math.round(width * skala);
  const nyHøyde = Math.round(height * skala);
  const nyData = new Uint8ClampedArray(nyBredde * nyHøyde * 4);

  for (let y = 0; y < nyHøyde; y++) {
    const kildeY = Math.min(Math.round(y / skala), height - 1);
    for (let x = 0; x < nyBredde; x++) {
      const kildeX = Math.min(Math.round(x / skala), width - 1);
      const srcIdx = (kildeY * width + kildeX) * 4;
      const dstIdx = (y * nyBredde + x) * 4;
      nyData[dstIdx] = data[srcIdx]!;
      nyData[dstIdx + 1] = data[srcIdx + 1]!;
      nyData[dstIdx + 2] = data[srcIdx + 2]!;
      nyData[dstIdx + 3] = data[srcIdx + 3]!;
    }
  }
  return { data: nyData, width: nyBredde, height: nyHøyde };
}

/**
 * Bildedata → PNG via zlib. Håndterer RGB og RGBA fra pdfjs-dist.
 */
function rgbaToPng(
  inputData: Uint8ClampedArray,
  inputWidth: number,
  inputHeight: number,
): Buffer {
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");

  // Konverter til RGBA hvis nødvendig (pdfjs-dist kan gi RGB)
  const rgbaData = tilRgba(inputData, inputWidth, inputHeight);

  // Verifiser at data-lengde matcher dimensjoner
  const forventet = inputWidth * inputHeight * 4;
  if (rgbaData.length < forventet) {
    throw new Error(`RGBA data for kort: ${rgbaData.length} < ${forventet} (${inputWidth}x${inputHeight})`);
  }

  // Skaler ned store bilder
  const { data, width, height } = skalerNed(rgbaData, inputWidth, inputHeight);

  // PNG IDAT: filterbyte (0 = None) foran hver rad, deretter RGBA-piksler
  const radBredde = width * 4;
  const rawLen = height * (1 + radBredde);
  const raw = Buffer.alloc(rawLen);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + radBredde);
    raw[rowOffset] = 0; // filter: None
    const srcStart = y * radBredde;
    for (let i = 0; i < radBredde; i++) {
      raw[rowOffset + 1 + i] = data[srcStart + i] ?? 0;
    }
  }
  const compressed = deflateSync(raw);

  // CRC32-beregning
  const crcTabell = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTabell[n] = c;
  }
  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTabell[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, payload: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), payload]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  // IHDR: width, height, 8-bit, RGBA (colorType=6)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bitDepth
  ihdr[9] = 6;  // colorType RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), iend]);
}
