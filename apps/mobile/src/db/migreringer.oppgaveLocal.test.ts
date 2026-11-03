import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Filter-mobil D1 (2026-11-03): oppgave_local får tekstkolonner for emne, opprettet av,
 * mottaker (bruker/gruppe), tegning, dokumentflyt og bestillerfaggruppe. Testen starter
 * med en EKSISTERENDE lokal database der tabellen har den gamle formen og en rad, kjører
 * de ekte migreringene (sql.js, samme harness som migreringer.test.ts) og krever at
 * kolonnene er lagt til og at raden står urørt.
 */

const holder = vi.hoisted(() => ({
  db: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  },
  shim: null as unknown,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("drizzle-orm/expo-sqlite", () => ({ drizzle: () => ({}) }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));

import { kjorMigreringer } from "./migreringer";

const NYE_KOLONNER = [
  "subject",
  "bestiller_navn",
  "recipient_user_navn",
  "recipient_group_navn",
  "drawing_navn",
  "dokumentflyt_navn",
  "bestiller_faggruppe_navn",
];

function kolonner(): string[] {
  const res = holder.db.exec("PRAGMA table_info(oppgave_local)");
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

  // Eksisterende installasjon: oppgave_local i formen fra 2026-10-03, med en rad.
  db.run(`
    CREATE TABLE oppgave_local (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      number INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      due_date TEXT,
      byggeplass_id TEXT,
      template_name TEXT,
      template_prefix TEXT,
      template_subdomain TEXT,
      utforer_faggruppe_navn TEXT,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO oppgave_local (id, project_id, user_id, title, status, priority, created_at, updated_at, sist_oppdatert) VALUES ('o-gammel', 'p1', 'u1', 'Gammel oppgave', 'sent', 'high', '2026-10-01', '2026-10-02', 1234)",
  );
});

describe("D1: oppgave_local-kolonner på eksisterende database", () => {
  it("den gamle tabellen mangler kolonnene før migrering", () => {
    for (const k of NYE_KOLONNER) expect(kolonner()).not.toContain(k);
  });

  it("migreringen legger til kolonnene og bevarer eksisterende rad", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const k of NYE_KOLONNER) expect(kolonner()).toContain(k);

    const rad = holder.db.exec("SELECT title, priority, subject FROM oppgave_local WHERE id='o-gammel'");
    expect(rad[0]?.values[0]).toEqual(["Gammel oppgave", "high", null]);
  });

  it("er idempotent — andre kjøring feiler ikke og dobler ingenting", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner().filter((k) => k === "subject")).toHaveLength(1);
    expect(holder.db.exec("SELECT COUNT(*) FROM oppgave_local")[0]?.values[0]?.[0]).toBe(1);
  });
});
