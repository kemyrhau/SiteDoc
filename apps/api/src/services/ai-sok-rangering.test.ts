import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, type PrismaClient } from "@sitedoc/db";
import { hybridSok, finnBesteSetning, DEFAULT_VEKTER, grupperTreff, MAKS_PR_DOK } from "./ai-sok-service";

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
    // SØK-2: fallbacken kjennes på ROW_NUMBER (før: DISTINCT ON).
    if (q.sql.includes("ROW_NUMBER")) return svar.fallback ?? [];
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
    const fallback = fanget.find((x) => x.sql.includes("ROW_NUMBER"))!;
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

  // Låsetester (relay 29.10, «S5 markeres ikke»): hypotesen «setningen har normaliserte mellomrom,
  // chunk-teksten har \n/\t → klientens indexOf = -1» er avkreftet. delISetninger deler bare på \n og
  // trimmer, så setningen er alltid en eksakt delstreng — også med \t inni. Målt rotårsak var null (neste test).
  it("låsetest: setningen er eksakt delstreng av chunkText også med \\t inni og \\n rundt (klientens indexOf ≥ 0)", () => {
    const tekst = "a)\tOmfang og\tprisgrunnlag.  Post omfatter gatevarme.\n\nDagmulkt\tpr.\tkalenderdag.\n";
    const setning = finnBesteSetning(tekst, ["dagmulkt"], []);
    expect(setning).toBe("Dagmulkt\tpr.\tkalenderdag.");
    expect(tekst.indexOf(setning!)).toBeGreaterThanOrEqual(0);
  });

  it("målt Røstbakken «dagmulkt» (test e8aac60a, gab-chunk 1036): chunk uten ordet → null, ingen setning å markere", () => {
    const gab1036 =
      "Valgfritt\n$DRIFTS- OG VEDLIKEHOLDSDOKUMENTASJON\na)\tOmfang og prisgrunnlag\n\nPost omfatter gatevarmneanlegg (teknisk rom og utendørs anlegg)\n\n- Protokoller over egenkontroller og innregulering.\n- Komplett FDV-dokumentasjon.\n";
    expect(finnBesteSetning(gab1036, ["dagmulkt"], [])).toBeNull();
  });
});

describe("F1b — mikro-chunker utelates fra semantiske kandidater (relay 29.10, Røstbakken «dagmulkt»)", () => {
  // Målt: chunken «— | |» (5 tegn) fikk cos 0,906 og lå øverst, mens ordentlige avsnitt lå på 0,30–0,36.
  it("rent semantisk kandidat under MIN_CHUNK_TEGN forsvinner; ordtreff i kort chunk beholdes", async () => {
    stubEmbedding();
    const { prisma } = lagPrisma({
      vektor: [rad("mikro", "— | |", 0.906), rad("c1", DAGMULKT_CHUNK, 0.35)],
      leksikalsk: [{ ...rad("kort", "Dagmulkt NS 8405", 0), documentId: "dok-kort" }],
      headline: [{ id: "kort", utdrag: "❰HL❱Dagmulkt❰/HL❱ NS 8405" }],
    });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, {});
    const ider = treff.map((t) => t.id);
    expect(ider).not.toContain("mikro");
    expect(ider).toContain("c1");
    expect(ider).toContain("kort");
  });
});

