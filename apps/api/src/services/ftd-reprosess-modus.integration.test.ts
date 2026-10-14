import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@sitedoc/db";
import { mappeRouter } from "../routes/mappe";

/**
 * Kontrast-sak til tvungen reekstraksjon (ordre fix/pdf-reekstraksjon 2026-10-14):
 * UTEN `tvingReekstraksjon` lar `reprosesserDokument` et completed dokument med
 * chunks stå i fred (kun re-embedding, modus "embedding") — sidene blir IKKE
 * rettet. Tving er altså nødvendig for sidetall-fiksen.
 *
 * 🔴 Egen fil fordi den MÅ importere `mappeRouter` for å kalle mutasjonen. Den
 * importen forgifter pdf.js under kjøreren (RETUR 2026-10-14), så den holdes unna
 * side-attribusjons-testene i ftd-reekstraksjon.integration.test.ts. Denne saken
 * tåler forgiftningen: modus "embedding" re-ekstraherer ikke, så vi leser aldri
 * pdf.js — vi bekrefter bare at sidene FORBLIR feil (side 1) uten tving.
 *
 * DB-integrasjonstest (ekte prisma). Kjøres via
 * `pnpm --filter @sitedoc/api test:integration`.
 */

const UPLOADS_DIR = join(process.cwd(), "uploads");

async function lagTreSidersPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const nr of ["en", "to", "tre"]) {
    const p = doc.addPage([595, 842]);
    // Rikelig tekst (> 50 ord totalt) så OCR-fallbacken ikke trigges.
    const linjer = [
      `Side ${nr} innledende avsnitt med beskrivende tekst om arbeidet paa denne siden.`,
      `Denne siden omtaler side ${nr} gjennom flere setninger med tilstrekkelig ordmengde.`,
      `Ytterligere innhold paa side ${nr} slik at tekstlaget er rikt nok uten OCR.`,
    ];
    linjer.forEach((linje, i) => {
      p.drawText(linje, { x: 50, y: 760 - i * 28, size: 12, font });
    });
  }
  return Buffer.from(await doc.save());
}

function ctx(userId: string) {
  return {
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const ids = { userId: "", projectId: "" };
const opprettedeDokIder: string[] = [];
const fixturFiler: string[] = [];
let dokTeller = 0;

async function lagDokumentMedSide1Chunks(fileUrl: string): Promise<string> {
  const dok = await prisma.ftdDocument.create({
    data: {
      projectId: ids.projectId,
      filename: `reprosess-modus-fixture-${++dokTeller}.pdf`,
      fileUrl,
      filetype: "application/pdf",
      processingState: "completed",
    },
  });
  opprettedeDokIder.push(dok.id);
  // Simuler bug-tilstanden: tre chunks, ALLE pageNumber = 1.
  await prisma.ftdDocumentChunk.createMany({
    data: [0, 1, 2].map((i) => ({
      documentId: dok.id,
      chunkIndex: i,
      chunkText: `GAMMEL-CHUNK-${i} alt staar paa side 1 i dette dokumentet.`,
      pageNumber: 1,
      embeddingState: "done",
    })),
  });
  return dok.id;
}

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: {
      email: `reprosess-modus-${Date.now()}@sitedoc.test`,
      name: "Reprosess-modus admin",
      role: "sitedoc_admin",
    },
  });
  ids.userId = bruker.id;

  const prosjekt = await prisma.project.create({
    data: {
      projectNumber: `REPMODUS-${Date.now()}`,
      name: "Reprosess-modus testprosjekt",
    },
  });
  ids.projectId = prosjekt.id;
});

afterAll(async () => {
  for (const id of opprettedeDokIder) {
    await prisma.ftdDocumentChunk.deleteMany({ where: { documentId: id } }).catch(() => {});
    await prisma.ftdSpecPost.deleteMany({ where: { documentId: id } }).catch(() => {});
    await prisma.ftdDocumentBlock.deleteMany({ where: { documentId: id } }).catch(() => {});
    await prisma.ftdDocument.delete({ where: { id } }).catch(() => {});
  }
  if (ids.projectId) await prisma.project.delete({ where: { id: ids.projectId } }).catch(() => {});
  if (ids.userId) await prisma.user.delete({ where: { id: ids.userId } }).catch(() => {});
  for (const f of fixturFiler) await unlink(f).catch(() => {});
});

describe("reprosesserDokument — modus uten tving", () => {
  it("uten tving lar reprosesseringen sidene stå feil (modus embedding)", async () => {
    const navn = `repmodus-${Date.now()}.pdf`;
    const sti = join(UPLOADS_DIR, navn);
    await writeFile(sti, await lagTreSidersPdf());
    fixturFiler.push(sti);

    const dokId = await lagDokumentMedSide1Chunks(`/uploads/${navn}`);
    const caller = mappeRouter.createCaller(ctx(ids.userId));

    const res = await caller.reprosesserDokument({ documentId: dokId });
    expect(res.modus).toBe("embedding"); // completed + chunks → ingen re-ekstraksjon

    const etter = await prisma.ftdDocumentChunk.findMany({
      where: { documentId: dokId },
      select: { pageNumber: true },
    });
    // Sidene står fortsatt feil — tving er nødvendig for å rette dem.
    expect(new Set(etter.map((c) => c.pageNumber))).toEqual(new Set([1]));
  });
});
