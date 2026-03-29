/**
 * FTD Prosesseringstjeneste — Dokumentsøk-modulen
 *
 * Eier all prosessering: tekstekstraksjon, chunking, NS-kode-deteksjon,
 * spec-post-ekstraksjon fra Excel, A-nota-parsing.
 */
import { join, extname } from "node:path";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@sitedoc/db";

// Filsti — kjører alltid i API-serveren (apps/api/)
const UPLOADS_DIR = join(process.cwd(), "uploads");
const MAKS_CHUNK = 1500;
const OVERLAPP = 100;

// NS 3420 kodemønster: f.eks. "21.341", "21.341.1", "01.1"
const NS_KODE_REGEX = /\b(\d{2}\.\d{1,3}(?:\.\d+)?)\b/;

// Overskrift: nummerert (f.eks. "3.2.1 Betongarbeid") eller ALL CAPS
const OVERSKRIFT_REGEX = /^(\d+(?:\.\d+)*)\s+(.+)/;

// --------------------------------------------------------------------------
// Hovedinngang
// --------------------------------------------------------------------------

export async function prosesserDokument(
  prisma: PrismaClient,
  documentId: string,
): Promise<void> {
  try {
    // Sett status til "processing"
    const dok = await prisma.ftdDocument.update({
      where: { id: documentId },
      data: { processingState: "processing", processingError: null },
    });

    if (!dok.fileUrl) {
      throw new Error("Dokument mangler fileUrl");
    }

    // Les fil fra disk (kjører i API-serveren, cwd = apps/api/)
    const filsti = join(UPLOADS_DIR, dok.fileUrl.replace(/^\/uploads\//, ""));
    const buffer = await readFile(filsti);
    const ext = extname(dok.filename ?? "").toLowerCase();

    switch (ext) {
      case ".pdf":
        await prosesserPdf(prisma, documentId, buffer, dok.projectId, dok.docType ?? "annet");
        break;
      case ".xlsx":
      case ".xls":
        await prosesserExcel(
          prisma,
          documentId,
          buffer,
          dok.docType ?? "annet",
          dok.projectId,
        );
        break;
      case ".xml":
        await prosesserXml(prisma, documentId, buffer, dok.projectId);
        break;
      case ".csv":
        await prosesserCsv(prisma, documentId, buffer);
        break;
      default:
        // Ukjent filtype — marker som ferdig uten chunks
        break;
    }

    await prisma.ftdDocument.update({
      where: { id: documentId },
      data: { processingState: "completed" },
    });
  } catch (err) {
    const melding =
      err instanceof Error ? err.message : "Ukjent prosesseringsfeil";
    console.error(`FTD prosessering feilet for ${documentId}:`, melding);
    await prisma.ftdDocument
      .update({
        where: { id: documentId },
        data: { processingState: "failed", processingError: melding },
      })
      .catch(() => {});
  }
}

// --------------------------------------------------------------------------
// PDF-prosessering
// --------------------------------------------------------------------------

async function prosesserPdf(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  projectId: string,
  docType: string,
): Promise<void> {
  // pdf-parse v1 — default export er en funksjon
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  const resultat = await pdfParse(buffer);

  const sider = resultat.text.split("\f").filter((s: string) => s.trim());
  const sideData = sider.map((tekst: string, i: number) => ({
    side: i + 1,
    tekst: tekst.trim(),
  }));

  if (sideData.length === 0 && resultat.text.trim()) {
    sideData.push({ side: 1, tekst: resultat.text.trim() });
  }

  const chunks = delTekstIChunks(sideData);

  if (chunks.length > 0) {
    await prisma.ftdDocumentChunk.createMany({
      data: chunks.map((c) => ({
        documentId,
        chunkIndex: c.chunkIndex,
        chunkText: c.chunkText,
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
        nsCode: c.nsCode,
        profile: "pdf",
      })),
    });
  }

  // Ekstraher spec-poster fra mengdebeskrivelse/budsjett PDF (NS 3420 format)
  if (docType === "anbudsgrunnlag" || docType === "budsjett" || docType === "mengdebeskrivelse") {
    const poster = ekstraherNs3420PosterFraTekst(resultat.text, projectId, documentId);
    if (poster.length > 0) {
      await prisma.ftdSpecPost.createMany({ data: poster });
    }
  }

  // Ekstraher spec-poster fra A-nota/T-nota PDF (Proadm-format)
  if (docType === "a_nota" || docType === "t_nota") {
    const poster = ekstraherNotaPosterFraPdf(resultat.text, projectId, documentId);
    if (poster.length > 0) {
      await prisma.ftdSpecPost.createMany({ data: poster });
    }
  }

  await prisma.ftdDocument.update({
    where: { id: documentId },
    data: {
      pageCount: resultat.numpages ?? sideData.length,
      wordCount: resultat.text.split(/\s+/).length,
    },
  });
}

// --------------------------------------------------------------------------
// Excel hjelpefunksjoner
// --------------------------------------------------------------------------

/** Konverterer ExcelJS celleverdi til ren tekst (håndterer richText, formler, datoer) */
function excelCelleTilTekst(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toLocaleDateString("nb-NO");

  const obj = v as Record<string, unknown>;

  // Formel: { formula: "...", result: 123 }
  if ("result" in obj) {
    return excelCelleTilTekst(obj.result);
  }

  // Rich text: { richText: [{ text: "..." }, ...] }
  if ("richText" in obj && Array.isArray(obj.richText)) {
    return (obj.richText as Array<{ text?: string }>)
      .map((t) => t.text ?? "")
      .join("");
  }

  // Hyperlink: { text: "...", hyperlink: "..." }
  if ("text" in obj && typeof obj.text === "string") {
    return obj.text;
  }

  // Error: { error: "#REF!" }
  if ("error" in obj) return "";

  return String(v);
}

// --------------------------------------------------------------------------
// Excel-prosessering
// --------------------------------------------------------------------------

async function prosesserExcel(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  docType: string,
  projectId: string,
): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = (ExcelJSModule as Record<string, unknown>).default ?? ExcelJSModule;
  const workbook = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  let sheet = workbook.worksheets[0];

  // Fallback for .xls (gammel binærformat): bruk SheetJS
  if (!sheet) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx") as typeof import("xlsx");
    const xlsWorkbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = xlsWorkbook.SheetNames[0];
    if (!sheetName) throw new Error("Ingen ark funnet i Excel-filen");

    // Konverter til xlsx-buffer som ExcelJS kan lese
    const xlsxBuf = XLSX.write(xlsWorkbook, { type: "buffer", bookType: "xlsx" });
    await workbook.xlsx.load(xlsxBuf as ArrayBuffer);
    sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Kunne ikke konvertere .xls til lesbart format");
  }

  // Lag chunks av celleinnhold for søk (alle typer)
  await lagExcelChunks(prisma, documentId, sheet);

  // Spesifikk parsing basert på docType
  if (docType === "anbudsgrunnlag" || docType === "budsjett" || docType === "mengdebeskrivelse") {
    await ekstraherSpecPoster(prisma, documentId, projectId, sheet);
  } else if (docType === "a_nota" || docType === "t_nota") {
    await ekstraherNotaPoster(prisma, documentId, projectId, sheet);
  }
}

