import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embeddDokumentChunks } from "./embedding-service";

/**
 * D (prod 2026-10-14): `embeddDokumentChunks` erstatter den gamle Python-subprosessen og
 * bruker HTTP-veien (NORBERT_URL). Krav: feiler embedding-serveren, settes chunkene til
 * en SYNLIG feilstatus (`embeddingState='failed'`), ikke stille `pending`. Oppe → `done`.
 */

function lagMockPrisma() {
  const updateManyKall: Array<{ data: { embeddingState: string } }> = [];
  const executeRawKall: unknown[] = [];
  const prisma = {
    ftdDocument: {
      findUnique: vi.fn().mockResolvedValue({ projectId: "p1" }),
    },
    ftdDocumentChunk: {
      findMany: vi.fn().mockResolvedValue([
        { id: "c1", chunkText: "komprimering av masser" },
        { id: "c2", chunkText: "platebelastning per lag" },
      ]),
      updateMany: vi.fn().mockImplementation((args: { data: { embeddingState: string } }) => {
        updateManyKall.push(args);
        return Promise.resolve({ count: 2 });
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    // $queryRaw brukes av hentEmbeddingInnstillinger → provider local (NorBERT HTTP)
    $queryRaw: vi.fn().mockResolvedValue([{ provider: "local", apiKey: null, model: "norbert2" }]),
    $executeRaw: vi.fn().mockImplementation((...a: unknown[]) => {
      executeRawKall.push(a);
      return Promise.resolve(1);
    }),
  };
  return { prisma, updateManyKall, executeRawKall };
}

describe("embeddDokumentChunks — synlig feilstatus (D)", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("embedding-server nede → chunks settes 'failed', ikke 'pending'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { prisma, updateManyKall } = lagMockPrisma();

    const res = await embeddDokumentChunks(prisma as never, "doc1", { retryBaseMs: 1 });

    expect(res.failed).toBeGreaterThan(0);
    expect(res.done).toBe(0);
    // Siste tilstand må være 'failed' — aldri tilbake til 'pending'
    const statuser = updateManyKall.map((k) => k.data.embeddingState);
    expect(statuser).toContain("failed");
    expect(statuser).not.toContain("pending");
  });

  it("forbigående feil (nettverk) → nytt forsøk med backoff, chunks blir 'done'", async () => {
    // To forbigående feil, så suksess. Uten retry (dagens kode) blir dette 'failed'.
    let kall = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        kall++;
        if (kall <= 2) return Promise.reject(new Error("ECONNRESET socket hang up"));
        return Promise.resolve({ ok: true, json: async () => [[0.1, 0.2], [0.3, 0.4]] });
      }),
    );
    const { prisma, executeRawKall } = lagMockPrisma();

    const res = await embeddDokumentChunks(prisma as never, "doc1", { retryBaseMs: 1 });

    expect(res.done).toBe(2);
    expect(res.failed).toBe(0);
    expect(kall).toBe(3); // 2 forbigående feil + 1 suksess
    expect(executeRawKall.length).toBe(2);
  });

  it("permanent feil (HTTP 400) → IKKE nytt forsøk, chunks 'failed'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "ugyldig forespørsel",
    });
    vi.stubGlobal("fetch", fetchMock);
    const { prisma, updateManyKall } = lagMockPrisma();

    const res = await embeddDokumentChunks(prisma as never, "doc1", { retryBaseMs: 1 });

    expect(res.failed).toBe(2);
    expect(res.done).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 4xx retries ikke
    expect(updateManyKall.map((k) => k.data.embeddingState)).toContain("failed");
  });

  it("embedding-server oppe → chunks settes 'done'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [[0.1, 0.2], [0.3, 0.4]],
      }),
    );
    const { prisma, executeRawKall, updateManyKall } = lagMockPrisma();

    const res = await embeddDokumentChunks(prisma as never, "doc1");

    expect(res.done).toBe(2);
    expect(res.failed).toBe(0);
    expect(executeRawKall.length).toBe(2); // 'done'-oppdatering per chunk
    expect(updateManyKall.map((k) => k.data.embeddingState)).not.toContain("failed");
  });
});
