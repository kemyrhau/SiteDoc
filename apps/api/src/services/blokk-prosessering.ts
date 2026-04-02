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
  const råBlokker = await ekstraherBlokkerFraPdf(buffer, documentId);
  const blokker = slåSammenBildetekster(råBlokker);

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
 * Etterprosessering: slå sammen sammenhengende captions til én blokk,
 * og koble caption-blokker til forutgående bilde-blokk.
 *
 * Mønster i Dalux-rapporter:
 *   [bilde] [bilde] [bilde] [caption: "1.3, 2022-06-29"] [caption: "1.4, 2022-06-29"]
 * Ønsket resultat:
 *   [bilde] [bilde] [bilde] [caption: "1.3, 2022-06-29 · 1.4, 2022-06-29"]
 */
function slåSammenBildetekster(blokker: RåBlokk[]): RåBlokk[] {
  const resultat: RåBlokk[] = [];

  for (let i = 0; i < blokker.length; i++) {
    const blokk = blokker[i]!;

    if (blokk.type === "caption") {
      // Samle sammenhengende captions
      let samlet = blokk.content;
      while (i + 1 < blokker.length && blokker[i + 1]!.type === "caption") {
        i++;
        samlet += " " + blokker[i]!.content;
      }
      resultat.push({ ...blokk, content: samlet });
    } else {
      resultat.push(blokk);
    }
  }

  return resultat;
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
  opIndex: number; // Sekvensiell indeks i PDF-operatørlisten
}

interface SideAnalyse {
  type: "skannet" | "tekst";
  rader: Map<number, Array<{ x: number; tekst: string; fontSize: number }>>;
  bilder: CachetBilde[];
  viewport: { width: number; height: number };
}

