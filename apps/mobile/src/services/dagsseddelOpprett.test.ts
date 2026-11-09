import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE 36e pkt. 3 — en tom sedel (0 timer-rader) arver ikke et gammelt hode.
 * `finnEllerOpprettDagsseddel` setter ramme og flagg fra de nye argumentene,
 * som for en ny draft. En sedel MED rader røres ikke (idempotens, UF-0).
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
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "ny-uuid" }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("./kalenderKatalog", () => ({
  hentArbeidsdagTiderLokalt: () => ({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30 }),
}));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { finnEllerOpprettDagsseddel } from "./dagsseddelOpprett";

const { dagsseddelLocal, sheetTimerLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
const db = () => holder.drizzle as Db;
const lokalDb = () => holder.drizzle as Parameters<typeof finnEllerOpprettDagsseddel>[0];

const DATO = "2026-11-09";
const GML_START = new Date(`${DATO}T00:00:00`).toISOString();
const GML_SLUTT = new Date(`${DATO}T12:00:00`).toISOString();
const NY_START = new Date(`${DATO}T08:00:00`).toISOString();
const NY_SLUTT = new Date(`${DATO}T12:00:00`).toISOString();

/** Sedel etter midnatt-splitt + tømt kort: system-flagg og ramme 00:00–12:00. */
function seedGammeltHode(medRad: boolean) {
  db().insert(dagsseddelLocal).values({
    id: "s1", userId: "u1", organizationId: "org1", projectId: "p1", aktivitetId: "a1",
    dato: DATO, status: "draft", startAt: GML_START, endAt: GML_SLUTT, pauseMin: 30,
    autoGenerert: true, deltVedMidnatt: true, sluttTidKilde: "system",
    syncStatus: "synced", sistEndretLokalt: 1000,
  }).run();
  if (medRad) {
    db().insert(sheetTimerLocal).values({
      id: "r1", dagsseddelId: "s1", projectId: "p1", lonnsartId: "L", aktivitetId: "a1",
      timer: 11.5, fraTid: "00:00", tilTid: "12:00", pauseMin: 30, sistEndretLokalt: 1000,
    }).run();
  }
}

const nyttKort = () =>
  finnEllerOpprettDagsseddel(lokalDb(), {
    userId: "u1", orgId: "org1", dato: DATO, prosjektId: "p2", aktivitetId: "a1",
    startAt: NY_START, endAt: NY_SLUTT, pauseMin: 30, sluttTidKilde: "bruker",
  });
const sedel = () => db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "s1")).all()[0]!;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (sql: string) => raw.run(sql),
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
});

describe("ORDRE 36e pkt. 3 — tom sedel får nytt hode", () => {
  it("🔴 tom sedel med system-flagg + nytt kort → flagg nullstilt, ramme = nytt kort, pending", () => {
    seedGammeltHode(false);
    const r = nyttKort();
    expect(r).toMatchObject({ id: "s1", eksisterte: true });
    const s = sedel();
    expect([s.startAt, s.endAt]).toEqual([NY_START, NY_SLUTT]);
    expect(s.sluttTidKilde).toBe("bruker");
    expect(s.deltVedMidnatt).toBe(false);
    expect(s.autoGenerert ?? null).toBeNull();
    expect(s.pauseMin).toBe(0);
    expect(s.syncStatus).toBe("pending");
    expect(s.sistEndretLokalt).toBeGreaterThan(1000);
  });

  it("vakt: sedel MED rader røres ikke", () => {
    seedGammeltHode(true);
    const r = nyttKort();
    expect(r).toMatchObject({ id: "s1", eksisterte: true });
    const s = sedel();
    expect([s.startAt, s.endAt, s.sluttTidKilde, s.deltVedMidnatt, s.autoGenerert, s.pauseMin]).toEqual([
      GML_START, GML_SLUTT, "system", true, true, 30,
    ]);
    expect([s.syncStatus, s.sistEndretLokalt]).toEqual(["synced", 1000]);
  });

  it("vakt: sendt tom sedel røres ikke", () => {
    seedGammeltHode(false);
    db().update(dagsseddelLocal).set({ status: "sent" }).where(eq(dagsseddelLocal.id, "s1")).run();
    nyttKort();
    expect([sedel().sluttTidKilde, sedel().syncStatus]).toEqual(["system", "synced"]);
  });

  it("ny dato → ny sedel som før", () => {
    const r = nyttKort();
    expect(r).toMatchObject({ id: "ny-uuid", eksisterte: false, status: "draft" });
  });
});