/** Detekter kontrakt, nota-type/nummer og entreprenør fra Excel-header */
async function detekterNotaInfo(
  prisma: PrismaClient,
  documentId: string,
  sheet: import("exceljs").Worksheet,
): Promise<void> {
  // Les de første 10 radene for å finne metadata
  const headerTekst: string[] = [];
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      const tekst = excelCelleTilTekst(cell.value);
      if (tekst.trim()) headerTekst.push(tekst.trim());
    });
  }

  const samlet = headerTekst.join(" ");

  // Detekter nota-type og nummer
  // "Avdragsnota nr. 4", "A-nota 6", "T-nota 3", "Sluttnota"
  let notaType: string | null = null;
  let notaNr: number | null = null;

  const avdragsMatch = samlet.match(/Avdragsnota\s+nr\.?\s*(\d+)/i);
  const aNotaMatch = samlet.match(/A-?nota\s+(\d+)/i);
  const tNotaMatch = samlet.match(/T-?nota\s+(\d+)/i);
  const sluttMatch = samlet.match(/Sluttnota/i);

  if (avdragsMatch) {
    notaType = "A-Nota";
    notaNr = parseInt(avdragsMatch[1]!, 10);
  } else if (aNotaMatch) {
    notaType = "A-Nota";
    notaNr = parseInt(aNotaMatch[1]!, 10);
  } else if (tNotaMatch) {
    notaType = "T-Nota";
    notaNr = parseInt(tNotaMatch[1]!, 10);
  } else if (sluttMatch) {
    notaType = "Sluttnota";
  }

  // Detekter prosjekt/kontrakt
  let kontraktNavn: string | null = null;
  const prosjektMatch = samlet.match(/Prosjekt:\s*(.+?)(?:\s*(?:Avdragsnota|A-?nota|T-?nota|Sluttnota|Faktura))/i);
  if (prosjektMatch) {
    kontraktNavn = prosjektMatch[1]!.trim();
  }

  // Detekter entreprenør (typisk firma etter faktura-info)
  let entreprenor: string | null = null;
  for (const tekst of headerTekst) {
    // Firmanavn etterfulgt av "AS", "ANS", "DA" etc.
    const firmaMatch = tekst.match(/^([A-ZÆØÅ][\w\s]+(?:AS|ANS|DA|SA|ASA))\b/);
    if (firmaMatch && !tekst.includes("Kommune") && !tekst.includes("Postboks")) {
      entreprenor = firmaMatch[1]!.trim();
      break;
    }
  }

  // Oppdater dokumentet hvis vi fant noe
  if (notaType || kontraktNavn || entreprenor) {
    await prisma.ftdDocument.update({
      where: { id: documentId },
      data: {
        ...(notaType ? { notaType } : {}),
        ...(notaNr !== null ? { notaNr } : {}),
        ...(kontraktNavn ? { kontraktNavn } : {}),
        ...(entreprenor ? { entreprenor } : {}),
      },
    });
  }
}

async function lagExcelChunks(
  prisma: PrismaClient,
  documentId: string,
  sheet: import("exceljs").Worksheet,
): Promise<void> {
  const rader: string[] = [];

  sheet.eachRow((row, _radNr) => {
    const celler = (row.values as unknown[])
      .slice(1) // ExcelJS: index 0 er tom
      .map((v) => excelCelleTilTekst(v))
      .filter((v) => v.trim());
    if (celler.length > 0) {
      rader.push(celler.join(" | "));
    }
  });

  if (rader.length === 0) return;

  // Del rader i chunks (~20 rader per chunk)
  const RADER_PER_CHUNK = 20;
  const chunks: Array<{
    chunkIndex: number;
    chunkText: string;
    nsCode: string | null;
  }> = [];

  for (let i = 0; i < rader.length; i += RADER_PER_CHUNK) {
    const utsnitt = rader.slice(i, i + RADER_PER_CHUNK);
    const tekst = utsnitt.join("\n");
    chunks.push({
      chunkIndex: chunks.length,
      chunkText: tekst,
      nsCode: detekterNsKode(tekst),
    });
  }

  await prisma.ftdDocumentChunk.createMany({
    data: chunks.map((c) => ({
      documentId,
      chunkIndex: c.chunkIndex,
      chunkText: c.chunkText,
      nsCode: c.nsCode,
      profile: "excel",
    })),
  });
}

interface KolonneMapping {
  headerRad: number;
  postnr?: number;
  beskrivelse?: number;
  enhet?: number;
  mengde?: number;
  enhetspris?: number;
  sum?: number;
  nsKode?: number;
}

