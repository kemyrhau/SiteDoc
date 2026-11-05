import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Metadata S-pakke B-5 (2026-11-04): tegning_local får `revision`, `status` og `kildeformat`
 * så tegningsraden viser det samme offline. Testen starter med EKSISTERENDE tegning_local
 * (formen før kolonnene) med én rad, kjører de ekte migreringene (sql.js) og krever at
 * kolonnene er lagt til, at raden står urørt, og at andre kjøring ikke ALTER-er på nytt.
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


import { kjorMigreringer, TEGNING_META_KOLONNER } from "./migreringer";

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

  // Eksisterende installasjon: tegning_local i formen før B-5, med én rad.
  db.run(`
    CREATE TABLE tegning_local (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      byggeplass_id TEXT,
      name TEXT NOT NULL,
      drawing_number TEXT,
      discipline TEXT,
      floor TEXT,
      file_type TEXT,
      file_url TEXT,
      mobil_file_url TEXT,
      revisjons_nokkel TEXT,
      antall_revisjoner INTEGER,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO tegning_local (id, project_id, user_id, name, file_type, sist_oppdatert) VALUES ('t-gammel', 'p1', 'u1', 'Plan 1. etg', 'svg', 1234)",
  );
});

describe("B-5: metadata-kolonner på eksisterende tegning_local", () => {
  it("gjelder revision, status og kildeformat", () => {
    expect([...TEGNING_META_KOLONNER]).toEqual(["revision", "status", "kildeformat"]);
  });

  it("kolonnene mangler før migrering", () => {
    for (const k of TEGNING_META_KOLONNER) expect(kolonner("tegning_local")).not.toContain(k);
  });

  it("migreringen legger til kolonnene og bevarer eksisterende rad", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const k of TEGNING_META_KOLONNER) expect(kolonner("tegning_local")).toContain(k);
    expect(
      holder.db.exec("SELECT name, file_type, revision, status, kildeformat FROM tegning_local WHERE id='t-gammel'")[0]
        ?.values[0],
    ).toEqual(["Plan 1. etg", "svg", null, null, null]);
  });

  it("er idempotent — andre kjøring ALTER-er ikke tegning_local", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ALTER TABLE tegning_local/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
