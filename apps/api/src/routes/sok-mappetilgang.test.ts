import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@sitedoc/db";

/**
 * Tom mappeliste (Kenneth 2026-10-28): `hentTilgjengeligeMappeIder` gir `[]` til et medlem uten
 * tilgang til noen mapper (og til firma-admin fra et annet firma). Før kastet `Prisma.join([])`
 * og søket ga 500. Nå gir `[]` bare dokumenter uten mappe (`d.folder_id IS NULL`), og `null`
 * (firma-admin i eget firma) gir ingen mappeklausul — dokumenter i mapper kommer med.
 * Rød på develop 5551b461: `[]` kaster.
 */

const { hentTilgjengeligeMappeIder, fetchMedTimeout } = vi.hoisted(() => ({
  hentTilgjengeligeMappeIder: vi.fn(),
  fetchMedTimeout: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  erSiteDocAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));
vi.mock("../services/embedding-service", () => ({
  fetchMedTimeout,
  startEmbeddingGenerering: vi.fn(),
  stoppEmbeddingGenerering: vi.fn(),
  hentEmbeddingStatus: vi.fn(),
}));

import { ftdSokRouter } from "./ftdSok";
import { hybridSok, blokkSok } from "../services/ai-sok-service";
import { mappeKlausulSql, byggMappeTilgangsFilter } from "../services/mappe-filter";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";

function lagPrisma() {
  const fanget: string[] = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      fanget.push(Prisma.sql(strings, ...values).sql);
      return [];
    }),
  };
  return { prisma, fanget };
}

const caller = (prisma: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ftdSokRouter.createCaller({ userId: "u1", prisma } as any);

/** Hver spørring som rører ftd_documents skal ha nøyaktig `d.folder_id IS NULL` som mappefilter. */
function bareUtenMappe(fanget: string[]) {
  expect(fanget.length).toBeGreaterThan(0);
  for (const sql of fanget) {
    expect(sql).toMatch(/AND d\.folder_id IS NULL/);
    expect(sql).not.toMatch(/d\.folder_id IN \(/);
  }
}

beforeEach(() => {
  hentTilgjengeligeMappeIder.mockReset();
  fetchMedTimeout.mockReset().mockRejectedValue(new Error("NorBERT nede"));
  vi.unstubAllGlobals();
});

describe("medlem uten mappetilgang ([]): treff uten mappe, ingen 500", () => {
  it("ftdSok.sokDokumenter", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue([]);
    const { prisma, fanget } = lagPrisma();
    await expect(caller(prisma).sokDokumenter({ projectId: PROSJEKT, query: "dagmulkt" })).resolves.toBeDefined();
    bareUtenMappe(fanget);
  });

  it("ftdSok.nsStandardSok", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue([]);
    const { prisma, fanget } = lagPrisma();
    await expect(caller(prisma).nsStandardSok({ projectId: PROSJEKT, nsKode: "AB1" })).resolves.toBeDefined();
    bareUtenMappe(fanget);
  });

  it("aiSok hybridSok (faller til leksikalsk søk)", async () => {
    const { prisma, fanget } = lagPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(hybridSok(prisma as any, PROSJEKT, "dagmulkt", [], {})).resolves.toBeDefined();
    bareUtenMappe(fanget);
  });

  it("aiSok blokkSok — og dokumenter uten mappe er nå med (felles regel)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[0.1, 0.2]] }) }),
    );
    const { prisma, fanget } = lagPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(blokkSok(prisma as any, PROSJEKT, "dagmulkt", "nb", [])).resolves.toBeDefined();
    bareUtenMappe(fanget);
  });
});

describe("firma-admin i eget firma (null): dokumenter i mapper kommer med", () => {
  it("ftdSok.sokDokumenter har ingen mappeklausul", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(null);
    const { prisma, fanget } = lagPrisma();
    await caller(prisma).sokDokumenter({ projectId: PROSJEKT, query: "dagmulkt" });
    expect(fanget.length).toBeGreaterThan(0);
    for (const sql of fanget) expect(sql).not.toMatch(/d\.folder_id IS NULL|d\.folder_id IN \(/);
  });
});

describe("mappe-filter — én regel", () => {
  it("SQL: null → ingen klausul, [] → bare uten mappe, ids → uten mappe ELLER i mappene", () => {
    expect(mappeKlausulSql(null).sql).toBe("");
    expect(mappeKlausulSql([]).sql).toBe("AND d.folder_id IS NULL");
    expect(mappeKlausulSql(["m1", "m2"]).sql).toBe("AND (d.folder_id IS NULL OR d.folder_id IN (?,?))");
  });

  it("Prisma-where: null → {}, ellers uten mappe ELLER i mappene (mengde tar nå med dokumenter uten mappe)", () => {
    expect(byggMappeTilgangsFilter(null)).toEqual({});
    expect(byggMappeTilgangsFilter([])).toEqual({ OR: [{ folderId: null }, { folderId: { in: [] } }] });
    expect(byggMappeTilgangsFilter(["m1"])).toEqual({ OR: [{ folderId: null }, { folderId: { in: ["m1"] } }] });
  });
});
