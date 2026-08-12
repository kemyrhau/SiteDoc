/**
 * Filsamling for dataeksport (fase 2, 2026-08-11).
 *
 * Samler ALLE filene som hører til ett prosjekt på tvers av modellene (kjerne-db
 * + timer-db). Returnerer en normalisert liste; arkiv-byggeren strømmer hver fil
 * fra disk inn i zip-en og binder den i manifestet.
 *
 * PointCloud er bevisst utelatt (v1-avgrensning: størrelse + kunden har kildefila).
 * PDF-genererte dokumenter (sjekkliste/oppgave/hms/kontrollplan) kommer i fase 3
 * (rendrer) — her tar vi kun FILENE slik de er lagret.
 */
import type { PrismaClient } from "@sitedoc/db";
import type { PrismaClient as PrismaTimerClient } from "@sitedoc/db-timer";

export type FilKategori =
  | "bilde"
  | "tegning"
  | "tegning-original"
  | "tegning-revisjon"
  | "dokument"
  | "kvittering-utlegg"
  | "kvittering-tillegg";

export interface EksportFil {
  kategori: FilKategori;
  fileUrl: string;
  mappe: string; // undermappe i arkivet
  visningsnavn: string; // original filnavn for mennesker
  storrelse: number | null; // bytes fra DB der satt, ellers måles fra disk
  opprettet: string; // ISO
  tilknyttet: { type: string; id: string; navn: string | null } | null;
}

const MAPPE: Record<FilKategori, string> = {
  bilde: "filer/bilder",
  tegning: "tegninger",
  "tegning-original": "tegninger/originaler",
  "tegning-revisjon": "tegninger/revisjoner",
  dokument: "filer/dokumenter",
  "kvittering-utlegg": "filer/kvitteringer",
  "kvittering-tillegg": "filer/kvitteringer",
};

