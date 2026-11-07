import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE 36b (2026-11-07): prosjektkortet ER valget. `sheet_machine_local` får `byggeplass_id`
 * og `vareforbruk_local` får `external_cost_object_id`. Testen starter med tabellene i formen
 * før kolonnene (med én rad hver), kjører de ekte migreringene (sql.js) og krever at kolonnene
 * er lagt til, at radene står urørt (ingen backfill), og at andre kjøring ikke ALTER-er på nytt.
 * Feiler når kolonnen mangler.
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


import { kjorMigreringer, KORTVALG_LOCAL_KOLONNER } from "./migreringer";

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

  // Eksisterende installasjon: tabellene i formen før ORDRE 36b, med én rad hver.
  db.run(`
    CREATE TABLE sheet_machine_local (
      id TEXT PRIMARY KEY NOT NULL,
      dagsseddel_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      timer REAL NOT NULL,
      mengde REAL,
      enhet TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );
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
      sync_status TEXT NOT NULL DEFAULT 'pending',
      feilmelding TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO sheet_machine_local (id, dagsseddel_id, vehicle_id, timer, sist_endret_lokalt) VALUES ('m-gammel', 's1', 'v1', 2, 1234)",
  );
  db.run(
    "INSERT INTO vareforbruk_local (id, user_id, organization_id, sheet_id, project_id, dato, vare_id, vare_navn, enhet, antall, byggeplass_id, sist_endret_lokalt) VALUES ('x-gammel', 'u1', 'o1', 's1', 'p1', '2026-11-07', 'v1', 'Pukk', 'tonn', 3, 'b1', 1234)",
  );
});

describe("ORDRE 36b: kortvalg-kolonner på eksisterende tabeller", () => {
  it("gjelder maskinens byggeplass og varens underprosjekt", () => {
    expect(KORTVALG_LOCAL_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual([
      "sheet_machine_local.byggeplass_id",
      "vareforbruk_local.external_cost_object_id",
    ]);
  });

  it("kolonnene mangler før migrering", () => {
    for (const [t, k] of KORTVALG_LOCAL_KOLONNER) expect(kolonner(t)).not.toContain(k);
  });

  it("migreringen legger til kolonnene, uten backfill, og bevarer eksisterende rader", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const [t, k] of KORTVALG_LOCAL_KOLONNER) expect(kolonner(t)).toContain(k);
    expect(holder.db.exec("SELECT timer, byggeplass_id FROM sheet_machine_local WHERE id='m-gammel'")[0]?.values[0]).toEqual([
      2,
      null,
    ]);
    expect(
      holder.db.exec("SELECT byggeplass_id, external_cost_object_id FROM vareforbruk_local WHERE id='x-gammel'")[0]?.values[0],
    ).toEqual(["b1", null]);
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) =>
      /ALTER TABLE (sheet_machine_local|vareforbruk_local) ADD COLUMN (byggeplass_id|external_cost_object_id)/i.test(String(sql)),
    );
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
