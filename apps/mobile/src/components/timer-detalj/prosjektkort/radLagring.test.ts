import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE 36b (lagring C) — kontrakt for prosjektkort-flytens skrivesti.
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

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../../../db/schema";
import { kjorMigreringer } from "../../../db/migreringer";
import {
  fjernMaskinRad,
  fjernTimerRad,
  leggTilMaskinRad,
  leggTilTimerRad,
  oppdaterMaskinRad,
  oppdaterTimerRad,
  type MaskinRadFelt,
  type TimerRadFelt,
} from "./radLagring";

const { dagsseddelLocal, lonnsartLocal, sheetMachineLocal, sheetTimerLocal, slettedeRaderLocal } = schema;

type Db = NonNullable<ReturnType<typeof import("../../../db/database").hentDatabase>>;
const db = () => holder.drizzle as Db;
const K = { sheetId: "s1", organizationId: "o1" };

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
  holder.uuid = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM slettede_rader_local; DELETE FROM lonnsart_local;",
  );
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "s1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-11-07",
      status: "draft",
      syncStatus: "synced",
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
  for (const [id, navn] of [
    ["l-arb", "Ordinær"],
    ["l-reise", "Reise"],
  ]) {
    db()
      .insert(lonnsartLocal)
      .values({ id, organizationId: "o1", type: "ordinaer", navn, aktiv: true, erStandardvalg: false, sistOppdatert: 1 })
      .run();
  }
});

const felt: TimerRadFelt = {
  projectId: "p1",
  byggeplassId: null,
  lonnsartId: "l-arb",
  aktivitetId: "a1",
  timer: 7.5,
  externalCostObjectId: null,
  fraTid: "07:00",
  tilTid: "15:00",
  beskrivelse: null,
  pauseMin: 30,
};
const maskinFelt: MaskinRadFelt = {
  projectId: "p1",
  ecoId: "eco1",
  vehicleId: "v1",
  timer: 3,
  mengde: 12,
  enhet: "m3",
  fraTid: "07:00",
  tilTid: "10:00",
};

const timerRad = (id: string) => db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0];
const maskinRader = () => db().select().from(sheetMachineLocal).all();
const tombstones = () => db().select().from(slettedeRaderLocal).all();

function seedTimer(id: string, ekstra: Partial<typeof sheetTimerLocal.$inferInsert> = {}) {
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId: "s1",
      projectId: "p1",
      lonnsartId: "l-arb",
      aktivitetId: "a1",
      timer: 7.5,
      fraTid: "07:00",
      tilTid: "15:00",
      pauseMin: 30,
      sistEndretLokalt: 1000,
      ...ekstra,
    })
    .run();
}

describe("leggTilTimerRad", () => {
  it("skriver raden med alle felt, tidKilde manuell, uten maskin", () => {
    const id = leggTilTimerRad(db(), K, { ...felt, beskrivelse: "Graving" }, null);
    const r = timerRad(id);
    expect(r).toMatchObject({ dagsseddelId: "s1", projectId: "p1", lonnsartId: "l-arb", timer: 7.5, beskrivelse: "Graving", pauseMin: 30, tidKilde: "manuell" });
    expect(maskinRader()).toHaveLength(0);
  });

  it("med maskin: koblet maskinrad (sheetTimerId = raden)", () => {
    const id = leggTilTimerRad(db(), K, felt, { vehicleId: "v1", mengde: null, enhet: null });
    expect(maskinRader()).toHaveLength(1);
    expect(maskinRader()[0]).toMatchObject({ sheetTimerId: id, vehicleId: "v1", projectId: "p1" });
  });
});

