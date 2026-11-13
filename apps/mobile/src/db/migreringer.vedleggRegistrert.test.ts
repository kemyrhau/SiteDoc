import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Telefontest A funn 2: kvitteringsvedleggene får `registrert` (Unix ms) — tidspunktet serveren
 * bekreftet vedlegget. Testen starter med begge tabellene i formen før kolonnen (med én gammel
 * rad hver), kjører de ekte migreringene (sql.js) og krever at kolonnen er lagt til som INTEGER,
 * at de gamle radene står urørt med NULL (ingen gjettende backfill) og at andre kjøring ikke
 * ALTER-er på nytt. Negativkontroll: kolonnen mangler før migrering.
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

import { kjorMigreringer, VEDLEGG_REGISTRERT_KOLONNER } from "./migreringer";

function kolonner(tabell: string): string[] {
  const res = holder.db.exec(`PRAGMA table_info(${tabell})`);
  return res[0]?.values.map((r) => String(r[1])) ?? [];
}

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

  for (const [tabell, fk] of [
    ["sheet_tillegg_vedlegg_local", "sheet_tillegg_id"],
    ["sheet_utlegg_vedlegg_local", "sheet_utlegg_id"],
  ] as const) {
    db.run(`
      CREATE TABLE ${tabell} (
        id TEXT PRIMARY KEY NOT NULL,
        ${fk} TEXT NOT NULL,
        lokal_sti TEXT,
        server_url TEXT,
        filnavn TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        filstorrelse INTEGER,
        sist_endret_lokalt INTEGER NOT NULL
      );
    `);
    db.run(
      `INSERT INTO ${tabell} (id, ${fk}, lokal_sti, server_url, filnavn, mime_type, sist_endret_lokalt) VALUES ('v-gammel', 'r1', NULL, '/uploads/privat/k.jpg', 'k.jpg', 'image/jpeg', 1234)`,
    );
  }
});

const TABELLER = ["sheet_tillegg_vedlegg_local", "sheet_utlegg_vedlegg_local"] as const;

describe("Funn 2: kvitteringsvedlegg.registrert", () => {
  it("gjelder begge vedleggstabellene", () => {
    expect(VEDLEGG_REGISTRERT_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual([
      "sheet_tillegg_vedlegg_local.registrert",
      "sheet_utlegg_vedlegg_local.registrert",
    ]);
  });

  it("kolonnen mangler før migrering (negativkontroll)", () => {
    for (const t of TABELLER) expect(kolonner(t)).not.toContain("registrert");
  });

  it("migreringen legger til INTEGER-kolonnen uten backfill og bevarer de gamle radene", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    for (const t of TABELLER) {
      expect(kolonneType(t, "registrert")).toBe("INTEGER");
      expect(
        holder.db.exec(`SELECT server_url, registrert FROM ${t} WHERE id='v-gammel'`)[0]?.values[0],
      ).toEqual(["/uploads/privat/k.jpg", null]);
    }
  });

  it("er idempotent — andre kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) => /ADD COLUMN registrert/i.test(String(sql)));
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
