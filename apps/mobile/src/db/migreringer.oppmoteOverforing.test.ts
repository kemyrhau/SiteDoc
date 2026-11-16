import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-15 (13) del B: `kilde` på oppmote_periode_local + kø-tabellen
 * oppmote_overforing_ko. Starter med periode-cachen i L1-formen (én gammel rad),
 * kjører de ekte migreringene (sql.js) og krever TEXT-kolonne, gammel rad urørt
 * med NULL, køtabellen med riktige kolonner, og idempotens.
 */

const holder = vi.hoisted(() => ({
  db: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  },
  shim: null as unknown as { execSync: (sql: string) => void; [k: string]: unknown },
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("drizzle-orm/expo-sqlite", () => ({ drizzle: () => ({}) }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));

import { kjorMigreringer, OPPMOTE_KILDE_KOLONNER, OPPMOTE_OVERFORING_KO } from "./migreringer";

function kolonner(tabell: string): Record<string, string> {
  const res = holder.db.exec(`PRAGMA table_info(${tabell})`);
  return Object.fromEntries((res[0]?.values ?? []).map((r) => [String(r[1]), String(r[2])]));
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const db = new SQL.Database();
  holder.db = db;
  holder.shim = {
    execSync: (sql: string) => {
      db.run(sql);
    },
    getAllSync: (sql: string, ...params: unknown[]) => {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params.flat());
      const rader: Record<string, unknown>[] = [];
      while (stmt.step()) rader.push(stmt.getAsObject());
      stmt.free();
      return rader;
    },
    runSync: (sql: string, ...params: unknown[]) => {
      db.run(sql, params.length ? (params.flat() as unknown[]) : undefined);
      return { changes: db.getRowsModified(), lastInsertRowId: 0 };
    },
  };
  db.run(`CREATE TABLE oppmote_periode_local (
    id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, organization_id TEXT NOT NULL,
    type TEXT NOT NULL, fast INTEGER NOT NULL DEFAULT 0, oppmotested_id TEXT, project_id TEXT,
    fra_dato TEXT NOT NULL, til_dato TEXT, sist_oppdatert INTEGER NOT NULL)`);
  db.run(`INSERT INTO oppmote_periode_local (id, user_id, organization_id, type, fast, fra_dato, sist_oppdatert)
          VALUES ('p-gammel', 'u1', 'o1', 'kontor', 1, '2026-01-01', 1234)`);
});

describe("del B: oppmote kilde + overføringskø", () => {
  it("konstantene peker på riktig tabell/kolonne", () => {
    expect(OPPMOTE_KILDE_KOLONNER).toEqual([["oppmote_periode_local", "kilde"]]);
    expect(OPPMOTE_OVERFORING_KO).toBe("oppmote_overforing_ko");
  });

  it("negativkontroll: kolonnen og køen finnes ikke før migrering", () => {
    expect(kolonner("oppmote_periode_local").kilde).toBeUndefined();
    expect(kolonner("oppmote_overforing_ko")).toEqual({});
  });

  it("migreringen legger til kilde TEXT uten backfill og lager køtabellen", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner("oppmote_periode_local").kilde).toBe("TEXT");
    expect(
      holder.db.exec(`SELECT sist_oppdatert, kilde FROM oppmote_periode_local WHERE id='p-gammel'`)[0]?.values[0],
    ).toEqual([1234, null]);
    expect(Object.keys(kolonner("oppmote_overforing_ko")).sort()).toEqual(
      ["dato", "feilmelding", "forsok", "handling", "id", "oppmotested_id", "opprettet", "organization_id", "user_id"],
    );
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ADD COLUMN kilde/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
