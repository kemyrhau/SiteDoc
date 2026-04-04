/**
 * PDF-splitting — splitter målebrev per NS-kode/postnr.
 *
 * Flyt:
 * 1. OCR (allerede kjørt) → sideData med tekst per side
 * 2. Ekstraher NS-kode fra hver side (linje 1-10, eller POST-regex)
 * 3. Grupper sider per kode
 * 4. For hver kode: opprett/append PDF i undermapper
 * 5. Lagre kilde-info (splitSources) for sporbarhet
 */
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import type { PrismaClient } from "@sitedoc/db";
import { randomUUID } from "node:crypto";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// NS-kode: 1-3 bokstaver + siffer + valgfri punktum/siffer/bokstav (AJ1.1A, FD2.11, AK3.335)
const NS_KODE_PAT = /^([A-Z]{1,3}\d[\w.]*[A-Z]?)\s*$/m;

// POST-regex (fallback for prosjekter som bruker numerisk format)
const POST_PAT = /POST\s*(?:nr\.?\s*)?(\d{1,2}(?:[.\-]\d{1,2}){1,6})/gi;

interface SplitKilde {
  filnavn: string;
  dokumentId: string;
  kildeSider: number[];   // sidenr i kildefilen
  startSide: number;      // startside i split-PDFen
}

/** Ekstraher NS-kode eller postnr fra sidetekst */
function finnPostIdentifikator(tekst: string): string | null {
  // 1. Søk NS-kode som egen linje (typisk linje 5 i målebrev)
  const linjer = tekst.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const linje of linjer.slice(0, 10)) {
    const m = NS_KODE_PAT.exec(linje);
    if (m && m[1]!.length >= 2 && m[1]!.length <= 15) {
      return m[1]!;
    }
  }

  // 2. Fallback: POST-regex
  POST_PAT.lastIndex = 0;
  const postMatch = POST_PAT.exec(tekst);
  if (postMatch) {
    return postMatch[1]!.replace(/-/g, ".");
  }

  return null;
}

/** Grupper sider per NS-kode med arv fra forrige side */
function grupperSiderPerPost(
  sideData: Array<{ side: number; tekst: string }>,
): Map<string, number[]> {
  const grupper = new Map<string, number[]>();
  let forrigeKode: string | null = null;

  for (const { side, tekst } of sideData) {
    const kode = finnPostIdentifikator(tekst);
    if (kode) {
      forrigeKode = kode;
    }

    const brukKode = kode ?? forrigeKode;
    if (brukKode) {
      const sider = grupper.get(brukKode) ?? [];
      sider.push(side);
      grupper.set(brukKode, sider);
    }
  }

  return grupper;
}

/**
 * Splitt en målebrev-PDF per NS-kode og lagre i undermapper.
 * Lagrer kilde-info (splitSources) for sporbarhet i UI.
 */
export async function splittMalebrevPdf(
  prisma: PrismaClient,
  projectId: string,
  parentFolderId: string,
  originalBuffer: Buffer,
  sideData: Array<{ side: number; tekst: string }>,
  kildeFilnavn: string,
  kildeDokumentId?: string,
): Promise<number> {
  const grupper = grupperSiderPerPost(sideData);
  if (grupper.size === 0) {
    console.log(`[SPLIT] Ingen postnr funnet i ${kildeFilnavn}`);
    return 0;
  }

  console.log(`[SPLIT] ${kildeFilnavn}: ${grupper.size} poster funnet, splitter...`);

  const kildePdf = await PDFDocument.load(originalBuffer);
  let antallFiler = 0;

  for (const [kode, sider] of grupper) {
    const mappeNavn = `Post ${kode}`;
    const filnavn = `${kode.replace(/\./g, "_")}.pdf`;

    // Finn eller opprett undermappe
    let mappe = await prisma.folder.findFirst({
      where: { projectId, parentId: parentFolderId, name: mappeNavn },
    });
    if (!mappe) {
      mappe = await prisma.folder.create({
        data: { projectId, parentId: parentFolderId, name: mappeNavn },
      });
    }

    // Sjekk om fil allerede finnes
    const eksisterende = await prisma.ftdDocument.findFirst({
      where: { projectId, folderId: mappe.id, filename: filnavn, isActive: true },
    });

    // Hent eksisterende kilder
    const eksisterendeKilder: SplitKilde[] = (eksisterende?.splitSources as SplitKilde[] | null) ?? [];

    // Bygg ny PDF med sidene
    const nyPdf = await PDFDocument.create();
    let eksisterendeAntallSider = 0;

    // Hvis eksisterende: kopier gamle sider først (append-modus)
    if (eksisterende?.fileUrl) {
      try {
        const eksFilsti = join(UPLOADS_DIR, eksisterende.fileUrl.replace(/^\/uploads\//, ""));
        const eksBuffer = await readFile(eksFilsti);
        const eksPdf = await PDFDocument.load(eksBuffer);
        const gamleIndekser = eksPdf.getPageIndices();
        const kopierteSider = await nyPdf.copyPages(eksPdf, gamleIndekser);
        for (const side of kopierteSider) {
          nyPdf.addPage(side);
        }
        eksisterendeAntallSider = gamleIndekser.length;
      } catch {
        console.warn(`[SPLIT] Kunne ikke lese eksisterende ${filnavn}, oppretter ny`);
      }
    }

    // Legg til nye sider (side-nummerering er 1-basert, PDF-indeks er 0-basert)
    const nyeIndekser = sider.map((s) => s - 1);
    const kopierteSider = await nyPdf.copyPages(kildePdf, nyeIndekser);
    for (const side of kopierteSider) {
      nyPdf.addPage(side);
    }

    // Oppdater kilder-liste
    const nyKilde: SplitKilde = {
      filnavn: kildeFilnavn,
      dokumentId: kildeDokumentId ?? "",
      kildeSider: sider,
      startSide: eksisterendeAntallSider + 1,
    };
    const oppdaterteKilder = [...eksisterendeKilder, nyKilde];

    // Lagre til disk
    const pdfBytes = await nyPdf.save();
    const uuid = randomUUID();
    const diskFilnavn = `${uuid}.pdf`;
    const filsti = join(UPLOADS_DIR, diskFilnavn);
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(filsti, pdfBytes);

    const fileUrl = `/uploads/${diskFilnavn}`;

    if (eksisterende) {
      await prisma.ftdDocument.update({
        where: { id: eksisterende.id },
        data: {
          fileUrl,
          pageCount: nyPdf.getPageCount(),
          processingState: "completed",
          splitSources: oppdaterteKilder as unknown as Parameters<typeof prisma.ftdDocument.create>[0]["data"]["splitSources"],
        },
      });
    } else {
      await prisma.ftdDocument.create({
        data: {
          projectId,
          folderId: mappe.id,
          filename: filnavn,
          fileUrl,
          filetype: "application/pdf",
          pageCount: nyPdf.getPageCount(),
          processingState: "completed",
          splitSources: oppdaterteKilder as unknown as Parameters<typeof prisma.ftdDocument.create>[0]["data"]["splitSources"],
        },
      });
    }

    antallFiler++;
    console.log(`[SPLIT] ${kode}: ${sider.length} nye sider (fra ${kildeFilnavn}) → ${nyPdf.getPageCount()} totalt`);
  }

  return antallFiler;
}
