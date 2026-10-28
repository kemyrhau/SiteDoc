import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@sitedoc/db";

/**
 * SØK-1 S4 (dokumentsok-visning-spec § 6 T6, D2/D4):
 * - D2: filteret (ett referansedokument / ekskluder NS-mapper) gjelder også Tekstsøk.
 * - D4: ILIKE-fallbacken rangeres på antall forekomster, ikke filnavn; likhet løses deterministisk.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  erSiteDocAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("../services/folder-tilgang", () => ({
  hentTilgjengeligeMappeIder: vi.fn().mockResolvedValue(null),
}));

import { ftdSokRouter } from "./ftdSok";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";

function lagCaller() {
  const fanget: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    // Tsvector-søket gir 0 treff → ILIKE-fallbacken kjøres også.
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = Prisma.sql(strings, ...values);
      fanget.push({ sql: q.sql, values: q.values });
      return [];
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { caller: ftdSokRouter.createCaller({ userId: "u1", prisma } as any), fanget };
}

describe("ftdSok.sokDokumenter — S4", () => {
  it("D2: dokumentIder/ekskluderMappeIder havner i både tsvector- og ILIKE-spørringen", async () => {
    const { caller, fanget } = lagCaller();
    await caller.sokDokumenter({
      projectId: PROSJEKT,
      query: "dagmulkt",
      dokumentIder: ["dok-ref"],
      ekskluderMappeIder: ["ns-mappe"],
    });
    expect(fanget).toHaveLength(2);
    for (const q of fanget) {
      expect(q.sql).toMatch(/d\.project_id = \?/);
      expect(q.sql).toMatch(/AND d\.id IN \(\?\)/);
      expect(q.sql).toMatch(/d\.folder_id NOT IN \(\?\)/);
      expect(q.values).toContain("dok-ref");
      expect(q.values).toContain("ns-mappe");
    }
  });

  it("uten filter: ingen dokument-/ekskluder-klausul", async () => {
    const { caller, fanget } = lagCaller();
    await caller.sokDokumenter({ projectId: PROSJEKT, query: "dagmulkt" });
    for (const q of fanget) {
      expect(q.sql).not.toMatch(/d\.id IN/);
      expect(q.sql).not.toMatch(/NOT IN/);
    }
  });

  it("D4: ILIKE-fallbacken sorteres på forekomster (rank) først, så filnavn/avsnitt/id", async () => {
    const { caller, fanget } = lagCaller();
    await caller.sokDokumenter({ projectId: PROSJEKT, query: "Dagmulkt" });
    const ilike = fanget[1]!.sql;
    // rank = antall ikke-overlappende forekomster av søkestrengen (små bokstaver)
    expect(ilike).toMatch(/length\(lower\(c\.chunk_text\)\) - length\(replace\(lower\(c\.chunk_text\), \?, ''\)\)/);
    expect(fanget[1]!.values).toContain("dagmulkt");
    expect(ilike).toMatch(/ORDER BY t\.rank DESC, t\.filename ASC, t\."chunkIndex" ASC, t\.id ASC/);
    expect(ilike).not.toMatch(/ORDER BY t\.filename ASC, t\.rank DESC/);
  });
});