function detekterKolonner(
  sheet: import("exceljs").Worksheet,
): KolonneMapping | null {
  const moonstre: Record<string, RegExp> = {
    postnr: /^(post|postnr|nr|pos)/i,
    beskrivelse: /^(beskrivelse|tekst|desc)/i,
    enhet: /^(enhet|enh)/i,
    mengde: /^(mengde|antall|mng)/i,
    enhetspris: /^(enhetspris|pris|e\.pris)/i,
    sum: /^(sum|beløp|total|verdi)/i,
    nsKode: /^(ns|kode|ns.kode)/i,
  };

  for (let rad = 1; rad <= Math.min(5, sheet.rowCount); rad++) {
    const row = sheet.getRow(rad);
    const mapping: KolonneMapping = { headerRad: rad };
    let treff = 0;

    row.eachCell((cell, col) => {
      const verdi = String(cell.value ?? "").trim();
      for (const [felt, regex] of Object.entries(moonstre)) {
        if (regex.test(verdi) && !(felt in mapping)) {
          (mapping as unknown as Record<string, number>)[felt] = col;
          treff++;
        }
      }
    });

    // Minst postnr eller beskrivelse + én tallkolonne
    if (treff >= 2 && (mapping.postnr || mapping.beskrivelse)) {
      return mapping;
    }
  }

  return null;
}

function cellVerdi(
  row: import("exceljs").Row,
  kolonne: number | undefined,
): string | null {
  if (!kolonne) return null;
  const cell = row.getCell(kolonne);
  const val = cell.value;
  if (val === null || val === undefined) return null;
  return String(val).trim() || null;
}

function cellDesimal(
  row: import("exceljs").Row,
  kolonne: number | undefined,
): number | null {
  if (!kolonne) return null;
  const cell = row.getCell(kolonne);
  const val = cell.value;
  if (val === null || val === undefined) return null;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(num) ? null : num;
}

async function ekstraherSpecPoster(
  prisma: PrismaClient,
  documentId: string,
  projectId: string,
  sheet: import("exceljs").Worksheet,
): Promise<void> {
  const mapping = detekterKolonner(sheet);
  if (!mapping) return; // Kunne ikke detektere kolonner

  const poster: Array<{
    projectId: string;
    documentId: string;
    postnr: string | null;
    beskrivelse: string | null;
    enhet: string | null;
    mengdeAnbud: number | null;
    enhetspris: number | null;
    sumAnbud: number | null;
    nsKode: string | null;
  }> = [];

  sheet.eachRow((row, radNr) => {
    if (radNr <= mapping.headerRad) return;

    const postnr = cellVerdi(row, mapping.postnr);
    const beskrivelse = cellVerdi(row, mapping.beskrivelse);
    if (!postnr && !beskrivelse) return;

    poster.push({
      projectId,
      documentId,
      postnr,
      beskrivelse,
      enhet: cellVerdi(row, mapping.enhet),
      mengdeAnbud: cellDesimal(row, mapping.mengde),
      enhetspris: cellDesimal(row, mapping.enhetspris),
      sumAnbud: cellDesimal(row, mapping.sum),
      nsKode: cellVerdi(row, mapping.nsKode),
    });
  });

  if (poster.length > 0) {
    await prisma.ftdSpecPost.createMany({ data: poster });
  }
}

/**
 * Ekstraher spec-poster fra Proadm A-nota/T-nota Excel.
 *
 * Proadm-formatet har header i rad 13 (typisk):
 *   A: Postnr, B-F: Beskrivelse (gjentatt), G: Mengde Anbudet, H: Enhet,
 *   I: Mengde forrige, J: Mengde denne, K: Mengde totalt, L: (duplikat),
 *   M: Enhetspris, N: Sum Anbudet, O: Verdi forrige, P: Verdi denne,
 *   Q: Mva denne, R: Verdi totalt, S: Utført %
 *
 * Detekterer header automatisk ved å søke etter "Postnr" i kolonne A.
 */
