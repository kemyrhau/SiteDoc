import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Prosjektkort L3 (2026-11-06): to nye lokale tabeller, `vare_local` (firmaets
 * vare-katalog) og `vareforbruk_local` (linjer ført fra kortet). Testen kjører de
 * ekte migreringene (sql.js, samme harness som migreringer.oppgaveLocal.test.ts) mot
 * en eksisterende installasjon, og krever at tabellene opprettes, at eksisterende data
 * står urørt, og at en andre kjøring ikke rører linjer som alt er ført.
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

import { kjorMigreringer, VAREFORBRUK_LOCAL_TABELLER } from "./migreringer";

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

  // Eksisterende installasjon fra før L3: alle andre migreringer har kjørt (de nye
  // tabellene fjernes igjen), og en lokal oppgave finnes.
  kjorMigreringer();
  for (const t of VAREFORBRUK_LOCAL_TABELLER) db.run(`DROP TABLE ${t}`);
  db.run(
    "INSERT INTO oppgave_local (id, project_id, user_id, title, status, priority, created_at, updated_at, sist_oppdatert) VALUES ('o-gammel', 'p1', 'u1', 'Gammel oppgave', 'sent', 'high', '2026-10-01', '2026-10-02', 1234)",
  );
});

describe("L3: vare_local + vareforbruk_local", () => {
  it("tabellene finnes ikke før migrering", () => {
    for (const t of VAREFORBRUK_LOCAL_TABELLER) expect(kolonner(t)).toEqual([]);
  });

  it("migreringen oppretter tabellene med forventede kolonner og bevarer eksisterende data", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner("vare_local").sort()).toEqual(
      ["enhet", "id", "navn", "organization_id", "sist_oppdatert", "varenummer"].sort(),
    );
    expect(kolonner("vareforbruk_local").sort()).toEqual(
      [
        "antall",
        "byggeplass_id",
        "dato",
        "enhet",
        "external_cost_object_id", // ORDRE 36b — kortnøkkel
        "feilmelding",
        "id",
        "organization_id",
        "project_id",
        "sheet_id",
        "sist_endret_lokalt",
        "sync_status",
        "user_id",
        "vare_id",
        "vare_navn",
      ].sort(),
    );
    const rad = holder.db.exec("SELECT title FROM oppgave_local WHERE id='o-gammel'");
    expect(rad[0]?.values[0]).toEqual(["Gammel oppgave"]);
  });

  it("ny linje får sync_status 'pending' som default", () => {
    holder.db.run(
      "INSERT INTO vareforbruk_local (id, user_id, organization_id, sheet_id, project_id, dato, vare_id, vare_navn, enhet, antall, sist_endret_lokalt) VALUES ('v1', 'u1', 'o1', 's1', 'p1', '2026-11-05', 'vare1', 'Grus', 'm3', 2.5, 1)",
    );
    const rad = holder.db.exec("SELECT sync_status, antall FROM vareforbruk_local WHERE id='v1'");
    expect(rad[0]?.values[0]).toEqual(["pending", 2.5]);
  });

  it("er idempotent — andre kjøring bevarer førte linjer", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(holder.db.exec("SELECT COUNT(*) FROM vareforbruk_local")[0]?.values[0]?.[0]).toBe(1);
    expect(holder.db.exec("SELECT COUNT(*) FROM oppgave_local")[0]?.values[0]?.[0]).toBe(1);
  });
});
