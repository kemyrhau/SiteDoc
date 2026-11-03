import { describe, it, expect, vi, afterEach } from "vitest";
import { startEmbeddingGenerering, stoppEmbeddingGenerering } from "./embedding-service";

/**
 * ORDRE 7 A3 (2026-10-30): `aiSok.stoppEmbeddings` var global — admin i prosjekt A stoppet
 * embedding-kjøringen uansett hvilket prosjekt den gjaldt. Stoppen skal bare treffe kjøringen
 * for eget prosjekt; kjøringen for et annet prosjekt går videre.
 */

const INNSTILLINGER = { provider: "local" as const, model: "norbert2", batchSize: 8 };

/** Prisma-mock med `batcher` ventende batcher à én chunk for prosjekt `projectId`. */
function lagMockPrisma(batcher: number) {
  let igjen = batcher;
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    ftdDocumentChunk: {
      count: vi.fn().mockResolvedValue(batcher),
      findMany: vi.fn().mockImplementation(() => {
        if (igjen === 0) return Promise.resolve([]);
        igjen -= 1;
        return Promise.resolve([{ id: `c${igjen}`, chunkText: "komprimering av masser" }]);
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

/** NorBERT-svar; `underFørsteKall` kjøres mens første batch embeddes (midt i kjøringen). */
function stubNorbert(underFørsteKall: () => void) {
  let første = true;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      if (første) {
        første = false;
        underFørsteKall();
      }
      return Promise.resolve({ ok: true, json: async () => [[0.1, 0.2]] });
    }),
  );
}

describe("🔴 stoppEmbeddingGenerering — prosjekt-scopet (ORDRE 7 A3)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("stopp i prosjekt A stopper ikke kjøringen for prosjekt B", async () => {
    let svar: boolean | undefined;
    stubNorbert(() => { svar = stoppEmbeddingGenerering("prosjekt-a"); });

    const res = await startEmbeddingGenerering(lagMockPrisma(3) as never, "prosjekt-b", INNSTILLINGER);

    expect(res.generert).toBe(3);
    expect(svar).toBe(false);
  });

  it("stopp i prosjekt B stopper kjøringen for prosjekt B etter pågående batch", async () => {
    let svar: boolean | undefined;
    stubNorbert(() => { svar = stoppEmbeddingGenerering("prosjekt-b"); });

    const res = await startEmbeddingGenerering(lagMockPrisma(3) as never, "prosjekt-b", INNSTILLINGER);

    expect(svar).toBe(true);
    expect(res.generert).toBe(1);
  });

  it("stopp uten aktiv kjøring gjør ingenting og forgifter ikke neste start", async () => {
    expect(stoppEmbeddingGenerering("prosjekt-b")).toBe(false);
    stubNorbert(() => {});

    const res = await startEmbeddingGenerering(lagMockPrisma(2) as never, "prosjekt-b", INNSTILLINGER);

    expect(res.generert).toBe(2);
  });
});
