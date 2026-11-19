import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * w9m (WM108, B21 A / B22 A): telefonens skrivevakt for maskintimer pr. jobb.
 * EKTE SQLite (sql.js) + ekte migreringer, harness som `radLagring.test.ts`.
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
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { bruddTekst, hoystForMaskin, jobbTall, lesJobbGrunnlag, skrivMedMaskinVakt } from "./maskinJobbLokalt";

const { dagsseddelLocal, equipmentLocal, sheetMachineLocal, sheetTimerLocal } = schema;
type Db = NonNullable<ReturnType<typeof import("../db/database").hentDatabase>>;
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

/** Sedel s1: jobb k1 = 7,5 t arbeid + gravemaskin 7,5 t; jobb k2 = 2 t arbeid + gammelt brudd 4 t. */
beforeEach(() => {
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM equipment_local;",
  );
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "s1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-11-19",
      status: "draft",
      sistEndretLokalt: 1,
    })
    .run();
  db()
    .insert(equipmentLocal)
    .values([
      { id: "grave", organizationId: "o1", kategori: "anleggsmaskin", utleieEnhet: "time", sistOppdatert: 1 },
      { id: "varme", organizationId: "o1", kategori: "smautstyr", utleieEnhet: "doegn", sistOppdatert: 1 },
    ])
    .run();
  db()
    .insert(sheetTimerLocal)
    .values([
      { id: "t1", dagsseddelId: "s1", projectId: "p1", aktivitetId: "a1", lonnsartId: "l", timer: 7.5, kortId: "k1", sistEndretLokalt: 1 },
      { id: "t2", dagsseddelId: "s1", projectId: "p2", aktivitetId: "a1", lonnsartId: "l", timer: 2, kortId: "k2", sistEndretLokalt: 1 },
    ])
    .run();
  db()
    .insert(sheetMachineLocal)
    .values([
      { id: "m1", dagsseddelId: "s1", sheetTimerId: "t1", projectId: "p1", vehicleId: "grave", timer: 7.5, kortId: "k1", sistEndretLokalt: 1 },
      { id: "m2", dagsseddelId: "s1", sheetTimerId: "t2", projectId: "p2", vehicleId: "grave", timer: 4, kortId: "k2", sistEndretLokalt: 1 },
    ])
    .run();
});

const timerPaa = (id: string) => db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0]!.timer;
const maskinPaa = (id: string) =>
  db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).all()[0]!.timer;

describe("skrivMedMaskinVakt (WM108)", () => {
  it("🔴 senket arbeid som gir nytt brudd → ingenting skrevet, bruddet forklarer", () => {
    const brudd = skrivMedMaskinVakt(db(), "s1", null, (tx) => {
      tx.update(sheetTimerLocal).set({ timer: 4 }).where(eq(sheetTimerLocal.id, "t1")).run();
    });
    expect(brudd).toMatchObject([{ kortId: "k1", maskinSum: 7.5, arbeidSum: 4 }]);
    expect(timerPaa("t1")).toBe(7.5);
  });

  it("negativkontroll: endring innenfor grensen skrives", () => {
    const brudd = skrivMedMaskinVakt(db(), "s1", null, (tx) => {
      tx.update(sheetTimerLocal).set({ timer: 8 }).where(eq(sheetTimerLocal.id, "t1")).run();
    });
    expect(brudd).toEqual([]);
    expect(timerPaa("t1")).toBe(8);
  });

  it("🔴 gammelt brudd i en annen jobb stopper ikke føring; økt overskudd der stopper", () => {
    expect(
      skrivMedMaskinVakt(db(), "s1", null, (tx) => {
        tx.update(sheetMachineLocal).set({ timer: 7 }).where(eq(sheetMachineLocal.id, "m1")).run();
      }),
    ).toEqual([]);
    expect(maskinPaa("m1")).toBe(7);
    const brudd = skrivMedMaskinVakt(db(), "s1", null, (tx) => {
      tx.update(sheetMachineLocal).set({ timer: 5 }).where(eq(sheetMachineLocal.id, "m2")).run();
    });
    expect(brudd).toMatchObject([{ kortId: "k2" }]);
    expect(maskinPaa("m2")).toBe(4);
  });

  it("🔴 døgn-maskin har ingen grense (B21 A)", () => {
    db()
      .insert(sheetMachineLocal)
      .values({ id: "m3", dagsseddelId: "s1", sheetTimerId: "t1", projectId: "p1", vehicleId: "varme", timer: 1, kortId: "k1", sistEndretLokalt: 1 })
      .run();
    expect(
      skrivMedMaskinVakt(db(), "s1", null, (tx) => {
        tx.update(sheetMachineLocal).set({ timer: 24 }).where(eq(sheetMachineLocal.id, "m3")).run();
      }),
    ).toEqual([]);
    expect(maskinPaa("m3")).toBe(24);
  });
});

describe("hoystForMaskin / bruddTekst", () => {
  it("høyst = jobbens arbeid minus andre førermaskiner; døgn → null", () => {
    const g = lesJobbGrunnlag(db(), "s1", null);
    const ny = { id: "ny", kortId: "k1", projectId: "p1", externalCostObjectId: null, timer: 0, utleieEnhet: "time" };
    expect(hoystForMaskin(g, ny)).toBe(0);
    expect(hoystForMaskin(g, g.maskin.find((m) => m.id === "m1")!)).toBe(7.5);
    expect(hoystForMaskin(g, { ...ny, utleieEnhet: "doegn" })).toBeNull();
  });
  it("teksten bruker serverens nøkkel og tall med komma", () => {
    const t = (k: string, p?: Record<string, string>) => `${k}:${p?.jobb}:${p?.maskin}:${p?.arbeid}`;
    const b = [{ nokkel: "kort:k1", kortId: "k1", projectId: "p1", externalCostObjectId: null, maskinSum: 9, arbeidSum: 7.5 }];
    expect(bruddTekst(t, null, b)).toBe("timer.maskin.overArbeidAvvist:p1:9:7,5");
    expect(bruddTekst(t, null, [])).toBe("");
    expect(jobbTall(7.25)).toBe("7,25");
  });
});
