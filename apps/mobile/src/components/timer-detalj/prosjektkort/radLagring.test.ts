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
    const id = leggTilTimerRad(db(), K, { ...felt, beskrivelse: "Graving" }, []);
    const r = timerRad(id);
    expect(r).toMatchObject({ dagsseddelId: "s1", projectId: "p1", lonnsartId: "l-arb", timer: 7.5, beskrivelse: "Graving", pauseMin: 30, tidKilde: "manuell" });
    expect(maskinRader()).toHaveLength(0);
  });

  it("med maskin: koblet maskinrad (sheetTimerId = raden), egne timer", () => {
    const id = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: 7.5, mengde: null, enhet: null }]);
    expect(maskinRader()).toHaveLength(1);
    expect(maskinRader()[0]).toMatchObject({ sheetTimerId: id, vehicleId: "v1", projectId: "p1", timer: 7.5 });
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

  it("maskin undefined rører ikke koblet maskinrad; ny linje oppretter, linje med id oppdaterer", () => {
    seedTimer("t1");
    expect(oppdaterTimerRad(db(), K, "t1", felt)).toEqual({ ok: true });
    expect(maskinRader()).toHaveLength(0);
    oppdaterTimerRad(db(), K, "t1", felt, { linjer: [{ id: null, vehicleId: "v1", timer: 7.5, mengde: null, enhet: null }], fjernede: [] });
    expect(maskinRader()).toHaveLength(1);
    const mid = maskinRader()[0].id;
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 5 }, { linjer: [{ id: mid, vehicleId: "v2", timer: 5, mengde: 4, enhet: "t" }], fjernede: [] });
    expect(maskinRader()).toHaveLength(1);
    expect(maskinRader()[0]).toMatchObject({ sheetTimerId: "t1", vehicleId: "v2", timer: 5, mengde: 4 });
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 6 });
    expect(maskinRader()[0].timer).toBe(5);
    expect(tombstones()).toHaveLength(0);
  });

  it("fjernede: sletter koblet maskinrad + maskin-tombstone UTEN serverVersjon", () => {
    seedTimer("t1");
    oppdaterTimerRad(db(), K, "t1", felt, { linjer: [{ id: null, vehicleId: "v1", timer: 7.5, mengde: null, enhet: null }], fjernede: [] });
    const mid = maskinRader()[0].id;
    oppdaterTimerRad(db(), K, "t1", felt, { linjer: [], fjernede: [mid] });
    expect(maskinRader()).toHaveLength(0);
    expect(tombstones()).toEqual([
      expect.objectContaining({ radId: mid, dagsseddelId: "s1", radType: "maskin", serverVersjon: null }),
    ]);
  });

  it("negativkontroll: fjernede med id som ikke er koblet til raden sletter ingenting", () => {
    seedTimer("t1");
    db().insert(sheetMachineLocal).values({ id: "m-los", dagsseddelId: "s1", projectId: "p1", vehicleId: "v9", timer: 3, sistEndretLokalt: 1 }).run();
    oppdaterTimerRad(db(), K, "t1", felt, { linjer: [], fjernede: ["m-los"] });
    expect(maskinRader()).toHaveLength(1);
    expect(tombstones()).toHaveLength(0);
  });
});

/* ============================================================================
 *  NY BESLUTNING maskinkobling (Kenneth 2026-11-12) — påkrevde tester, hver
 *  med negativkontroll.
 * ============================================================================ */
