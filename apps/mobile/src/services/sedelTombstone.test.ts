import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import { readFileSync } from "node:fs";

/**
 * ORDRE 36e (RETUR) — sedel-tombstonen fra prosjektkortets `slettSedel`.
 * Hjelperen må legge radType "sedel" (synken sender `slett` kun for den), og
 * hooken må kalle den før `slettLokalt()` i draft-veien.
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
import { leggSedelTombstone } from "./sedelTombstone";

type Db = ReturnType<typeof drizzle<typeof schema>>;
const db = () => holder.drizzle as Db;
const lokalDb = () => holder.drizzle as Parameters<typeof leggSedelTombstone>[0];
const tombstones = () => db().select().from(schema.slettedeRaderLocal).all();

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
  holder.raw.run("DELETE FROM slettede_rader_local;");
});

describe("ORDRE 36e — leggSedelTombstone", () => {
  it("🔴 legger tombstone med radType sedel og sedel-id som radId og dagsseddelId", () => {
    leggSedelTombstone(lokalDb(), "s1", 1234);
    expect(tombstones()).toEqual([
      { radId: "s1", dagsseddelId: "s1", radType: "sedel", serverVersjon: null, slettetVed: 1234 },
    ]);
  });

  it("idempotent: ny sletting av samme sedel gir ingen dublett og ingen feil", () => {
    leggSedelTombstone(lokalDb(), "s1", 1);
    leggSedelTombstone(lokalDb(), "s1", 2);
    expect(tombstones()).toHaveLength(1);
  });
});

describe("ORDRE 36e — prosjektkortets slettSedel legger tombstonen", () => {
  const kilde = readFileSync(
    path.join(__dirname, "../components/timer-detalj/prosjektkort/useProsjektkortSedel.ts"),
    "utf-8",
  );
  const slettSedel = kilde.slice(kilde.indexOf("function slettSedel()"));

  it("🔴 draft-veien kaller leggSedelTombstone før slettLokalt()", () => {
    const tombstone = slettSedel.indexOf("leggSedelTombstone(db, sheetId)");
    const draftSlett = slettSedel.indexOf("slettLokalt();", slettSedel.indexOf("} else {"));
    expect(tombstone).toBeGreaterThan(-1);
    expect(draftSlett).toBeGreaterThan(tombstone);
  });
});
