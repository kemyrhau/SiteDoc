import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * K5 (ORDRE (33) c1) — én beskrivelse pr. kort (harness som fravaerKortLagring.test.ts).
 *
 * EKTE SQLite (sql.js) + ekte migreringer, som `nyTimerRad.test.ts`. Måler
 * DB-effekten feltvis: oppdaterte felt, tidKilde/reise-spor, koblet maskin,
 * transaksjon og tombstone (timer MED serverVersjon, maskin UTEN). Hver
 * kontrakt har negativkontroll (det som ikke skal skje, skjer ikke).
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    prepare: (sql: string) => {
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      bind(p: unknown[]): void;
      free(): void;
    };
    getRowsModified(): number;
  },
  shim: null as unknown,
  drizzle: null as unknown,
  uuid: 0,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++holder.uuid}` }));
vi.mock("../../../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../../../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../../../db/schema";
import { kjorMigreringer } from "../../../db/migreringer";
import { skrivKortBeskrivelse } from "./kortBeskrivelse";

const { dagsseddelLocal, sheetTimerLocal } = schema;

type Db = NonNullable<ReturnType<typeof import("../../../db/database").hentDatabase>>;
const db = () => holder.drizzle as Db;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (sql: string) => {
      raw.run(sql);
    },
    getAllSync: (sql: string, ...params: unknown[]) => {
      const stmt = raw.prepare(sql);
      if (params.length) stmt.bind(params.flat());
      const rader: Record<string, unknown>[] = [];
      while (stmt.step()) rader.push(stmt.getAsObject());
      stmt.free();
      return rader;
    },
    runSync: (sql: string, ...params: unknown[]) => {
      raw.run(sql, params.length ? (params.flat() as unknown[]) : undefined);
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
  };
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local;");
  db().insert(dagsseddelLocal).values({
    id: "s1", userId: "u1", organizationId: "o1", projectId: "p1", aktivitetId: "a",
    dato: "2026-11-16", status: "draft", syncStatus: "synced", sistEndretLokalt: 1, sistSynkronisert: 1,
  }).run();
});

const rad = (id: string, kortId: string | null, beskrivelse: string | null, ekstra: Partial<typeof sheetTimerLocal.$inferInsert> = {}) =>
  db().insert(sheetTimerLocal).values({
    id, dagsseddelId: "s1", projectId: "p1", lonnsartId: "l", aktivitetId: "a", timer: 2,
    kortId, beskrivelse, sistEndretLokalt: 1, ...ekstra,
  } as typeof sheetTimerLocal.$inferInsert).run();
const tekst = (id: string) =>
  db().select().from(sheetTimerLocal).all().find((r) => r.id === id)?.beskrivelse ?? null;

describe("K5 — tekst endret på én arbeidsrad skrives på kortets øvrige arbeidsrader", () => {
  it("samme kort får teksten; annet kort, reise og fravær røres ikke", () => {
    rad("a1", "k1", "Ny tekst");
    rad("a2", "k1", "Gammel");
    rad("a3", "k1", null);
    rad("b1", "k2", "Annet kort");
    rad("r1", "k1", "Reise", { erReise: true });
    rad("f1", "k1", "Syk", { utenProsjekt: true, projectId: null });
    expect(skrivKortBeskrivelse(db(), { sheetId: "s1", radId: "a1", beskrivelse: "Ny tekst" })).toBe(2);
    expect([tekst("a2"), tekst("a3")]).toEqual(["Ny tekst", "Ny tekst"]);
    expect([tekst("b1"), tekst("r1"), tekst("f1")]).toEqual(["Annet kort", "Reise", "Syk"]);
  });

  it("to kort på samme prosjekt (to kortId-er) holdes adskilt", () => {
    rad("a1", "k1", "Grøft");
    rad("a2", "k2", "Kum");
    skrivKortBeskrivelse(db(), { sheetId: "s1", radId: "a1", beskrivelse: "Grøft" });
    expect(tekst("a2")).toBe("Kum");
  });

  it("reiserad gir ikke teksten videre", () => {
    rad("r1", "k1", "Reise", { erReise: true });
    rad("a1", "k1", "Grøft");
    expect(skrivKortBeskrivelse(db(), { sheetId: "s1", radId: "r1", beskrivelse: "Reise" })).toBe(0);
    expect(tekst("a1")).toBe("Grøft");
  });
});
