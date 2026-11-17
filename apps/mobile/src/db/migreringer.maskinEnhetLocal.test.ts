import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Kort-id d2c-2 (R24): `equipment_local` får `utleie_enhet`. Testen starter med
 * tabellen i formen før kolonnen (med én rad), kjører de ekte migreringene og
 * krever at kolonnen er lagt til, at raden står urørt, og at andre kjøring ikke
 * ALTER-er på nytt. Enheten fylles av maskinlista (`maskinKoblingLokal.test.ts`).
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

import { kjorMigreringer, MASKIN_ENHET_LOCAL_KOLONNER } from "./migreringer";

const kolonner = (tabell: string): string[] =>
  holder.db.exec(`PRAGMA table_info(${tabell})`)[0]?.values.map((r) => String(r[1])) ?? [];

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
    CREATE TABLE equipment_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      kategori TEXT NOT NULL,
      type TEXT,
      merke TEXT,
      modell TEXT,
      intern_navn TEXT,
      intern_nummer TEXT,
      registreringsnummer TEXT,
      status TEXT NOT NULL DEFAULT 'tilgjengelig',
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  db.run(
    "INSERT INTO equipment_local (id, organization_id, kategori, merke, sist_oppdatert) VALUES ('e-gammel', 'o1', 'anleggsmaskin', 'Cat', 1234)",
  );
});

describe("Kort-id d2c-2: utleie_enhet på equipment_local", () => {
  it("gjelder maskinens enhet", () => {
    expect(MASKIN_ENHET_LOCAL_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual(["equipment_local.utleie_enhet"]);
  });

  it("kolonnen mangler før migrering", () => {
    expect(kolonner("equipment_local")).not.toContain("utleie_enhet");
  });

  it("migreringen legger til kolonnen og bevarer eksisterende rad", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner("equipment_local")).toContain("utleie_enhet");
    expect(
      holder.db.exec("SELECT merke, utleie_enhet FROM equipment_local WHERE id='e-gammel'")[0]?.values[0],
    ).toEqual(["Cat", null]);
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ALTER TABLE equipment_local ADD COLUMN utleie_enhet/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
