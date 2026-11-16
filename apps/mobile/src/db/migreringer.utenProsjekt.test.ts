import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Fraværskortet (prosjektkort-kortid-spec § 11.2, ordre c2): `sheet_timer_local` får
 * `uten_prosjekt INTEGER DEFAULT 0` i en additiv kolonneliste (M20). Testen kjører de ekte
 * migreringene (sql.js), fjerner kolonnen for å gjenskape en telefon fra før c (med én gammel
 * rad), kjører migreringene igjen og krever kolonnen tilbake, den gamle raden med 0 og ingen ny
 * ALTER på tredje kjøring. Negativkontroll: kolonnen mangler etter fjerningen.
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

import { kjorMigreringer, UTEN_PROSJEKT_LOCAL_KOLONNER } from "./migreringer";

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

  kjorMigreringer();
  db.run(
    "INSERT INTO sheet_timer_local (id, dagsseddel_id, project_id, lonnsart_id, aktivitet_id, timer, sist_endret_lokalt) VALUES ('t-gammel', 's1', 'p1', 'l1', 'a1', 7.5, 1234)",
  );
  db.run("ALTER TABLE sheet_timer_local DROP COLUMN uten_prosjekt");
});

describe("Fraværskort: sheet_timer_local.uten_prosjekt", () => {
  it("gjelder bare timerrader (K8)", () => {
    expect(UTEN_PROSJEKT_LOCAL_KOLONNER.map(([t, k]) => `${t}.${k}`)).toEqual(["sheet_timer_local.uten_prosjekt"]);
  });

  it("kolonnen mangler på telefon fra før c (negativkontroll)", () => {
    expect(kolonner("sheet_timer_local")).not.toContain("uten_prosjekt");
  });

  it("migreringen legger til kolonnen; gammel rad får 0 og står ellers urørt", () => {
    expect(() => kjorMigreringer()).not.toThrow();
    expect(kolonner("sheet_timer_local")).toContain("uten_prosjekt");
    expect(
      holder.db.exec("SELECT project_id, timer, uten_prosjekt FROM sheet_timer_local WHERE id='t-gammel'")[0]?.values[0],
    ).toEqual(["p1", 7.5, 0]);
  });

  it("er idempotent — tredje kjøring ALTER-er ikke på nytt", () => {
    const spion = vi.spyOn(holder.shim, "execSync");
    kjorMigreringer();
    const alters = spion.mock.calls.filter(([sql]) =>
      /ALTER TABLE sheet_timer_local ADD COLUMN uten_prosjekt/i.test(String(sql)),
    );
    spion.mockRestore();
    expect(alters).toEqual([]);
  });
});
