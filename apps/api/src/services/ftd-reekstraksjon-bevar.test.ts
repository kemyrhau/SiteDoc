import { describe, it, expect } from "vitest";
import { prosesserDokument } from "./ftd-prosessering";

/**
 * Atomisitet ved tvungen reekstraksjon (ordre fix/pdf-reekstraksjon 2026-10-14).
 *
 * Enhetstest UTEN DB: prosesserDokument tar prisma som parameter, så vi injiserer
 * en mock som fanger kallene. Dokumentet peker på en fil som ikke finnes →
 * `readFile` kaster FØR ekstraksjonen. Vi beviser de to veiene i catch:
 *
 *  - `bevarVedFeil: true`  → gamle chunks slettes ALDRI opp front; ved feil
 *    fjernes bare nye rader (`id notIn gamle`) og dokumentet står igjen som
 *    `completed` med synlig feilårsak. Ingen stille tomhet.
 *  - standard (false)      → gamle slettes opp front; ved feil settes `failed`.
 *
 * Side-attribusjonen (side 1/2/3) på suksess-veien dekkes av
 * pdf-sideattribusjon.test.ts (ekstraherPdfSider) + ftd-reekstraksjon.integration.test.ts.
 */

type Kall = { model: string; metode: string; args: any };

function lagMockPrisma(gamleChunkIds: string[]) {
  const kall: Kall[] = [];
  const rec = (model: string, metode: string) => (args?: unknown) => {
    kall.push({ model, metode, args });
    if (model === "ftdDocument" && metode === "updateMany") return Promise.resolve({ count: 1 });
    if (model === "ftdDocumentChunk" && metode === "findMany")
      return Promise.resolve(gamleChunkIds.map((id) => ({ id })));
    if (model === "ftdSpecPost" && metode === "findMany") return Promise.resolve([]);
    if (model === "ftdDocument" && metode === "findUniqueOrThrow")
      return Promise.resolve({
        id: "d1",
        projectId: "p1",
        folderId: null,
        kontraktId: null,
        docType: null,
        filename: "mangler.pdf",
        // Peker på en fil som ikke finnes → readFile kaster før ekstraksjon.
        fileUrl: "/uploads/finnes-ikke-reekst-bevar-xyz.pdf",
      });
    return Promise.resolve({ count: 0 });
  };
  const prisma = {
    ftdDocument: {
      updateMany: rec("ftdDocument", "updateMany"),
      findUniqueOrThrow: rec("ftdDocument", "findUniqueOrThrow"),
      update: rec("ftdDocument", "update"),
    },
    ftdDocumentChunk: {
      findMany: rec("ftdDocumentChunk", "findMany"),
      deleteMany: rec("ftdDocumentChunk", "deleteMany"),
      count: rec("ftdDocumentChunk", "count"),
    },
    ftdSpecPost: {
      findMany: rec("ftdSpecPost", "findMany"),
      deleteMany: rec("ftdSpecPost", "deleteMany"),
    },
  };
  return { prisma, kall };
}

describe("prosesserDokument — atomisk bevaring ved feil", () => {
  it("bevarVedFeil: sletter aldri gamle opp front; ved feil beholdes gamle + completed med feilårsak", async () => {
    const { prisma, kall } = lagMockPrisma(["c1", "c2", "c3"]);
    await prosesserDokument(prisma as never, "d1", { bevarVedFeil: true });

    const chunkDeletes = kall.filter((k) => k.model === "ftdDocumentChunk" && k.metode === "deleteMany");
    // Ingen opp-front-sletting av HELE dokumentet (where = kun { documentId }).
    const oppFront = chunkDeletes.filter(
      (k) => k.args?.where && !("id" in k.args.where),
    );
    expect(oppFront).toHaveLength(0);
    // Rollback skjedde: sletting avgrenset til NYE rader (id notIn gamle).
    const rollback = chunkDeletes.find((k) => k.args?.where?.id?.notIn);
    expect(rollback).toBeTruthy();
    expect(rollback!.args.where.id.notIn).toEqual(["c1", "c2", "c3"]);

    const update = kall.find((k) => k.model === "ftdDocument" && k.metode === "update");
    expect(update!.args.data.processingState).toBe("completed");
    expect(update!.args.data.processingError).toContain("Tvungen reekstraksjon feilet");
  });

  it("standard (bevarVedFeil=false): sletter gamle opp front; ved feil settes failed", async () => {
    const { prisma, kall } = lagMockPrisma(["c1", "c2", "c3"]);
    await prosesserDokument(prisma as never, "d1");

    const chunkDeletes = kall.filter((k) => k.model === "ftdDocumentChunk" && k.metode === "deleteMany");
    // Opp-front-sletting av hele dokumentet skjedde (where = kun { documentId }).
    const oppFront = chunkDeletes.find((k) => k.args?.where && !("id" in k.args.where));
    expect(oppFront).toBeTruthy();

    const update = kall.find((k) => k.model === "ftdDocument" && k.metode === "update");
    expect(update!.args.data.processingState).toBe("failed");
  });
});