async function ekstraherNotaPoster(
  prisma: PrismaClient,
  documentId: string,
  projectId: string,
  sheet: import("exceljs").Worksheet,
): Promise<void> {
  // Finn header-raden (søk etter "Postnr" i kolonne A)
  let headerRad = 0;
  for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
    const v = excelCelleTilTekst(sheet.getRow(r).getCell(1).value).trim();
    if (/postnr/i.test(v)) {
      headerRad = r;
      break;
    }
  }
  // Fallback: rad 13 er standard i Proadm
  if (!headerRad) headerRad = 13;

  // Detekter kolonner fra header
  const headerRow = sheet.getRow(headerRad);
  const kolonner: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const v = excelCelleTilTekst(cell.value).toLowerCase().trim();
    if (v === "postnr" && !kolonner.postnr) kolonner.postnr = col;
    else if (v.includes("beskrivelse") && !kolonner.beskrivelse) kolonner.beskrivelse = col;
    else if (v === "enh" || v === "enhet") kolonner.enhet = col;
    else if (v === "enhetspris") kolonner.enhetspris = col;
    else if (v.includes("anbudet") && !kolonner.mengdeAnbud) {
      // Sjekk om parent-header (rad over) sier "Mengder" eller "Verdi"
      const overVerdi = excelCelleTilTekst(sheet.getRow(headerRad - 1).getCell(col).value).toLowerCase();
      if (overVerdi.includes("mengd")) kolonner.mengdeAnbud = col;
      else if (overVerdi.includes("verdi")) kolonner.sumAnbud = col;
      else if (!kolonner.mengdeAnbud) kolonner.mengdeAnbud = col;
    }
    else if (v.includes("denne per") && !kolonner.mengdeDenne) {
      const overVerdi = excelCelleTilTekst(sheet.getRow(headerRad - 1).getCell(col).value).toLowerCase();
      if (overVerdi.includes("mengd")) kolonner.mengdeDenne = col;
      else if (overVerdi.includes("verdi")) kolonner.verdiDenne = col;
      else if (!kolonner.mengdeDenne) kolonner.mengdeDenne = col;
    }
    else if (v.includes("totalt") && !kolonner.mengdeTotal) {
      const overVerdi = excelCelleTilTekst(sheet.getRow(headerRad - 1).getCell(col).value).toLowerCase();
      if (overVerdi.includes("mengd")) kolonner.mengdeTotal = col;
      else if (overVerdi.includes("verdi")) kolonner.verdiTotal = col;
      else if (!kolonner.mengdeTotal) kolonner.mengdeTotal = col;
    }
    else if (v.includes("utført") && v.includes("%")) kolonner.prosentFerdig = col;
  });

  // Fallback: detekter format basert på kolonneantall
  // .xls (via SheetJS) ekspanderer til ~37 kolonner, .xlsx har ~20
  const erXlsFormat = sheet.columnCount > 25;

  if (erXlsFormat) {
    // .xls Proadm-format (ekspandert via SheetJS)
    // 1:Postnr | 3:Beskrivelse | 13:MengdeAnb | 15:Enh | 16:MengdForr | 18:MengdDenne | 20:MengdTot
    // 25:Enhetspris | 27:VerdiAnb | 29:VerdiForr | 30:VerdiDenne | 34:VerdiTot | 37:%
    if (!kolonner.postnr) kolonner.postnr = 1;
    if (!kolonner.beskrivelse) kolonner.beskrivelse = 3;
    if (!kolonner.mengdeAnbud) kolonner.mengdeAnbud = 13;
    if (!kolonner.enhet) kolonner.enhet = 15;
    if (!kolonner.mengdeDenne) kolonner.mengdeDenne = 18;
    if (!kolonner.mengdeTotal) kolonner.mengdeTotal = 20;
    if (!kolonner.enhetspris) kolonner.enhetspris = 25;
    if (!kolonner.sumAnbud) kolonner.sumAnbud = 27;
    if (!kolonner.verdiDenne) kolonner.verdiDenne = 30;
    if (!kolonner.verdiTotal) kolonner.verdiTotal = 34;
    if (!kolonner.prosentFerdig) kolonner.prosentFerdig = 37;
  } else {
    // .xlsx Proadm standard-format
    if (!kolonner.postnr) kolonner.postnr = 1;
    if (!kolonner.beskrivelse) kolonner.beskrivelse = 2;
    if (!kolonner.mengdeAnbud) kolonner.mengdeAnbud = 7;
    if (!kolonner.enhet) kolonner.enhet = 8;
    if (!kolonner.mengdeDenne) kolonner.mengdeDenne = 10;
    if (!kolonner.mengdeTotal) kolonner.mengdeTotal = 11;
    if (!kolonner.enhetspris) kolonner.enhetspris = 13;
    if (!kolonner.sumAnbud) kolonner.sumAnbud = 14;
    if (!kolonner.verdiDenne) kolonner.verdiDenne = 16;
    if (!kolonner.verdiTotal) kolonner.verdiTotal = 18;
    if (!kolonner.prosentFerdig) kolonner.prosentFerdig = 19;
  }

  const poster: Array<{
    projectId: string;
    documentId: string;
    postnr: string | null;
    beskrivelse: string | null;
    enhet: string | null;
    mengdeAnbud: number | null;
    enhetspris: number | null;
    sumAnbud: number | null;
    mengdeDenne: number | null;
    mengdeTotal: number | null;
    verdiDenne: number | null;
    verdiTotal: number | null;
    prosentFerdig: number | null;
  }> = [];

  sheet.eachRow((row, radNr) => {
    if (radNr <= headerRad) return;

    const postnr = excelCelleTilTekst(row.getCell(kolonner.postnr!).value).trim();
    if (!postnr || !/^\d/.test(postnr)) return; // Hopp over ikke-poster

    const beskrivelse = excelCelleTilTekst(row.getCell(kolonner.beskrivelse!).value).trim();

    poster.push({
      projectId,
      documentId,
      postnr: postnr || null,
      beskrivelse: beskrivelse || null,
      enhet: excelCelleTilTekst(row.getCell(kolonner.enhet!).value).trim() || null,
      mengdeAnbud: cellDesimalRaw(row.getCell(kolonner.mengdeAnbud!).value),
      enhetspris: cellDesimalRaw(row.getCell(kolonner.enhetspris!).value),
      sumAnbud: cellDesimalRaw(row.getCell(kolonner.sumAnbud!).value),
      mengdeDenne: cellDesimalRaw(row.getCell(kolonner.mengdeDenne!).value),
      mengdeTotal: cellDesimalRaw(row.getCell(kolonner.mengdeTotal!).value),
      verdiDenne: cellDesimalRaw(row.getCell(kolonner.verdiDenne!).value),
      verdiTotal: cellDesimalRaw(row.getCell(kolonner.verdiTotal!).value),
      prosentFerdig: cellDesimalRaw(row.getCell(kolonner.prosentFerdig!).value),
    });
  });

  if (poster.length > 0) {
    await prisma.ftdSpecPost.createMany({ data: poster });
  }
}

/** Hent desimalverdi direkte fra celleverdi (støtter number, formel-resultat, richText, streng) */
function cellDesimalRaw(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    // Formel-resultat
    if ("result" in obj && typeof obj.result === "number") return obj.result;
    if ("result" in obj && typeof obj.result === "string") {
      return parsNorskTall(obj.result);
    }
    // richText: { richText: [{ text: "7 500,00" }] }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      const tekst = (obj.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
      return parsNorskTall(tekst);
    }
  }
  if (typeof v === "string") return parsNorskTall(v);
  return null;
}

/** Parser norsk tallformat: "7 500,00" → 7500, "1 200" → 1200 */
function parsNorskTall(s: string): number | null {
  const renset = s.replace(/\s/g, "").replace(",", ".");
  if (!renset) return null;
  const n = parseFloat(renset);
  return isNaN(n) ? null : n;
}

// --------------------------------------------------------------------------
// XML-prosessering (NS3459)
// --------------------------------------------------------------------------

