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
 * Ekstraher ordnede blokker fra PDF via pdfjs-dist.
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

    // 1. Ekstraher tekst med posisjoner
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const sideHøyde = viewport.height;

    // Grupper tekstelementer etter y-posisjon
    const rader = new Map<number, Array<{ x: number; tekst: string; fontSize: number }>>();
    for (const item of content.items) {
      const el = item as { str?: string; transform?: number[]; height?: number };
      if (!el.str?.trim() || !el.transform) continue;
      const y = Math.round(el.transform[5]! / 3) * 3;
      const x = Math.round(el.transform[4]!);
      const fontSize = Math.abs(el.transform[0]!);
      if (!rader.has(y)) rader.set(y, []);
      rader.get(y)!.push({ x, tekst: el.str.trim(), fontSize });
    }

    // Sorter rader topp→bunn (høy y = topp i PDF)
    const sortertRader = [...rader.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([_y, items]) => {
        items.sort((a, b) => a.x - b.x);
        return items;
      });

    // Beregn gjennomsnittlig fontstørrelse for å detektere overskrifter
    const fontStørrelser = sortertRader.flat().map((i) => i.fontSize).filter((f) => f > 0);
    const gjennomsnittFont = fontStørrelser.length > 0
      ? fontStørrelser.reduce((a, b) => a + b, 0) / fontStørrelser.length
      : 10;

    // 2. Ekstraher bilder
    const opList = await page.getOperatorList();
    let bildeNr = 0;
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === OPS.paintImageXObject) {
        const imgName = opList.argsArray[i]![0] as string;
        try {
          const imgData = await hentBildeData(page, imgName);
          if (imgData && imgData.width > 50 && imgData.height > 50) {
            const bildeUrl = await lagreBilde(documentId, p, bildeNr++, imgData);
            // Sett inn bilde-blokk basert på operatørens posisjon i strømmen
            alleBlokker.push({
              type: "image",
              content: "",
              pageNumber: p,
              imageUrl: bildeUrl,
            });
          }
        } catch {
          // Ignorer bilder som ikke kan ekstraheres
        }
      }
    }

    // 3. Bygg tekst-blokker fra rader
    let currentText = "";
    let currentType: "heading" | "text" = "text";

    for (const items of sortertRader) {
      const linje = items.map((i) => i.tekst).join(" ").trim();
      if (!linje) continue;

      const maxFont = Math.max(...items.map((i) => i.fontSize));
      const erOverskrift = maxFont > gjennomsnittFont * 1.15 || OVERSKRIFT_REGEX.test(linje);

      if (erOverskrift) {
        // Flush akkumulert tekst
        if (currentText.trim()) {
          alleBlokker.push({
            type: currentType,
            content: currentText.trim(),
            pageNumber: p,
          });
          currentText = "";
        }
        // Bestem overskriftsnivå
        const match = linje.match(OVERSKRIFT_REGEX);
        const nivå = match ? match[1]!.split(".").length : 1;
        alleBlokker.push({
          type: "heading",
          content: linje,
          pageNumber: p,
          headingLevel: Math.min(nivå, 6),
        });
        currentType = "text";
      } else {
        // Sjekk om dette er en bildetekst (kort linje, starter med "Figur", "Bilde", "Tabell")
        if (/^(Figur|Fig\.|Bilde|Tabell|Table|Figure)\s/i.test(linje) && linje.length < 200) {
          if (currentText.trim()) {
            alleBlokker.push({ type: "text", content: currentText.trim(), pageNumber: p });
            currentText = "";
          }
          alleBlokker.push({ type: "caption", content: linje, pageNumber: p });
        } else {
          currentText += (currentText ? "\n" : "") + linje;
        }
      }
    }

    // Flush siste blokk
    if (currentText.trim()) {
      alleBlokker.push({
        type: currentType,
        content: currentText.trim(),
        pageNumber: p,
      });
    }
  }

  await doc.destroy();
  return alleBlokker;
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
 * RGBA→PNG konvertering via zlib (ingen native deps).
 * Genererer gyldig PNG som nettlesere kan vise.
 */
function rgbaToPng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Buffer {
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");

  // PNG IDAT: filterbyte (0 = None) foran hver rad, deretter RGBA-piksler
  const rawLen = height * (1 + width * 4);
  const raw = Buffer.alloc(rawLen);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    raw[rowOffset] = 0; // filter: None
    data.buffer && Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, rowOffset + 1);
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
