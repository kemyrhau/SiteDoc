import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, type PrismaClient } from "@sitedoc/db";
import { hybridSok, finnBesteSetning, DEFAULT_VEKTER } from "./ai-sok-service";

/**
 * SØK-1 (dokumentsok-visning-spec § 6): T5 (D1), T6 (S-M9 fallback-filter), T7 (D3), T8 server-del (E1/E2).
 * Fake `$queryRaw` setter sammen den faktiske SQL-en (Prisma.sql) og svarer etter hvilken spørring det er.
 */

const DAGMULKT_CHUNK =
  "Kontraktssummen er fast. Ved forsinkelse påløper dagmulkt på 1 promille av kontraktssummen pr. kalenderdag. Sluttoppgjør etter NS 8405.";

function rad(id: string, chunkText: string, cosineSim = 0.8) {
  return {
    id,
    documentId: `dok-${id}`,
    chunkText,
    chunkIndex: 1,
    pageNumber: 2,
    sectionTitle: null,
    pageHeading: null,
    nsCode: null,
    filename: "tilbud-kontrakt-b12.pdf",
    fileUrl: null,
    docType: "pdf",
    folderId: null,
    cosineSim,
    score: 0.5,
  };
}

interface Fangst {
  sql: string;
  values: unknown[];
}

function lagPrisma(svar: { vektor?: unknown[]; leksikalsk?: unknown[]; headline?: unknown[]; fallback?: unknown[] }) {
  const fanget: Fangst[] = [];
  const $queryRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = Prisma.sql(strings, ...values);
    fanget.push({ sql: q.sql, values: q.values });
    if (q.sql.includes("<=>")) return svar.vektor ?? [];
    if (q.sql.includes("ts_headline")) return svar.headline ?? [];
    if (q.sql.includes("DISTINCT ON")) return svar.fallback ?? [];
    return svar.leksikalsk ?? [];
  });
  return { prisma: { $queryRaw } as unknown as PrismaClient, fanget };
}

function stubEmbedding(ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ok
        ? new Response(JSON.stringify([[0.1, 0.2, 0.3]]), { status: 200 })
        : Promise.reject(new Error("NorBERT nede")),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const leksikalskSql = (f: Fangst[]) => f.find((x) => x.sql.includes("0.0 AS \"cosineSim\""))!.sql;

describe("T5 / D1 — leksikalsk kandidatuttak er sortert før LIMIT", () => {
  it("SQL-en har ORDER BY ts_rank(...) DESC før LIMIT", async () => {
    stubEmbedding();
    const { prisma, fanget } = lagPrisma({});
    await hybridSok(prisma, "p1", "dagmulkt", null, {});
    const sql = leksikalskSql(fanget);
    const orderPos = sql.search(/ORDER BY ts_rank\(c\.search_vector, plainto_tsquery\('norwegian', \?\)\) DESC/);
    const limitPos = sql.lastIndexOf("LIMIT");
    expect(orderPos).toBeGreaterThan(-1);
    expect(orderPos).toBeLessThan(limitPos);
  });
});

describe("T6 — leksikalskSok-fallbacken respekterer dokumentfilteret", () => {
  it("embedding feiler → fallback-SQL har d.id IN og ekskluder-klausul", async () => {
    stubEmbedding(false);
    const { prisma, fanget } = lagPrisma({});
    const res = await hybridSok(prisma, "p1", "dagmulkt", null, {
      dokumentIder: ["dok-x"],
      ekskluderMappeIder: ["ns-mappe"],
    });
    expect(res.aiSøkUtilgjengelig).toBe(true);
    const fallback = fanget.find((x) => x.sql.includes("DISTINCT ON"))!;
    expect(fallback.sql).toMatch(/AND d\.id IN \(\?\)/);
    expect(fallback.sql).toMatch(/d\.folder_id NOT IN \(\?\)/);
    expect(fallback.values).toContain("dok-x");
    expect(fallback.values).toContain("ns-mappe");
  });
});

describe("T7 / D3 — ubrukte vekter er fjernet", () => {
  it("bm25Weight/qualityWeight finnes ikke i DEFAULT_VEKTER, service eller Zod", () => {
    expect(DEFAULT_VEKTER).not.toHaveProperty("bm25Weight");
    expect(DEFAULT_VEKTER).not.toHaveProperty("qualityWeight");
    for (const fil of ["./ai-sok-service.ts", "../routes/aiSok.ts"]) {
      const kilde = readFileSync(resolve(__dirname, fil), "utf-8");
      expect(kilde).not.toMatch(/bm25Weight|qualityWeight/);
    }
  });
});

describe("T8 / S5 — semantiske treff får beste setning, ordtreff får headline", () => {
  it("E1: «bot ved forsinkelse» (rent semantisk) → setningen «Ved forsinkelse påløper dagmulkt …»", async () => {
    stubEmbedding();
    const { prisma } = lagPrisma({ vektor: [rad("c1", DAGMULKT_CHUNK)] });
    const { treff } = await hybridSok(prisma, "p1", "bot ved forsinkelse", null, {});
    expect(treff[0]!.metode).toBe("semantisk");
    expect(treff[0]!.semantiskSetning).toBe(
      "Ved forsinkelse påløper dagmulkt på 1 promille av kontraktssummen pr. kalenderdag.",
    );
    expect(treff[0]!.utdrag).toBeNull();
  });

  it("E2: «begge» får ts_headline-utdrag (gult), ikke semantisk setning", async () => {
    stubEmbedding();
    const { prisma } = lagPrisma({
      vektor: [rad("c1", DAGMULKT_CHUNK)],
      leksikalsk: [rad("c1", DAGMULKT_CHUNK, 0)],
      headline: [{ id: "c1", utdrag: "… påløper ❰HL❱dagmulkt❰/HL❱ på …" }],
    });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, {});
    expect(treff[0]!.metode).toBe("begge");
    expect(treff[0]!.semantiskSetning).toBeNull();
    expect(treff[0]!.utdrag).toContain("❰HL❱dagmulkt❰/HL❱");
  });

  it("ingen setning med overlapp → null (ikke en tilfeldig setning)", () => {
    expect(finnBesteSetning(DAGMULKT_CHUNK, ["vernerunde"], [])).toBeNull();
  });

  it("likt score → tidligste setning; frase veier tyngre enn term", () => {
    const tekst = "Første om frost. Andre om frost. Tredje om frostsikring av grunnmur.";
    expect(finnBesteSetning(tekst, ["frost"], [])).toBe("Første om frost.");
    expect(finnBesteSetning(tekst, ["frost"], ["frostsikring av grunnmur"])).toBe(
      "Tredje om frostsikring av grunnmur.",
    );
  });

  it("stamme-treff: «forsinkelser» finner «forsinkelse» (æøå-sikker ordstart)", () => {
    expect(finnBesteSetning(DAGMULKT_CHUNK, ["forsinkelser"], [])).toMatch(/^Ved forsinkelse/);
  });
});