async function prosesserXml(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  projectId: string,
): Promise<void> {
  const { XMLParser } = await import("fast-xml-parser");
  const xml = buffer.toString("utf-8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const resultat = parser.parse(xml);

  // Lag chunk av hele XML-innholdet for søk
  await prisma.ftdDocumentChunk.createMany({
    data: [
      {
        documentId,
        chunkIndex: 0,
        chunkText: xml.slice(0, 10000), // Begrens for store filer
        profile: "xml",
      },
    ],
  });

  // Forsøk å ekstrahere poster fra NS3459-struktur
  const poster = ekstraherNs3459Poster(resultat, projectId, documentId);
  if (poster.length > 0) {
    await prisma.ftdSpecPost.createMany({ data: poster });
  }
}

function ekstraherNs3459Poster(
  data: Record<string, unknown>,
  projectId: string,
  documentId: string,
): Array<{
  projectId: string;
  documentId: string;
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number | null;
  enhetspris: number | null;
  sumAnbud: number | null;
}> {
  const poster: Array<{
    projectId: string;
    documentId: string;
    postnr: string | null;
    beskrivelse: string | null;
    enhet: string | null;
    mengdeAnbud: number | null;
    enhetspris: number | null;
    sumAnbud: number | null;
  }> = [];

  // Rekursivt søk etter elementer som ligner poster
  function traverser(obj: unknown) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) traverser(item);
      return;
    }
    const o = obj as Record<string, unknown>;
    // Sjekk om dette er en post (har postnr/beskrivelse-lignende felter)
    const postnr =
      o["Postnr"] ?? o["postnr"] ?? o["PostNr"] ?? o["nummer"] ?? null;
    const beskrivelse =
      o["Beskrivelse"] ?? o["beskrivelse"] ?? o["Tekst"] ?? o["tekst"] ?? null;
    if (postnr || beskrivelse) {
      poster.push({
        projectId,
        documentId,
        postnr: postnr ? String(postnr) : null,
        beskrivelse: beskrivelse ? String(beskrivelse) : null,
        enhet: o["Enhet"] ? String(o["Enhet"]) : null,
        mengdeAnbud: o["Mengde"] ? Number(o["Mengde"]) : null,
        enhetspris: o["Enhetspris"] ? Number(o["Enhetspris"]) : null,
        sumAnbud: o["Sum"] ? Number(o["Sum"]) : null,
      });
    }
    for (const v of Object.values(o)) traverser(v);
  }

  traverser(data);
  return poster;
}

// --------------------------------------------------------------------------
// CSV-prosessering
// --------------------------------------------------------------------------

async function prosesserCsv(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
): Promise<void> {
  const innhold = buffer.toString("utf-8");
  const linjer = innhold.split("\n").filter((l) => l.trim());

  if (linjer.length === 0) return;

  // Del i chunks (~20 linjer per chunk)
  const LINJER_PER_CHUNK = 20;
  const chunks: Array<{ chunkIndex: number; chunkText: string }> = [];

  for (let i = 0; i < linjer.length; i += LINJER_PER_CHUNK) {
    chunks.push({
      chunkIndex: chunks.length,
      chunkText: linjer.slice(i, i + LINJER_PER_CHUNK).join("\n"),
    });
  }

  await prisma.ftdDocumentChunk.createMany({
    data: chunks.map((c) => ({
      documentId,
      chunkIndex: c.chunkIndex,
      chunkText: c.chunkText,
      profile: "csv",
    })),
  });
}

// --------------------------------------------------------------------------
// Chunking-hjelpefunksjoner
// --------------------------------------------------------------------------

function delTekstIChunks(
  sideData: Array<{ side: number; tekst: string }>,
): Array<{
  chunkIndex: number;
  chunkText: string;
  pageNumber: number;
  sectionTitle: string | null;
  nsCode: string | null;
}> {
  const chunks: Array<{
    chunkIndex: number;
    chunkText: string;
    pageNumber: number;
    sectionTitle: string | null;
    nsCode: string | null;
  }> = [];
  let index = 0;

  for (const side of sideData) {
    if (!side.tekst.trim()) continue;

    if (side.tekst.length <= MAKS_CHUNK) {
      chunks.push({
        chunkIndex: index++,
        chunkText: side.tekst,
        pageNumber: side.side,
        sectionTitle: detekterOverskrift(side.tekst),
        nsCode: detekterNsKode(side.tekst),
      });
    } else {
      // Del på avsnitt
      const avsnitt = side.tekst.split(/\n{2,}/);
      let buffer = "";

      for (const a of avsnitt) {
        if (buffer.length + a.length > MAKS_CHUNK && buffer.length > 0) {
          chunks.push({
            chunkIndex: index++,
            chunkText: buffer.trim(),
            pageNumber: side.side,
            sectionTitle: detekterOverskrift(buffer),
            nsCode: detekterNsKode(buffer),
          });
          // Overlapp
          buffer = buffer.slice(-OVERLAPP) + "\n\n" + a;
        } else {
          buffer += (buffer ? "\n\n" : "") + a;
        }
      }

      if (buffer.trim()) {
        chunks.push({
          chunkIndex: index++,
          chunkText: buffer.trim(),
          pageNumber: side.side,
          sectionTitle: detekterOverskrift(buffer),
          nsCode: detekterNsKode(buffer),
        });
      }
    }
  }

  return chunks;
}

function detekterNsKode(tekst: string): string | null {
  const match = tekst.match(NS_KODE_REGEX);
  return match?.[1] ?? null;
}

// --------------------------------------------------------------------------
// NS 3420 mengdebeskrivelse-parsing fra PDF-tekst
// Portert fra FtD Python-pipeline (mengdebeskrivelse.py)
// --------------------------------------------------------------------------