export async function samleProsjektFiler(
  prisma: PrismaClient,
  prismaTimer: PrismaTimerClient,
  projectId: string,
): Promise<EksportFil[]> {
  const filer: EksportFil[] = [];

  // ── Bilder (Image) — koblet via Checklist/Task → ReportTemplate.projectId ──
  const maler = await prisma.reportTemplate.findMany({
    where: { projectId },
    select: { id: true },
  });
  const malIder = maler.map((m) => m.id);
  if (malIder.length > 0) {
    const [sjekklister, oppgaver] = await Promise.all([
      prisma.checklist.findMany({
        where: { templateId: { in: malIder } },
        select: { id: true, title: true },
      }),
      prisma.task.findMany({
        where: { templateId: { in: malIder } },
        select: { id: true, title: true },
      }),
    ]);
    const sjekklisteNavn = new Map(sjekklister.map((c) => [c.id, c.title]));
    const oppgaveNavn = new Map(oppgaver.map((t) => [t.id, t.title]));

    const bilder = await prisma.image.findMany({
      where: {
        OR: [
          { checklistId: { in: [...sjekklisteNavn.keys()] } },
          { taskId: { in: [...oppgaveNavn.keys()] } },
        ],
      },
      select: {
        fileUrl: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        checklistId: true,
        taskId: true,
      },
    });
    for (const b of bilder) {
      const tilknyttet = b.checklistId
        ? { type: "sjekkliste", id: b.checklistId, navn: sjekklisteNavn.get(b.checklistId) ?? null }
        : b.taskId
          ? { type: "oppgave", id: b.taskId, navn: oppgaveNavn.get(b.taskId) ?? null }
          : null;
      filer.push({
        kategori: "bilde",
        fileUrl: b.fileUrl,
        mappe: MAPPE.bilde,
        visningsnavn: b.fileName,
        storrelse: b.fileSize,
        opprettet: b.createdAt.toISOString(),
        tilknyttet,
      });
    }
  }

  // ── Tegninger (Drawing) + originaler + revisjoner ──
  const tegninger = await prisma.drawing.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      drawingNumber: true,
      revision: true,
      fileUrl: true,
      fileSize: true,
      originalFileUrl: true,
      createdAt: true,
    },
  });
  for (const t of tegninger) {
    const tilknyttet = { type: "tegning", id: t.id, navn: t.name };
    filer.push({
      kategori: "tegning",
      fileUrl: t.fileUrl,
      mappe: MAPPE.tegning,
      visningsnavn: t.name,
      storrelse: t.fileSize,
      opprettet: t.createdAt.toISOString(),
      tilknyttet,
    });
    if (t.originalFileUrl) {
      filer.push({
        kategori: "tegning-original",
        fileUrl: t.originalFileUrl,
        mappe: MAPPE["tegning-original"],
        visningsnavn: t.name,
        storrelse: null, // ingen egen kolonne — måles fra disk
        opprettet: t.createdAt.toISOString(),
        tilknyttet,
      });
    }
  }
  if (tegninger.length > 0) {
    const revisjoner = await prisma.drawingRevision.findMany({
      where: { drawingId: { in: tegninger.map((t) => t.id) } },
      select: { drawingId: true, fileUrl: true, fileSize: true, revision: true, createdAt: true },
    });
    const tegningNavn = new Map(tegninger.map((t) => [t.id, t.name]));
    for (const r of revisjoner) {
      filer.push({
        kategori: "tegning-revisjon",
        fileUrl: r.fileUrl,
        mappe: MAPPE["tegning-revisjon"],
        visningsnavn: `${tegningNavn.get(r.drawingId) ?? "tegning"} (rev ${r.revision})`,
        storrelse: r.fileSize,
        opprettet: r.createdAt.toISOString(),
        tilknyttet: { type: "tegning", id: r.drawingId, navn: tegningNavn.get(r.drawingId) ?? null },
      });
    }
  }

  // ── Dokumenter (FtdDocument) — økonomi/notaer/kontrakter, fileUrl kan være null ──
  const dokumenter = await prisma.ftdDocument.findMany({
    where: { projectId, fileUrl: { not: null } },
    select: { id: true, filename: true, fileUrl: true, fileSize: true, docType: true, uploadedAt: true },
  });
  for (const d of dokumenter) {
    if (!d.fileUrl) continue;
    filer.push({
      kategori: "dokument",
      fileUrl: d.fileUrl,
      mappe: MAPPE.dokument,
      visningsnavn: d.filename,
      storrelse: d.fileSize,
      opprettet: d.uploadedAt.toISOString(),
      tilknyttet: { type: d.docType ?? "dokument", id: d.id, navn: d.filename },
    });
  }

  // ── Kvitteringer: utleggs- + tilleggsvedlegg (timer-db, svak FK til prosjekt) ──
  const [utlegg, tillegg] = await Promise.all([
    prismaTimer.sheetUtlegg.findMany({ where: { projectId }, select: { id: true } }),
    prismaTimer.sheetTillegg.findMany({ where: { projectId }, select: { id: true } }),
  ]);
  if (utlegg.length > 0) {
    const vedlegg = await prismaTimer.sheetUtleggVedlegg.findMany({
      where: { sheetUtleggId: { in: utlegg.map((u) => u.id) } },
      select: { sheetUtleggId: true, fileUrl: true, fileName: true, fileSize: true, createdAt: true },
    });
    for (const v of vedlegg) {
      filer.push({
        kategori: "kvittering-utlegg",
        fileUrl: v.fileUrl,
        mappe: MAPPE["kvittering-utlegg"],
        visningsnavn: v.fileName,
        storrelse: v.fileSize,
        opprettet: v.createdAt.toISOString(),
        tilknyttet: { type: "utlegg", id: v.sheetUtleggId, navn: null },
      });
    }
  }
  if (tillegg.length > 0) {
    const vedlegg = await prismaTimer.sheetTilleggVedlegg.findMany({
      where: { sheetTilleggId: { in: tillegg.map((t) => t.id) } },
      select: { sheetTilleggId: true, fileUrl: true, fileName: true, fileSize: true, createdAt: true },
    });
    for (const v of vedlegg) {
      filer.push({
        kategori: "kvittering-tillegg",
        fileUrl: v.fileUrl,
        mappe: MAPPE["kvittering-tillegg"],
        visningsnavn: v.fileName,
        storrelse: v.fileSize,
        opprettet: v.createdAt.toISOString(),
        tilknyttet: { type: "tillegg", id: v.sheetTilleggId, navn: null },
      });
    }
  }

  return filer;
}
