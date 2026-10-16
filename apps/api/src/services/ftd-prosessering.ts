/**
 * FTD Prosesseringstjeneste — Dokumentsøk-modulen
 *
 * Eier all prosessering: tekstekstraksjon, chunking, NS-kode-deteksjon,
 * spec-post-ekstraksjon fra Excel, A-nota-parsing.
 */
import { join, extname } from "node:path";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import type { PrismaClient } from "@sitedoc/db";
import * as mammoth from "mammoth";
import { splittMalebrevPdf } from "./pdf-splitting";
import { genererBlokker } from "./blokk-prosessering";
import { embeddNyeBlokker, embeddDokumentChunks } from "./embedding-service";
import { detekterSpraak } from "./spraak-deteksjon";
import { lagLivstegn } from "./reprosessering";

const execFileAsync = promisify(execFile);

// Filsti — kjører alltid i API-serveren (apps/api/)
const UPLOADS_DIR = join(process.cwd(), "uploads");
const MAKS_CHUNK = 1500;
const OVERLAPP = 100;

// Filtyper som gir søkbart innhold. Alt annet (f.eks. gammelt binært .doc, .rtf,
// .pages) skal IKKE markeres `completed` med 0 chunks — det blir «stille tomhet».
// I stedet settes status `unsupported` med en synlig melding. Se prosesserDokument.
export const STOTTEDE_FILTYPER = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".xml",
  ".csv",
  ".gab",
  ".ga1",
  ".docx",
];

export function erStøttetFiltype(ext: string): boolean {
  return STOTTEDE_FILTYPER.includes(ext.toLowerCase());
}

// Melding ved ikke-støttet format. Gammelt .doc er vanligste tilfelle.
const IKKE_STOTTET_MELDING =
  "Filformatet støttes ikke for søk. Lagre som .docx eller PDF og last opp på nytt.";

// NS 3420 kodemønster: f.eks. "21.341", "21.341.1", "01.1"
const NS_KODE_REGEX = /\b(\d{2}\.\d{1,3}(?:\.\d+)?)\b/;

/**
 * Rens OCR-tekst: splitt sammensatte ord, fiks vanlige OCR-feil.
 * "StorgataNord" → "Storgata Nord", "Utførtpr:" → "Utført pr:"
 */
function rensOcrTekst(tekst: string): string {
  let t = tekst;
  // Splitt CamelCase: "StorgataNord" → "Storgata Nord" (kun store bokstaver etter små)
  t = t.replace(/([a-zæøå])([A-ZÆØÅ])/g, "$1 $2");
  // Splitt tall+bokstav: "84310299,80" beholder, men "20.10.2025Utført" → "20.10.2025 Utført"
  t = t.replace(/(\d)([A-ZÆØÅ])/g, "$1 $2");
  // Splitt bokstav+tall der det mangler mellomrom: "Side02" → "Side 02"
  t = t.replace(/([a-zæøå])(\d)/g, "$1 $2");
  // Fiks kolon uten mellomrom: "Utførtpr:" → "Utført pr:"
  t = t.replace(/([a-zæøå]):([A-Za-zæøåÆØÅ])/g, "$1: $2");
  // Fjern overflødige mellomrom
  t = t.replace(/  +/g, " ");
  return t;
}

/**
 * Sjekk om chunk er OCR-søppel (innholdsfortegnelse med prikk-linjer).
 * Mønster: lange sekvenser av repeterende bokstaver som "ssevsseevsseven..."
 */
function erOcrSøppel(tekst: string): boolean {
  // Mer enn 20 repeterende konsonanter/vokaler i sekvens = søppel
  return /[srvne]{20,}/.test(tekst);
}

// Overskrift: nummerert (f.eks. "3.2.1 Betongarbeid") eller ALL CAPS
const OVERSKRIFT_REGEX = /^(\d+(?:\.\d+)*)\s+(.+)/;

// --------------------------------------------------------------------------
// Sikkerhetsventil: dedupliser og lagre spec-poster
// --------------------------------------------------------------------------

/** Lagre spec-poster med in-memory deduplisering + skipDuplicates (DB-constraint) */
async function lagreSpecPoster(
  prisma: PrismaClient,
  poster: Array<Record<string, unknown>>,
): Promise<void> {
  if (poster.length === 0) return;

  // Dedupliser i minnet — behold siste forekomst per (documentId, postnr)
  const unikeMap = new Map<string, Record<string, unknown>>();
  for (const p of poster) {
    const nøkkel = `${p.documentId}:${p.postnr ?? "NULL"}`;
    unikeMap.set(nøkkel, p);
  }
  const unikePoster = Array.from(unikeMap.values());

  await prisma.ftdSpecPost.createMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: unikePoster as any,
    skipDuplicates: true,
  });
}

// --------------------------------------------------------------------------
// Hovedinngang
// --------------------------------------------------------------------------

export async function prosesserDokument(
  prisma: PrismaClient,
  documentId: string,
  opts: { bevarVedFeil?: boolean } = {},
): Promise<void> {
  // Tvungen reekstraksjon (bevarVedFeil): behold eksisterende chunks/poster til
  // ny ekstraksjon har lykkes, slik at et completed dokument ALDRI ender tomt om
  // reekstraksjonen feiler. Mulig fordi ftd_document_chunks ikke har unik
  // (document_id, chunk_index) — gamle og nye rader kan sameksistere i vinduet.
  const { bevarVedFeil = false } = opts;
  let gamleChunkIds: string[] | null = null;
  let gamleSpecIds: string[] | null = null;
  try {
    // Concurrency guard: sett status til "processing" KUN hvis ikke allerede pågår
    const oppdatert = await prisma.ftdDocument.updateMany({
      where: {
        id: documentId,
        processingState: { not: "processing" },
      },
      data: { processingState: "processing", processingError: null },
    });

    if (oppdatert.count === 0) {
      console.log(`FTD: Prosessering allerede pågår for ${documentId}, avbryter`);
      return;
    }

    // Livstegn: bumper updated_at throttlet mens jobben kjører, slik at en lovlig
    // lang OCR aldri feilklassifiseres som strandet (RETUR 2 2026-10-15). Første
    // kall markerer ekstraksjons-fasen. (Embedding-fasen kjører FØRST etter at
    // state er satt til `completed` nedenfor — den er derfor utenfor strandet-
    // vinduet per konstruksjon, og trenger ikke livstegn.)
    const livstegn = lagLivstegn(prisma, documentId);
    await livstegn();

    if (bevarVedFeil) {
      // Snapshot gamle rad-id-er; de slettes først når ny ekstraksjon har lykkes.
      gamleChunkIds = (
        await prisma.ftdDocumentChunk.findMany({ where: { documentId }, select: { id: true } })
      ).map((c) => c.id);
      gamleSpecIds = (
        await prisma.ftdSpecPost.findMany({ where: { documentId }, select: { id: true } })
      ).map((p) => p.id);
    } else {
      // Standardvei (ny opplasting / reparasjon): slett eksisterende data først.
      await prisma.ftdSpecPost.deleteMany({ where: { documentId } });
      await prisma.ftdDocumentChunk.deleteMany({ where: { documentId } });
    }

    const dok = await prisma.ftdDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    if (!dok.fileUrl) {
      throw new Error("Dokument mangler fileUrl");
    }

    // Les fil fra disk (kjører i API-serveren, cwd = apps/api/)
    const filsti = join(UPLOADS_DIR, dok.fileUrl.replace(/^\/uploads\//, ""));
    const buffer = await readFile(filsti);
    const ext = extname(dok.filename ?? "").toLowerCase();

    switch (ext) {
      case ".pdf": {
        const sideData = await prosesserPdf(prisma, documentId, buffer, dok.projectId, dok.docType ?? "annet", filsti, livstegn);
        // Splitt målebrev per NS-kode hvis mappen har kontraktId (økonomi-mappe)
        if (dok.folderId && sideData.length > 0) {
          const mappe = await prisma.folder.findUnique({ where: { id: dok.folderId }, select: { kontraktId: true } });
          if (mappe?.kontraktId) {
            await splittMalebrevPdf(prisma, dok.projectId, dok.folderId, buffer, sideData, dok.filename ?? "ukjent.pdf", documentId)
              .catch((err) => console.error(`Splitting feilet for ${documentId}:`, err));
          }
        }
        break;
      }
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
      case ".gab":
      case ".ga1":
        await prosesserGab(prisma, documentId, buffer, dok.projectId);
        break;
      case ".docx":
        await prosesserDocx(prisma, documentId, buffer);
        break;
      default:
        // Ikke-støttet filtype (gammelt .doc, .rtf osv.) — håndteres etter switch
        break;
    }

    if (bevarVedFeil && gamleChunkIds) {
      // Swap kun hvis ny ekstraksjon faktisk ga nye chunks. Gir den 0 (f.eks.
      // tom/ødelagt fil), kaster vi → catch beholder de gamle chunkene.
      const nyeAntall = await prisma.ftdDocumentChunk.count({
        where: { documentId, id: { notIn: gamleChunkIds } },
      });
      if (nyeAntall === 0) {
        throw new Error("Tvungen reekstraksjon ga 0 nye chunks — beholder eksisterende");
      }
      await prisma.$transaction([
        prisma.ftdDocumentChunk.deleteMany({
          where: { documentId, id: { in: gamleChunkIds } },
        }),
        prisma.ftdSpecPost.deleteMany({
          where: { documentId, id: { in: gamleSpecIds ?? [] } },
        }),
      ]);
    }

    const støttet = erStøttetFiltype(ext);
    await prisma.ftdDocument.update({
      where: { id: documentId },
      data: støttet
        ? { processingState: "completed", processingError: null }
        : { processingState: "unsupported", processingError: IKKE_STOTTET_MELDING },
    });

    // Oppdater budsjett-poster fra nota-verdier (A-nota/T-nota)
    if (dok.kontraktId && (dok.docType === "a_nota" || dok.docType === "t_nota")) {
      await oppdaterBudsjettFraNota(prisma, dok.kontraktId, documentId);
    }

    // Automatisk embedding av nye chunks (fire-and-forget) via HTTP (NORBERT_URL)
    embeddDokumentChunks(prisma, documentId).catch((err) => {
      console.error(`Embedding feilet for ${documentId}:`, err);
    });

    // Blokkbasert parsing for alle PDF-er (bilder + strukturert tekst)
    if (ext === ".pdf") {
      genererBlokkOgOversett(prisma, documentId, dok.folderId, buffer, ext).catch((err) => {
        console.error(`Blokkgenerering feilet for ${documentId}:`, err);
      });
    }
  } catch (err) {
    const melding =
      err instanceof Error ? err.message : "Ukjent prosesseringsfeil";
    console.error(`FTD prosessering feilet for ${documentId}:`, melding);
    if (bevarVedFeil && gamleChunkIds) {
      // Rull tilbake: fjern nye rader fra denne kjøringen, behold de gamle, og
      // la dokumentet stå som completed (fortsatt søkbart) med synlig feilårsak.
      await prisma.ftdDocumentChunk
        .deleteMany({ where: { documentId, id: { notIn: gamleChunkIds } } })
        .catch(() => {});
      await prisma.ftdSpecPost
        .deleteMany({ where: { documentId, id: { notIn: gamleSpecIds ?? [] } } })
        .catch(() => {});
      await prisma.ftdDocument
        .update({
          where: { id: documentId },
          data: {
            processingState: "completed",
            processingError: `Tvungen reekstraksjon feilet (gamle treff beholdt): ${melding}`,
          },
        })
        .catch(() => {});
    } else {
      await prisma.ftdDocument
        .update({
          where: { id: documentId },
          data: { processingState: "failed", processingError: melding },
        })
        .catch(() => {});
    }
  }
}

/**
 * Generer blokker for alle PDF-er (bilder + strukturert tekst).
 * Oversettelsesoppdrag opprettes kun når mappen har flere språk og modul er aktiv.
 */
async function genererBlokkOgOversett(
  prisma: PrismaClient,
  documentId: string,
  folderId: string | null,
  buffer: Buffer,
  ext: string,
): Promise<void> {
  // Hent prosjekt + mappeinfo for språkinnstillinger
  let languages: string[] = ["nb"];
  let prosjektKildespråk = "nb";
  let projectId: string | null = null;

  if (folderId) {
    const mappe = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { projectId: true },
    });
    if (mappe) {
      projectId = mappe.projectId;
      // Kildespråk fra prosjektet
      const prosjekt = await prisma.project.findUnique({
        where: { id: mappe.projectId },
        select: { sourceLanguage: true },
      });
      prosjektKildespråk = prosjekt?.sourceLanguage ?? "nb";
      // Resolve effektive målspråk via arv
      const { hentEffektiveSpråk } = await import("./folder-spraak");
      const effektiv = await hentEffektiveSpråk(prisma, folderId);
      languages = effektiv.languages;
    }
  }

  // Alltid detekter språk fra innhold
  const tekst = buffer.toString("utf-8").slice(0, 5000);
  const detektert = detekterSpraak(tekst);

  // Bruk detektert språk for blokker (det faktiske innholdet)
  const kildeSpråk = detektert;
  const harAvvik = detektert !== prosjektKildespråk;

  // Lagre begge på dokumentet
  await prisma.ftdDocument.update({
    where: { id: documentId },
    data: {
      sourceLanguage: kildeSpråk,
      detectedLanguage: detektert,
      languageConfirmed: !harAvvik, // Auto-bekreftet kun når språk matcher
    },
  });

  if (harAvvik) {
    console.warn(`Språkavvik: dokument ${documentId} detektert som "${detektert}", prosjekt forventer "${prosjektKildespråk}"`);
  }

  // Generer blokker med detektert språk (riktig merking)
  const antall = await genererBlokker(prisma, documentId, buffer, ext, kildeSpråk);
  console.log(`Blokkprosessering: ${antall} blokker for ${documentId} (kilde: ${kildeSpråk})`);

  // Generer embeddings for blokker (fire-and-forget)
  embeddNyeBlokker(prisma, documentId).catch((err) => {
    console.error(`Blokk-embedding feilet for ${documentId}:`, err);
  });

  // Ved språkavvik: IKKE opprett oversettelsesoppdrag — vent på bekreftelse fra bruker
  if (harAvvik) return;

  // Oversettelsesoppdrag kun når mappen har flere språk og modul er aktiv
  const ekstraSpråk = languages.filter((l: string) => l !== kildeSpråk);
  if (ekstraSpråk.length === 0) return;

  // Sjekk om oversettelsesmodulen er aktiv
  if (projectId) {
    const modul = await prisma.projectModule.findUnique({
      where: { projectId_moduleSlug: { projectId, moduleSlug: "oversettelse" } },
    });
    if (modul?.status !== "aktiv") return;
  }

  for (const lang of ekstraSpråk) {
    await prisma.ftdTranslationJob.upsert({
      where: { documentId_targetLang: { documentId, targetLang: lang } },
      create: {
        id: `${documentId}-${lang}`,
        documentId,
        targetLang: lang,
        blocksTotal: antall,
        status: "pending",
      },
      update: {
        status: "pending",
        blocksTotal: antall,
        blocksDone: 0,
        error: null,
      },
    });
  }
}

