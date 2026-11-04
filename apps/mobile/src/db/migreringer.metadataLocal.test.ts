import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Metadata M-pakke B-2/B-4 (2026-11-04): sjekkliste_local og oppgave_local får
 * `statushendelser` og `utfylling` (JSON) for person-/periodefilteret offline. Testen starter
 * med EKSISTERENDE lokale tabeller (formen før kolonnene) med én rad hver, kjører de ekte
 * migreringene (sql.js) og krever at kolonnene er lagt til, at radene står urørt, og at andre
 * kjøring ikke ALTER-er på nytt.
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


import { kjorMigreringer, METADATA_LOCAL_KOLONNER, OMRADE_LOCAL_TABELLER } from "./migreringer";

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

  // Eksisterende installasjon: begge katalogtabellene uten omrade_navn, med en rad hver.
  db.run(`
    CREATE TABLE sjekkliste_local (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE oppgave_local (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO sjekkliste_local (id, project_id, user_id, title, status, created_at, updated_at, sist_oppdatert) VALUES ('s-gammel', 'p1', 'u1', 'Gammel sjekkliste', 'sent', '2026-10-01', '2026-10-02', 1234)",
  );
  db.run(
    "INSERT INTO oppgave_local (id, project_id, user_id, title, status, priority, created_at, updated_at, sist_oppdatert) VALUES ('o-gammel', 'p1', 'u1', 'Gammel oppgave', 'sent', 'high', '2026-10-01', '2026-10-02', 1234)",
  );
});

describe("B-2/B-4: statushendelser og utfylling på eksisterende database", () => {
  it("gjelder begge katalogtabellene og begge kolonnene", () => {
    expect([...OMRADE_LOCAL_TABELLER]).toEqual(["sjekkliste_local", "oppgave_local"]);
    expect([...METADATA_LOCAL_KOLONNER]).toEqual(["statushendelser", "utfylling"]);
  });

  it("kolonnene mangler før migrering", () => {
    for (const t of OMRADE_LOCAL_TABELLER) {
      for (const k of METADATA_LOCAL_KOLONNER) expect(kolonner(t)).not.toContain(k);
    }
  });

  it("migreringen legger til kolonnene og bevarer eksisterende rader", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const t of OMRADE_LOCAL_TABELLER) {
      for (const k of METADATA_LOCAL_KOLONNER) expect(kolonner(t)).toContain(k);
    }
    expect(
      holder.db.exec("SELECT title, statushendelser, utfylling FROM sjekkliste_local WHERE id='s-gammel'")[0]?.values[0],
    ).toEqual(["Gammel sjekkliste", null, null]);
    expect(
      holder.db.exec("SELECT title, priority, statushendelser, utfylling FROM oppgave_local WHERE id='o-gammel'")[0]?.values[0],
    ).toEqual(["Gammel oppgave", "high", null, null]);
  });

  it("er idempotent — andre kjøring ALTER-er ikke metadata-kolonnene", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ADD COLUMN (statushendelser|utfylling)/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
    for (const t of OMRADE_LOCAL_TABELLER) {
      for (const k of METADATA_LOCAL_KOLONNER) expect(kolonner(t).filter((x) => x === k)).toHaveLength(1);
    }
  });
});
