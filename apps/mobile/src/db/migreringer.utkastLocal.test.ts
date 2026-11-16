import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Utkast for prosjektkort (T1): `prosjektkort_utkast_local` + unik indeks på
 * (user_id, organization_id, nokkel). Kjører de ekte migreringene (sql.js) mot en
 * eksisterende installasjon uten tabellen, og to ganger uten feil.
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

import { kjorMigreringer, UTKAST_LOCAL_TABELL, UTKAST_LOCAL_UNIK_INDEKS } from "./migreringer";

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
  // Eksisterende installasjon fra før utkastet: tabellen fjernes igjen.
  kjorMigreringer();
  db.run(`DROP TABLE ${UTKAST_LOCAL_TABELL}`);
});

const RAD = (id: string, bruker: string, org: string, nokkel: string) =>
  `INSERT INTO prosjektkort_utkast_local (id, user_id, organization_id, nokkel, dato, skjema_versjon, data, opprettet, sist_endret) VALUES ('${id}', '${bruker}', '${org}', '${nokkel}', '2026-11-13', 1, '{}', 'x', 'x')`;

describe("T1: prosjektkort_utkast_local", () => {
  it("tabellen finnes ikke før migrering", () => {
    expect(kolonner(UTKAST_LOCAL_TABELL)).toEqual([]);
  });

  it("migreringen oppretter tabell med kolonner og unik indeks, og tåler å kjøre to ganger", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner(UTKAST_LOCAL_TABELL).sort()).toEqual(
      [
        "arbeidsdag_id",
        "data",
        "dato",
        "id",
        "kvitteringer",
        "nokkel",
        "opprettet",
        "organization_id",
        "sist_endret",
        "skjema_versjon",
        "user_id",
      ].sort(),
    );
    const idx = holder.db.exec(`PRAGMA index_list(${UTKAST_LOCAL_TABELL})`)[0]!;
    const navnKol = idx.columns.indexOf("name");
    const unikKol = idx.columns.indexOf("unique");
    const ux = idx.values.find((r) => r[navnKol] === UTKAST_LOCAL_UNIK_INDEKS);
    expect(ux?.[unikKol]).toBe(1);
    const kol = holder.db.exec(`PRAGMA index_info(${UTKAST_LOCAL_UNIK_INDEKS})`)[0]!;
    expect(kol.values.map((r) => r[2])).toEqual(["user_id", "organization_id", "nokkel"]);
  });

  it("unik-garantien: samme (bruker, firma, nøkkel) to ganger avvises; annen bruker/firma går", () => {
    holder.db.run(RAD("a", "u1", "o1", "dato:2026-11-13"));
    expect(() => holder.db.run(RAD("b", "u1", "o1", "dato:2026-11-13"))).toThrow(/UNIQUE/);
    expect(() => holder.db.run(RAD("c", "u2", "o1", "dato:2026-11-13"))).not.toThrow();
    expect(() => holder.db.run(RAD("d", "u1", "o2", "dato:2026-11-13"))).not.toThrow();
  });
});