describe("oppdaterTimerRad", () => {
  it("oppdaterer felt; uendret fra/til stempler IKKE tidKilde", () => {
    seedTimer("t1", { tidKilde: "utledet" });
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 6, beskrivelse: "Ny" });
    expect(timerRad("t1")).toMatchObject({ timer: 6, beskrivelse: "Ny", tidKilde: "utledet", erReise: false });
    expect(timerRad("t1").sistEndretLokalt).toBeGreaterThan(1000);
  });

  it("endret fra/til → tidKilde manuell", () => {
    seedTimer("t1", { tidKilde: "utledet" });
    oppdaterTimerRad(db(), K, "t1", { ...felt, fraTid: "08:00" });
    expect(timerRad("t1").tidKilde).toBe("manuell");
  });

  it("reise-lønnsart: manuell reise; matrise-spor beholdes; ikke reise renser sporet", () => {
    seedTimer("t1");
    oppdaterTimerRad(db(), K, "t1", { ...felt, lonnsartId: "l-reise" });
    expect(timerRad("t1")).toMatchObject({ erReise: true, reiseKilde: "manuell" });

    seedTimer("t2", { erReise: true, reiseKilde: "matrise", reiseAvstandM: 4200, lonnsartId: "l-reise" });
    oppdaterTimerRad(db(), K, "t2", { ...felt, lonnsartId: "l-reise" });
    expect(timerRad("t2")).toMatchObject({ erReise: true, reiseKilde: "matrise", reiseAvstandM: 4200 });

    oppdaterTimerRad(db(), K, "t2", felt);
    expect(timerRad("t2")).toMatchObject({ erReise: false, reiseKilde: null, reiseAvstandM: null });
  });

  it("maskin undefined rører ikke koblet maskinrad; objekt oppretter, så oppdaterer", () => {
    seedTimer("t1");
    oppdaterTimerRad(db(), K, "t1", felt);
    expect(maskinRader()).toHaveLength(0);
    oppdaterTimerRad(db(), K, "t1", felt, { vehicleId: "v1", mengde: null, enhet: null });
    expect(maskinRader()).toHaveLength(1);
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 5 }, { vehicleId: "v2", mengde: 4, enhet: "t" });
    expect(maskinRader()).toHaveLength(1);
    expect(maskinRader()[0]).toMatchObject({ sheetTimerId: "t1", vehicleId: "v2", timer: 5, mengde: 4 });
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 4 });
    expect(maskinRader()[0].timer).toBe(5);
    expect(tombstones()).toHaveLength(0);
  });

  it("maskin null sletter koblet maskinrad + maskin-tombstone UTEN serverVersjon", () => {
    seedTimer("t1");
    oppdaterTimerRad(db(), K, "t1", felt, { vehicleId: "v1", mengde: null, enhet: null });
    const mid = maskinRader()[0].id;
    oppdaterTimerRad(db(), K, "t1", felt, null);
    expect(maskinRader()).toHaveLength(0);
    expect(tombstones()).toEqual([
      expect.objectContaining({ radId: mid, dagsseddelId: "s1", radType: "maskin", serverVersjon: null }),
    ]);
  });

  it("negativkontroll: maskin null uten koblet maskinrad skriver ingen tombstone", () => {
    seedTimer("t1");
    oppdaterTimerRad(db(), K, "t1", felt, null);
    expect(tombstones()).toHaveLength(0);
  });
});

describe("fjernTimerRad", () => {
  it("sletter raden + timer-tombstone MED radens serverVersjon", () => {
    seedTimer("t1", { serverVersjon: "2026-11-07T08:00:00.000Z" });
    fjernTimerRad(db(), K, "t1");
    expect(timerRad("t1")).toBeUndefined();
    expect(tombstones()).toEqual([
      expect.objectContaining({ radId: "t1", dagsseddelId: "s1", radType: "timer", serverVersjon: "2026-11-07T08:00:00.000Z" }),
    ]);
  });

  it("ukjent serverVersjon → null (S4); dobbel sletting gir én tombstone", () => {
    seedTimer("t1");
    fjernTimerRad(db(), K, "t1");
    fjernTimerRad(db(), K, "t1");
    expect(tombstones()).toHaveLength(1);
    expect(tombstones()[0].serverVersjon).toBeNull();
  });

  it("transaksjon: feiler tombstone-skrivingen, står raden igjen", () => {
    seedTimer("t1");
    holder.raw.run("CREATE TRIGGER blokk BEFORE INSERT ON slettede_rader_local BEGIN SELECT RAISE(ABORT, 'nei'); END;");
    try {
      expect(() => fjernTimerRad(db(), K, "t1")).toThrow();
      expect(timerRad("t1")).toBeDefined();
    } finally {
      holder.raw.run("DROP TRIGGER blokk;");
    }
  });
});

describe("maskinrad", () => {
  it("leggTil skriver alle felt (ecoId → externalCostObjectId), uten sheetTimerId", () => {
    const id = leggTilMaskinRad(db(), K, maskinFelt);
    expect(maskinRader()).toEqual([
      expect.objectContaining({ id, dagsseddelId: "s1", externalCostObjectId: "eco1", vehicleId: "v1", timer: 3, mengde: 12, enhet: "m3", sheetTimerId: null }),
    ]);
  });

  it("oppdater endrer bare den raden", () => {
    const a = leggTilMaskinRad(db(), K, maskinFelt);
    const b = leggTilMaskinRad(db(), K, maskinFelt);
    oppdaterMaskinRad(db(), K, a, { ...maskinFelt, timer: 1, ecoId: "eco2" });
    const rader = new Map(maskinRader().map((r) => [r.id, r]));
    expect(rader.get(a)).toMatchObject({ timer: 1, externalCostObjectId: "eco2" });
    expect(rader.get(b)).toMatchObject({ timer: 3, externalCostObjectId: "eco1" });
  });

  it("fjern sletter + maskin-tombstone UTEN serverVersjon; transaksjon ruller tilbake", () => {
    const a = leggTilMaskinRad(db(), K, maskinFelt);
    holder.raw.run("CREATE TRIGGER blokk BEFORE INSERT ON slettede_rader_local BEGIN SELECT RAISE(ABORT, 'nei'); END;");
    try {
      expect(() => fjernMaskinRad(db(), K, a)).toThrow();
      expect(maskinRader()).toHaveLength(1);
    } finally {
      holder.raw.run("DROP TRIGGER blokk;");
    }
    fjernMaskinRad(db(), K, a);
    expect(maskinRader()).toHaveLength(0);
    expect(tombstones()).toEqual([
      expect.objectContaining({ radId: a, dagsseddelId: "s1", radType: "maskin", serverVersjon: null }),
    ]);
  });
});
