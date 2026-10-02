import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * B6 v3 — svar-cachen (`arbeidstid_svar_local`). Ekte SQLite (sql.js/WASM), samme
 * harness som `timerSync.test.ts`: expo-sqlite byttes med sql.js, migreringene
 * kjører uendret, `hentDatabase()` gir Drizzle over samme base.
 *
 * Gate: trinn 1 (server) · trinn 2 (cachet ≤30d) · trinn 3 (null, ALDRI 7,5) ·
 * >30d → null · henting-ved-åpning (hent fra server → rad finnes → "server").
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
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
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

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  hentDagsnormLokalt,
  hentOgCacheArbeidstidSvar,
} from "./arbeidstidSvarKatalog";

const { arbeidstidSvarLocal } = schema;

type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const ORG = "o1";
const DAG_MS = 24 * 60 * 60 * 1000;
// Fast "nå" for deterministiske cache-alder-tester.
const NAA = 1_000 * DAG_MS;
const naa = () => NAA;

function seedSvar(over: {
  dato: string;
  dagsnorm?: number;
  normKilde?: string;
  hentetAt: number;
}) {
  db()
    .insert(arbeidstidSvarLocal)
    .values({
      organizationId: ORG,
      dato: over.dato,
      dagsnorm: over.dagsnorm ?? 7.5,
      startTid: "07:00",
      sluttTid: "15:00",
      pauseMin: 30,
      normKilde: over.normKilde ?? "fast",
      pauseEtterTimer: 4,
      pauseReferanse: "ankomst",
      hentetAt: over.hentetAt,
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
    execSync: (sql: string) => {
      raw.run(sql);
    },
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
  holder.raw.run("DELETE FROM arbeidstid_svar_local;");
});

describe("hentDagsnormLokalt — svar-cachens tre trinn", () => {
  it("trinn 1: eksakt svar for datoen → normStatus 'server'", () => {
    seedSvar({ dato: "2026-07-01", dagsnorm: 8, normKilde: "kalender", hentetAt: NAA });
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r?.normStatus).toBe("server");
    expect(r?.dagsnorm).toBe(8);
    expect(r?.normKilde).toBe("kalender");
  });

  it("trinn 2: intet svar for datoen, men ett ≤30d gammelt → 'cachet'", () => {
    // Svar for en ANNEN dato, hentet 10 dager siden.
    seedSvar({ dato: "2026-06-20", dagsnorm: 7.5, hentetAt: NAA - 10 * DAG_MS });
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r?.normStatus).toBe("cachet");
    expect(r?.dato).toBe("2026-06-20"); // for «siste kjente svar (dd.mm)»-teksten
  });

  it("🔴 trinn 3: ingenting → null (ALDRI 7,5)", () => {
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r).toBeNull();
  });

  it("🔴 >30d gammelt svar → null (telefon offline > 30 dager)", () => {
    seedSvar({ dato: "2026-05-01", hentetAt: NAA - 31 * DAG_MS });
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r).toBeNull();
  });

  it("trinn 1 vinner over trinn 2 når begge finnes", () => {
    seedSvar({ dato: "2026-07-01", dagsnorm: 8, hentetAt: NAA - 5 * DAG_MS });
    seedSvar({ dato: "2026-06-20", dagsnorm: 7.5, hentetAt: NAA });
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r?.normStatus).toBe("server");
    expect(r?.dagsnorm).toBe(8);
  });
});

describe("hentOgCacheArbeidstidSvar — henting ved åpning", () => {
  function lagKlient(svar: Record<string, unknown>) {
    return {
      organisasjon: {
        hentEffektivArbeidstid: { query: async () => svar },
      },
    } as unknown as Parameters<typeof hentOgCacheArbeidstidSvar>[0];
  }

  it("henter server-svar og cacher det → etterpå finnes raden som 'server'", async () => {
    const klient = lagKlient({
      dagsnorm: 8,
      startTid: "07:00",
      sluttTid: "15:30",
      pauseMin: 30,
      normKilde: "kalender",
      pauseEtterTimer: 4,
      pauseReferanse: "ankomst",
    });
    const ok = await hentOgCacheArbeidstidSvar(klient, ORG, "2026-07-01", naa);
    expect(ok).toBe(true);
    const r = hentDagsnormLokalt(ORG, "2026-07-01", naa);
    expect(r?.normStatus).toBe("server");
    expect(r?.dagsnorm).toBe(8);
  });

  it("offline (query kaster) → false, cachen urørt", async () => {
    const klient = {
      organisasjon: {
        hentEffektivArbeidstid: {
          query: async () => {
            throw new Error("offline");
          },
        },
      },
    } as unknown as Parameters<typeof hentOgCacheArbeidstidSvar>[0];
    const ok = await hentOgCacheArbeidstidSvar(klient, ORG, "2026-07-01", naa);
    expect(ok).toBe(false);
    expect(hentDagsnormLokalt(ORG, "2026-07-01", naa)).toBeNull();
  });

  it("upsert: nytt svar for samme (org,dato) overskriver", async () => {
    await hentOgCacheArbeidstidSvar(
      lagKlient({ dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
      ORG,
      "2026-07-01",
      naa,
    );
    await hentOgCacheArbeidstidSvar(
      lagKlient({ dagsnorm: 8, startTid: "07:00", sluttTid: "15:30", pauseMin: 30, normKilde: "kalender", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
      ORG,
      "2026-07-01",
      naa,
    );
    expect(hentDagsnormLokalt(ORG, "2026-07-01", naa)?.dagsnorm).toBe(8);
  });
});
