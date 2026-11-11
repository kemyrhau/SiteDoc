import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { PrismaClient } from "@sitedoc/db";
import { INGEN_LESERBLOKKER } from "@sitedoc/shared";

// Blokkuttrekket fra PDF (pdfjs) mockes — testen gjelder reparasjonsveien og etterløpet.
const genererBlokker = vi.fn(async (..._a: unknown[]) => 3);
vi.mock("./blokk-prosessering", () => ({
  genererBlokker: (...a: unknown[]) => genererBlokker(...a),
  genererDocxBlokker: vi.fn(async () => 0),
}));
const embeddNyeBlokker = vi.fn(async () => {});
vi.mock("./embedding-service", () => ({
  embeddNyeBlokker: (...a: unknown[]) => embeddNyeBlokker(...(a as [])),
  embeddDokumentChunks: vi.fn(async () => {}),
}));
vi.mock("./folder-spraak", () => ({ hentEffektiveSpråk: vi.fn(async () => ({ languages: ["nb"] })) }));

import { genererBlokkerFraLagretFil, utenLeserblokker } from "./ftd-prosessering";

/**
 * DL-2 (2026-11-11): «Prosesser på nytt» på en PDF som er completed med chunks men
 * 0 leser-blokker kjørte bare embedding, så leseren stod «feilet». Nå lager
 * reparasjonen blokker fra lagret fil via samme vei som opplasting, og 0 blokker gir
 * markøren `INGEN_LESERBLOKKER` (ærlig «kan ikke vises») i stedet for evig venting.
 */

function lagPrismaMock(fil: { fileUrl: string; filename: string }) {
  const dokUpdate = vi.fn(async (_a: { data: Record<string, unknown> }) => ({}));
  dokUpdate.mockResolvedValueOnce({ ...fil, folderId: "mappe1" });
  const prisma = {
    folder: { findUnique: vi.fn(async () => ({ projectId: "p1" })) },
    project: { findUnique: vi.fn(async () => ({ sourceLanguage: "nb" })) },
    ftdDocument: { update: dokUpdate },
    projectModule: { findUnique: vi.fn(async () => ({ status: "aktiv" })) },
    ftdTranslationJob: { upsert: vi.fn(async () => ({})) },
  };
  return { prisma: prisma as unknown as PrismaClient, dokUpdate };
}

const markørSatt = (dokUpdate: ReturnType<typeof lagPrismaMock>["dokUpdate"]) =>
  dokUpdate.mock.calls.some((c) => c[0].data.processingError === INGEN_LESERBLOKKER);

describe("genererBlokkerFraLagretFil — PDF (DL-2)", () => {
  const filnavn = `dl2-test-${process.pid}.pdf`;
  const sti = join(process.cwd(), "uploads", filnavn);
  const innhold = Buffer.from("%PDF-1.4 dl2-test");

  beforeEach(async () => {
    genererBlokker.mockReset();
    embeddNyeBlokker.mockClear();
    await mkdir(join(process.cwd(), "uploads"), { recursive: true });
    await writeFile(sti, innhold);
  });
  afterEach(async () => {
    await rm(sti, { force: true });
  });

  it("completed + 0 blokker → blokker fra lagret fil og etterløpet kjører", async () => {
    genererBlokker.mockResolvedValueOnce(3);
    const m = lagPrismaMock({ fileUrl: `/uploads/${filnavn}`, filename: "Rapport.PDF" });
    await genererBlokkerFraLagretFil(m.prisma, "dok1");

    // Nullstiller feil/markør først (bumper updatedAt → leseren viser «klargjøres»)
    expect(m.dokUpdate.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ where: { id: "dok1" }, data: { processingError: null } }),
    );
    expect(genererBlokker).toHaveBeenCalledTimes(1);
    const [, id, buffer, ext, språk] = genererBlokker.mock.calls[0]!;
    expect([id, (buffer as Buffer).equals(innhold), ext, språk]).toEqual(["dok1", true, ".pdf", "nb"]);
    // Etterløpet: språk lagret og blokk-embedding startet
    expect(m.dokUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sourceLanguage: "nb" }) }),
    );
    expect(embeddNyeBlokker).toHaveBeenCalledWith(m.prisma, "dok1");
    expect(markørSatt(m.dokUpdate)).toBe(false);
  });

  it("0 blokker (ingen uttrekkbar tekst/bilder) → markøren settes, ingen embedding", async () => {
    genererBlokker.mockResolvedValueOnce(0);
    const m = lagPrismaMock({ fileUrl: `/uploads/${filnavn}`, filename: "skannet.pdf" });
    await genererBlokkerFraLagretFil(m.prisma, "dok1");

    expect(markørSatt(m.dokUpdate)).toBe(true);
    expect(embeddNyeBlokker).not.toHaveBeenCalled();
  });
});

describe("utenLeserblokker", () => {
  it("PDF og DOCX uten blokker velges; dokumenter med blokker og andre filtyper røres ikke", async () => {
    const findMany = vi.fn(async (_a: { where: { documentId: { in: string[] } } }) => [
      { documentId: "pdf-med" },
    ]);
    const db = { ftdDocumentBlock: { findMany } } as unknown as Pick<PrismaClient, "ftdDocumentBlock">;
    const ider = await utenLeserblokker(db, [
      { id: "pdf-uten", filename: "a.pdf" },
      { id: "pdf-med", filename: "b.PDF" },
      { id: "docx-uten", filename: "c.docx" },
      { id: "xlsx", filename: "d.xlsx" },
      { id: "uten-navn", filename: null },
    ]);
    expect(ider).toEqual(["pdf-uten", "docx-uten"]);
    expect(findMany.mock.calls[0]![0].where.documentId.in).toEqual(["pdf-uten", "pdf-med", "docx-uten"]);
  });
});
