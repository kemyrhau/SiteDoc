import { describe, it, expect, vi, afterEach } from "vitest";
import type { PrismaClient } from "@sitedoc/db";
import { hybridSok } from "./ai-sok-service";

/**
 * Prod 2026-10-15: query-embedding i søket (`ai-sok-service.ts`) brukte rå `fetch` uten
 * tidsavbrudd. Henger NorBERT, henger `hybridSok` for alltid — fallback-catchen utløses
 * aldri uten et avbrudd, så brukeren får en evig spinner.
 *
 * Fiksen: `encodeQueryLokal` gjenbruker `fetchMedTimeout` (kort timeout, ingen retry).
 * Når tjenesten ikke svarer, avbrytes kallet og søket faller til rent tekstsøk med flagget
 * `aiSøkUtilgjengelig = true`, som klienten viser som synlig merknad.
 *
 * Rød i dag: uten timeout resolver mock-`fetch` aldri → testen går i vitest-timeout.
 * Grønn med fiks: avbrytes innen fristen → tekst-treff returneres.
 */

const TEKST_RAD = {
  id: "chunk-1",
  documentId: "doc-1",
  chunkText: "Komprimeringsgrad måles med platebelastning per lag.",
  chunkIndex: 0,
  pageNumber: 3,
  sectionTitle: "Utførelse",
  nsCode: null,
  filename: "kontrollplan.docx",
  fileUrl: null,
  docType: "docx",
  folderId: null,
  score: 0.42,
};

// Fake Prisma: leksikalskSok gjør ett `$queryRaw`-kall og forventer tekst-rader.
const fakePrisma = {
  $queryRaw: vi.fn(async () => [TEKST_RAD]),
} as unknown as PrismaClient;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("query-embedding timeout → tekstsøk-fallback", () => {
  it("returnerer tekst-treff innen fristen når NorBERT henger", async () => {
    // Mock-NorBERT som ALDRI svarer, men respekterer AbortController-signalet.
    // (Uten signal — altså før fiksen — resolver dette aldri og testen henger.)
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      ),
    );

    const start = Date.now();
    const resultat = await hybridSok(fakePrisma, "proj-1", "komprimeringsgrad", null, {
      provider: "local",
      embeddingTimeoutMs: 100, // kort timeout for test
    });
    const elapsed = Date.now() - start;

    // Innen fristen (romslig margin), ikke hengende.
    expect(elapsed).toBeLessThan(2000);
    // Falt til tekstsøk, med synlig-merknad-flagget satt.
    expect(resultat.aiSøkUtilgjengelig).toBe(true);
    expect(resultat.treff.length).toBeGreaterThanOrEqual(1);
    expect(resultat.treff[0]!.metode).toBe("tekst");
    expect(resultat.treff[0]!.chunkText).toContain("platebelastning");
    // Query-embedding gjøres UTEN retry (interaktivt): nøyaktig ett fetch-kall.
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