describe("SØK-2 C1–C3 — flere treff pr. dokument (dokumentsok-visning-spec § 5)", () => {
  const iDok = (id: string, dok: string, tekst: string, sim: number, chunkIndex = 1) => ({
    ...rad(id, tekst, sim),
    documentId: dok,
    chunkIndex,
  });

  it("C1 ✗: tre chunks fra ett dokument over terskel → 3 treff under samme documentId", async () => {
    stubEmbedding();
    const { prisma } = lagPrisma({
      vektor: [
        iDok("a", "dok-1", `${DAGMULKT_CHUNK} A`, 0.9, 1),
        iDok("b", "dok-1", `${DAGMULKT_CHUNK} B`, 0.8, 2),
        iDok("c", "dok-1", `${DAGMULKT_CHUNK} C`, 0.7, 3),
      ],
    });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, {});
    expect(treff).toHaveLength(3);
    expect(new Set(treff.map((t) => t.documentId))).toEqual(new Set(["dok-1"]));
    expect(treff.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(treff.every((t) => t.antallIDok === 3)).toBe(true);
  });

  it("C2: dokument rangeres på beste chunk, ikke sum av chunks", async () => {
    stubEmbedding();
    const { prisma } = lagPrisma({
      vektor: [
        iDok("x1", "dok-x", `${DAGMULKT_CHUNK} X1`, 0.95, 1),
        iDok("y1", "dok-y", `${DAGMULKT_CHUNK} Y1`, 0.6, 1),
        iDok("y2", "dok-y", `${DAGMULKT_CHUNK} Y2`, 0.6, 2),
        iDok("y3", "dok-y", `${DAGMULKT_CHUNK} Y3`, 0.6, 3),
      ],
    });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, {});
    expect(treff[0]!.documentId).toBe("dok-x");
    expect(treff.slice(1).every((t) => t.documentId === "dok-y")).toBe(true);
  });

  it("C3: 7 chunks i ett dok → 5 ut, antallIDok = 7; topK teller chunks", async () => {
    stubEmbedding();
    const sju = Array.from({ length: 7 }, (_, i) =>
      iDok(`s${i}`, "dok-s", `${DAGMULKT_CHUNK} ${i}`, 0.9 - i * 0.05, i),
    );
    const { prisma } = lagPrisma({ vektor: sju });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, {});
    expect(treff).toHaveLength(MAKS_PR_DOK);
    expect(treff.every((t) => t.antallIDok === 7)).toBe(true);

    const { prisma: p2 } = lagPrisma({ vektor: sju });
    const { treff: topp3 } = await hybridSok(p2, "p1", "dagmulkt", null, { topK: 3 });
    expect(topp3).toHaveLength(3);
  });

  it("ett dokument i dokumentIder («Vis flere») → intet tak pr. dok, topK styrer", async () => {
    stubEmbedding();
    const sju = Array.from({ length: 7 }, (_, i) =>
      iDok(`s${i}`, "dok-s", `${DAGMULKT_CHUNK} ${i}`, 0.9 - i * 0.05, i),
    );
    const { prisma } = lagPrisma({ vektor: sju });
    const { treff } = await hybridSok(prisma, "p1", "dagmulkt", null, { dokumentIder: ["dok-s"], topK: 25 });
    expect(treff).toHaveLength(7);
  });

  it("fallback-SQL (leksikalskSok) bruker ROW_NUMBER + COUNT OVER, ikke DISTINCT ON ✗; rn-tak 5 / intet tak ved ett dok", async () => {
    stubEmbedding(false);
    const { prisma, fanget } = lagPrisma({});
    await hybridSok(prisma, "p1", "dagmulkt", null, {});
    const fb = fanget.find((x) => x.sql.includes("ROW_NUMBER"))!;
    expect(fb.sql).not.toContain("DISTINCT ON");
    expect(fb.sql).toMatch(/COUNT\(\*\) OVER \(PARTITION BY c\.document_id\)/);
    expect(fb.sql).toMatch(/WHERE t\.rn <= \?/);
    expect(fb.values).toContain(MAKS_PR_DOK);

    const { prisma: p2, fanget: f2 } = lagPrisma({});
    await hybridSok(p2, "p1", "dagmulkt", null, { dokumentIder: ["dok-s"] });
    const fb2 = f2.find((x) => x.sql.includes("ROW_NUMBER"))!;
    expect(fb2.sql).not.toMatch(/t\.rn <=/);
  });
});

describe("SØK-2 grupperTreff — ren funksjon", () => {
  const s = (id: string, dok: string, score: number) => ({ chunk: { id, documentId: dok }, score });

  it("dokumentrekkefølge = beste chunk; chunks i score-rekkefølge; antallIDok teller alle", () => {
    const ut = grupperTreff(
      [s("b2", "B", 0.5), s("a1", "A", 0.9), s("b1", "B", 0.7), s("a2", "A", 0.3), s("c1", "C", 0.8)],
      { maksPrDok: 5, topK: 20 },
    );
    expect(ut.map((x) => x.chunk.id)).toEqual(["a1", "a2", "c1", "b1", "b2"]);
    expect(ut.map((x) => x.antallIDok)).toEqual([2, 2, 1, 2, 2]);
  });

  it("tak pr. dok kappes, antallIDok beholder totalen; topK teller chunks", () => {
    const inn = Array.from({ length: 7 }, (_, i) => s(`d${i}`, "D", 1 - i * 0.1));
    const ut = grupperTreff([...inn, s("e1", "E", 0.05)], { maksPrDok: 5, topK: 20 });
    expect(ut.map((x) => x.chunk.id)).toEqual(["d0", "d1", "d2", "d3", "d4", "e1"]);
    expect(ut[0]!.antallIDok).toBe(7);
    expect(grupperTreff(inn, { maksPrDok: 5, topK: 2 })).toHaveLength(2);
    expect(grupperTreff(inn, { maksPrDok: Number.POSITIVE_INFINITY, topK: 20 })).toHaveLength(7);
  });

  it("stabil: likt score beholder innsendt rekkefølge; input muteres ikke", () => {
    const inn = [s("x", "X", 0.5), s("y", "Y", 0.5), s("z", "Z", 0.5)];
    const kopi = [...inn];
    expect(grupperTreff(inn, { maksPrDok: 5, topK: 20 }).map((x) => x.chunk.id)).toEqual(["x", "y", "z"]);
    expect(inn).toEqual(kopi);
  });
});