// Postnr med tekst etter: "01.03 Drift" — krever mellomrom
const RE_POST_WITH_TEXT = /^(?<num>\d{2}(?:\.\d{1,2})+)\s+(?<text>.+)$/;
// Postnr etterfulgt direkte av NS-kode: "00.03.03.9FB1.31A"
const RE_POST_SAMMENKLEMT = /^(?<num>\d{2}(?:\.\d{1,2})+)(?<ns>[A-Z]{1,3}\d[\w.]*[A-Z]?)$/;
// Norske desimaltall: "115 245,00", "2 550,00", "45,00"
const RE_NORSK_TALL = /\d{1,3}(?:\s\d{3})*,\d{2}/g;
// NS-kode: "FV3.12090A", "KB6.29", "AM1.824A"
const RE_NS_KODE = /^([A-Z]{1,3}\d[\w.]*[A-Z]?)\b/;
// Enheter (inkl. sammenklemt format som "Arealm", "Lengdem", "Antallstk")
const RE_ENHET = /^(lm|m2|m3|m²|m³|stk|RS|tonn|kg|timer|pst|pr|l)$/i;
// Sammenklemt verdilinje: "Arealm2250,0045,0011 250,00" eller "Lengdem1,00750,00750,00"
const RE_SAMMENKLEMT_VERDI = /^([A-Za-zæøåÆØÅ\s]+?)(m\d?|m²|m³|stk|RS|tonn|kg|time|timer)(\d[\d\s,]+)$/i;
// Linjeskift i postnr
const RE_TAIL_LINE = /^(?<dot>\.)?\s*(?<tail>\d{1,2}(?:\.\d{1,2})*)\s+(?<text>.+)$/;

function parseNorskTall(s: string): number | null {
  if (!s || !s.trim()) return null;
  const renset = s.trim().replace(/\xa0/g, "").replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(renset);
  return isNaN(num) ? null : num;
}

function ekstraherEnhetFraTekst(tekst: string): [string, string | null] {
  const deler = tekst.trimEnd().split(/\s+/);
  if (deler.length >= 2) {
    const siste = deler[deler.length - 1]!;
    if (RE_ENHET.test(siste)) {
      return [deler.slice(0, -1).join(" "), siste];
    }
  }
  return [tekst, null];
}

function filtrerLinjer(linjer: string[]): string[] {
  const filtrert: string[] = [];
  for (const linje of linjer) {
    const s = linje.trim();
    if (!s) continue;
    // Fjern header/footer-støy
    if (/^Tromsø kommune$/i.test(s)) continue;
    if (/^Sum denne side/i.test(s)) continue;
    if (/^Akkumulert Kapittel/i.test(s)) continue;
    if (/^PostnrNS-kode/i.test(s)) continue;
    if (/^Prosjekt:.*Side\s+\d/i.test(s)) continue;
    if (/^Kapittel:\s+\d/i.test(s)) continue;
    // Rene tall-linjer (sidesummer)
    if (/^\d[\d\s]*,\d{2}$/.test(s)) continue;
    filtrert.push(s);
  }
  return filtrert;
}

// Postnr alene på linje (uten tekst etter)
const RE_POST_BARE = /^(\d{2}(?:\.\d{1,2})+)$/;
// Tail-linje: ".1", ".10", "0" (med eller uten ledende punkt)
const RE_TAIL_BARE = /^\.(\d{1,2}(?:\.\d{1,2})*)$/;

function slaSammenPostnr(linjer: string[]): string[] {
  const resultat: string[] = [];
  let prevParts: number[] | null = null;
  let i = 0;

  while (i < linjer.length) {
    const linje = linjer[i]!.trim();

    // Sjekk: postnr med tekst etter ("03.04.14 GRØFT - UTTAK OG UTLEGGING")
    const mPostTekst = linje.match(RE_POST_WITH_TEXT);
    // Sjekk: postnr alene ("03.04.12")
    const mPostBare = linje.match(RE_POST_BARE);
    // Sjekk: sammenklemt postnr+NS ("00.03.03.9FB1.31A")
    const mSammenklemt = linje.match(RE_POST_SAMMENKLEMT);

    if (mSammenklemt?.groups) {
      // Sammenklemt — behold som er
      resultat.push(linje);
      prevParts = mSammenklemt.groups["num"]!.split(".").map(Number);
      i++;
      continue;
    }

    if (mPostBare && i + 1 < linjer.length) {
      const numStr = mPostBare[1]!;
      const nesteLinje = linjer[i + 1]!.trim();

      // Sjekk om neste linje er en tail (".1", ".10")
      const mTail = nesteLinje.match(RE_TAIL_BARE);
      if (mTail) {
        const tail = mTail[1]!;
        const mergedNum = `${numStr}.${tail}`;
        const mergedParts = mergedNum.split(".").map(Number);

        // Kun merge hvis stigende
        if (prevParts === null || mergedParts > prevParts) {
          // Sjekk om linje i+2 har tekst (NS-kode eller beskrivelse)
          resultat.push(`${mergedNum}`);
          prevParts = mergedParts;
          i += 2; // Hopp over tail-linjen
          continue;
        }
      }

      // Neste linje er bare et tall ("0", "1") uten punkt — append til siste segment
      if (/^\d{1,2}$/.test(nesteLinje)) {
        const parts = numStr.split(".");
        parts[parts.length - 1] = `${parts[parts.length - 1]}${nesteLinje}`;
        const mergedNum = parts.join(".");
        const mergedParts = mergedNum.split(".").map(Number);

        if (prevParts === null || mergedParts > prevParts) {
          resultat.push(mergedNum);
          prevParts = mergedParts;
          i += 2;
          continue;
        }
      }

      // Ingen merge — bare postnr alene
      resultat.push(linje);
      prevParts = numStr.split(".").map(Number);
      i++;
      continue;
    }

    if (mPostTekst?.groups) {
      const numStr = mPostTekst.groups["num"]!;
      resultat.push(linje);
      prevParts = numStr.split(".").map(Number);
      i++;
      continue;
    }

    resultat.push(linje);
    i++;
  }

  return resultat;
}

interface SpecPostRad {
  projectId: string;
  documentId: string;
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number | null;
  enhetspris: number | null;
  sumAnbud: number | null;
  nsKode: string | null;
  fullNsTekst: string | null;
}

/**
 * Parser A-nota/T-nota PDF (Proadm-format).
 *
 * Portert fra Python: pipeline/profiles/a_nota.py
 *
 * Hver post er på én linje med eksakt 11 norske desimaltall:
 *   nums[0]=mengdeAnbud, [1]=mengdeForrige, [2]=mengdeDenne, [3]=mengdeTotalt,
 *   [4]=enhetspris, [5]=sumAnbud, [6]=verdiForrige, [7]=verdiDenne,
 *   [8]=mvaDenne, [9]=verdiTotalt, [10]=prosentFerdig
 *
 * Enhet er det alfabetiske tokenet mellom nums[0] og nums[1].
 */
