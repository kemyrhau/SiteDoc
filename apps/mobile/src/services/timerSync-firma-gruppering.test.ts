import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-15 (14) punkt 3 — push grupperes pr. firma. Ventende sedler fra
 * to firmaer (etter firmabytte) skal gå i to syncBatch-kall, hvert med sitt
 * eget `organizationId` og bare sine egne sedler. EKTE `syncTimer` mot EKTE
 * SQLite (sql.js), samme harness som `timerSync-tillegg-utlegg-kort.test.ts`.
 * 🔴 Feiler når grupperingen fjernes (én batch med batch[0].organizationId).
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    prepare: (sql: string) => {
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      bind(p: unknown[]): void;
      free(): void;
    };
    getRowsModified(): number;
  },
  shim: null as unknown,
  drizzle: null as unknown,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { syncTimer, delPendingIBatcher } from "./timerSync";

const { dagsseddelLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const kall: Array<{ organizationId: string; ider: string[] }> = [];

const klient = {
  timer: {
    dagsseddel: {
      syncBatch: {
        mutate: async (input: { organizationId: string; sedler: Array<{ clientUuid: string }> }) => {
          kall.push({ organizationId: input.organizationId, ider: input.sedler.map((s) => s.clientUuid) });
          return {
            resultater: input.sedler.map((s) => ({
              clientUuid: s.clientUuid,
              resultat: "ok" as const,
              serverData: { clientUuid: s.clientUuid, status: "draft" as const, lederKommentar: null, attestertVed: null },
            })),
          };
        },
      },
      hentEndringerSiden: {
        query: async () => ({
          serverTid: "2026-07-02T00:00:00.000Z",
          slettevindu: { fraDato: "2026-01-01", tilDato: null as string | null },
          levendeSedler: [],
          sedler: [],
        }),
      },
    },
  },
} as unknown as Parameters<typeof syncTimer>[0];

function sedel(id: string, organizationId: string, dato: string) {
  db()
    .insert(dagsseddelLocal)
    .values({
      id,
      userId: "u1",
      organizationId,
      projectId: "p1",
      aktivitetId: "a1",
      dato,
      status: "draft",
      syncStatus: "pending",
      sistEndretLokalt: 1000,
    })
    .run();
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (sql: string) => raw.run(sql),
    getAllSync: (sql: string, ...params: unknown[]) => {
      const stmt = raw.prepare(sql);
      if (params.length) stmt.bind(params.flat());
      const rader: Record<string, unknown>[] = [];
      while (stmt.step()) rader.push(stmt.getAsObject());
      stmt.free();
      return rader;
    },
    runSync: (sql: string, ...params: unknown[]) => {
      raw.run(sql, params.length ? (params.flat() as unknown[]) : undefined);
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
  };
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  kall.length = 0;
  holder.raw.run("DELETE FROM dagsseddel_local;");
});

describe("POST (14) — push grupperes pr. firma", () => {
  it("(iii) ventende sedler fra to firmaer → to kall med riktig org hver", async () => {
    sedel("a-1", "firma-a", "2026-07-01");
    sedel("b-1", "firma-b", "2026-07-02");
    sedel("a-2", "firma-a", "2026-07-03");
    await syncTimer(klient, "u1", 5000, "firma-b");
    expect(kall).toHaveLength(2);
    const a = kall.find((k) => k.organizationId === "firma-a")!;
    const b = kall.find((k) => k.organizationId === "firma-b")!;
    expect(a.ider.sort()).toEqual(["a-1", "a-2"]);
    expect(b.ider).toEqual(["b-1"]);
  });

  it("ett firma → ett kall (uendret atferd)", async () => {
    sedel("a-1", "firma-a", "2026-07-01");
    sedel("a-2", "firma-a", "2026-07-02");
    await syncTimer(klient, "u1", 5000, "firma-a");
    expect(kall).toEqual([{ organizationId: "firma-a", ider: expect.arrayContaining(["a-1", "a-2"]) }]);
  });
});

describe("delPendingIBatcher", () => {
  it("deler pr. firma og deretter à maks", () => {
    const s = (id: string, organizationId: string) => ({ id, organizationId });
    const ut = delPendingIBatcher([s("1", "a"), s("2", "b"), s("3", "a"), s("4", "a")], 2);
    expect(ut.map((b) => b.map((x) => x.id))).toEqual([["1", "3"], ["4"], ["2"]]);
  });
});
