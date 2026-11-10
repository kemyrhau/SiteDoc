import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deflateRawSync } from "node:zlib";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import type { PrismaClient } from "@sitedoc/db";

// Etterløpets sideeffekter utenfor DB: blokk-embedding (HTTP) og mappespråk-arv.
const embeddNyeBlokker = vi.fn(async () => {});
vi.mock("./embedding-service", () => ({
  embeddNyeBlokker: (...a: unknown[]) => embeddNyeBlokker(...(a as [])),
  embeddDokumentChunks: vi.fn(async () => {}),
}));
const hentEffektiveSpråk = vi.fn(async () => ({ languages: ["nb"] }));
vi.mock("./folder-spraak", () => ({
  hentEffektiveSpråk: (...a: unknown[]) => hentEffektiveSpråk(...(a as [])),
}));

import {
  genererDocxBlokkOgOversett,
  genererBlokkerFraLagretFil,
  DOCX_UGYLDIG_MELDING,
} from "./ftd-prosessering";
import { docxTilLeserblokker } from "./blokk-prosessering";

/**
 * DL-1 (2026-11-10): DOCX fikk søk-chunks men aldri leser-blokker, så leseren stod
 * «ikke klar» for alltid og oversettelse startet aldri. Disse testene dekker at DOCX
 * nå får blokker (overskrift/avsnitt, nivå, rekkefølge, språk) og samme etterløp som
 * PDF (embedding + oversettelsesoppdrag), og at zip-bomb-vernet fortsatt er porten.
 */

async function lagDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Sikkerhetsinstruks for anlegget", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Alle som skal arbeide på anlegget må ha gjennomført opplæring og ha gyldig adgangskort." }),
          new Paragraph({ text: "Verneutstyr", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: "Hjelm, vernesko og synlighetstøy skal brukes hele tiden når du er i området." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function lagPrismaMock(opts: { prosjektSpråk?: string; modulAktiv?: boolean } = {}) {
  const createMany = vi.fn(async (_a: { data: unknown[] }) => ({ count: 0 }));
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const dokUpdate = vi.fn(async () => ({}));
  const jobUpsert = vi.fn(async () => ({}));
  const prisma = {
    folder: { findUnique: vi.fn(async () => ({ projectId: "p1" })) },
    project: { findUnique: vi.fn(async () => ({ sourceLanguage: opts.prosjektSpråk ?? "nb" })) },
    ftdDocument: { update: dokUpdate },
    ftdDocumentBlock: { createMany, deleteMany },
    projectModule: {
      findUnique: vi.fn(async () => ({ status: opts.modulAktiv === false ? "inaktiv" : "aktiv" })),
    },
    ftdTranslationJob: { upsert: jobUpsert },
  };
  return { prisma: prisma as unknown as PrismaClient, createMany, deleteMany, dokUpdate, jobUpsert };
}

type LagretBlokk = {
  sortOrder: number;
  blockType: string;
  content: string;
  headingLevel: number | null;
  language: string;
  pageNumber: number;
};

beforeEach(() => {
  embeddNyeBlokker.mockClear();
  hentEffektiveSpråk.mockReset();
  hentEffektiveSpråk.mockResolvedValue({ languages: ["nb"] });
});

describe("docxTilLeserblokker", () => {
  it("overskrift → heading med nivå, avsnitt → text, side 1", () => {
    expect(
      docxTilLeserblokker([
        { type: "heading", level: 3, text: "A" },
        { type: "para", level: null, text: "B" },
      ]),
    ).toEqual([
      { type: "heading", content: "A", pageNumber: 1, headingLevel: 3 },
      { type: "text", content: "B", pageNumber: 1 },
    ]);
  });
});

describe("genererDocxBlokkOgOversett", () => {
  it("lagrer overskrifter og avsnitt i dokumentrekkefølge med detektert språk", async () => {
    const m = lagPrismaMock();
    await genererDocxBlokkOgOversett(m.prisma, "dok1", "mappe1", await lagDocx());

    expect(m.createMany).toHaveBeenCalledTimes(1);
    const data = m.createMany.mock.calls[0]![0].data as LagretBlokk[];
    expect(data.map((b) => [b.sortOrder, b.blockType, b.headingLevel, b.content])).toEqual([
      [0, "heading", 1, "Sikkerhetsinstruks for anlegget"],
      [1, "text", null, "Alle som skal arbeide på anlegget må ha gjennomført opplæring og ha gyldig adgangskort."],
      [2, "heading", 2, "Verneutstyr"],
      [3, "text", null, "Hjelm, vernesko og synlighetstøy skal brukes hele tiden når du er i området."],
    ]);
    expect(data.every((b) => b.language === "nb" && b.pageNumber === 1)).toBe(true);
    // Språk fra uttrukket tekst (ikke zip-bytene) → nb, ingen avvik
    expect(m.dokUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { sourceLanguage: "nb", detectedLanguage: "nb", languageConfirmed: true },
      }),
    );
    expect(embeddNyeBlokker).toHaveBeenCalledWith(m.prisma, "dok1");
  });

  it("oppretter oversettelsesoppdrag pr. ekstra mappespråk når modulen er aktiv", async () => {
    hentEffektiveSpråk.mockResolvedValue({ languages: ["nb", "en", "lt"] });
    const m = lagPrismaMock();
    await genererDocxBlokkOgOversett(m.prisma, "dok1", "mappe1", await lagDocx());

    const mål = m.jobUpsert.mock.calls.map(
      (c) => (c as unknown as [{ create: { targetLang: string; blocksTotal: number } }])[0].create,
    );
    expect(mål.map((j) => j.targetLang)).toEqual(["en", "lt"]);
    expect(mål.every((j) => j.blocksTotal === 4)).toBe(true);
  });

  it("ingen oversettelsesoppdrag ved språkavvik (venter på bekreftelse)", async () => {
    hentEffektiveSpråk.mockResolvedValue({ languages: ["nb", "en"] });
    const m = lagPrismaMock({ prosjektSpråk: "en" });
    await genererDocxBlokkOgOversett(m.prisma, "dok1", "mappe1", await lagDocx());

    expect(m.createMany).toHaveBeenCalledTimes(1);
    expect(m.dokUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ languageConfirmed: false }) }),
    );
    expect(m.jobUpsert).not.toHaveBeenCalled();
  });

  it("ingen oversettelsesoppdrag når oversettelsesmodulen ikke er aktiv", async () => {
    hentEffektiveSpråk.mockResolvedValue({ languages: ["nb", "en"] });
    const m = lagPrismaMock({ modulAktiv: false });
    await genererDocxBlokkOgOversett(m.prisma, "dok1", "mappe1", await lagDocx());
    expect(m.jobUpsert).not.toHaveBeenCalled();
  });

  it("går gjennom zip-bomb-vernet: lyvende bombe avvises før noe lagres", async () => {
    const m = lagPrismaMock();
    const bombe = lagZipDeflate("word/document.xml", deflateRawSync(Buffer.alloc(60 * 1024 * 1024)), 1024);
    await expect(genererDocxBlokkOgOversett(m.prisma, "dok1", "mappe1", bombe)).rejects.toThrow(
      DOCX_UGYLDIG_MELDING,
    );
    expect(m.createMany).not.toHaveBeenCalled();
    expect(m.dokUpdate).not.toHaveBeenCalled();
  });
});

