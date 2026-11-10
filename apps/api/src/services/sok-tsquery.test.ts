import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";

/**
 * SØK-2 punkt 6 (Kenneth 2026-11-11): tekstsøket matcher ordbegynnelser. «adgangskontr» ga
 * «Ingen dokumenter inneholder ordet» selv om dokumentet har «Adgangskontroll». Hele ord
 * rangeres fortsatt foran rene prefiks-treff. Ctrl K («Søk overalt») bruker `ftdSok.sokDokumenter`
 * — samme port som Dokumentsøk (medlemskap + mappefilter på server).
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder, fetchMedTimeout } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
  fetchMedTimeout: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem,
  verifiserAdmin: vi.fn(),
  erSiteDocAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("./folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));
vi.mock("./embedding-service", () => ({
  fetchMedTimeout,
  startEmbeddingGenerering: vi.fn(),
  stoppEmbeddingGenerering: vi.fn(),
  hentEmbeddingStatus: vi.fn(),
}));

import { prefiksTsqueryStreng, tekstTsquery, MIN_PREFIKS_TEGN } from "./sok-tsquery";
import { hybridSok, beregReRank, DEFAULT_VEKTER, PREFIKS_FAKTOR } from "./ai-sok-service";
import { ftdSokRouter } from "../routes/ftdSok";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";

/** Fanger SQL + parametre fra hvert `$queryRaw`-kall. */
function lagPrisma() {
  const fanget: { sql: string; values: unknown[] }[] = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const s = Prisma.sql(strings, ...values);
      fanget.push({ sql: s.sql, values: s.values });
      return [];
    }),
  };
  return { prisma, fanget };
}

// Ctrl K-kallet (apps/web/src/hooks/useDokumentSok.ts): { projectId, query, limit: 20 }.
const ctrlK = (prisma: unknown, query = "adgangskontr") =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ftdSokRouter.createCaller({ userId: "u1", prisma } as any).sokDokumenter({ projectId: PROSJEKT, query, limit: 20 });

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
  fetchMedTimeout.mockReset().mockRejectedValue(new Error("NorBERT nede"));
});

describe("prefiksTsqueryStreng — ren", () => {
  it("ett ord → term:*", () => {
    expect(prefiksTsqueryStreng("Adgangskontr")).toBe("adgangskontr:*");
  });

  it("flere ord → &", () => {
    expect(prefiksTsqueryStreng("adgangs kontroll")).toBe("adgangs:* & kontroll:*");
  });

  it("tsquery-operatorer slipper aldri gjennom", () => {
    const s = prefiksTsqueryStreng("vern & !(sja | ras):* 'x' <-> \\ dag");
    expect(s).toBe("vern:* & sja:* & ras:* & dag:*");
    expect(s?.replace(/:\*/g, "").replace(/ & /g, " ")).not.toMatch(/[&|!():*'<>\\-]/);
  });

  it("tom / bare tegn → null", () => {
    expect(prefiksTsqueryStreng("")).toBeNull();
    expect(prefiksTsqueryStreng("  & | ! ")).toBeNull();
  });

  it(`termer under ${MIN_PREFIKS_TEGN} tegn får ikke :*`, () => {
    expect(prefiksTsqueryStreng("ab")).toBeNull();
    expect(prefiksTsqueryStreng("ab sja")).toBe("sja:*");
  });

  it("æøå og tall beholdes", () => {
    expect(prefiksTsqueryStreng("Påløper 2026")).toBe("påløper:* & 2026:*");
  });

  it("tekstTsquery faller til hele ord når prefiks-delen er tom", () => {
    expect(tekstTsquery("ab").sql).toBe("plainto_tsquery('norwegian', ?)");
    expect(tekstTsquery("adgang").sql).toBe(
      "(plainto_tsquery('norwegian', ?) || to_tsquery('norwegian', ?))",
    );
  });
});

describe("ftdSok.sokDokumenter (Ctrl K-kallet) — prefiks + helords-klassen først", () => {
  it("SQL har prefiks-tsquery og ORDER BY helord DESC før rank", async () => {
    const { prisma, fanget } = lagPrisma();
    await ctrlK(prisma);
    const hoved = fanget[0]!;
    expect(hoved.sql).toContain("to_tsquery('norwegian', ?)");
    expect(hoved.values).toContain("adgangskontr:*");
    expect(hoved.sql).toMatch(/ORDER BY t\.helord DESC, t\.rank DESC/);
    expect(hoved.sql).toMatch(/PARTITION BY c\.document_id\s+ORDER BY \(c\.search_vector @@ plainto_tsquery/);
  });

  it("hent mappe-ider gir [] → bare dokumenter uten mappe (også i ILIKE-fallback)", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue([]);
    const { prisma, fanget } = lagPrisma();
    await ctrlK(prisma);
    expect(fanget.length).toBe(2); // tsvector + ILIKE-fallback (0 rader)
    for (const { sql } of fanget) {
      expect(sql).toMatch(/AND d\.folder_id IS NULL/);
      expect(sql).not.toMatch(/d\.folder_id IN \(/);
    }
  });

  it("ikke-medlem → FORBIDDEN, ingen spørring", async () => {
    verifiserProsjektmedlem.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const { prisma, fanget } = lagPrisma();
    await expect(ctrlK(prisma)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fanget).toHaveLength(0);
  });
});

describe("hybridSok (AI-modus) — prefiks i leksikalske kandidater", () => {
  it("kandidatuttaket bruker prefiks-tsquery og helords-klassen først", async () => {
    const { prisma, fanget } = lagPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await hybridSok(prisma as any, PROSJEKT, "adgangskontr", null, {});
    const medPrefiks = fanget.filter((f) => f.values.includes("adgangskontr:*"));
    expect(medPrefiks.length).toBeGreaterThan(0);
    for (const { sql } of medPrefiks) {
      expect(sql).toMatch(/ORDER BY (t\.helord DESC|\(c\.search_vector @@ plainto_tsquery)/);
    }
  });

  it(`rent prefiks-treff får term-signalet ganget med ${PREFIKS_FAKTOR}`, () => {
    const chunk = {
      id: "c1", documentId: "d1", chunkText: "Adgangskontroll ved porten", chunkIndex: 0,
      pageNumber: null, sectionTitle: null, pageHeading: null, nsCode: null,
      filename: "x.docx", fileUrl: null, docType: null, folderId: null,
      cosineSim: 0, kilde: "leksikalsk" as const,
    };
    const hel = beregReRank(chunk, ["adgangskontr"], [], [], DEFAULT_VEKTER);
    const prefiks = beregReRank({ ...chunk, kunPrefiks: true }, ["adgangskontr"], [], [], DEFAULT_VEKTER);
    expect(prefiks).toBeCloseTo(hel - DEFAULT_VEKTER.termWeight * (1 - PREFIKS_FAKTOR));
  });
});
