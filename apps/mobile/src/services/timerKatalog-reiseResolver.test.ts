import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-14 (8) punkt 2 (5) — mobilens `hentReiseLonnsartId` (render-
 * merking, GPS-forslagets fallback, maskin-kontroll) skal velge SAMME reise-
 * lønnsart som den delte resolveren `løsReiseKnappLonnsart` («+ Reise»):
 *   - eksplisitt valg som er deaktivert → ingen (ikke den deaktiverte id-en),
 *   - automatisk kun ved nøyaktig ÉN aktiv ORDINÆR navne-match,
 *   - ≥ 2 treff → ingen (tvetydig), ikke «første i katalogorden».
 * Rød før fiksen: gammel fallback tok `reiseLonnsartId ?? første regex-treff`.
 *
 * EKTE SQLite (sql.js), samme harness som `timerKatalog-lag2.test.ts`.
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

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { hentReiseKnappLokalt, hentReiseLonnsartId } from "./timerKatalog";

const { lonnsartLocal, organizationSettingLocal, reiseGrensepunktLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

function seedLonnsart(id: string, navn: string, type = "ordinaer", aktiv = true) {
  db()
    .insert(lonnsartLocal)
    .values({ id, organizationId: "o1", type, navn, aktiv, sistOppdatert: 1 })
    .run();
}

function settValgt(reiseLonnsartId: string | null) {
  db()
    .insert(organizationSettingLocal)
    .values({ organizationId: "o1", reiseLonnsartId, sistOppdatert: 1 })
    .run();
}

/** Det «+ Reise» (delt resolver) fører på — fasit for render/GPS-merking. */
function resolverFasit(): string | null {
  const r = hentReiseKnappLokalt("o1");
  return r.status === "valgt" || r.status === "automatisk" ? r.lonnsartId : null;
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
  holder.raw.run(
    "DELETE FROM lonnsart_local; DELETE FROM organization_setting_local; DELETE FROM reise_grensepunkt_local;",
  );
});

describe("hentReiseLonnsartId = delt resolver (POST (8) punkt 2 (5))", () => {
  it("🔴 eksplisitt valg som er deaktivert → null (ikke den deaktiverte arten)", () => {
    settValgt("reise-art");
    seedLonnsart("reise-art", "Reise", "ordinaer", false);
    seedLonnsart("timelonn", "Timelønn");
    expect(hentReiseLonnsartId("o1")).toBeNull();
    expect(hentReiseLonnsartId("o1")).toBe(resolverFasit());
  });

  it("🔴 to navne-treff uten valg → null (tvetydig), ikke første i katalogen", () => {
    settValgt(null);
    seedLonnsart("r1", "Reise sone 1");
    seedLonnsart("r2", "Transport");
    expect(hentReiseLonnsartId("o1")).toBeNull();
    expect(hentReiseLonnsartId("o1")).toBe(resolverFasit());
  });

  it("🔴 navne-treff som ikke er ordinær lønnsart → null", () => {
    settValgt(null);
    seedLonnsart("t1", "Reisetillegg", "tillegg");
    expect(hentReiseLonnsartId("o1")).toBeNull();
    expect(hentReiseLonnsartId("o1")).toBe(resolverFasit());
  });

  it("aktivt eksplisitt valg → valget; nøyaktig én ordinær treff → den", () => {
    settValgt("valgt");
    seedLonnsart("valgt", "Kjøring");
    seedLonnsart("r1", "Reise");
    expect(hentReiseLonnsartId("o1")).toBe("valgt");
    expect(hentReiseLonnsartId("o1")).toBe(resolverFasit());
    holder.raw.run("DELETE FROM organization_setting_local;");
    settValgt(null);
    expect(hentReiseLonnsartId("o1")).toBe("r1");
    expect(hentReiseLonnsartId("o1")).toBe(resolverFasit());
  });

  it("avstandsbånd med art vinner fortsatt når avstand er oppgitt", () => {
    settValgt(null);
    seedLonnsart("r1", "Reise");
    seedLonnsart("band", "Sone 2");
    db()
      .insert(reiseGrensepunktLocal)
      .values({ organizationId: "o1", grenseM: 25000, lonnsartId: "band", sistOppdatert: 1 })
      .run();
    expect(hentReiseLonnsartId("o1", 30000)).toBe("band");
    expect(hentReiseLonnsartId("o1", 1000)).toBe("r1");
  });
});