describe("genererBlokkerFraLagretFil (A4: reparasjon av eksisterende DOCX)", () => {
  const filnavn = `dl1-test-${process.pid}.docx`;
  const sti = join(process.cwd(), "uploads", filnavn);

  afterEach(async () => {
    await rm(sti, { force: true });
  });

  it("DOCX: nullstiller feil (bumper updatedAt) og lager blokker fra lagret fil", async () => {
    await mkdir(join(process.cwd(), "uploads"), { recursive: true });
    await writeFile(sti, await lagDocx());
    const m = lagPrismaMock();
    m.dokUpdate.mockResolvedValueOnce({
      fileUrl: `/uploads/${filnavn}`,
      filename: "Instruks.DOCX",
      folderId: "mappe1",
    } as never);
    await genererBlokkerFraLagretFil(m.prisma, "dok1");

    expect(m.dokUpdate.mock.calls[0]).toEqual([
      expect.objectContaining({ where: { id: "dok1" }, data: { processingError: null } }),
    ]);
    expect(m.createMany).toHaveBeenCalledTimes(1);
  });

  it("PDF berøres ikke: ingen fil leses, ingen blokker lages", async () => {
    const m = lagPrismaMock();
    m.dokUpdate.mockResolvedValueOnce({
      fileUrl: "/uploads/finnes-ikke.pdf",
      filename: "a.pdf",
      folderId: "mappe1",
    } as never);
    await genererBlokkerFraLagretFil(m.prisma, "dok1");
    expect(m.createMany).not.toHaveBeenCalled();
  });
});

/** ZIP med én deflate-entry som deklarerer `utpakketDeklarert` (bombe-løgn). */
function lagZipDeflate(navn: string, komprimert: Buffer, utpakketDeklarert: number): Buffer {
  const nm = Buffer.from(navn, "utf-8");
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(8, 8);
  lfh.writeUInt32LE(komprimert.length, 18);
  lfh.writeUInt32LE(utpakketDeklarert, 22);
  lfh.writeUInt16LE(nm.length, 26);
  const lokal = Buffer.concat([lfh, nm, komprimert]);
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(8, 10);
  cdh.writeUInt32LE(komprimert.length, 20);
  cdh.writeUInt32LE(utpakketDeklarert, 24);
  cdh.writeUInt16LE(nm.length, 28);
  const sentral = Buffer.concat([cdh, nm]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(sentral.length, 12);
  eocd.writeUInt32LE(lokal.length, 16);
  return Buffer.concat([lokal, sentral, eocd]);
}