function ekstraherNotaPosterFraPdf(
  fullTekst: string,
  projectId: string,
  documentId: string,
): Array<{
  projectId: string;
  documentId: string;
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number | null;
  enhetspris: number | null;
  sumAnbud: number | null;
  mengdeDenne: number | null;
  mengdeTotal: number | null;
  verdiDenne: number | null;
  verdiTotal: number | null;
  prosentFerdig: number | null;
}> {
  // Norsk desimaltall: "38 000,00", "1,00", "0,00"
  const N_PAT = /\d{1,3}(?:\s\d{3})*,\d+/g;
  // Postnr i starten av linje
  const POSTNR_PAT = /^(\d+(?:\.\d+)*)\s+/;
  // Enhet: kun bokstaver (RS, m2, m3, stk, lm etc.)
  const UNIT_PAT = /^[A-Za-zÆØÅæøå²³/\-]+$/;
  // Linjer som skal hoppes over
  const SKIP_PATS = [
    /^\[\[PAGE:\d+\]\]$/,
    /^Sum\s+denne\s+side\b/i,
    /^Sum\s+total\b/i,
    /^Postnr\b/i,
  ];

  function tilDesimal(s: string): number {
    return parseFloat(s.replace(/\s/g, "").replace(",", "."));
  }

  function erSkipLinje(linje: string): boolean {
    return SKIP_PATS.some((p) => p.test(linje));
  }

  const linjer = fullTekst.split("\n");
  const poster: Array<{
    projectId: string;
    documentId: string;
    postnr: string | null;
    beskrivelse: string | null;
    enhet: string | null;
    mengdeAnbud: number | null;
    enhetspris: number | null;
    sumAnbud: number | null;
    mengdeDenne: number | null;
    mengdeTotal: number | null;
    verdiDenne: number | null;
    verdiTotal: number | null;
    prosentFerdig: number | null;
  }> = [];

  let tabellStartet = false;

  for (const rawLinje of linjer) {
    const linje = rawLinje.trim();

    // Vent på første "Postnr Beskrivelse"-header
    if (!tabellStartet) {
      if (/Postnr\b/i.test(linje) && linje.includes("Beskrivelse")) {
        tabellStartet = true;
      }
      continue;
    }

    if (!linje || erSkipLinje(linje)) continue;

    // Parse post-linje
    const pm = POSTNR_PAT.exec(linje);
    if (!pm) continue;

    const postnr = pm[1]!;
    const restStart = pm[0].length;

    // Finn alle norske desimaltall på linjen
    const nums: Array<{ value: number; start: number; end: number }> = [];
    N_PAT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = N_PAT.exec(linje)) !== null) {
      nums.push({ value: tilDesimal(m[0]), start: m.index, end: m.index + m[0].length });
    }

    if (nums.length < 11) continue; // Trenger eksakt 11 tall

    // Enhet: alfabetisk token mellom tall 0 og tall 1
    const mellom = linje.slice(nums[0]!.end, nums[1]!.start).trim();
    const enhet = mellom && UNIT_PAT.test(mellom) && mellom.length <= 10 ? mellom : null;

    // Beskrivelse: tekst mellom postnr og første tall
    const beskrivelse = linje.slice(restStart, nums[0]!.start).trim();

    poster.push({
      projectId,
      documentId,
      postnr,
      beskrivelse: beskrivelse.slice(0, 500) || null,
      enhet,
      mengdeAnbud: nums[0]!.value,
      enhetspris: nums[4]!.value,
      sumAnbud: nums[5]!.value,
      mengdeDenne: nums[2]!.value,
      mengdeTotal: nums[3]!.value,
      verdiDenne: nums[7]!.value,
      verdiTotal: nums[9]!.value,
      prosentFerdig: nums[10]!.value,
    });
  }

  return poster;
}

