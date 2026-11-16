import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";

/**
 * SØK-2 punkt 6 (Kenneth 2026-11-11): «adgangskontr» ga «Ingen dokumenter inneholder ordet» selv om
 * dokumentet har «Adgangskontroll». Søket skal gi mest mulig korrekte treff: hele ord først,
 * ordbegynnelser bare når hele ord gir 0 treff. Ctrl K («Søk overalt») bruker `ftdSok.sokDokumenter`
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

import { prefiksTsqueryStreng, prefiksTsquery, MIN_PREFIKS_TEGN } from "./sok-tsquery";
import { hybridSok, beregReRank, DEFAULT_VEKTER, PREFIKS_FAKTOR } from "./ai-sok-service";
import { ftdSokRouter } from "../routes/ftdSok";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";

/** Fanger SQL + parametre fra hvert `$queryRaw`-kall. `svar(sql)` gir radene (standard: ingen). */
function lagPrisma(svar: (sql: string) => unknown[] = () => []) {
  const fanget: { sql: string; values: unknown[] }[] = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const s = Prisma.sql(strings, ...values);
      fanget.push({ sql: s.sql, values: s.values });
      return svar(s.sql);
    }),
  };
  return { prisma, fanget };
}

const HELORD = "plainto_tsquery('norwegian', ?)";
const PREFIKS = "to_tsquery('norwegian', ?)";
/** `to_tsquery(` står også inni `plainto_tsquery(` — se bare etter den frittstående. */
const harPrefiks = (sql: string) => /(?<!plain)to_tsquery\('norwegian'/.test(sql);

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

  it("prefiksTsquery er null når ingen term er lang nok", () => {
    expect(prefiksTsquery("ab")).toBeNull();
    expect(prefiksTsquery("adgang")?.sql).toBe(PREFIKS);
  });
});

describe("ftdSok.sokDokumenter (Ctrl K-kallet) — hele ord først, prefiks bare ved 0 treff", () => {
  it("hele ord gir treff → ingen prefiks-spørring", async () => {
    const { prisma, fanget } = lagPrisma(() => [{ id: "c1" }]);
    await ctrlK(prisma, "sikkerhet");
    expect(fanget).toHaveLength(1);
    expect(fanget[0]!.sql).toContain(HELORD);
    expect(harPrefiks(fanget[0]!.sql)).toBe(false);
  });

  it("hele ord gir 0 treff → prefiks-spørring med term:*, så ILIKE", async () => {
    const { prisma, fanget } = lagPrisma();
    await ctrlK(prisma);
    expect(fanget).toHaveLength(3);
    expect(fanget[0]!.sql).toContain(HELORD);
    expect(harPrefiks(fanget[1]!.sql)).toBe(true);
    expect(fanget[1]!.sql).not.toContain(HELORD);
    expect(fanget[1]!.values).toContain("adgangskontr:*");
    expect(fanget[2]!.sql).toContain("ILIKE");
  });

  it("prefiks gir treff → ingen ILIKE", async () => {
    const { prisma, fanget } = lagPrisma((sql) => (harPrefiks(sql) ? [{ id: "c1" }] : []));
    await ctrlK(prisma);
    expect(fanget).toHaveLength(2);
    expect(fanget.some((f) => f.sql.includes("ILIKE"))).toBe(false);
  });

  it("hent mappe-ider gir [] → bare dokumenter uten mappe (i alle trinn)", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue([]);
    const { prisma, fanget } = lagPrisma();
    await ctrlK(prisma);
    expect(fanget.length).toBe(3); // hele ord + prefiks + ILIKE-fallback (0 rader)
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

describe("hybridSok (AI-modus) — prefiks bare når hele ord gir 0 kandidater", () => {
  it("leksikalske kandidater: hele ord først, deretter term:*", async () => {
    const { prisma, fanget } = lagPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await hybridSok(prisma as any, PROSJEKT, "adgangskontr", null, {});
    const helordIdx = fanget.findIndex((f) => f.sql.includes(HELORD) && !harPrefiks(f.sql));
    const prefiksIdx = fanget.findIndex((f) => f.values.includes("adgangskontr:*"));
    expect(helordIdx).toBeGreaterThan(-1);
    expect(prefiksIdx).toBeGreaterThan(helordIdx);
    expect(fanget[prefiksIdx]!.sql).not.toContain(HELORD);
  });

  it("hele ord gir kandidater → ingen prefiks-spørring", async () => {
    const { prisma, fanget } = lagPrisma(() => [{ id: "c1", documentId: "d1", chunkText: "sikkerhet" }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await hybridSok(prisma as any, PROSJEKT, "sikkerhet", null, {});
    expect(fanget.some((f) => harPrefiks(f.sql))).toBe(false);
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