async function analyserSide(
  page: { getTextContent: () => Promise<{ items: unknown[] }>; getViewport: (opts: { scale: number }) => { width: number; height: number }; getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>; objs: { get: (name: string, callback?: (data: unknown) => void) => unknown } },
  OPS: { paintImageXObject: number; transform: number },
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

  // Finn bilder med Y-posisjon via transform-operatører
  const opList = await page.getOperatorList();
  const bilder: CachetBilde[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === OPS.paintImageXObject) {
      const imgName = opList.argsArray[i]![0] as string;
      const imgData = await hentBildeData(page, imgName);
      if (imgData && imgData.width > 150 && imgData.height > 150) {
        bilder.push({ ...imgData, opIndex: i });
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
 * Tekstbasert side: ekstraher bilder og tekst, koble bildetekster 1:1 til bilder.
 *
 * Typisk mønster i befaringsrapporter:
 *   PDF: [bilder] [overskrift] [metadata] [bildetekster]
 *   Vi vil ha: [bilde + caption] [bilde + caption] ... [overskrift] [metadata]
 */
async function prosesserTekstSide(
  analyse: SideAnalyse,
  alleBlokker: RåBlokk[],
  documentId: string,
  sideNr: number,
): Promise<void> {
  const sortertRader = [...analyse.rader.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([_y, items]) => {
      items.sort((a, b) => a.x - b.x);
      return items;
    });

  const fontStørrelser = sortertRader.flat().map((i) => i.fontSize).filter((f) => f > 0);
  const gjennomsnittFont = fontStørrelser.length > 0
    ? fontStørrelser.reduce((a, b) => a + b, 0) / fontStørrelser.length
    : 10;

  const BILDETEKST_REGEX = /^(\d+\.\s*\d+,\s*\d{4}-\d{2}-\d{2}|Figur|Fig\.|Bilde|Tabell|Table|Figure)/i;
  // Regex for individuelle bildetekster: "1. 3, 2022-06-28, 08.39"
  const ENKELT_BILDETEKST = /\d+\.\s*\d+,\s*\d{4}-\d{2}-\d{2},?\s*\d{2}[.:]\d{2}/g;

  // Steg 1: Lagre bilder
  const bildeUrler: string[] = [];
  let bildeNr = 0;
  for (const bilde of analyse.bilder) {
    try {
      bildeUrler.push(await lagreBilde(documentId, sideNr, bildeNr++, bilde));
    } catch (err) {
      console.error(`Bilde s${sideNr}_b${bildeNr - 1} feilet:`, (err as Error).message);
    }
  }

  // Steg 2: Prosesser tekst — skill bildetekster fra resten
  const bildetekster: string[] = [];
  const andreBlokker: RåBlokk[] = [];
  let currentText = "";

  for (const items of sortertRader) {
    const linje = items.map((i) => i.tekst).join(" ").trim();
    if (!linje) continue;

    const maxFont = Math.max(...items.map((i) => i.fontSize));
    const erOverskrift = maxFont > gjennomsnittFont * 1.15 || OVERSKRIFT_REGEX.test(linje);

    if (erOverskrift) {
      if (currentText.trim()) {
        andreBlokker.push({ type: "text", content: currentText.trim(), pageNumber: sideNr });
        currentText = "";
      }
      const match = linje.match(OVERSKRIFT_REGEX);
      const nivå = match ? match[1]!.split(".").length : 1;
      andreBlokker.push({ type: "heading", content: linje, pageNumber: sideNr, headingLevel: Math.min(nivå, 6) });
    } else if (BILDETEKST_REGEX.test(linje) && linje.length < 200) {
      if (currentText.trim()) {
        andreBlokker.push({ type: "text", content: currentText.trim(), pageNumber: sideNr });
        currentText = "";
      }
      // Splitt sammenslåtte: "1. 3, 2022-06-28, 08.39 1. 4, 2022-06-28, 08.31"
      const enkelt = linje.match(ENKELT_BILDETEKST);
      if (enkelt) {
        bildetekster.push(...enkelt);
      } else {
        bildetekster.push(linje);
      }
    } else {
      currentText += (currentText ? "\n" : "") + linje;
    }
  }
  if (currentText.trim()) {
    andreBlokker.push({ type: "text", content: currentText.trim(), pageNumber: sideNr });
  }

  // Steg 3: Bygg resultat — bilde + bildetekst parvis
  for (let i = 0; i < bildeUrler.length; i++) {
    alleBlokker.push({ type: "image", content: "", pageNumber: sideNr, imageUrl: bildeUrler[i]! });
    if (i < bildetekster.length) {
      alleBlokker.push({ type: "caption", content: bildetekster[i]!, pageNumber: sideNr });
    }
  }
  // Overskytende bildetekster
  for (let i = bildeUrler.length; i < bildetekster.length; i++) {
    alleBlokker.push({ type: "caption", content: bildetekster[i]!, pageNumber: sideNr });
  }

  // Steg 4: Resten av teksten (overskrifter, metadata)
  alleBlokker.push(...andreBlokker);
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
 * Lagre bildedata som komprimert JPEG (300-400KB) via sharp.
 * Returnerer relativ URL for uploads.
 */
async function lagreBilde(
  documentId: string,
  sideNr: number,
  bildeNr: number,
  imgData: { data: Uint8ClampedArray; width: number; height: number },
): Promise<string> {
  const sharp = (await import("sharp")).default;

  // Konverter til RGBA hvis nødvendig
  const rgbaData = tilRgba(imgData.data, imgData.width, imgData.height);

  // Sharp: raw RGBA → JPEG med maks 1200px bredde, 80% kvalitet
  const jpegBuffer = await sharp(Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength), {
    raw: { width: imgData.width, height: imgData.height, channels: 4 },
  })
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const mappeNavn = `documents/${documentId}/images`;
  const filnavn = `s${sideNr}_b${bildeNr}.jpg`;
  const fullSti = join(UPLOADS_DIR, mappeNavn);

  await mkdir(fullSti, { recursive: true });
  await writeFile(join(fullSti, filnavn), jpegBuffer);

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

// skalerNed og rgbaToPng er erstattet av sharp i lagreBilde()
