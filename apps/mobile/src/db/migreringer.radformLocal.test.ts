import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Radform (Kenneth 2026-11-12): `vareforbruk_local` får `sheet_timer_id` — timerraden linjen
 * er ført fra. Testen starter med tabellen i formen før kolonnen (med én gammel linje), kjører
 * de ekte migreringene (sql.js) og krever at kolonnen er lagt til, at den gamle linjen står
 * urørt med NULL (ingen gjettende backfill) og at andre kjøring ikke ALTER-er på nytt.
 * Negativkontroll: kolonnen mangler før migrering.
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

import { kjorMigreringer, RADFORM_LOCAL_KOLONNER } from "./migreringer";

function kolonner(tabell: string): string[] {
  const res = holder.db.exec(`PRAGMA table_info(${tabell})`);
  return res[0]?.values.map((r) => String(r[1])) ?? [];
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

  db.run(`
    CREATE TABLE vareforbruk_local (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      sheet_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      dato TEXT NOT NULL,
      vare_id TEXT NOT NULL,
      vare_navn TEXT NOT NULL,
      enhet TEXT NOT NULL,
      antall REAL NOT NULL,
      byggeplass_id TEXT,
      external_cost_object_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      feilmelding TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO vareforbruk_local (id, user_id, organization_id, sheet_id, project_id, dato, vare_id, vare_navn, enhet, antall, sist_endret_lokalt) VALUES ('x-gammel', 'u1', 'o1', 's1', 'p1', '2026-11-12', 'v1', 'Pukk', 'tonn', 3, 1234)",
  );
});

describe("Radform: vareforbruk_local.sheet_timer_id", () => {
  it("gjelder varelinjens timerrad", () => {
    expect(RADFORM_LOCAL_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual(["vareforbruk_local.sheet_timer_id"]);
  });

  it("kolonnen mangler før migrering (negativkontroll)", () => {
    expect(kolonner("vareforbruk_local")).not.toContain("sheet_timer_id");
  });

  it("migreringen legger til kolonnen uten backfill og bevarer den gamle linjen", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner("vareforbruk_local")).toContain("sheet_timer_id");
    expect(
      holder.db.exec("SELECT antall, sheet_timer_id FROM vareforbruk_local WHERE id='x-gammel'")[0]?.values[0],
    ).toEqual([3, null]);
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) =>
      /ALTER TABLE vareforbruk_local ADD COLUMN sheet_timer_id/i.test(String(sql)),
    );
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