// --------------------------------------------------------------------------
// OCR via pdftoppm + tesseract CLI
// --------------------------------------------------------------------------

/** Sjekk om sideData har tilstrekkelig tekst (>50 ord totalt) */
function harTilstrekkeligTekst(sideData: Array<{ side: number; tekst: string }>): boolean {
  const totaltOrd = sideData.reduce((sum, s) => sum + s.tekst.split(/\s+/).filter(Boolean).length, 0);
  return totaltOrd > 50;
}

// Tesseract-språkkoder (ISO 639-1 → tessdata)
const TESS_SPRAAK: Record<string, string> = {
  nb: "nor", en: "eng", sv: "swe", de: "deu", pl: "pol", fi: "fin",
  cs: "ces", ro: "ron", lt: "lit", et: "est", lv: "lav", uk: "ukr", ru: "rus", fr: "fra",
};

/** OCR-fallback: pdftoppm rendrer sider til PNG, tesseract leser tekst.
 *  Prosesserer i batches à 20 sider for å unngå minne-/timeout-problemer. */
async function ocrPdf(
  filsti: string,
  antallSider: number,
  spraak = "nb",
  livstegn?: () => Promise<void>,
): Promise<Array<{ side: number; tekst: string }>> {
  const BATCH = 20;
  const sideData: Array<{ side: number; tekst: string }> = [];
  const { readdir } = await import("node:fs/promises");

  for (let start = 1; start <= antallSider; start += BATCH) {
    // Livstegn pr. OCR-batch: det tyngste steget (tesseract 30 s/side) — uten dette
    // blir en stor skannet PDF feilklassifisert som strandet etter 15 min.
    await livstegn?.();
    const slutt = Math.min(start + BATCH - 1, antallSider);
    const tmpDir = await mkdtemp(join(tmpdir(), "sitedoc-ocr-"));
    try {
      const prefix = join(tmpDir, "side");
      await execFileAsync(
        "pdftoppm",
        ["-png", "-r", "300", "-f", String(start), "-l", String(slutt), filsti, prefix],
        { timeout: 120_000 },
      );

      const filer = (await readdir(tmpDir))
        .filter((f) => f.endsWith(".png"))
        .sort();

      for (let i = 0; i < filer.length; i++) {
        const pngSti = join(tmpDir, filer[i]!);
        try {
          const { stdout } = await execFileAsync(
            "tesseract",
            [pngSti, "stdout", "-l", TESS_SPRAAK[spraak] ?? "eng", "--psm", "6"],
            { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
          );
          sideData.push({ side: start + i, tekst: stdout.trim() });
        } catch {
          sideData.push({ side: start + i, tekst: "" });
        }
      }
    } catch (err) {
      console.error(`OCR batch ${start}-${slutt} feilet:`, err);
      // Legg til tomme sider for feilet batch
      for (let s = start; s <= slutt; s++) {
        sideData.push({ side: s, tekst: "" });
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Fyll ut manglende sider
  while (sideData.length < antallSider) {
    sideData.push({ side: sideData.length + 1, tekst: "" });
  }

  console.log(
    `OCR ferdig: ${sideData.filter((s) => s.tekst.length > 0).length}/${antallSider} sider, ${sideData.reduce((s, p) => s + p.tekst.length, 0)} tegn totalt`,
  );
  return sideData;
}

// --------------------------------------------------------------------------
// PDF-prosessering
// --------------------------------------------------------------------------

/** Minimal form av pdf.js sin tekst-item (vi leser bare `str` + `transform`). */
interface PdfTekstItem {
  str?: string;
  transform?: number[];
}

/**
 * Henter tekst PR. SIDE via pdfjs-dist (`getDocument` + `page.getTextContent`).
 *
 * To feil er rettet her:
 *  1. Sann `pageNumber` pr. side i stedet for å gjette sidegrenser i teksten.
 *     (Den gamle `split("\f")`-strategien la ALLE PDF-er på «side 1» —
 *     prod-feil 2026-10-14 — fordi pdf-parse v1 skiller sider med `\n\n`.)
 *  2. Byttet FRA `pdf-parse@1.1.1` (som bundler pdf.js v1.10.100, 2018) TIL
 *     den moderne pdfjs-dist 4.x som allerede brukes av
 *     `ekstraherPdfMedPosisjoner`. Gamle pdf.js holder muterbar PROSESS-GLOBAL
 *     tilstand: ett parse i en fersk prosess er stabilt, men flere PDF-er i
 *     samme langlevde api/web-prosess (sekvensielt ELLER samtidig — som
 *     bulk-reekstraksjonen) ødelegger hverandres tilstand og gir
 *     intermitterende «bad XRef entry» + stille sidetap (test-feil 2026-10-14).
 *     pdfjs-dist er re-entrant-trygt per `getDocument`. Se
 *     `ftd-reekstraksjon-xref.test.ts`.
 *
 * Tekstuttrekket beholder samme Y-baserte linjeskift som før (nytt linjeskift
 * når `transform[5]` endrer seg).
 */
export async function ekstraherPdfSider(
  buffer: Buffer,
  livstegn?: () => Promise<void>,
): Promise<{ sider: Array<{ side: number; tekst: string }>; antallSider: number }> {
  // LEGACY-build: Node-målrettet, self-polyfiller `Promise.withResolvers` via
  // core-js (mangler i Node < 21.7). Standard-builden kaster i prod (Node 20).
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Egen kopi av bytene — getDocument tar eierskap over typed array-en.
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const antallSider = doc.numPages;

  const sider: Array<{ side: number; tekst: string }> = [];
  try {
    for (let p = 1; p <= antallSider; p++) {
      // Livstegn pr. side: holder store PDF-er «ferske» også i ren tekst-ekstraksjon.
      await livstegn?.();
      const page = await doc.getPage(p);
      const innhold = await page.getTextContent();
      // Samme logikk som før: nytt linjeskift når Y (transform[5]) endrer seg.
      let forrigeY: number | undefined;
      let tekst = "";
      for (const item of innhold.items) {
        const el = item as PdfTekstItem;
        if (el.str === undefined || !el.transform) continue;
        const y = el.transform[5];
        if (forrigeY === y || forrigeY === undefined) tekst += el.str;
        else tekst += "\n" + el.str;
        forrigeY = y;
      }
      sider.push({ side: p, tekst: tekst.trim() });
    }
  } finally {
    await doc.destroy();
  }

  return { sider, antallSider };
}

async function prosesserPdf(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  projectId: string,
  docType: string,
  filsti: string,
  livstegn?: () => Promise<void>,
): Promise<Array<{ side: number; tekst: string }>> {
  // Tekst pr. side via pagerender (se ekstraherPdfSider). Erstatter det gamle
  // `split("\f")` som gjorde alle PDF-er til «side 1» (prod-feil 2026-10-14).
  const { sider: siderFraPdf, antallSider } = await ekstraherPdfSider(buffer, livstegn);
  let sideData = siderFraPdf;

  // OCR-fallback for skannede PDFer
  if (!harTilstrekkeligTekst(sideData)) {
    // Hent prosjektets kildespråk for OCR
    const prosjekt = await prisma.project.findUnique({ where: { id: projectId }, select: { sourceLanguage: true } });
    const ocrSpråk = prosjekt?.sourceLanguage ?? "nb";
    console.log(`Skannet PDF oppdaget (${documentId}), kjører OCR (${ocrSpråk})...`);
    try {
      sideData = await ocrPdf(filsti, antallSider, ocrSpråk, livstegn);
    } catch (err) {
      console.error(`OCR feilet for ${documentId}:`, err);
      // Fortsett med tom sideData — bedre enn å krasje
    }
  }

  // Livstegn ved chunking-fasen (etter ev. lang OCR, før DB-skriving).
  await livstegn?.();
  const chunks = delTekstIChunks(sideData);

  if (chunks.length > 0) {
    const rensetChunks = chunks
      .filter((c) => !erOcrSøppel(c.chunkText))
      .map((c) => ({
        documentId,
        chunkIndex: c.chunkIndex,
        chunkText: rensOcrTekst(c.chunkText),
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
        nsCode: c.nsCode,
        profile: "pdf",
      }));
    if (rensetChunks.length > 0) {
      await prisma.ftdDocumentChunk.createMany({ data: rensetChunks });
    }
  }

  // Side→postnr indeksering for dokumentasjon per post
  await indekserSiderTilPostnr(prisma, documentId, sideData);

  // Ekstraher spec-poster fra mengdebeskrivelse/budsjett PDF (NS 3420 format)
  if (docType === "anbudsgrunnlag" || docType === "budsjett" || docType === "mengdebeskrivelse") {
    const tabellTekst = await ekstraherPdfMedPosisjoner(buffer);
    const poster = ekstraherBudsjettPosterFraPdf(tabellTekst, projectId, documentId);
    await lagreSpecPoster(prisma, poster);
  }

  // Ekstraher spec-poster fra A-nota/T-nota PDF (Proadm-format) via pdfjs-dist
  if (docType === "a_nota" || docType === "t_nota") {
    const tabellTekst = await ekstraherPdfMedPosisjoner(buffer);
    const { poster, header } = ekstraherNotaPosterFraPdf(tabellTekst, projectId, documentId);
    await lagreSpecPoster(prisma, poster);
    // Lagre header-verdier (innestående, utført, netto etc.) på dokumentet
    await prisma.ftdDocument.update({
      where: { id: documentId },
      data: {
        utfortPr: header.utfortPr,
        utfortTotalt: header.utfortTotalt,
        utfortForrige: header.utfortForrige,
        utfortDenne: header.utfortDenne,
        innestaaende: header.innestaaende,
        innestaaendeForrige: header.innestaaendeForrige,
        innestaaendeDenne: header.innestaaendeDenne,
        nettoDenne: header.nettoDenne,
        mva: header.mva,
        sumInkMva: header.sumInkMva,
      },
    });
  }

  // Bruk sideData (eventuelt OCR-tekst) for ordtelling
  const totalTekst = sideData.map((s) => s.tekst).join(" ");
  await prisma.ftdDocument.update({
    where: { id: documentId },
    data: {
      pageCount: antallSider || sideData.length,
      wordCount: totalTekst.split(/\s+/).filter(Boolean).length,
    },
  });

  return sideData;
}

/** Indekser PDF-sider til postnr for dokumentasjon per post.
 *  Regex: "POST XX.YY.ZZ" (case-insensitive). Sider uten match arver forrige postnr. */
async function indekserSiderTilPostnr(
  prisma: PrismaClient,
  documentId: string,
  sideData: Array<{ side: number; tekst: string }>,
): Promise<void> {
  // POST 01.03.21, POST 01.03.21.2, etc. — også "Post:" og "POST nr."
  const POST_PAT = /POST\s*(?:nr\.?\s*)?(\d{1,2}(?:[.\-]\d{1,2}){1,6})/gi;

  const sidePostnr: Array<{ pageNumber: number; postnr: string }> = [];
  let forrigePostnr: string | null = null;

  for (const { side, tekst } of sideData) {
    POST_PAT.lastIndex = 0;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = POST_PAT.exec(tekst)) !== null) {
      // Normaliser: bytt bindestrek med punktum
      matches.push(m[1]!.replace(/-/g, "."));
    }

    if (matches.length > 0) {
      // Bruk siste match på siden (mest sannsynlig aktiv post)
      const postnr = matches[matches.length - 1]!;
      sidePostnr.push({ pageNumber: side, postnr });
      forrigePostnr = postnr;
    } else if (forrigePostnr) {
      // Arv fra forrige side
      sidePostnr.push({ pageNumber: side, postnr: forrigePostnr });
    }
    // Sider uten noen postnr-kontekst hoppes over
  }

  if (sidePostnr.length === 0) return;

  // Slett gamle side-indeks for dette dokumentet
  await prisma.ftdDocumentPage.deleteMany({ where: { documentId } });

  await prisma.ftdDocumentPage.createMany({
    data: sidePostnr.map((sp) => ({
      documentId,
      pageNumber: sp.pageNumber,
      postnr: sp.postnr,
    })),
  });

  console.warn(`[FTD-DEBUG] Side-indeks: ${sidePostnr.length}/${sideData.length} sider indeksert for ${documentId}`);
}

// --------------------------------------------------------------------------
// Excel hjelpefunksjoner
// --------------------------------------------------------------------------

/** Konverterer ExcelJS celleverdi til ren tekst (håndterer richText, formler, datoer) */
function excelCelleTilTekst(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) {
    // Excel konverterer postnr som "01.01.1" til Date.
    // Returnerer ISO-dato som fallback — formatering håndteres av kaller med numFmt
    return v.toLocaleDateString("nb-NO");
  }

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

/** Ekstraher header-verdier fra Excel A-nota (utført, innestående, netto, mva) */
async function ekstraherExcelNotaHeader(
  prisma: PrismaClient,
  documentId: string,
  sheet: import("exceljs").Worksheet,
  headerRad: number,
): Promise<void> {
  // Les alle celler fra radene før tabellen
  const labelVerdiPar: Array<{ label: string; verdi: number }> = [];

  for (let r = 1; r < headerRad; r++) {
    const row = sheet.getRow(r);
    const celler: Array<{ col: number; tekst: string; num: number | null }> = [];

    row.eachCell((cell, col) => {
      const tekst = excelCelleTilTekst(cell.value).trim();
      const rawVal = cell.value;
      const num = typeof rawVal === "number" ? rawVal : null;
      if (tekst || num !== null) celler.push({ col, tekst, num });
    });

    // Match: label-celle etterfulgt av numerisk celle
    for (let i = 0; i < celler.length - 1; i++) {
      const c = celler[i]!;
      if (c.tekst && !/^\d/.test(c.tekst)) {
        // Finn neste celle med tall
        for (let j = i + 1; j < celler.length; j++) {
          const n = celler[j]!;
          if (n.num !== null) {
            labelVerdiPar.push({ label: c.tekst, verdi: n.num });
            break;
          }
        }
      }
    }
  }

  if (labelVerdiPar.length === 0) return;

  function finn(pat: RegExp): number | null {
    for (const { label, verdi } of labelVerdiPar) {
      if (pat.test(label)) return verdi;
    }
    return null;
  }

  // Dato: "Utført pr: 20.10.2025" — i Excel kan dette være en dato-celle
  let utfortPr: Date | null = null;
  for (let r = 1; r < headerRad; r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      if (utfortPr) return;
      const tekst = excelCelleTilTekst(cell.value);
      const dm = tekst.match(/Utf.rt\s+pr[.:]*\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
      if (dm) {
        utfortPr = new Date(parseInt(dm[3]!), parseInt(dm[2]!) - 1, parseInt(dm[1]!));
      } else if (cell.value instanceof Date && /utf.rt\s+pr/i.test(
        excelCelleTilTekst(row.getCell(Number(cell.col) > 1 ? Number(cell.col) - 1 : 1).value)
      )) {
        utfortPr = cell.value;
      }
    });
  }

  const data: Record<string, unknown> = {};
  const utfortTotalt = finn(/Utf.rt\s+totalt/i);
  const utfortForrige = finn(/Utf.rt\s+forrige/i);
  const utfortDenne = finn(/Utf.rt\s+denne/i);
  const innestaaende = finn(/^(?!.*(?:forrige|denne)).*Innest.ende/i);
  const innestaaendeForrige = finn(/Innest.ende\s+forrige/i);
  const innestaaendeDenne = finn(/Innest.ende\s+denne/i);
  const nettoDenne = finn(/Netto\s+denne/i);
  const mva = finn(/^\s*\+?\s*Mva\.?\s*$/i);
  const sumInkMva = finn(/Sum\s+inkludert/i);

  if (utfortPr) data.utfortPr = utfortPr;
  if (utfortTotalt !== null) data.utfortTotalt = utfortTotalt;
  if (utfortForrige !== null) data.utfortForrige = utfortForrige;
  if (utfortDenne !== null) data.utfortDenne = utfortDenne;
  if (innestaaende !== null) data.innestaaende = innestaaende;
  if (innestaaendeForrige !== null) data.innestaaendeForrige = innestaaendeForrige;
  if (innestaaendeDenne !== null) data.innestaaendeDenne = innestaaendeDenne;
  if (nettoDenne !== null) data.nettoDenne = nettoDenne;
  if (mva !== null) data.mva = mva;
  if (sumInkMva !== null) data.sumInkMva = sumInkMva;

  if (Object.keys(data).length > 0) {
    console.warn(`[FTD-DEBUG] Excel header: ${JSON.stringify(data)}`);
    await prisma.ftdDocument.update({ where: { id: documentId }, data });
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

  await lagreSpecPoster(prisma, poster);
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
  // Finn header-raden (søk etter "Postnr" i kolonne A — kan være rad 13 eller 41+)
  let headerRad = 0;
  for (let r = 1; r <= Math.min(60, sheet.rowCount); r++) {
    const v = excelCelleTilTekst(sheet.getRow(r).getCell(1).value).trim();
    if (/postnr/i.test(v)) {
      headerRad = r;
      break;
    }
  }
  // Fallback: rad 13 er standard i Proadm
  if (!headerRad) headerRad = 13;

  // Ekstraher header-verdier (utført, innestående, netto, mva) fra rader før tabellen
  await ekstraherExcelNotaHeader(prisma, documentId, sheet, headerRad);

  // Detekter kolonner fra header
  const headerRow = sheet.getRow(headerRad);
  const kolonner: Record<string, number> = {};
  // Samle alle header-celler for posisjonelt oppslag
  const headerCeller: Array<{ col: number; tekst: string }> = [];
  headerRow.eachCell((cell, col) => {
    const v = excelCelleTilTekst(cell.value).toLowerCase().trim();
    if (v) headerCeller.push({ col, tekst: v });
  });

  // Finn enhetspris-kolonnen først (ankerpunkt mellom mengde- og verdi-seksjoner)
  for (const h of headerCeller) {
    if (h.tekst === "postnr" && !kolonner.postnr) kolonner.postnr = h.col;
    else if (h.tekst.includes("beskrivelse") && !kolonner.beskrivelse) kolonner.beskrivelse = h.col;
    else if (h.tekst === "enh" || h.tekst === "enhet") kolonner.enhet = h.col;
    else if (h.tekst === "enhetspris" && !kolonner.enhetspris) kolonner.enhetspris = h.col;
    else if (h.tekst.includes("utført") && h.tekst.includes("%")) kolonner.prosentFerdig = h.col;
  }

  // Bruk enhetspris som skillelinje: kolonner FØR = mengder, ETTER = verdier
  const enhetsprisKol = kolonner.enhetspris ?? 999;
  for (const h of headerCeller) {
    if (h.tekst.includes("anbudet")) {
      if (h.col < enhetsprisKol && !kolonner.mengdeAnbud) kolonner.mengdeAnbud = h.col;
      else if (h.col > enhetsprisKol && !kolonner.sumAnbud) kolonner.sumAnbud = h.col;
    }
    else if (h.tekst.includes("denne")) {
      if (h.col < enhetsprisKol && !kolonner.mengdeDenne) kolonner.mengdeDenne = h.col;
      else if (h.col > enhetsprisKol && !kolonner.verdiDenne) kolonner.verdiDenne = h.col;
    }
    else if (h.tekst.includes("totalt")) {
      if (h.col < enhetsprisKol && !kolonner.mengdeTotal) kolonner.mengdeTotal = h.col;
      else if (h.col > enhetsprisKol && !kolonner.verdiTotal) kolonner.verdiTotal = h.col;
    }
  }

  // Fallback: sjekk parent-header (rad over) for Proadm-format med sammensatte overskrifter
  if (!kolonner.mengdeAnbud || !kolonner.sumAnbud) {
    for (const h of headerCeller) {
      if (!h.tekst.includes("anbudet") && !h.tekst.includes("denne") && !h.tekst.includes("totalt")) continue;
      const overVerdi = headerRad > 1
        ? excelCelleTilTekst(sheet.getRow(headerRad - 1).getCell(h.col).value).toLowerCase()
        : "";
      if (h.tekst.includes("anbudet")) {
        if (overVerdi.includes("mengd") && !kolonner.mengdeAnbud) kolonner.mengdeAnbud = h.col;
        else if (overVerdi.includes("verdi") && !kolonner.sumAnbud) kolonner.sumAnbud = h.col;
      }
      if (h.tekst.includes("denne")) {
        if (overVerdi.includes("mengd") && !kolonner.mengdeDenne) kolonner.mengdeDenne = h.col;
        else if (overVerdi.includes("verdi") && !kolonner.verdiDenne) kolonner.verdiDenne = h.col;
      }
      if (h.tekst.includes("totalt")) {
        if (overVerdi.includes("mengd") && !kolonner.mengdeTotal) kolonner.mengdeTotal = h.col;
        else if (overVerdi.includes("verdi") && !kolonner.verdiTotal) kolonner.verdiTotal = h.col;
      }
    }
  }

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

    // Postnr-celler: Excel konverterer "01.03.10" til Date. Bruk numFmt for å rekonstruere.
    const postnrCell = row.getCell(kolonner.postnr!);
    let postnr = "";
    if (postnrCell.value instanceof Date) {
      postnr = formaterDatoPostnr(postnrCell.value, postnrCell.numFmt ?? "");
    } else {
      postnr = excelCelleTilTekst(postnrCell.value).trim();
    }
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

  await lagreSpecPoster(prisma, poster);
}

/**
 * Konverterer Excel-dato tilbake til postnr-streng basert på cellens numFmt.
 * Excel konverterer postnr som "01.03.10" til Date. numFmt angir rekkefølgen
 * på komponentene: "yy.mm.d", "mm.dd.yy", "yy.m.d" osv.
 */
function formaterDatoPostnr(dato: Date, numFmt: string): string {
  const y = dato.getFullYear();
  const m = dato.getMonth() + 1;
  const d = dato.getDate();

  // Parse numFmt for å finne rekkefølge (f.eks. "yy.mm.d;@", "mm.dd.yy;@")
  const fmt = numFmt.split(";")[0] ?? ""; // Fjern ;@ text-del
  const deler = fmt.split(".");

  if (deler.length >= 3) {
    const resultat: string[] = [];
    for (const del of deler) {
      const norm = del.toLowerCase().trim();
      if (norm.startsWith("y")) {
        resultat.push(String(y % 100).padStart(2, "0"));
      } else if (norm.startsWith("m")) {
        const pad = norm.length >= 2; // "mm" → pad, "m" → ikke
        resultat.push(pad ? String(m).padStart(2, "0") : String(m));
      } else if (norm.startsWith("d")) {
        // "d" = uten ledende null, "dd" = med
        resultat.push(norm.length >= 2 ? String(d).padStart(2, "0") : String(d));
      }
    }
    if (resultat.length >= 3) return resultat.join(".");
  }

  // Fallback: yy.mm.d (vanligste format)
  return `${String(y % 100).padStart(2, "0")}.${String(m).padStart(2, "0")}.${d}`;
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

// --------------------------------------------------------------------------
// GAB/GA1-prosessering (ISY Beskrivelse/Linker anbudsfiler)
// --------------------------------------------------------------------------

/**
 * Parser ISY Beskrivelse .gab/.ga1 binærfil.
 *
 * GAB-formatet er et proprietært binærformat fra Norconsult/ISY.
 * Poster kan ekstraheres via regex på lesbare strenger i filen:
 *   postnr - NSkode  BESKRIVELSE\0
 *   postnr - beskrivelse\0
 *
 * Enhet finnes som \x02RS\x03 eller \x02m\x03 (length-prefixed) etter GUID.
 * Enhetspris: IEEE 754 double (LE) ved fast offset +31 fra NS-kode-slutt.
 * 78% av poster har enhetspris. RS-poster: mengde=1, sum=enhetspris.
 */
async function prosesserGab(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  projectId: string,
): Promise<void> {
  const data = buffer;

  // Regex for å finne poster: postnr - tekst\0
  const POST_RE = /(\d{2}\.\d{2}(?:\.\d{1,3})*) - ([^\x00]{3,300}?)\x00/g;
  const NS_KODE_RE = /^([A-Z]{1,3}\d[\w.]*[A-Z]?)\s+(.*)/s;
  const ENHET_RE = /\x02(RS|stk|m[23²³]?|lm|tonn|kg|time[rs]?|uke|liter|%)\x03/;

  // Konverter buffer til string for regex (latin-1 for å bevare alle bytes)
  const tekst = data.toString("latin1");

  // Finn alle post-matcher med posisjoner
  const matcher: Array<{ postnr: string; headerTekst: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = POST_RE.exec(tekst)) !== null) {
    matcher.push({ postnr: match[1]!, headerTekst: match[2]!.trim(), start: match.index, end: match.index + match[0].length });
  }

  const sett = new Set<string>();
  const poster: Array<{
    projectId: string;
    documentId: string;
    postnr: string;
    beskrivelse: string | null;
    enhet: string | null;
    nsKode: string | null;
    mengdeAnbud: number | null;
    enhetspris: number | null;
    sumAnbud: number | null;
  }> = [];

  for (let mi = 0; mi < matcher.length; mi++) {
    const m = matcher[mi]!;
    if (sett.has(m.postnr)) continue;
    sett.add(m.postnr);

    // Skill NS-kode fra header-tekst
    let nsKode: string | null = null;
    let beskrivelse: string;
    const nsMatch = NS_KODE_RE.exec(m.headerTekst);
    if (nsMatch) {
      nsKode = nsMatch[1]!;
      beskrivelse = nsMatch[2]!.trim();
    } else {
      beskrivelse = m.headerTekst;
    }

    // Samle tilleggstekst mellom denne posten og neste
    const nesteStart = mi + 1 < matcher.length ? matcher[mi + 1]!.start : m.end + 5000;
    const mellomrom = tekst.slice(m.end, Math.min(nesteStart, m.end + 5000));

    // Ekstraher lesbare tekstsegmenter (splitt på null-bytes)
    const segmenter = mellomrom.split(/\x00+/);
    const ekstraTekst: string[] = [];
    for (const seg of segmenter) {
      const renset = seg.trim();
      if (renset.length < 4) continue;
      // Hopp over GUIDs, binære blokker, RTF-markup
      if (/^\$[0-9a-f-]{36}/.test(renset)) continue;
      if (/^\{\\rtf/.test(renset)) continue;
      if (!/[a-zA-ZæøåÆØÅ]{2,}/.test(renset)) continue;
      // Hopp over korte kontrollsekvenser
      if (/^[\x00-\x1f]/.test(renset)) continue;
      // Rens RTF-rester og binære tegn
      const ren = renset
        .replace(/\\par\b/g, "\n")
        .replace(/\\tab\b/g, "\t")
        .replace(/\\'([0-9a-f]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\[a-z]+\d*\s?/g, "")
        .replace(/[{}]/g, "")
        .replace(/[\x00-\x1f\x7f-\x9f]/g, "") // Fjern kontrollkoder
        .replace(/[^\x20-\x7eæøåÆØÅéèêëàáâãäöüïîìíñçÉÈÊËÀÁÂÃÄÖÜÏÎÌÍÑÇ\n\t]/g, "") // Kun printbare tegn
        .trim();
      if (ren.length >= 4 && /[a-zA-ZæøåÆØÅ]{2,}/.test(ren)) {
        ekstraTekst.push(ren);
      }
    }

    // Kombiner header-beskrivelse med ekstra tekst
    if (ekstraTekst.length > 0) {
      beskrivelse = (beskrivelse + "\n" + ekstraTekst.join("\n")).trim();
    }

    // Finn enhet og enhetspris fra binærstruktur
    // Struktur etter post: [header][GUID][\x02 enhet][\xNN NS-kode][fast header 31 bytes][double LE = enhetspris]
    let enhet: string | null = null;
    let enhetspris: number | null = null;
    let mengdeAnbud: number | null = null;
    let sumAnbud: number | null = null;

    // Finn enhet via regex (forbedret — matcher flere enheter)
    const enhetMatch = ENHET_RE.exec(mellomrom);
    if (enhetMatch) {
      enhet = enhetMatch[1]!;
    }

    // Ekstraher enhetspris fra binærformat
    // Finn GUID i mellomrom-bufferen, deretter length-prefixed enhet + NS-kode
    const mellomBuf = data.slice(m.end, Math.min(m.end + 200, data.length));
    const mellomStr = mellomBuf.toString("latin1");
    const guidMatch = /\$[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(mellomStr);
    if (guidMatch && mellomBuf.length >= guidMatch.index + guidMatch[0].length + 40) {
      let cursor = guidMatch.index + guidMatch[0].length;
      // Length-prefixed enhet
      const enhetLen = mellomBuf[cursor]!;
      if (enhetLen > 0 && enhetLen < 20) {
        const binEnhet = mellomStr.slice(cursor + 1, cursor + 1 + enhetLen);
        if (!enhet && /^[A-Za-z%²³]+$/.test(binEnhet)) {
          enhet = binEnhet;
        }
        cursor += 1 + enhetLen;
      }
      // Length-prefixed NS-kode
      const nsLen = mellomBuf[cursor]!;
      if (nsLen !== undefined && nsLen < 30) {
        cursor += 1 + nsLen;
      }
      // Fast offset +31 fra NS-kode-slutt → double LE = enhetspris
      if (cursor + 39 <= mellomBuf.length) {
        const val = mellomBuf.readDoubleLE(cursor + 31);
        if (val !== 0 && isFinite(val) && Math.abs(val) > 0.001 && Math.abs(val) < 1e12) {
          enhetspris = Math.round(val * 100) / 100; // Avrund til 2 desimaler
          // For RS (Rund Sum): mengde=1, sum=enhetspris
          if (enhet === "RS") {
            mengdeAnbud = 1;
            sumAnbud = enhetspris;
          }
        }
      }
    }

    poster.push({
      projectId,
      documentId,
      postnr: m.postnr,
      beskrivelse: beskrivelse.slice(0, 2000) || null,
      enhet,
      nsKode,
      mengdeAnbud,
      enhetspris,
      sumAnbud,
    });
  }

  // Lag chunks for søk (samle lesbare strenger)
  const chunks: string[] = [];
  let currentChunk = "";
  const lines = tekst.split(/\x00+/).filter((s) => s.length > 3);
  for (const line of lines) {
    const clean = line.replace(/[\x00-\x1f]/g, " ").trim();
    if (!clean || clean.length < 3) continue;
    // Bare ASCII/Latin-1 tekst
    if (!/[a-zA-ZæøåÆØÅ]/.test(clean)) continue;
    currentChunk += clean + "\n";
    if (currentChunk.length > MAKS_CHUNK) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Lagre chunks
  if (chunks.length > 0) {
    await prisma.ftdDocumentChunk.createMany({
      data: chunks.map((c, i) => ({
        documentId,
        chunkIndex: i,
        chunkText: c.slice(0, 5000),
        profile: "gab",
      })),
    });
  }

  // Lagre spec-poster
  await lagreSpecPoster(prisma, poster);
}

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
  await lagreSpecPoster(prisma, poster);
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

export function delTekstIChunks(
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
// DOCX-prosessering (mammoth → samme chunk-format som PDF)
// --------------------------------------------------------------------------

export interface DocxChunk {
  chunkIndex: number;
  chunkText: string;
  sectionTitle: string | null;
  sectionLevel: number | null;
  nsCode: string | null;
}

/** Dekod de vanligste HTML-entitetene mammoth produserer. */
function dekodHtmlEntiteter(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)));
}

type DocxBlokk = { type: "heading" | "para"; level: number | null; text: string };

/**
 * Parser mammoth-HTML til ordnede blokker. Overskrifter (`<h1>`–`<h6>`) bærer nivå;
 * avsnitt/listepunkter/tabellceller (`<p>`/`<li>`/`<td>`/`<th>`) blir tekst-blokker.
 * Inline-tagger (`<strong>`, `<em>`, `<a>`) ignoreres — kun tekstinnholdet beholdes.
 */
function parseDocxBlokker(html: string): DocxBlokk[] {
  const blokker: DocxBlokk[] = [];
  const tokens = html.split(/(<[^>]+>)/);
  let aktiv: { type: "heading" | "para"; level: number | null; buf: string } | null = null;

  const flush = () => {
    if (!aktiv) return;
    const text = dekodHtmlEntiteter(aktiv.buf).replace(/\s+/g, " ").trim();
    if (text) blokker.push({ type: aktiv.type, level: aktiv.level, text });
    aktiv = null;
  };

  const erBlokkTag = (tag: string) =>
    /^h[1-6]$/.test(tag) || tag === "p" || tag === "li" || tag === "td" || tag === "th";

  for (const tok of tokens) {
    const m = tok.match(/^<\s*(\/?)\s*([a-zA-Z0-9]+)/);
    if (m) {
      const lukkende = m[1] === "/";
      const tag = m[2]!.toLowerCase();
      if (!lukkende) {
        if (/^h[1-6]$/.test(tag)) {
          flush();
          aktiv = { type: "heading", level: Number(tag[1]), buf: "" };
        } else if (tag === "p" || tag === "li" || tag === "td" || tag === "th") {
          flush();
          aktiv = { type: "para", level: null, buf: "" };
        } else if (tag === "br" && aktiv) {
          aktiv.buf += " ";
        }
      } else if (erBlokkTag(tag)) {
        flush();
      }
    } else if (tok && aktiv) {
      aktiv.buf += tok;
    }
  }
  flush();
  return blokker;
}

/**
 * Bygger chunks fra DOCX-blokker. Hver overskrift starter en ny seksjon og settes som
 * `sectionTitle`/`sectionLevel`; overskriftsteksten prependes chunk-teksten så den er
 * søkbar. Avsnitt akkumuleres til `MAKS_CHUNK` og deles så. En overskrift uten brødtekst
 * gir fortsatt en egen chunk (ellers ville overskriften forsvunnet fra søk).
 */
function byggDocxChunks(blokker: DocxBlokk[]): DocxChunk[] {
  const chunks: DocxChunk[] = [];
  let index = 0;
  let overskrift: string | null = null;
  let nivå: number | null = null;
  let overskriftEmittert = false;
  let buffer = "";

  const flush = () => {
    const tekst = buffer.trim();
    if (tekst || (overskrift && !overskriftEmittert)) {
      const chunkText = overskrift
        ? tekst
          ? `${overskrift}\n\n${tekst}`
          : overskrift
        : tekst;
      chunks.push({
        chunkIndex: index++,
        chunkText,
        sectionTitle: overskrift,
        sectionLevel: nivå,
        nsCode: detekterNsKode(chunkText),
      });
      overskriftEmittert = true;
    }
    buffer = "";
  };

  for (const b of blokker) {
    if (b.type === "heading") {
      flush();
      overskrift = b.text;
      nivå = b.level;
      overskriftEmittert = false;
      continue;
    }
    if (buffer.length + b.text.length > MAKS_CHUNK && buffer.length > 0) {
      flush();
    }
    buffer += (buffer ? "\n\n" : "") + b.text;
  }
  flush();
  return chunks;
}

// Zip-bomb-vern for DOCX (RETUR 2). DOCX er en ZIP; mammoth (via jszip) pakker HELE arkivet
// ut IN-PROCESS i web-containeren FØR vi ser noe — en dekompresjonsbombe (noen KB → gigabyte)
// gir OOM som tar ned frontend for ALLE. De deklarerte størrelsene i ZIP-katalogen KAN
// forfalskes (liten deklarert, enorm faktisk strøm), så vi stoler ikke på dem. I stedet
// pakker vi ut hver entry SELV med et hardt byte-budsjett (inflateRawSync + maxOutputLength
// avbryter og kaster idet budsjettet overskrides — allokeringen er bundet til budsjettet),
// og mater mammoth en REN ZIP (STORED, ærlige størrelser + CRC) av de verifiserte entriene.
const DOCX_MAKS_UTPAKKET = 50 * 1024 * 1024; // 50 MB utpakket total (hardt tak)
export const DOCX_UGYLDIG_MELDING =
  "Filen er for stor eller ugyldig for søk (maks 50 MB utpakket). Del opp eller lagre som PDF.";

const LFH_SIG = 0x04034b50; // local file header
const CDH_SIG = 0x02014b50; // central directory header
const EOCD_SIG = 0x06054b50; // end of central directory

interface ZipEntry {
  navn: string;
  metode: number; // 0 = stored, 8 = deflate
  lokalOffset: number; // offset til local file header
  kompStr: number; // komprimert størrelse (katalog — kan lyve, kun til slicing)
}

/** Les central directory til en entry-liste. Returnerer null hvis ikke en lesbar ZIP. */
function lesZipKatalog(buffer: Buffer): ZipEntry[] | null {
  if (buffer.length < 22) return null;
  let eocd = -1;
  const minPos = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= minPos; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  let p = buffer.readUInt32LE(eocd + 16); // central-dir-offset
  const entries: ZipEntry[] = [];
  while (p + 46 <= buffer.length && buffer.readUInt32LE(p) === CDH_SIG) {
    const metode = buffer.readUInt16LE(p + 10);
    const kompStr = buffer.readUInt32LE(p + 20);
    const navnLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const kommentarLen = buffer.readUInt16LE(p + 32);
    const lokalOffset = buffer.readUInt32LE(p + 42);
    const navn = buffer.toString("utf-8", p + 46, p + 46 + navnLen);
    entries.push({ navn, metode, lokalOffset, kompStr });
    p += 46 + navnLen + extraLen + kommentarLen;
  }
  return entries.length > 0 ? entries : null;
}

// CRC-32 (IEEE) — trengs for å bygge en ren STORED-ZIP mammoth/jszip godtar. Tabell lazy.
let crcTabell: Uint32Array | null = null;
function crc32(data: Buffer): number {
  if (!crcTabell) {
    crcTabell = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTabell[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTabell[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Pakk ut DOCX-en SELV med hardt byte-budsjett (RETUR 2) og returner en REN ZIP (STORED)
 * av de verifiserte entriene — trygg å gi til mammoth. Kaster `DOCX_UGYLDIG_MELDING` ved
 * bombe (total utpakket > 50 MB, eller en enkelt entry sprenger budsjettet) eller ugyldig ZIP.
 * Allokeringen er bundet til gjenværende budsjett pr. entry (`maxOutputLength`), så en entry
 * som LYVER om størrelsen kan ikke materialisere mer enn budsjettet før den kastes.
 */
export function pakkUtDocxTrygg(buffer: Buffer): Buffer {
  const entries = lesZipKatalog(buffer);
  if (!entries) throw new Error(DOCX_UGYLDIG_MELDING);

  const utpakkede: { navn: string; data: Buffer }[] = [];
  let brukt = 0;

  for (const e of entries) {
    if (e.navn.endsWith("/")) continue; // katalog-oppføring, ingen data
    // Finn faktisk data-start fra LOCAL header (egne navn-/extra-lengder).
    const lo = e.lokalOffset;
    if (lo + 30 > buffer.length || buffer.readUInt32LE(lo) !== LFH_SIG) {
      throw new Error(DOCX_UGYLDIG_MELDING);
    }
    const lNavnLen = buffer.readUInt16LE(lo + 26);
    const lExtraLen = buffer.readUInt16LE(lo + 28);
    const dataStart = lo + 30 + lNavnLen + lExtraLen;
    const dataSlutt = Math.min(dataStart + e.kompStr, buffer.length);
    if (dataStart > buffer.length) throw new Error(DOCX_UGYLDIG_MELDING);
    const komp = buffer.subarray(dataStart, dataSlutt);

    const rest = DOCX_MAKS_UTPAKKET - brukt;
    let data: Buffer;
    if (e.metode === 0) {
      if (komp.length > rest) throw new Error(DOCX_UGYLDIG_MELDING);
      data = Buffer.from(komp);
    } else if (e.metode === 8) {
      try {
        // maxOutputLength avbryter og kaster ERR_BUFFER_TOO_LARGE idet budsjettet nås —
        // uansett hva katalogen deklarerer. +1 så en entry PÅ grensen ikke feil-avvises.
        data = inflateRawSync(komp, { maxOutputLength: rest + 1 });
      } catch {
        throw new Error(DOCX_UGYLDIG_MELDING); // bombe (for stor) eller korrupt strøm
      }
    } else {
      throw new Error(DOCX_UGYLDIG_MELDING); // ukjent metode — ekte DOCX bruker kun 0/8
    }

    brukt += data.length;
    if (brukt > DOCX_MAKS_UTPAKKET) throw new Error(DOCX_UGYLDIG_MELDING);
    utpakkede.push({ navn: e.navn, data });
  }

  if (utpakkede.length === 0) throw new Error(DOCX_UGYLDIG_MELDING);
  return byggStoredZip(utpakkede);
}

/** Bygg en minimal ZIP med alle entries lagret ukomprimert (metode 0) + korrekt CRC. */
function byggStoredZip(entries: { navn: string; data: Buffer }[]): Buffer {
  const lokale: Buffer[] = [];
  const sentrale: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const navn = Buffer.from(e.navn, "utf-8");
    const crc = crc32(e.data);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(LFH_SIG, 0);
    lfh.writeUInt16LE(20, 4); // versjon
    lfh.writeUInt16LE(0, 6); // metode 0 (stored)
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(e.data.length, 18); // komprimert = utpakket (stored)
    lfh.writeUInt32LE(e.data.length, 22);
    lfh.writeUInt16LE(navn.length, 26);
    const lokalDel = Buffer.concat([lfh, navn, e.data]);
    lokale.push(lokalDel);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(CDH_SIG, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 10); // metode 0
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(e.data.length, 20);
    cdh.writeUInt32LE(e.data.length, 24);
    cdh.writeUInt16LE(navn.length, 28);
    cdh.writeUInt32LE(offset, 42); // local-header-offset
    sentrale.push(Buffer.concat([cdh, navn]));
    offset += lokalDel.length;
  }

  const lokalBlokk = Buffer.concat(lokale);
  const sentralBlokk = Buffer.concat(sentrale);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(sentralBlokk.length, 12);
  eocd.writeUInt32LE(lokalBlokk.length, 16);
  return Buffer.concat([lokalBlokk, sentralBlokk, eocd]);
}

/** Ekstraher søkbare chunks fra en DOCX-buffer. Ren funksjon — ingen DB. */
export async function ekstraherDocxChunks(buffer: Buffer): Promise<DocxChunk[]> {
  // RETUR 2: pakk ut selv med byte-budsjett og gi mammoth en ren, verifisert ZIP. Aldri gi
  // råbufferen til mammoth — jszip ville pakket ut hele bomba FØR noen størrelsessjekk.
  const rentZip = pakkUtDocxTrygg(buffer);
  const { value: html } = await mammoth.convertToHtml({ buffer: rentZip });
  const blokker = parseDocxBlokker(html);
  return byggDocxChunks(blokker);
}

async function prosesserDocx(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
): Promise<void> {
  const chunks = await ekstraherDocxChunks(buffer);

  if (chunks.length > 0) {
    await prisma.ftdDocumentChunk.createMany({
      data: chunks.map((c) => ({
        documentId,
        chunkIndex: c.chunkIndex,
        chunkText: c.chunkText,
        pageNumber: null,
        sectionTitle: c.sectionTitle,
        sectionLevel: c.sectionLevel,
        nsCode: c.nsCode,
        profile: "docx",
      })),
    });
  }

  const totalTekst = chunks.map((c) => c.chunkText).join(" ");
  await prisma.ftdDocument.update({
    where: { id: documentId },
    data: {
      wordCount: totalTekst.split(/\s+/).filter(Boolean).length,
    },
  });
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
 * Ekstraher tekst fra PDF med bevarte kolonneposisjoner via pdfjs-dist.
 * Grupperer tekstelementer etter y-posisjon (rad) og sorterer etter x (kolonne),
 * slik at tabellstrukturen bevares med mellomrom mellom kolonnene.
 */
export async function ekstraherPdfMedPosisjoner(buffer: Buffer): Promise<string> {
  // LEGACY-build (se ekstraherPdfSider) — self-polyfiller Promise.withResolvers.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const alleLinjer: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // Grupper tekstelementer etter y-posisjon (avrundet til 3px toleranse)
    const rader = new Map<number, Array<{ x: number; bredde: number; tekst: string }>>();
    for (const item of content.items) {
      const el = item as { str?: string; width?: number; transform?: number[] };
      if (!el.str?.trim() || !el.transform) continue;
      const y = Math.round(el.transform[5]! / 3) * 3;
      const x = Math.round(el.transform[4]!);
      const bredde = el.width ?? el.str.length * 4;
      if (!rader.has(y)) rader.set(y, []);
      rader.get(y)!.push({ x, bredde, tekst: el.str.trim() });
    }

    // Sorter rader etter y (fallende = topp til bunn i PDF)
    const sortertRader = [...rader.entries()].sort((a, b) => b[0] - a[0]);

    // Målrettet postnr-tail merge:
    // Når en rad har et postnr (x<90, format XX.YY.ZZ) og NESTE rad har
    // et kort siffer/punktum-fragment ved x<90, slå dem sammen.
    // Unngår sidedatoer (XX.XX.XXXX) ved å kreve postnr-format.
    const POSTNR_FMT = /^\d{2}\.\d{2}(?:\.\d{1,2})+$/;
    const TAIL_FMT = /^\d[\d.]*$/;
    for (let ri = 0; ri < sortertRader.length; ri++) {
      const items = sortertRader[ri]![1];
      items.sort((a, b) => a.x - b.x);

      // Finn postnr-element i venstre kolonne (x < 90)
      const pnrItem = items.find((it) => it.x < 90 && POSTNR_FMT.test(it.tekst));
      if (!pnrItem) continue;
      // Ikke merge datoer (DD.MM.YYYY)
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(pnrItem.tekst)) continue;

      if (ri + 1 >= sortertRader.length) continue;
      const nesteItems = sortertRader[ri + 1]![1];
      // Finn kort siffer-fragment i postnr-kolonnen på neste rad
      const tailItem = nesteItems.find((it) => it.x < 90 && TAIL_FMT.test(it.tekst) && it.tekst.length <= 5);
      if (!tailItem) continue;

      // Merge: legg tail til postnr — valider at resultatet har maks 2 siffer per segment
      const merged = pnrItem.tekst + tailItem.tekst;
      if (!/^\d{2}(?:\.\d{1,2})+$/.test(merged)) continue;
      pnrItem.tekst = merged;
      const idx = nesteItems.indexOf(tailItem);
      if (idx >= 0) nesteItems.splice(idx, 1);
    }

    for (const [_y, items] of sortertRader) {
      const linje = items.map((i) => i.tekst).join(" ");
      if (linje.trim()) alleLinjer.push(linje);
    }
  }

  await doc.destroy();
  return alleLinjer.join("\n");
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
/**
 * Ekstraher budsjett-poster fra NS 3420 mengdebeskrivelse PDF (pdfjs-dist tekst).
 *
 * Format (etter pdfjs-dist):
 *   00.03.01.1                          ← postnr (egen rad)
 *   TIMEARBEID, SAKSBEHANDLER/INGENIØR  ← beskrivelse
 *   Tid | time | 40,00 | 1 200,00 | 48 000,00  ← prislinje
 *
 * Prislinje: [type] [enhet] [mengde] [enhetspris] [sum]
 * - Pris og sum har alltid komma-desimaler (X XXX,XX)
 * - Mengde kan være heltall (40) eller desimal (40,00)
 * - Sub-poster (.1, .2) refererer til siste fulle postnr
 */
function ekstraherBudsjettPosterFraPdf(
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
  nsKode: string | null;
  fullNsTekst: string | null;
}> {
  // Norsk desimaltall: "1 200,00", "40,00"
  const DESIMAL_PAT = /\d{1,3}(?:\s\d{3})*,\d{2}/;
  // Heltall eller desimaltall som mengde: "40" eller "40,00" eller "9 000"
  const MENGDE_PAT = /\d{1,3}(?:\s\d{3})*(?:,\d+)?/;
  // Postnr: "00.03.01.1", "03.01.01.3.7" etc.
  const POSTNR_PAT = /^(\d{2}(?:\.\d{1,2})+)\s*$/;
  // Sub-postnr: ".1", ".2"
  const SUB_POSTNR_PAT = /^\.(\d+)\s*$/;
  // Prislinje: slutter med minst 2 desimaltall (enhetspris + sum)
  // Format: [type] [enhet] [mengde] [enhetspris,XX] [sum,XX]
  const PRIS_RE = /^(.+?)\s+(\S+)\s+(\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s+(\d{1,3}(?:\s\d{3})*,\d{2})\s+(\d{1,3}(?:\s\d{3})*,\d{2})$/;
  // Enhet-mønster
  const ENHET_PAT = /^[A-Za-zÆØÅæøå²³/\-\.]+$/;

  function tilTall(s: string): number {
    return parseFloat(s.replace(/\s/g, "").replace(",", "."));
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
    nsKode: string | null;
    fullNsTekst: string | null;
  }> = [];

  // Postnr med ekstra tekst: "00.03.01.3 | Bygg" → postnr + sub-beskrivelse
  const POSTNR_MED_TEKST = /^(\d{2}(?:\.\d{1,2})+)\s+(.+)$/;
  // NS 3420 kode: "KB6.33", "FB1.251A", "FS2.333014022", "AM3.868A"
  const NS_KODE_PAT = /^[A-Z]{1,3}\d[\w.]*$/;

  let gjeldende: {
    postnr: string;
    beskrivelse: string;
    nsKode: string | null;
    harPrislinje: boolean;
  } | null = null;

  // Ventende sub-info: settes når postnr-rad med tekst dukker opp FØR prislinje
  let ventendeSub: { postnr: string; beskrivelse: string; nsKode: string | null } | null = null;

  // Siste post som ble lagt til — for å tilordne .1/.2 sub-nummer etterpå
  let sistePostIdx = -1;

  /** Lagre gjeldende som seksjonspost uten priser (hvis den aldri fikk direkte prislinje) */
  function lagreSeksjonspost() {
    if (gjeldende && !gjeldende.harPrislinje && gjeldende.beskrivelse) {
      poster.push({
        projectId, documentId,
        postnr: gjeldende.postnr,
        beskrivelse: gjeldende.beskrivelse.slice(0, 2000),
        enhet: null, mengdeAnbud: null, enhetspris: null, sumAnbud: null,
        nsKode: gjeldende.nsKode, fullNsTekst: null,
      });
    }
  }

  /** Marker at gjeldende fikk en DIREKTE prislinje (ikke sub) */
  function markerPrislinje() {
    if (gjeldende) gjeldende.harPrislinje = true;
  }

  for (let i = 0; i < linjer.length; i++) {
    const linje = linjer[i]!.trim();
    if (!linje) continue;

    // Hopp over headere og sumlinjer
    if (/^Sum\s+(denne|Kapittel)/i.test(linje)) continue;
    if (/^Akkumulert/i.test(linje)) continue;
    if (/^Postnr\b/i.test(linje)) continue;
    if (/^Side\b/i.test(linje)) continue;
    if (/^Kapittel:/i.test(linje)) continue;
    if (/^Prosjekt:/i.test(linje)) continue;
    if (/^Tromsø/i.test(linje)) continue;

    // Sub-postnr (.1, .2) ALENE på rad — tilordne til FORRIGE post
    const subMatch = SUB_POSTNR_PAT.exec(linje);
    if (subMatch && sistePostIdx >= 0) {
      const sistePost = poster[sistePostIdx]!;
      sistePost.postnr = (sistePost.postnr ?? "") + "." + subMatch[1]!;
      continue;
    }

    // Prislinje med sub-nr: ".2 Tid time 40,00 1 200,00 48 000,00"
    const subPrisMatch = /^\.(\d+)\s+/.exec(linje);
    if (subPrisMatch && gjeldende) {
      // Resten av linjen er prislinjen — fjern sub-nummeret og parse som vanlig
      const subNr = subPrisMatch[1]!;
      const prisLinje = linje.slice(subPrisMatch[0].length);

      const alleTallSub: Array<{ val: number; start: number; end: number }> = [];
      const ALLE_TALL_SUB = /\d{1,3}(?:\s\d{3})*,\d+|\b\d+\b/g;
      let tm: RegExpExecArray | null;
      while ((tm = ALLE_TALL_SUB.exec(prisLinje)) !== null) {
        const raw = tm[0];
        if (tm.index > 0 && prisLinje[tm.index - 1] === ".") continue;
        if (tm.index + raw.length < prisLinje.length && prisLinje[tm.index + raw.length] === ".") continue;
        alleTallSub.push({ val: tilTall(raw), start: tm.index, end: tm.index + raw.length });
      }

      if (alleTallSub.length >= 2) {
        const sisteTo = alleTallSub.slice(-2);
        const prisRaw = prisLinje.slice(sisteTo[0]!.start, sisteTo[0]!.end);
        const sumRaw = prisLinje.slice(sisteTo[1]!.start, sisteTo[1]!.end);
        if (prisRaw.includes(",") && sumRaw.includes(",")) {
          let mengde: number, pris: number, sum: number;
          if (alleTallSub.length >= 3) {
            const n = alleTallSub.slice(-3);
            mengde = n[0]!.val; pris = n[1]!.val; sum = n[2]!.val;
          } else {
            mengde = 1; pris = sisteTo[0]!.val; sum = sisteTo[1]!.val;
          }

          const mengdeStart = alleTallSub.length >= 3 ? alleTallSub.slice(-3)[0]!.start : sisteTo[0]!.start;
          const forMengde = prisLinje.slice(0, mengdeStart).trim();
          const forTokens = forMengde.split(/\s+/);
          const enhetKandidat = forTokens[forTokens.length - 1] ?? "";

          const postBeskr = ventendeSub?.beskrivelse || gjeldende.beskrivelse;
          const postNsKode = ventendeSub?.nsKode || gjeldende.nsKode;

          sistePostIdx = poster.length;
          poster.push({
            projectId, documentId,
            postnr: gjeldende.postnr + "." + subNr,
            beskrivelse: postBeskr.slice(0, 500) || null,
            enhet: ENHET_PAT.test(enhetKandidat) && enhetKandidat.length <= 10 ? enhetKandidat : null,
            mengdeAnbud: mengde, enhetspris: pris, sumAnbud: sum,
            nsKode: postNsKode, fullNsTekst: null,
          });
          // Lagre linje-indeks for spesifikasjonstekst-samling
          (poster[poster.length - 1] as Record<string, unknown>)._prisLinjeIdx = i;
          ventendeSub = null;
          continue;
        }
      }
    }

    // Postnr ALENE på rad (ingen ekstra tekst) → ny hovedpost
    const postnrAlene = POSTNR_PAT.exec(linje);
    if (postnrAlene) {
      lagreSeksjonspost();
      const nyttPostnr = postnrAlene[1]!;
      let beskr = "";
      let nsKode: string | null = null;
      // Samle ALLE linjer frem til neste postnr, prislinje eller sub-postnr
      for (let j = i + 1; j < linjer.length; j++) {
        const nl = linjer[j]!.trim();
        if (!nl) continue;
        if (POSTNR_PAT.test(nl) || POSTNR_MED_TEKST.test(nl) || SUB_POSTNR_PAT.test(nl)) break;
        if (/^Sum\s/i.test(nl) || /^Akkumulert/i.test(nl)) break;
        if (/^Postnr\b/i.test(nl) || /^Side\b/i.test(nl) || /^Kapittel:/i.test(nl) || /^Prosjekt:/i.test(nl) || /^Tromsø/i.test(nl)) continue;
        const desimaler = nl.match(/\d{1,3}(?:\s\d{3})*,\d{2}/g);
        if (desimaler && desimaler.length >= 2 && nl.split(/\s+/).length <= 8) break;
        if (/^\.(\d+)\s+/.test(nl)) break;
        beskr += (beskr ? "\n" : "") + nl;
      }
      gjeldende = { postnr: nyttPostnr, beskrivelse: beskr, nsKode, harPrislinje: false };
      ventendeSub = null;
      continue;
    }

    // Postnr MED tekst: "00.03.01.3 | Bygg" eller "00.03.03.8 | FB1.251A"
    const postnrMedTekst = POSTNR_MED_TEKST.exec(linje);
    if (postnrMedTekst) {
      const postnr = postnrMedTekst[1]!;
      const tekst = postnrMedTekst[2]!.trim();

      // Sjekk om teksten er en NS-kode
      const erNsKode = NS_KODE_PAT.test(tekst);

      if (erNsKode) {
        // NS-kode følger postnr — samle beskrivelse fra neste linjer
        // Første linje etter kan ha postnr-tail: "0 BUSKER" → postnr += "0", beskr = "BUSKER"
        let beskr = "";
        let fullPostnr = postnr;
        let postnrMerget = false;
        const POSTNR_TAIL = /^(\d[\d.]*\d|\d)\s+([A-ZÆØÅ].+)$/;

        for (let j = i + 1; j < linjer.length && j <= i + 15; j++) {
          const nl = linjer[j]!.trim();
          if (!nl) continue;
          if (POSTNR_PAT.test(nl) || POSTNR_MED_TEKST.test(nl) || SUB_POSTNR_PAT.test(nl)) break;
          if (/^Sum\s/i.test(nl) || /^Akkumulert/i.test(nl)) break;
          const desimaler = nl.match(/\d{1,3}(?:\s\d{3})*,\d{2}/g);
          if (desimaler && desimaler.length >= 2 && nl.split(/\s+/).length <= 8) break;
          // Sub-prislinje (.1 Tid time...)
          if (/^\.(\d+)\s+/.test(nl)) break;

          // Postnr-tail: "0 BUSKER" eller bare "0" (siffer alene, beskrivelse på neste linje)
          if (!postnrMerget) {
            // Case 1: "0 BUSKER" — siffer + UPPERCASE på samme linje
            const tailMatch = POSTNR_TAIL.exec(nl);
            if (tailMatch) {
              fullPostnr = postnr + tailMatch[1]!;
              beskr = tailMatch[2]!;
              postnrMerget = true;
              continue;
            }
            // Case 2: bare siffer(e) alene — "0", "26", "1.2"
            if (/^\d[\d.]*$/.test(nl) && nl.length <= 4) {
              fullPostnr = postnr + nl;
              postnrMerget = true;
              continue;
            }
            postnrMerget = true;
          }

          beskr += (beskr ? " " : "") + nl;
        }

        if (gjeldende && postnr === gjeldende.postnr) {
          // Samme base-postnr → sub-post under gjeldende
          ventendeSub = { postnr: fullPostnr, beskrivelse: beskr, nsKode: tekst };
        } else {
          lagreSeksjonspost();
          gjeldende = { postnr: fullPostnr, beskrivelse: beskr, nsKode: tekst, harPrislinje: false };
          ventendeSub = null;
        }
      } else {
        if (gjeldende && postnr === gjeldende.postnr) {
          ventendeSub = { postnr, beskrivelse: tekst, nsKode: null };
        } else {
          lagreSeksjonspost();
          // Samle full tekst for seksjon (postnr med beskrivelse, ikke NS-kode)
          let fullBeskr = tekst;
          for (let j = i + 1; j < linjer.length; j++) {
            const nl = linjer[j]!.trim();
            if (!nl) continue;
            if (POSTNR_PAT.test(nl) || POSTNR_MED_TEKST.test(nl) || SUB_POSTNR_PAT.test(nl)) break;
            if (/^Sum\s/i.test(nl) || /^Akkumulert/i.test(nl)) break;
            if (/^Postnr\b/i.test(nl) || /^Side\b/i.test(nl) || /^Kapittel:/i.test(nl) || /^Prosjekt:/i.test(nl) || /^Tromsø/i.test(nl)) continue;
            const desimaler = nl.match(/\d{1,3}(?:\s\d{3})*,\d{2}/g);
            if (desimaler && desimaler.length >= 2 && nl.split(/\s+/).length <= 8) break;
            if (/^\.(\d+)\s+/.test(nl)) break;
            fullBeskr += "\n" + nl;
          }
          gjeldende = { postnr, beskrivelse: fullBeskr, nsKode: null, harPrislinje: false };
          ventendeSub = null;
        }
      }
      continue;
    }

    // Sjekk prislinje: finn alle tall
    const alleTall: Array<{ val: number; start: number; end: number }> = [];
    const ALLE_TALL_G = /\d{1,3}(?:\s\d{3})*,\d+|\b\d+\b/g;
    let tallMatch: RegExpExecArray | null;
    ALLE_TALL_G.lastIndex = 0;
    while ((tallMatch = ALLE_TALL_G.exec(linje)) !== null) {
      const raw = tallMatch[0];
      if (tallMatch.index > 0 && linje[tallMatch.index - 1] === ".") continue;
      if (tallMatch.index + raw.length < linje.length && linje[tallMatch.index + raw.length] === ".") continue;
      alleTall.push({ val: tilTall(raw), start: tallMatch.index, end: tallMatch.index + raw.length });
    }

    // Trenger minst 2 tall, og de to siste MÅ ha komma (pris + sum)
    if (alleTall.length >= 2 && gjeldende) {
      const sisteTo = alleTall.slice(-2);
      const prisRaw = linje.slice(sisteTo[0]!.start, sisteTo[0]!.end);
      const sumRaw = linje.slice(sisteTo[1]!.start, sisteTo[1]!.end);
      if (!prisRaw.includes(",") || !sumRaw.includes(",")) continue;

      let mengde: number;
      let pris: number;
      let sum: number;

      if (alleTall.length >= 3) {
        const n = alleTall.slice(-3);
        mengde = n[0]!.val;
        pris = n[1]!.val;
        sum = n[2]!.val;
      } else {
        mengde = 1;
        pris = sisteTo[0]!.val;
        sum = sisteTo[1]!.val;
      }

      // Finn enhet
      const mengdeStart = alleTall.length >= 3 ? alleTall.slice(-3)[0]!.start : sisteTo[0]!.start;
      const forMengde = linje.slice(0, mengdeStart).trim();
      const forTokens = forMengde.split(/\s+/);
      const enhetKandidat = forTokens[forTokens.length - 1] ?? "";

      // Bruk ventende sub-info hvis tilgjengelig
      let postPostnr = gjeldende.postnr;
      let postBeskr = gjeldende.beskrivelse;
      let postNsKode = gjeldende.nsKode;
      if (ventendeSub) {
        if (ventendeSub.beskrivelse) postBeskr = ventendeSub.beskrivelse;
        if (ventendeSub.nsKode) postNsKode = ventendeSub.nsKode;
      }

      sistePostIdx = poster.length;
      poster.push({
        projectId,
        documentId,
        postnr: postPostnr,
        beskrivelse: postBeskr.slice(0, 500) || null,
        enhet: ENHET_PAT.test(enhetKandidat) && enhetKandidat.length <= 10 ? enhetKandidat : null,
        mengdeAnbud: mengde,
        enhetspris: pris,
        sumAnbud: sum,
        nsKode: postNsKode,
        fullNsTekst: null,
      });
      (poster[poster.length - 1] as Record<string, unknown>)._prisLinjeIdx = i;

      // Marker direkte prislinje (ikke via ventendeSub som er sub-post)
      if (gjeldende && !ventendeSub) gjeldende.harPrislinje = true;
      ventendeSub = null;
      continue;
    }
  }

  // Lagre siste seksjonspost
  lagreSeksjonspost();

  // Andre pass: samle spesifikasjonstekst etter hver prislinje
  for (let p = 0; p < poster.length; p++) {
    const post = poster[p]!;
    const startIdx = (post as { _prisLinjeIdx?: number })._prisLinjeIdx;
    if (startIdx === undefined) continue;

    // Finn neste posts prislinje-indeks (eller slutt)
    let sluttIdx = linjer.length;
    if (p + 1 < poster.length) {
      const nesteStart = (poster[p + 1] as { _prisLinjeIdx?: number })._prisLinjeIdx;
      if (nesteStart !== undefined) sluttIdx = nesteStart;
    }

    // Samle tekst fra linjene etter prislinjen til neste post
    const spekLinjer: string[] = [];
    for (let j = startIdx + 1; j < sluttIdx; j++) {
      const nl = linjer[j]?.trim() ?? "";
      if (!nl) continue;
      // Hopp over navigasjonslinjer
      if (/^Sum\s/i.test(nl) || /^Akkumulert/i.test(nl) || /^Postnr\b/i.test(nl)) continue;
      if (/^Side\b/i.test(nl) || /^Kapittel:/i.test(nl) || /^Prosjekt:/i.test(nl) || /^Tromsø/i.test(nl)) continue;
      // Stopp ved neste postnr eller sub-prislinje
      if (POSTNR_PAT.test(nl) || POSTNR_MED_TEKST.test(nl)) break;
      if (/^\.(\d+)\s+/.test(nl)) break;
      // Hopp over sub-postnr linjer (.1, .2 alene)
      if (SUB_POSTNR_PAT.test(nl)) continue;
      spekLinjer.push(nl);
    }

    if (spekLinjer.length > 0) {
      // Legg spesifikasjonstekst til beskrivelsen (ikke fullNsTekst — det er for NS-standard)
      const spekTekst = spekLinjer.join("\n");
      const eksisterende = post.beskrivelse ?? "";
      post.beskrivelse = (eksisterende + "\n" + spekTekst).trim().slice(0, 2000);
    }

    // Fjern midlertidig felt
    delete (post as Record<string, unknown>)._prisLinjeIdx;
  }

  // Tredje pass: dedupliser postnr — legg til auto-sub-nummer for duplikater
  const postnrTeller = new Map<string, number>();
  for (const post of poster) {
    if (!post.postnr) continue;
    const ant = (postnrTeller.get(post.postnr) ?? 0) + 1;
    postnrTeller.set(post.postnr, ant);
  }
  // Samle alle brukte postnr
  const bruktePostnr = new Set(poster.map((p) => p.postnr).filter(Boolean));
  // For hvert duplisert postnr, nummerer dem sekvensielt
  const postnrSett = new Map<string, number>();
  for (const post of poster) {
    if (!post.postnr) continue;
    const totalt = postnrTeller.get(post.postnr) ?? 1;
    if (totalt <= 1) continue;
    const nr = (postnrSett.get(post.postnr) ?? 0) + 1;
    postnrSett.set(post.postnr, nr);
    if (nr > 1) {
      // Finn et ledig sub-nummer som ikke kolliderer
      let subNr = nr;
      while (bruktePostnr.has(post.postnr + "." + subNr)) subNr++;
      const nyttPostnr = post.postnr + "." + subNr;
      post.postnr = nyttPostnr;
      bruktePostnr.add(nyttPostnr);
    }
  }

  return poster;
}

interface NotaHeaderVerdier {
  utfortPr: Date | null;
  utfortTotalt: number | null;
  utfortForrige: number | null;
  utfortDenne: number | null;
  innestaaende: number | null;
  innestaaendeForrige: number | null;
  innestaaendeDenne: number | null;
  nettoDenne: number | null;
  mva: number | null;
  sumInkMva: number | null;
}

function ekstraherNotaHeader(linjer: string[]): NotaHeaderVerdier {
  const N = /-?\d{1,3}(?:\s\d{3})*,\d+/;
  function tilDes(s: string): number {
    return parseFloat(s.replace(/\s/g, "").replace(",", "."));
  }
  function finnVerdi(label: RegExp): number | null {
    for (const l of linjer) {
      if (label.test(l)) {
        const m = l.match(N);
        if (m) return tilDes(m[0]);
      }
    }
    return null;
  }

  // Dato: "Utført pr: 20.10.2025" eller "Utført pr 20.10.2025"
  let utfortPr: Date | null = null;
  for (const l of linjer) {
    const dm = l.match(/Utf.rt\s+pr[.:]*\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    if (dm) {
      utfortPr = new Date(parseInt(dm[3]!), parseInt(dm[2]!) - 1, parseInt(dm[1]!));
      break;
    }
  }

  return {
    utfortPr,
    utfortTotalt: finnVerdi(/Utf.rt\s+totalt/i),
    utfortForrige: finnVerdi(/Utf.rt\s+forrige/i),
    utfortDenne: finnVerdi(/Utf.rt\s+denne/i),
    innestaaende: finnVerdi(/Innest.ende\s+(?!forrige|denne)-?\d/i) ?? finnVerdi(/^\s*Innest.ende\s*-?\d/i),
    innestaaendeForrige: finnVerdi(/Innest.ende\s+forrige/i),
    innestaaendeDenne: finnVerdi(/Innest.ende\s+denne/i),
    nettoDenne: finnVerdi(/Netto\s+denne/i),
    mva: finnVerdi(/^\s*\+?\s*Mva\.?\s/i),
    sumInkMva: finnVerdi(/Sum\s+inkludert/i),
  };
}

function ekstraherNotaPosterFraPdf(
  fullTekst: string,
  projectId: string,
  documentId: string,
): {
  poster: Array<{
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
  }>;
  header: NotaHeaderVerdier;
} {
  // Norsk desimaltall: "38 000,00", "1,00", "0,00"
  const N_PAT = /-?\d{1,3}(?:\s\d{3})*,\d+/g;
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
    importNotat: string | null;
  }> = [];

  let tabellStartet = false;
  let droppetPoster = 0;
  const headerLinjer: string[] = [];

  for (const rawLinje of linjer) {
    const linje = rawLinje.trim();

    // Vent på første "Postnr...Beskrivelse"-header (kan være sammenhengende i PDF)
    if (!tabellStartet) {
      headerLinjer.push(linje);
      if (/Postnr/i.test(linje) && /Beskrivelse/i.test(linje)) {
        tabellStartet = true;
      }
      continue;
    }

    // Gjentatt header-linje på nye sider — hopp over (preventiv)
    if (/Postnr/i.test(linje) && /Beskrivelse/i.test(linje)) continue;

    if (!linje || erSkipLinje(linje)) continue;

    // Parse post-linje
    const pm = POSTNR_PAT.exec(linje);
    if (!pm) {
      // Logg linjer som har tall men ikke matcher postnr-format
      if (/\d{1,3}(?:\s\d{3})*,\d+/.test(linje) && !/^Sum/i.test(linje)) {
        console.warn(`[FTD-DEBUG] Ingen postnr-match, men har tall: "${linje.slice(0, 200)}"`);
      }
      continue;
    }

    const postnr = pm[1]!;
    const restStart = pm[0].length;

    // Finn alle norske desimaltall på linjen
    const nums: Array<{ value: number; start: number; end: number }> = [];
    N_PAT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = N_PAT.exec(linje)) !== null) {
      nums.push({ value: tilDesimal(m[0]), start: m.index, end: m.index + m[0].length });
    }

    if (nums.length < 11) {
      droppetPoster++;
      continue;
    }

    // Bruk de 11 SISTE tallene — beskrivelsen kan inneholde tall (Ø225, 3,0m)
    const n = nums.slice(-11);

    // Enhet: alfabetisk token mellom tall n[0] og n[1]
    const mellom = linje.slice(n[0]!.end, n[1]!.start).trim();
    const enhet = mellom && UNIT_PAT.test(mellom) && mellom.length <= 10 ? mellom : null;

    // Beskrivelse: tekst mellom postnr og første av de 11 siste tallene
    const beskrivelse = linje.slice(restStart, n[0]!.start).trim();

    // Valider mengde × enhetspris ≈ sum — fikser falske tusenskille
    // "tilstandsklasse 2 400,00" → regex gir mengde=2400, men sum/pris=400
    const korrigeringer: string[] = [];

    function validerMengde(mengde: number, pris: number, sum: number, felt: string): number {
      if (mengde > 0 && pris > 0 && sum > 0) {
        const beregnet = mengde * pris;
        if (Math.abs(beregnet - sum) > sum * 0.01) {
          const korrigert = Math.round((sum / pris) * 100) / 100;
          if (korrigert > 0 && Math.abs(korrigert * pris - sum) < sum * 0.01) {
            korrigeringer.push(`${felt}: ${mengde} → ${korrigert} (sum/pris)`);
            return korrigert;
          }
        }
      }
      return mengde;
    }

    const pris = n[4]!.value;
    const mengdeAnbud = validerMengde(n[0]!.value, pris, n[5]!.value, "mengdeAnbud");
    const mengdeDenne = validerMengde(n[2]!.value, pris, n[7]!.value, "mengdeDenne");
    const mengdeTotal = validerMengde(n[3]!.value, pris, n[9]!.value, "mengdeTotal");

    poster.push({
      projectId,
      documentId,
      postnr,
      beskrivelse: beskrivelse.slice(0, 500) || null,
      enhet,
      mengdeAnbud,
      enhetspris: pris,
      sumAnbud: n[5]!.value,
      mengdeDenne,
      mengdeTotal,
      verdiDenne: n[7]!.value,
      verdiTotal: n[9]!.value,
      prosentFerdig: n[10]!.value,
      importNotat: korrigeringer.length > 0 ? korrigeringer.join("; ") : null,
    });
  }

  console.warn(`[FTD-DEBUG] Nota-oppsummering: ${poster.length} poster funnet, ${droppetPoster} droppet (< 11 tall)`);
  if (poster.length > 0) {
    const sumVerdiDenne = poster.reduce((s, p) => s + (p.verdiDenne ?? 0), 0);
    const sumVerdiTotal = poster.reduce((s, p) => s + (p.verdiTotal ?? 0), 0);
    console.warn(`[FTD-DEBUG] Sum verdiDenne: ${sumVerdiDenne.toFixed(2)}, Sum verdiTotal: ${sumVerdiTotal.toFixed(2)}`);
  }

  const header = ekstraherNotaHeader(headerLinjer);
  console.warn(`[FTD-DEBUG] Header: utførtPr=${header.utfortPr?.toISOString()}, utførtDenne=${header.utfortDenne}, innestående=${header.innestaaende}, sumInkMva=${header.sumInkMva}`);

  return { poster, header };
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

// Automatisk embedding av chunks skjer nå via `embeddDokumentChunks` i
// embedding-service.ts (HTTP mot NORBERT_URL, samme vei som den manuelle løkka).
// Den gamle Python-subprosessen (`norbert-env/bin/python3` + `norbert-embed.py`)
// fantes aldri i Docker-containerne og hoppet stille over — chunks ble stående
// `pending` for alltid (prod 2026-10-14). Feiler embedding-serveren nå, settes
// chunkene til `failed` (synlig), ikke stille `pending`.

// ---------------------------------------------------------------------------
// Oppdater budsjett-poster med nota-verdier
// ---------------------------------------------------------------------------

async function oppdaterBudsjettFraNota(
  prisma: PrismaClient,
  kontraktId: string,
  notaDokumentId: string,
): Promise<void> {
  // Finn budsjett-dokumentet (anbudsgrunnlag) for kontrakten
  const budsjettDok = await prisma.ftdDocument.findFirst({
    where: { kontraktId, docType: "anbudsgrunnlag", isActive: true },
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });
  if (!budsjettDok) return;

  // Hent budsjett-poster
  const budsjettPoster = await prisma.ftdSpecPost.findMany({
    where: { documentId: budsjettDok.id },
    select: { id: true, postnr: true, mengdeAnbud: true, enhetspris: true, sumAnbud: true },
  });
  const budsjettMap = new Map<string, (typeof budsjettPoster)[number]>();
  for (const bp of budsjettPoster) {
    if (bp.postnr) budsjettMap.set(bp.postnr, bp);
  }

  // Hent nota-poster med verdier
  const notaPoster = await prisma.ftdSpecPost.findMany({
    where: { documentId: notaDokumentId, enhetspris: { not: null } },
    select: { postnr: true, mengdeAnbud: true, enhetspris: true, sumAnbud: true },
  });

  let oppdatert = 0;
  for (const np of notaPoster) {
    if (!np.postnr || !np.enhetspris) continue;
    const bp = budsjettMap.get(np.postnr);
    if (!bp) continue;

    const notaPris = Number(np.enhetspris);
    if (notaPris === 0) continue;

    const bpPris = bp.enhetspris != null ? Number(bp.enhetspris) : null;
    const bpMengde = bp.mengdeAnbud != null ? Number(bp.mengdeAnbud) : null;
    const bpSum = bp.sumAnbud != null ? Number(bp.sumAnbud) : null;

    const manglerPris = bpPris == null || bpPris === 0;
    const manglerMengde = bpMengde == null || bpMengde === 0;
    const manglerSum = bpSum == null || bpSum === 0;
    const prisAvvik = bpPris != null && bpPris !== 0
      ? Math.abs(bpPris - notaPris) / notaPris
      : 0;

    if (manglerPris || manglerMengde || manglerSum || prisAvvik > 0.5) {
      const data: Record<string, number> = {};
      if (np.enhetspris != null && (manglerPris || prisAvvik > 0.5)) data.enhetspris = Number(np.enhetspris);
      if (np.mengdeAnbud != null && (manglerMengde || prisAvvik > 0.5)) data.mengdeAnbud = Number(np.mengdeAnbud);
      if (np.sumAnbud != null && (manglerSum || prisAvvik > 0.5)) data.sumAnbud = Number(np.sumAnbud);

      if (Object.keys(data).length > 0) {
        await prisma.ftdSpecPost.update({ where: { id: bp.id }, data });
        oppdatert++;
      }
    }
  }

  if (oppdatert > 0) {
    console.log(`[FTD] Oppdaterte ${oppdatert} budsjett-poster med nota-verdier (kontrakt ${kontraktId})`);
  }
}