function ekstraherNs3420PosterFraTekst(
  fullTekst: string,
  projectId: string,
  documentId: string,
): SpecPostRad[] {
  const poster: SpecPostRad[] = [];

  // 1) Filtrer og slå sammen splittede postnumre
  const råLinjer = fullTekst.split("\n");
  const filtrert = filtrerLinjer(råLinjer);
  const slåttSammen = slaSammenPostnr(filtrert);

  // 2) Parse poster — samler tekst mellom postnumre
  let gjeldendNsKode: string | null = null;
  let nsKodeTekstLinjer: string[] = [];
  let gjeldendPostnr: string | null = null;
  let gjeldendBeskrivelse: string | null = null;
  let gjeldendLinjer: string[] = []; // alle linjer under gjeldende post

  // Gjenkjenn enhetslinjer som er splittet over 2-3 linjer i PDF:
  // "Arealm" + "2" + "940,00..." → enhet = m2, fjern "Arealm" og "2" fra tallparsing
  // "Lengdem" + "1,00..." → enhet = m
  // "Antallstk" + "20..." → enhet = stk
  // "Rund sumRS" + "10 000,00..." → enhet = RS
  // Enhetslinjer: slutter med enhetskode limt til siste ord (uten mellomrom)
  // "Arealm", "Areal per gangm", "Lengdem", "Volumm", "Antallstk", "Rund sumRS"
  const RE_ENHET_LINJE = /^(.+[a-zæøå])(m\d?|m²|m³|stk|RS|tonn|kg|time|timer|lm)$/;

  function rensEnhetslinjer(linjer: string[]): { rensede: string[]; enhet: string | null } {
    let enhet: string | null = null;
    const rensede: string[] = [];
    let i = 0;

    while (i < linjer.length) {
      const linje = linjer[i]!;
      const enhetMatch = linje.match(RE_ENHET_LINJE);

      if (enhetMatch) {
        // Enhetslinje funnet (f.eks. "Arealm", "Areal per gangm", "Lengdem")
        let enhetSuffix = enhetMatch[2] ?? ""; // m, stk, RS...

        // Sjekk om neste linje er en eksponent (2, 3) for m²/m³
        if (i + 1 < linjer.length) {
          const neste = linjer[i + 1]!.trim();
          if (/^[23]$/.test(neste) && enhetSuffix.toLowerCase() === "m") {
            enhetSuffix = `m${neste}`;
            i += 2; // Hopp over enhetslinje + eksponent
            enhet = enhetSuffix;
            continue;
          }
        }

        enhet = enhetSuffix;
        i++;
        continue;
      }

      // Sjekk også frittstående eksponent etter enhetslinje vi allerede hoppet over
      // (håndtert ovenfor)

      // Sjekk sammenklemt verdilinje: "Antallstk20500,0010 000,00"
      const vm = linje.match(RE_SAMMENKLEMT_VERDI);
      if (vm) {
        enhet = enhet ?? (vm[2] ?? null);
        // Behold linjen for tallparsing, men fjern enhets-prefiks
        const tallDel = linje.slice((vm[1]?.length ?? 0) + (vm[2]?.length ?? 0));
        if (tallDel.trim()) {
          rensede.push(tallDel);
        } else {
          rensede.push(linje);
        }
        i++;
        continue;
      }

      rensede.push(linje);
      i++;
    }

    return { rensede, enhet };
  }

  function avsluttPost() {
    if (!gjeldendPostnr) return;

    // Rens enhetslinjer før tallparsing
    const { rensede, enhet } = rensEnhetslinjer(gjeldendLinjer);

    // Slå sammen rensede linjer og finn tall
    const samlet = rensede.join(" ");
    const tallMatch = [...samlet.matchAll(RE_NORSK_TALL)];

    if (tallMatch.length >= 3) {

      const mengde = parseNorskTall(tallMatch[0]![0]);
      const pris = parseNorskTall(tallMatch[1]![0]);
      const sum = parseNorskTall(tallMatch[2]![0]);

      const fullNsTekst = nsKodeTekstLinjer.length > 0
        ? nsKodeTekstLinjer.join("\n")
        : null;

      poster.push({
        projectId,
        documentId,
        postnr: gjeldendPostnr,
        beskrivelse: gjeldendBeskrivelse,
        enhet,
        mengdeAnbud: mengde,
        enhetspris: pris,
        sumAnbud: sum,
        nsKode: gjeldendNsKode,
        fullNsTekst,
      });
      nsKodeTekstLinjer = [];
    } else if (gjeldendBeskrivelse && tallMatch.length === 0) {
      // Seksjonsheader uten priser
      poster.push({
        projectId,
        documentId,
        postnr: gjeldendPostnr,
        beskrivelse: gjeldendBeskrivelse,
        enhet: null,
        mengdeAnbud: null,
        enhetspris: null,
        sumAnbud: null,
        nsKode: gjeldendNsKode,
        fullNsTekst: null,
      });
    }

    gjeldendPostnr = null;
    gjeldendBeskrivelse = null;
    gjeldendLinjer = [];
  }

  for (const linje of slåttSammen) {
    const stripped = linje.trim();
    if (!stripped) continue;

    // Sjekk sammenklemt postnr+NS-kode: "00.03.03.9FB1.31A"
    const sammenklemtMatch = stripped.match(RE_POST_SAMMENKLEMT);
    if (sammenklemtMatch?.groups) {
      avsluttPost();
      gjeldendPostnr = sammenklemtMatch.groups["num"]!;
      gjeldendNsKode = sammenklemtMatch.groups["ns"]!;
      nsKodeTekstLinjer = [];
      continue;
    }

    // Sjekk postnr med tekst: "01.03 Drift av bygge- eller anleggsplassen"
    const postMatch = stripped.match(RE_POST_WITH_TEXT);
    if (postMatch?.groups) {
      const num = postMatch.groups["num"]!;
      const rest = postMatch.groups["text"]!.trim();

      // Sjekk om rest starter med NS-kode
      const nsMatch = rest.match(RE_NS_KODE);

      avsluttPost();
      gjeldendPostnr = num;
      if (nsMatch) {
        gjeldendNsKode = nsMatch[1]!;
        nsKodeTekstLinjer = [rest];
      } else {
        gjeldendBeskrivelse = rest.slice(0, 500);
      }
      continue;
    }

    // Sjekk postnr alene: "03.04.12.1" (ingen tekst etter)
    const barePostMatch = stripped.match(RE_POST_BARE);
    if (barePostMatch) {
      avsluttPost();
      gjeldendPostnr = barePostMatch[1]!;
      continue;
    }

    // Ikke en postlinje — akkumuler under gjeldende post
    if (gjeldendPostnr) {
      gjeldendLinjer.push(stripped);

      // Fang opp beskrivelse: første tekstlinje som ikke er et tall/enhet-mønster
      if (
        !gjeldendBeskrivelse &&
        stripped.length > 2 &&
        /[A-Za-zæøåÆØÅ]/.test(stripped) &&
        !/^\d[\d\s,]+$/.test(stripped) && // ikke bare tall
        !RE_SAMMENKLEMT_VERDI.test(stripped) // ikke verdilinje
      ) {
        gjeldendBeskrivelse = stripped.slice(0, 500);
      }
    } else if (gjeldendNsKode) {
      nsKodeTekstLinjer.push(stripped);
    }
  }

  // Avslutt siste post
  avsluttPost();

  return poster;
}

function detekterOverskrift(tekst: string): string | null {
  const forsteLinjer = tekst.split("\n").slice(0, 3);
  for (const linje of forsteLinjer) {
    const trimmed = linje.trim();
    // Nummerert overskrift: "3.2.1 Betongarbeid"
    const match = trimmed.match(OVERSKRIFT_REGEX);
    if (match?.[2]) return match[2].trim();
    // ALL CAPS (minst 3 ord)
    if (
      trimmed.length > 5 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-ZÆØÅ]/.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return null;
}
