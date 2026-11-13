import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Plan A (2026-11-13): `paa_server` på maskin-, tillegg- og utleggslinjene. Testen starter med
 * tabellene i formen før kolonnen (med én gammel rad hver), kjører de ekte migreringene (sql.js)
 * og krever INTEGER-kolonne, gamle rader urørt med NULL (ingen gjettende backfill — kjent
 * restrisiko i timer.md) og at andre kjøring ikke ALTER-er på nytt.
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

import { kjorMigreringer, PAA_SERVER_KOLONNER } from "./migreringer";

const TABELLER = ["sheet_machine_local", "sheet_tillegg_local", "sheet_utlegg_local"] as const;

function kolonneType(tabell: string, kol: string): string | undefined {
  const res = holder.db.exec(`PRAGMA table_info(${tabell})`);
  const rad = res[0]?.values.find((r) => String(r[1]) === kol);
  return rad ? String(rad[2]) : undefined;
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
  for (const t of TABELLER) {
    db.run(
      `CREATE TABLE ${t} (id TEXT PRIMARY KEY NOT NULL, dagsseddel_id TEXT NOT NULL, sist_endret_lokalt INTEGER NOT NULL)`,
    );
    db.run(`INSERT INTO ${t} (id, dagsseddel_id, sist_endret_lokalt) VALUES ('r-gammel', 's1', 1234)`);
  }
});

describe("Plan A: paa_server", () => {
  it("gjelder maskin, tillegg og utlegg", () => {
    expect(PAA_SERVER_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual(
      TABELLER.map((t) => `${t}.paa_server`),
    );
  });

  it("kolonnen mangler før migrering (negativkontroll)", () => {
    for (const t of TABELLER) expect(kolonneType(t, "paa_server")).toBeUndefined();
  });

  it("migreringen legger til INTEGER-kolonnen uten backfill og bevarer de gamle radene", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const t of TABELLER) {
      expect(kolonneType(t, "paa_server")).toBe("INTEGER");
      expect(
        holder.db.exec(`SELECT sist_endret_lokalt, paa_server FROM ${t} WHERE id='r-gammel'`)[0]?.values[0],
      ).toEqual([1234, null]);
    }
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ADD COLUMN paa_server/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
