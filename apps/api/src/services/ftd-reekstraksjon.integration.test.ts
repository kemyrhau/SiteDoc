import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@sitedoc/db";
import { prosesserDokument } from "./ftd-prosessering";

/**
 * Tvungen reekstraksjon (ordre fix/pdf-reekstraksjon 2026-10-14). Eksisterende
 * PDF-er prosessert før pagerender-fiksen står på «side 1» overalt. Dagens
 * reprosessering re-ekstraherer IKKE et `completed` dokument med chunks (kun
 * re-embedding), så sidetallet forblir feil. `tvingReekstraksjon` tvinger full
 * ny kjøring fra lagret fil og retter sidene — uten ny opplasting.
 *
 * DB-integrasjonstest (ekte prisma + fil på disk). Ekskludert fra `pnpm test`,
 * kjøres via `pnpm --filter @sitedoc/api test:integration` (DATABASE_URL,
 * localhost-sandkasse). Fixturen (3-siders PDF) lages av test-koden selv.
 *
 * To saker som BEVISER tving-veien mot ekte ekstraksjon:
 *  A. completed-dokument med side=1 overalt → side 1/2/3 etter tvungen reekstraksjon.
 *  B. feiler reekstraksjonen (fil borte) → de GAMLE chunkene står igjen (ikke tomt),
 *     status completed + synlig feilårsak (ingen stille tomhet).
 *
 * 🔴 DENNE FILA IMPORTERER IKKE `mappeRouter`. Å dra inn router-grafen forgifter
 * pdf.js under kjøreren (pdf-parse sin bundlede pdf.js vs. den routeren trekker
 * inn), slik at `pagerender` returnerer tom side-info og test A falskt får «side
 * 1» (RETUR 2026-10-14). Kontrast-saken som trenger routeren (uten tving = modus
 * "embedding") ligger derfor i ftd-reprosess-modus.integration.test.ts.
 */

const UPLOADS_DIR = join(process.cwd(), "uploads");

const T = { en: "SIDEENUNIK", to: "SIDETOUNIK", tre: "SIDETREUNIK" } as const;

async function lagTreSidersPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sider = [
    { token: T.en, nr: "en" },
    { token: T.to, nr: "to" },
    { token: T.tre, nr: "tre" },
  ];
  for (const s of sider) {
    const p = doc.addPage([595, 842]);
    // Rikelig tekst (> 50 ord totalt) så OCR-fallbacken ikke trigges.
    const linjer = [
      `Side ${s.nr} ${s.token} innledende avsnitt med beskrivende tekst om arbeidet.`,
      `Denne siden omtaler ${s.token} gjennom flere setninger med tilstrekkelig ordmengde.`,
      `Ytterligere innhold paa side ${s.nr} slik at tekstlaget er rikt nok uten OCR.`,
    ];
    linjer.forEach((linje, i) => {
      p.drawText(linje, { x: 50, y: 760 - i * 28, size: 12, font });
    });
  }
  return Buffer.from(await doc.save());
}

const ids = { userId: "", projectId: "" };
const opprettedeDokIder: string[] = [];
const fixturFiler: string[] = [];
let dokTeller = 0;

async function lagDokumentMedSide1Chunks(
  fileUrl: string | null,
): Promise<string> {
  // Unikt filnavn pr. dokument — ftd_documents har unik (project_id, filename).
  const dok = await prisma.ftdDocument.create({
    data: {
      projectId: ids.projectId,
      filename: `reekstraksjon-fixture-${++dokTeller}.pdf`,
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
      email: `reekstraksjon-${Date.now()}@sitedoc.test`,
      name: "Reekstraksjon admin",
      role: "sitedoc_admin",
    },
  });
  ids.userId = bruker.id;

  const prosjekt = await prisma.project.create({
    data: {
      projectNumber: `REEKST-${Date.now()}`,
      name: "Reekstraksjon testprosjekt",
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

describe("Tvungen reekstraksjon av FTD-PDF", () => {
  it("A: completed-dokument med side=1 overalt får side 1/2/3 etter tvungen reekstraksjon", async () => {
    const navn = `reekst-A-${Date.now()}.pdf`;
    const sti = join(UPLOADS_DIR, navn);
    await writeFile(sti, await lagTreSidersPdf());
    fixturFiler.push(sti);

    const dokId = await lagDokumentMedSide1Chunks(`/uploads/${navn}`);

    // Forbetingelse: alle gamle chunks er side 1.
    const foer = await prisma.ftdDocumentChunk.findMany({
      where: { documentId: dokId },
      select: { pageNumber: true },
    });
    expect(foer).toHaveLength(3);
    expect(new Set(foer.map((c) => c.pageNumber))).toEqual(new Set([1]));

    await prosesserDokument(prisma, dokId, { bevarVedFeil: true });

    const etter = await prisma.ftdDocumentChunk.findMany({
      where: { documentId: dokId },
      select: { pageNumber: true, chunkText: true },
    });
    const sider = new Set(etter.map((c) => c.pageNumber));
    expect(sider).toEqual(new Set([1, 2, 3])); // sidene rettet
    // De gamle chunkene er byttet ut (ingen «GAMMEL-CHUNK» igjen).
    expect(etter.every((c) => !c.chunkText.includes("GAMMEL-CHUNK"))).toBe(true);

    const d = await prisma.ftdDocument.findUniqueOrThrow({ where: { id: dokId } });
    expect(d.processingState).toBe("completed");
    expect(d.processingError).toBeNull();
  });

  it("B: feiler reekstraksjonen (fil borte) → gamle chunks beholdes, status completed med synlig feil", async () => {
    // fileUrl peker på en fil som ikke finnes → readFile kaster i reekstraksjonen.
    const dokId = await lagDokumentMedSide1Chunks(`/uploads/finnes-ikke-${Date.now()}.pdf`);

    const foerIds = (
      await prisma.ftdDocumentChunk.findMany({ where: { documentId: dokId }, select: { id: true } })
    ).map((c) => c.id);
    expect(foerIds).toHaveLength(3);

    await prosesserDokument(prisma, dokId, { bevarVedFeil: true });

    const etter = await prisma.ftdDocumentChunk.findMany({
      where: { documentId: dokId },
      select: { id: true, chunkText: true },
    });
    // Nøyaktig de gamle chunkene står igjen — ingen stille tomhet.
    expect(etter.map((c) => c.id).sort()).toEqual([...foerIds].sort());
    expect(etter.every((c) => c.chunkText.includes("GAMMEL-CHUNK"))).toBe(true);

    const d = await prisma.ftdDocument.findUniqueOrThrow({ where: { id: dokId } });
    expect(d.processingState).toBe("completed"); // fortsatt søkbart
    expect(d.processingError).toContain("Tvungen reekstraksjon feilet");
  });
});
