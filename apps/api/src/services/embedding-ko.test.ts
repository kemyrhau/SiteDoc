import { describe, it, expect, vi, afterEach } from "vitest";
import { embeddDokumentChunks, EMBEDDING_SAMTIDIG } from "./embedding-service";

/**
 * Felles NorBERT-kø (2026-10-16): batch-embedding fyres fire-and-forget pr. dokument utenfor
 * kjørMedGrense(…,2), så uten en prosess-global grense traff ALLE batch-kall NorBERT samtidig
 * → overbelastning → failed-chunks (32 dok / ~190 chunks på test).
 *
 * Krav: N samtidige embedding-jobber → aldri mer enn `EMBEDDING_SAMTIDIG` kall i flukt mot
 * NorBERT. RØD uten køen (da ville in-flight = N).
 */

function lagMockPrisma() {
  return {
    ftdDocument: { findUnique: vi.fn().mockResolvedValue({ projectId: "p1" }) },
    ftdDocumentChunk: {
      findMany: vi.fn().mockResolvedValue([
        { id: "c1", chunkText: "komprimering av masser" },
        { id: "c2", chunkText: "platebelastning per lag" },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ provider: "local", apiKey: null, model: "norbert2" }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("embedding-kø — felles samtidighetsgrense mot NorBERT", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("N samtidige jobber → aldri mer enn EMBEDDING_SAMTIDIG kall i flukt", async () => {
    let iFlukt = 0;
    let maksIFlukt = 0;
    let totaltKall = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        totaltKall++;
        iFlukt++;
        maksIFlukt = Math.max(maksIFlukt, iFlukt);
        // Hold slotten en stund så overlappende kall ville vist seg uten køen.
        await new Promise((r) => setTimeout(r, 15));
        iFlukt--;
        return { ok: true, json: async () => [[0.1, 0.2], [0.3, 0.4]] };
      }),
    );

    const N = 8;
    const jobber = Array.from({ length: N }, (_, i) =>
      embeddDokumentChunks(lagMockPrisma() as never, `doc${i}`, { retryBaseMs: 1 }),
    );
    const res = await Promise.all(jobber);

    // Køen holdt samtidigheten på grensen …
    expect(maksIFlukt).toBeGreaterThan(0);
    expect(maksIFlukt).toBeLessThanOrEqual(EMBEDDING_SAMTIDIG);
    // … men alle jobbene ble faktisk kjørt (ett batch-kall pr. dokument, N dokumenter).
    expect(totaltKall).toBe(N);
    expect(res.every((r) => r.done === 2 && r.failed === 0)).toBe(true);
  });
});