describe("maskinkobling — flere maskiner pr. rad, egne timer ≤ radens", () => {
  const koblet = (radId: string) => maskinRader().filter((m) => m.sheetTimerId === radId);
  const timerFor = (vehicleId: string) => maskinRader().find((m) => m.vehicleId === vehicleId)?.timer;

  it("gravemaskin 8 t + bil 3 t på en rad på 8 t", () => {
    const id = leggTilTimerRad(db(), K, { ...felt, timer: 8, fraTid: "07:00", tilTid: "15:30" }, [
      { vehicleId: "grave", timer: 8, mengde: null, enhet: null },
      { vehicleId: "bil", timer: 3, mengde: null, enhet: null },
    ]);
    expect(koblet(id)).toHaveLength(2);
    expect(timerFor("grave")).toBe(8);
    expect(timerFor("bil")).toBe(3);
    // Full maskin arver radens fra/til; kortere maskin gjetter ikke tid.
    expect(maskinRader().find((m) => m.vehicleId === "grave")).toMatchObject({ fraTid: "07:00", tilTid: "15:30" });
    expect(maskinRader().find((m) => m.vehicleId === "bil")).toMatchObject({ fraTid: null, tilTid: null });
    // Negativkontroll: bilen ble IKKE løftet til radens 8 t.
    expect(timerFor("bil")).not.toBe(8);
  });

  it("maskintimer over radens avvises (ny rad kaster, eksisterende rad → ok:false, ingenting skrevet)", () => {
    expect(() =>
      leggTilTimerRad(db(), K, { ...felt, timer: 8 }, [{ vehicleId: "grave", timer: 9, mengde: null, enhet: null }]),
    ).toThrow(/maskinOverRad/);
    expect(timerRad("uuid-1")).toBeUndefined();
    expect(maskinRader()).toHaveLength(0);

    seedTimer("t1", { timer: 8 });
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 8 }, { linjer: [{ id: null, vehicleId: "grave", timer: 8, mengde: null, enhet: null }], fjernede: [] });
    // Senker raden til 6 t uten å rette maskinen → avvist, raden står på 8 t.
    expect(oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 6 })).toEqual({ ok: false, grunn: "maskinOverRad" });
    expect(timerRad("t1").timer).toBe(8);
    expect(timerFor("grave")).toBe(8);
    // Ny linje over raden → avvist.
    expect(
      oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 8 }, { linjer: [{ id: null, vehicleId: "bil", timer: 8.5, mengde: null, enhet: null }], fjernede: [] }),
    ).toEqual({ ok: false, grunn: "maskinOverRad" });
    expect(maskinRader()).toHaveLength(1);
    // Negativkontroll: lik radens timer er lov, og retter brukeren maskinen
    // samtidig, går senkingen gjennom.
    const mid = maskinRader()[0].id;
    expect(
      oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 6 }, { linjer: [{ id: mid, vehicleId: "grave", timer: 6, mengde: null, enhet: null }], fjernede: [] }),
    ).toEqual({ ok: true });
    expect(timerRad("t1").timer).toBe(6);
    expect(timerFor("grave")).toBe(6);
  });

  it("lagring av rad endrer eller sletter ikke maskiner stille", () => {
    const id = leggTilTimerRad(db(), K, { ...felt, timer: 8 }, [
      { vehicleId: "grave", timer: 8, mengde: null, enhet: null },
      { vehicleId: "bil", timer: 3, mengde: null, enhet: null },
    ]);
    const foer = koblet(id).map((m) => ({ ...m }));
    // Rad lagres med endret beskrivelse og høyere timer, uten maskiner sendt.
    oppdaterTimerRad(db(), K, id, { ...felt, timer: 9, beskrivelse: "Ny" });
    // Rad lagres med bare én av maskinene sendt (endret) — den andre er urørt.
    const grave = koblet(id).find((m) => m.vehicleId === "grave")!;
    oppdaterTimerRad(db(), K, id, { ...felt, timer: 9 }, { linjer: [{ id: grave.id, vehicleId: "grave", timer: 7, mengde: null, enhet: null }], fjernede: [] });
    expect(koblet(id)).toHaveLength(2);
    expect(timerFor("bil")).toBe(3);
    expect(koblet(id).find((m) => m.vehicleId === "bil")).toEqual(foer.find((m) => m.vehicleId === "bil"));
    expect(timerFor("grave")).toBe(7);
    expect(tombstones()).toHaveLength(0);
    // Negativkontroll: raden fikk 9 t, men ingen maskin fulgte etter.
    expect(timerRad(id).timer).toBe(9);
    expect(maskinRader().some((m) => m.timer === 9)).toBe(false);
  });

  it("ukoblet maskin på 3 t er fortsatt 3 t etter lagring av en rad", () => {
    seedTimer("t1", { timer: 8 });
    db().insert(sheetMachineLocal).values({ id: "m-los", dagsseddelId: "s1", projectId: "p1", vehicleId: "bil", timer: 3, sistEndretLokalt: 1 }).run();
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 2 });
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 8 }, { linjer: [{ id: null, vehicleId: "grave", timer: 8, mengde: null, enhet: null }], fjernede: [] });
    const los = maskinRader().find((m) => m.id === "m-los")!;
    expect(los).toMatchObject({ timer: 3, sheetTimerId: null, sistEndretLokalt: 1 });
    // Negativkontroll: en linje med den ukoblede id-en blir ikke dratt inn på raden.
    oppdaterTimerRad(db(), K, "t1", { ...felt, timer: 8 }, { linjer: [{ id: "m-los", vehicleId: "bil", timer: 8, mengde: null, enhet: null }], fjernede: [] });
    expect(maskinRader().find((m) => m.id === "m-los")).toMatchObject({ timer: 3, sheetTimerId: null });
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
