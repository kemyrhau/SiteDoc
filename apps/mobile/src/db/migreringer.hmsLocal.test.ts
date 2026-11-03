import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Filter-hms (2026-11-03): hms_local får tekstkolonner for filterarket (emne, prioritet,
 * frist, opprettet av, mottaker, tegning, dokumentflyt, utførende faggruppe). Samme
 * oppsett som D1-testen for oppgave_local: EKSISTERENDE database med gammel tabellform
 * og en rad → ekte migreringer → kolonnene finnes og raden står urørt.
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

import { HMS_LOCAL_FILTERKOLONNER, kjorMigreringer } from "./migreringer";

const NYE_KOLONNER = [...HMS_LOCAL_FILTERKOLONNER];

function kolonner(): string[] {
  const res = holder.db.exec("PRAGMA table_info(hms_local)");
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

  // Eksisterende installasjon: hms_local i formen fra 2026-10-03, med en rad.
  db.run(`
    CREATE TABLE hms_local (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kategori TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      number INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      byggeplass_id TEXT,
      template_name TEXT,
      template_prefix TEXT,
      bestiller_faggruppe_navn TEXT,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO hms_local (id, project_id, user_id, kategori, title, status, created_at, updated_at, sist_oppdatert) VALUES ('h-gammel', 'p1', 'u1', 'avvik', 'Gammelt avvik', 'sent', '2026-10-01', '2026-10-02', 1234)",
  );
});

describe("filter-hms: hms_local-kolonner på eksisterende database", () => {
  it("den gamle tabellen mangler kolonnene før migrering", () => {
    for (const k of NYE_KOLONNER) expect(kolonner()).not.toContain(k);
  });

  it("migreringen legger til kolonnene og bevarer eksisterende rad", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const k of NYE_KOLONNER) expect(kolonner()).toContain(k);

    const rad = holder.db.exec("SELECT title, kategori, subject, priority FROM hms_local WHERE id='h-gammel'");
    expect(rad[0]?.values[0]).toEqual(["Gammelt avvik", "avvik", null, null]);
  });

  it("er idempotent — andre kjøring kjører ingen ALTER mot hms_local", () => {
    // try/catch i migreringen svelger en duplikat-ALTER, så mål PRAGMA-sjekken direkte.
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ALTER TABLE hms_local/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
    expect(kolonner().filter((k) => k === "priority")).toHaveLength(1);
    expect(holder.db.exec("SELECT COUNT(*) FROM hms_local")[0]?.values[0]?.[0]).toBe(1);
  });
});
