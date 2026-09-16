import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Mobil-harness runde (2026-09-16, krav 3): offline-DB-laget mot EKTE SQLite.
 *
 * `kjorMigreringer()` er koblet til `expo-sqlite` (`openDatabaseSync`) og `react-native`
 * (`Platform`). Her byttes den native `expo-sqlite`-BINDINGEN ut med sql.js — SQLite
 * kompilert til WASM. Det er IKKE en mock av SQLite: den FAKTISKE migrerings-SQL-en kjører
 * mot en EKTE SQLite-motor, og ekte constraints (NOT NULL) håndheves. Bare den native
 * driver-shimen er byttet — samme prinsipp som at api-integrasjonstestene bytter serveren,
 * ikke databasen. Krav (c) er dermed EKTE oppfylt, ikke mocket bort.
 *
 * (RN-komponenter testes ikke — kun det rene DB-laget. Metro/EAS urørt.)
 */

// Holder fylles i beforeAll og leses av den hoistede expo-sqlite-mocken.
const holder = vi.hoisted(() => ({
  db: null as unknown as { run: (sql: string, params?: unknown[]) => void; prepare: (sql: string) => { step(): boolean; getAsObject(): Record<string, unknown>; bind(p: unknown[]): void; free(): void }; getRowsModified(): number; exec(sql: string): Array<{ columns: string[]; values: unknown[][] }> },
  shim: null as unknown,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("drizzle-orm/expo-sqlite", () => ({ drizzle: () => ({}) }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));

import { kjorMigreringer } from "./migreringer";

/** Tabellnavn i den lokale SQLite-en. */
function tabeller(): string[] {
  const res = holder.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (!res.length) return [];
  return res[0].values.map((r) => String(r[0]));
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const db = new SQL.Database();
  holder.db = db;

  // Shim som speiler den lille expo-sqlite-flaten migreringene bruker.
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

  // Kjør de EKTE migreringene mot den ekte SQLite-en.
  kjorMigreringer();
});

describe("Offline-DB migreringer mot ekte SQLite (krav 3)", () => {
  it("oppretter offline-tabellene", () => {
    const t = tabeller();
    expect(t).toContain("sjekkliste_feltdata");
    expect(t).toContain("opplastings_ko");
    expect(t).toContain("oppgave_feltdata");
  });

  it("er idempotent — kjorMigreringer() kan kjøres igjen uten feil", () => {
    const forFor = tabeller().length;
    expect(() => kjorMigreringer()).not.toThrow();
    expect(tabeller().length).toBe(forFor); // CREATE TABLE IF NOT EXISTS → ingen dobling
  });

  it("KRAV (c): en feltdata-rad UTEN sjekkliste-identitet avvises av ekte NOT NULL-constraint", () => {
    // Gyldig rad slipper gjennom.
    expect(() =>
      holder.db.run(
        "INSERT INTO sjekkliste_feltdata (id, sjekkliste_id, felt_verdier, sist_endret_lokalt) VALUES ('rad-ok', 'sjekk-1', '{}', 1000)",
      ),
    ).not.toThrow();

    // Identitetskolonnen er tom (NULL) → SQLite skal AVVISE. En feltdata-rad uten hvilken
    // sjekkliste den hører til er meningsløs — nettopp «stille tomhet»-klassen.
    expect(() =>
      holder.db.run(
        "INSERT INTO sjekkliste_feltdata (id, sjekkliste_id, felt_verdier, sist_endret_lokalt) VALUES ('rad-tom', NULL, '{}', 1000)",
      ),
    ).toThrow(/NOT NULL|constraint/i);

    // Primærnøkkelen (id) er tom → avvises også (eksplisitt NOT NULL på PK).
    expect(() =>
      holder.db.run(
        "INSERT INTO sjekkliste_feltdata (id, sjekkliste_id, felt_verdier, sist_endret_lokalt) VALUES (NULL, 'sjekk-2', '{}', 1000)",
      ),
    ).toThrow(/NOT NULL|constraint/i);
  });
});
