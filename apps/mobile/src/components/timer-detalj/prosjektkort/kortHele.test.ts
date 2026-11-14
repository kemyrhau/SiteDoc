import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * ORDRE 36c-kort — «Endre kort» (`flyttKort`) og «Slett kort» (`slettKort`).
 *
 * EKTE SQLite (sql.js) + ekte migreringer, samme oppsett som
 * `kortRadFlytt.test.ts`. Hver kontrakt har negativkontroll: nabokort, reise,
 * tillegg og utlegg er urørt; avslag (låst, brudd, offline, serverfeil) gir
 * ingen lokal skriving.
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
  flyttKort,
  kortFinnesFraFor,
  erIkkeFunnet,
  kortInnhold,
  kortUtfallTekst,
  radInnhold,
  slettKort,
  vareFinnesPaaServer,
  type KortDag,
  type KortUtfall,
  type KortVare,
} from "./kortRadFlytt";
import { leggTilTimerRad, type TimerRadFelt } from "./radLagring";
import type { KortValg, SedelKortKontekst } from "../../../lib/prosjektkortMobil";

const {
  dagsseddelLocal,
  lonnsartLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetTimerLocal,
  sheetUtleggLocal,
  slettedeRaderLocal,
  vareforbrukLocal,
} = schema;

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

/** Tom DB + én sedel og to lønnsarter — også mellom gjennomløp i én test. */
function nullstillDb() {
  holder.uuid = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM slettede_rader_local; DELETE FROM lonnsart_local; DELETE FROM vareforbruk_local; DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local;",
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
}
beforeEach(nullstillDb);

const felt: TimerRadFelt = {
  projectId: "p1",
  byggeplassId: "bp1",
  lonnsartId: "l-arb",
  aktivitetId: "a1",
  timer: 7.5,
  externalCostObjectId: null,
  fraTid: "07:00",
  tilTid: "15:00",
  beskrivelse: "Graving",
  pauseMin: 0,
};
const SEDEL: SedelKortKontekst = { projectId: "p1", byggeplass: null };
const A: KortValg = { projectId: "p1", byggeplassId: "bp1", ecoId: null };
const TIL: KortValg = { projectId: "p2", byggeplassId: "bp2", ecoId: "eco2" };

const timerAlle = () => db().select().from(sheetTimerLocal).all();
const maskinAlle = () => db().select().from(sheetMachineLocal).all();
const timerRad = (id: string) => db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0];
const maskin = (id: string) => db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).all()[0];
const vare = (id: string) => db().select().from(vareforbrukLocal).where(eq(vareforbrukLocal.id, id)).all()[0];
const tombstones = () => db().select().from(slettedeRaderLocal).all();
const varerDb = (): KortVare[] =>
  db()
    .select()
    .from(vareforbrukLocal)
    .all()
    .map((v) => ({ id: v.id, projectId: v.projectId, byggeplassId: v.byggeplassId, externalCostObjectId: v.externalCostObjectId, syncStatus: v.syncStatus }));

function lagVare(id: string, projectId: string, byggeplassId: string | null, syncStatus: "pending" | "synced") {
  db()
    .insert(vareforbrukLocal)
    .values({ id, userId: "u1", organizationId: "o1", sheetId: "s1", projectId, byggeplassId, dato: "2026-11-07", vareId: "x", vareNavn: "Pukk", enhet: "t", antall: 2, syncStatus, sistEndretLokalt: 1 })
    .run();
}
function lagMaskin(id: string, projectId: string, byggeplassId: string | null, timer: number) {
  db().insert(sheetMachineLocal).values({ id, dagsseddelId: "s1", projectId, byggeplassId, vehicleId: "v9", timer, sistEndretLokalt: 1 }).run();
}
function dagFor(sedel = SEDEL, status = "draft"): KortDag {
  return { sheetId: "s1", organizationId: "o1", status, pauseMin: 0, sedel, timerRader: timerAlle(), maskinRader: maskinAlle(), reiseLonnsartId: "l-reise" };
}
const innholdFor = (kort: KortValg, sedel = SEDEL) =>
  kortInnhold({ timerRader: timerAlle(), maskinRader: maskinAlle(), varer: varerDb(), sedel, kort, reiseLonnsartId: "l-reise" });

/** Kort A (p1 · bp1) med arbeid + koblet maskin + fri maskin + reise + vare; nabokort i p2; tillegg og utlegg. */
function byggDag() {
  const a = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
  db().update(sheetTimerLocal).set({ serverVersjon: "ver-7" }).where(eq(sheetTimerLocal.id, a)).run();
  const koblet = maskinAlle()[0].id;
  db().update(sheetMachineLocal).set({ timer: 5 }).where(eq(sheetMachineLocal.id, koblet)).run(); // under arbeid → ingen brudd
  lagMaskin("m-a", "p1", "bp1", 1);
  const reise = leggTilTimerRad(db(), K, { ...felt, lonnsartId: "l-reise", timer: 1 }, []);
  const nabo = leggTilTimerRad(db(), K, { ...felt, projectId: "p2", byggeplassId: null, beskrivelse: "Støping" }, []);
  lagMaskin("m-b", "p2", null, 1);
  lagVare("v-a", "p1", "bp1", "pending");
  lagVare("v-b", "p2", null, "synced");
  db().insert(sheetTilleggLocal).values({ id: "t-1", dagsseddelId: "s1", projectId: "p1", tilleggId: "x", antall: 1, sistEndretLokalt: 1 }).run();
  db()
    .insert(sheetUtleggLocal)
    .values({ id: "u-1", dagsseddelId: "s1", projectId: "p1", expenseCategoryId: "x", belop: 10, ordningVedFoering: "utlegg", foertVed: 1, sistEndretLokalt: 1 })
    .run();
  return { a, koblet, reise, nabo };
}
/** tRPC-klientfeil bærer koden i `e.data.code`. */
const trpcFeil = (code: string) => Object.assign(new Error(code), { data: { code } });

const SERVER_OK = { erPaaNettet: true, slettVare: async () => {}, pushSedel: async () => true, flyttVare: async () => {} };
const sedelRad = () => db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "s1")).all()[0];

describe("slettKort", () => {
  it("sletter bare kortets arbeid, maskin (også koblet) og varer; reise, nabokort, tillegg og utlegg er urørt", async () => {
    const { a, koblet, reise, nabo } = byggDag();
    const slettVare = vi.fn(async () => {});
    expect(await slettKort(db(), dagFor(), innholdFor(A), { erPaaNettet: true, slettVare })).toEqual({ utfall: "ok" });
    expect(timerAlle().map((r) => r.id).sort()).toEqual([reise, nabo].sort());
    expect(maskinAlle().map((m) => m.id)).toEqual(["m-b"]);
    expect(maskin(koblet)).toBeUndefined();
    expect(varerDb().map((v) => v.id)).toEqual(["v-b"]);
    expect(db().select().from(sheetTilleggLocal).all()).toHaveLength(1);
    expect(db().select().from(sheetUtleggLocal).all()).toHaveLength(1);
    // Usynket vare: ingen server.
    expect(slettVare).not.toHaveBeenCalled();
    // Tombstones: timer MED serverVersjon, maskin (koblet + fri).
    const ts = tombstones();
    expect(ts.find((t) => t.radId === a)).toMatchObject({ radType: "timer", serverVersjon: "ver-7", dagsseddelId: "s1" });
    expect(ts.filter((t) => t.radType === "maskin").map((t) => t.radId).sort()).toEqual([koblet, "m-a"].sort());
    expect(ts).toHaveLength(3);
  });

  it("synket vare slettes på server FØR lokal skriving", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    const slettVare = vi.fn(async (_id: string) => {
      expect(timerRad(a)).toBeDefined();
      expect(vare("v-a")).toBeDefined();
    });
    expect(await slettKort(db(), dagFor(), innholdFor(A), { erPaaNettet: true, slettVare })).toEqual({ utfall: "ok" });
    expect(slettVare).toHaveBeenCalledWith("v-a");
    expect(slettVare).toHaveBeenCalledTimes(1);
    expect(vare("v-a")).toBeUndefined();
  });

  it("negativkontroll: serverfeil → ingen lokal skriving", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    const u = await slettKort(db(), dagFor(), innholdFor(A), {
      erPaaNettet: true,
      slettVare: async () => {
        throw new Error("vareforbruk.feil");
      },
    });
    expect(u).toEqual({ utfall: "serverFeil", melding: "vareforbruk.feil" });
    expect(timerRad(a)).toBeDefined();
    expect(maskinAlle()).toHaveLength(3);
    expect(vare("v-a")).toBeDefined();
    expect(tombstones()).toHaveLength(0);
  });

  it("RETUR 36c-kort-2: nett faller etter server-slett → nytt forsøk får NOT_FOUND og fullfører", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    // Forsøk 1: serveren sletter, men svaret når aldri fram.
    const brudd = await slettKort(db(), dagFor(), innholdFor(A), {
      erPaaNettet: true,
      slettVare: async () => {
        throw new Error("Network request failed");
      },
    });
    expect(brudd).toEqual({ utfall: "serverFeil", melding: "Network request failed" });
    expect(vare("v-a")).toBeDefined();
    // Forsøk 2: linja finnes ikke lenger på server → regnes som slettet.
    const slettVare = vi.fn(async () => {
      throw trpcFeil("NOT_FOUND");
    });
    expect(await slettKort(db(), dagFor(), innholdFor(A), { erPaaNettet: true, slettVare })).toEqual({ utfall: "ok" });
    expect(slettVare).toHaveBeenCalledWith("v-a");
    expect(vare("v-a")).toBeUndefined();
    expect(timerRad(a)).toBeUndefined();
  });

  it("negativkontroll: annen tRPC-feil enn NOT_FOUND stopper fortsatt før lokal skriving", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    for (const kode of ["FORBIDDEN", "BAD_REQUEST", "INTERNAL_SERVER_ERROR"]) {
      const u = await slettKort(db(), dagFor(), innholdFor(A), {
        erPaaNettet: true,
        slettVare: async () => {
          throw trpcFeil(kode);
        },
      });
      expect(u).toMatchObject({ utfall: "serverFeil" });
    }
    expect(vare("v-a")).toBeDefined();
    expect(timerRad(a)).toBeDefined();
    expect(tombstones()).toHaveLength(0);
  });

  it("offline-sperre: synket vare på kortet → offline uten skriving; bare usynkede → ok", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    const slettVare = vi.fn(async () => {});
    expect(await slettKort(db(), dagFor(), innholdFor(A), { erPaaNettet: false, slettVare })).toEqual({ utfall: "offline" });
    expect(slettVare).not.toHaveBeenCalled();
    expect(timerRad(a)).toBeDefined();
    expect(tombstones()).toHaveLength(0);
    db().update(vareforbrukLocal).set({ syncStatus: "pending" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    expect(await slettKort(db(), dagFor(), innholdFor(A), { erPaaNettet: false, slettVare })).toEqual({ utfall: "ok" });
    expect(timerRad(a)).toBeUndefined();
  });

  it("vareFinnesPaaServer: synket og ukjent status = server; pending og avvist = bare lokal", () => {
    expect(vareFinnesPaaServer({ id: "1", projectId: "p", syncStatus: "synced" })).toBe(true);
    expect(vareFinnesPaaServer({ id: "1", projectId: "p" })).toBe(true);
    expect(vareFinnesPaaServer({ id: "1", projectId: "p", syncStatus: "pending" })).toBe(false);
    expect(vareFinnesPaaServer({ id: "1", projectId: "p", syncStatus: "avvist" })).toBe(false);
  });

  it("arvende rad (null byggeplass) teller som kortets når sedelens byggeplass hører til prosjektet", async () => {
    const sedel: SedelKortKontekst = { projectId: "p1", byggeplass: { id: "bpA", projectId: "p1" } };
    const arver = leggTilTimerRad(db(), K, { ...felt, byggeplassId: null }, []);
    const eksplisitt = leggTilTimerRad(db(), K, { ...felt, byggeplassId: "bpA" }, []);
    const annet = leggTilTimerRad(db(), K, { ...felt, projectId: "p2", byggeplassId: null }, []);
    const kortA: KortValg = { projectId: "p1", byggeplassId: "bpA", ecoId: null };
    expect(innholdFor(kortA, sedel).timer.map((r) => r.id).sort()).toEqual([arver, eksplisitt].sort());
    expect(await slettKort(db(), dagFor(sedel), innholdFor(kortA, sedel), SERVER_OK)).toEqual({ utfall: "ok" });
    expect(timerAlle().map((r) => r.id)).toEqual([annet]);
  });

  it("negativkontroll: nøkkelen er hele kortet — samme prosjekt, annen byggeplass eller underprosjekt hører ikke med", () => {
    const a = leggTilTimerRad(db(), K, felt, []);
    leggTilTimerRad(db(), K, { ...felt, byggeplassId: "bp2" }, []);
    leggTilTimerRad(db(), K, { ...felt, externalCostObjectId: "eco1" }, []);
    expect(innholdFor(A).timer.map((r) => r.id)).toEqual([a]);
  });

  it("låst sedel (sendt/godkjent) → laast, ingen skriving", async () => {
    const { a } = byggDag();
    for (const status of ["submitted", "approved"]) {
      expect(await slettKort(db(), dagFor(SEDEL, status), innholdFor(A), SERVER_OK)).toEqual({ utfall: "laast" });
      expect(await flyttKort(db(), dagFor(SEDEL, status), innholdFor(A), A, TIL, SERVER_OK)).toEqual({ utfall: "laast" });
    }
    expect(timerRad(a)).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    expect(tombstones()).toHaveLength(0);
    // Returnert er redigerbar.
    expect(await slettKort(db(), dagFor(SEDEL, "returned"), innholdFor(A), SERVER_OK)).toEqual({ utfall: "ok" });
  });

  it("nytt maskinbrudd stopper uten skriving; brudd som fantes fra før blokkerer ikke", async () => {
    const a = leggTilTimerRad(db(), K, felt, []);
    lagMaskin("m-c", "p1", "bp2", 6); // annet kort, samme bøtte (p1) — dekkes bare av kort A
    expect(await slettKort(db(), dagFor(), innholdFor(A), SERVER_OK)).toEqual({ utfall: "brudd" });
    expect(timerRad(a)).toBeDefined();
    expect(tombstones()).toHaveLength(0);
    // Eksisterende brudd i p2 hindrer ikke sletting når p1 ikke får nytt brudd.
    db().delete(sheetMachineLocal).run();
    lagMaskin("m-p2", "p2", null, 5);
    expect(await slettKort(db(), dagFor(), innholdFor(A), SERVER_OK)).toEqual({ utfall: "ok" });
  });

  it("ordre (6): reise i bøtta dekker ikke maskin — maskin måles mot arbeid uten reise", async () => {
    const a = leggTilTimerRad(db(), K, felt, []);
    leggTilTimerRad(db(), K, { ...felt, byggeplassId: "bp2", lonnsartId: "l-reise", timer: 7 }, []);
    lagMaskin("m-c", "p1", "bp2", 6); // 6 t maskin ≤ 7 t reise, men reise er ikke arbeid
    expect(await slettKort(db(), dagFor(), innholdFor(A), SERVER_OK)).toEqual({ utfall: "brudd" });
    expect(timerRad(a)).toBeDefined();
  });
});

describe("flyttKort", () => {
  it("alle kortets rader og koblet maskin får målnøkkelen; reise, nabokort, tillegg og utlegg er urørt", async () => {
    const { a, koblet, reise, nabo } = byggDag();
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, SERVER_OK)).toEqual({ utfall: "ok" });
    const nokkel = { projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2" };
    expect(timerRad(a)).toMatchObject({ ...nokkel, beskrivelse: "Graving", fraTid: "07:00" });
    expect(maskin(koblet)).toMatchObject({ ...nokkel, sheetTimerId: a });
    expect(maskin("m-a")).toMatchObject(nokkel);
    expect(vare("v-a")).toMatchObject(nokkel);
    expect(timerRad(reise)).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    expect(timerRad(nabo)).toMatchObject({ projectId: "p2", byggeplassId: null, externalCostObjectId: null });
    expect(maskin("m-b")).toMatchObject({ projectId: "p2", byggeplassId: null, sistEndretLokalt: 1 });
    expect(vare("v-b")).toMatchObject({ projectId: "p2", byggeplassId: null });
    expect(db().select().from(sheetTilleggLocal).all()[0]).toMatchObject({ projectId: "p1", sistEndretLokalt: 1 });
    expect(db().select().from(sheetUtleggLocal).all()[0]).toMatchObject({ projectId: "p1", sistEndretLokalt: 1 });
    expect(tombstones()).toHaveLength(0);
  });

  it("36c-kort-3: timer flyttes lokalt, sedelen pushes, så flyttes den synkede varen på server og deretter lokalt", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    const rekke: string[] = [];
    const pushSedel = vi.fn(async () => {
      // Pushen ser timer-raden på målprosjektet — det `oppdater` krever (RETUR 4).
      expect(timerRad(a).projectId).toBe("p2");
      expect(sedelRad().syncStatus).toBe("pending");
      expect(vare("v-a").projectId).toBe("p1");
      rekke.push("push");
      return true;
    });
    const flyttVare = vi.fn(async (_id: string, _m: unknown) => {
      // Lokal vare røres ikke før serveren har bekreftet.
      expect(vare("v-a").projectId).toBe("p1");
      rekke.push("vare");
    });
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, { erPaaNettet: true, pushSedel, flyttVare })).toEqual({ utfall: "ok" });
    expect(rekke).toEqual(["push", "vare"]);
    expect(flyttVare).toHaveBeenCalledWith("v-a", { projectId: "p2", byggeplassId: "bp2", ecoId: "eco2" });
    expect(vare("v-a")).toMatchObject({ projectId: "p2", byggeplassId: "bp2" });
  });

  it("uten synkede varer pushes ingenting — sedelen synkes som før", async () => {
    byggDag();
    const pushSedel = vi.fn(async () => true);
    const flyttVare = vi.fn(async () => {});
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, { erPaaNettet: false, pushSedel, flyttVare })).toEqual({ utfall: "ok" });
    expect(pushSedel).not.toHaveBeenCalled();
    expect(flyttVare).not.toHaveBeenCalled();
  });

  it("offline med synket vare → offline uten skriving", async () => {
    const { a } = byggDag();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
    const pushSedel = vi.fn(async () => true);
    const flyttVare = vi.fn(async () => {});
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, { erPaaNettet: false, pushSedel, flyttVare })).toEqual({ utfall: "offline" });
    expect(pushSedel).not.toHaveBeenCalled();
    expect(flyttVare).not.toHaveBeenCalled();
    expect(timerRad(a)).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    expect(maskin("m-a")).toMatchObject({ projectId: "p1", sistEndretLokalt: 1 });
    expect(sedelRad().syncStatus).toBe("synced");
    expect(vare("v-a").projectId).toBe("p1");
  });

  it("push feiler (false eller kaster) → delvis: timer og maskin flyttet, sedel pending, varen urørt og ikke sendt", async () => {
    for (const pushSedel of [async () => false, async (): Promise<boolean> => { throw new Error("nett"); }]) {
      nullstillDb();
      const { a, koblet } = byggDag();
      db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
      const flyttVare = vi.fn(async () => {});
      expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, { erPaaNettet: true, pushSedel, flyttVare })).toEqual({ utfall: "delvis" });
      expect(flyttVare).not.toHaveBeenCalled();
      expect(timerRad(a)).toMatchObject({ projectId: "p2", byggeplassId: "bp2" });
      expect(maskin(koblet)).toMatchObject({ projectId: "p2" });
      expect(maskin("m-a")).toMatchObject({ projectId: "p2" });
      expect(sedelRad().syncStatus).toBe("pending");
      expect(vare("v-a")).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    }
  });

  it("serveren avviser varen (feil, NOT_FOUND, FORBIDDEN) → delvis med serverens grunn; varen står igjen", async () => {
    for (const feil of [new Error("nei"), trpcFeil("NOT_FOUND"), trpcFeil("FORBIDDEN")]) {
      nullstillDb();
      const { a } = byggDag();
      db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "v-a")).run();
      const u = await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, {
        erPaaNettet: true,
        pushSedel: async () => true,
        flyttVare: async () => {
          throw feil;
        },
      });
      expect(u).toEqual({ utfall: "delvis", melding: feil.message });
      expect(timerRad(a)).toMatchObject({ projectId: "p2" });
      expect(vare("v-a")).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    }
  });

  it("vare 2 av 3 avvises → vare 1 flyttet, 2 og 3 urørt; nytt forsøk på fra-kortet flytter resten", async () => {
    const a = leggTilTimerRad(db(), K, felt, []);
    for (const id of ["v-1", "v-2", "v-3"]) lagVare(id, "p1", "bp1", "synced");
    const kall: string[] = [];
    const u = await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, {
      erPaaNettet: true,
      pushSedel: async () => true,
      flyttVare: async (id) => {
        kall.push(id);
        if (id === "v-2") throw new Error("nett");
      },
    });
    expect(u).toEqual({ utfall: "delvis", melding: "nett" });
    expect(kall).toEqual(["v-1", "v-2"]);
    expect(vare("v-1").projectId).toBe("p2");
    expect(vare("v-2").projectId).toBe("p1");
    expect(vare("v-3").projectId).toBe("p1");
    expect(timerRad(a).projectId).toBe("p2");
    // Fra-kortet har nå bare de to varene igjen; «Endre kort» igjen fullfører.
    const rest = innholdFor(A);
    expect(rest.timer).toHaveLength(0);
    expect(rest.varer.map((v) => v.id).sort()).toEqual(["v-2", "v-3"]);
    expect(await flyttKort(db(), dagFor(), rest, A, TIL, SERVER_OK)).toEqual({ utfall: "ok" });
    for (const id of ["v-1", "v-2", "v-3"]) expect(vare(id)).toMatchObject({ projectId: "p2", byggeplassId: "bp2" });
  });

  it("sammenslåing: målkortet finnes → radene får samme nøkkel og beholder beskrivelsene", async () => {
    const { a, nabo } = byggDag();
    const B: KortValg = { projectId: "p2", byggeplassId: null, ecoId: null };
    const utenfor = timerAlle().filter((r) => !innholdFor(A).timer.some((k) => k.id === r.id));
    expect(kortFinnesFraFor(utenfor, SEDEL, B)).toBe(true);
    expect(kortFinnesFraFor(utenfor, SEDEL, { projectId: "p3", byggeplassId: null, ecoId: null })).toBe(false);
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, B, SERVER_OK)).toEqual({ utfall: "ok" });
    expect(innholdFor(B).timer.map((r) => [r.id, r.beskrivelse]).sort()).toEqual(
      [
        [a, "Graving"],
        [nabo, "Støping"],
      ].sort(),
    );
    expect(innholdFor(A).timer).toHaveLength(0);
  });

  it("nytt maskinbrudd stopper uten skriving", async () => {
    const a = leggTilTimerRad(db(), K, felt, []);
    lagMaskin("m-c", "p1", "bp2", 6);
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, TIL, SERVER_OK)).toEqual({ utfall: "brudd" });
    expect(timerRad(a)).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
  });

  it("uendret kort → ingen skriving", async () => {
    const { a } = byggDag();
    const før = timerRad(a).sistEndretLokalt;
    expect(await flyttKort(db(), dagFor(), innholdFor(A), A, { ...A }, SERVER_OK)).toEqual({ utfall: "uendret" });
    expect(timerRad(a).sistEndretLokalt).toBe(før);
  });

  it("«Uten byggeplass» løfter sedelens arv: andre arvende rader beholder byggeplassen eksplisitt", async () => {
    db().update(dagsseddelLocal).set({ byggeplassId: "bpA" }).where(eq(dagsseddelLocal.id, "s1")).run();
    const sedel: SedelKortKontekst = { projectId: "p1", byggeplass: { id: "bpA", projectId: "p1" } };
    const a = leggTilTimerRad(db(), K, felt, []);
    const arver = leggTilTimerRad(db(), K, { ...felt, byggeplassId: null, beskrivelse: "Annet" }, []);
    const uten: KortValg = { projectId: "p1", byggeplassId: null, ecoId: null };
    expect(await flyttKort(db(), dagFor(sedel), innholdFor(A, sedel), A, uten, SERVER_OK)).toEqual({ utfall: "ok" });
    expect(timerRad(a).byggeplassId).toBeNull();
    expect(timerRad(arver).byggeplassId).toBe("bpA");
    expect(db().select().from(dagsseddelLocal).all()[0]).toMatchObject({ byggeplassId: null, syncStatus: "pending" });
  });
});

describe("RETUR 36c-kort-2 — feiltekst og NOT_FOUND", () => {
  it("erIkkeFunnet kjenner bare tRPC-koden NOT_FOUND", () => {
    expect(erIkkeFunnet(trpcFeil("NOT_FOUND"))).toBe(true);
    for (const e of [trpcFeil("FORBIDDEN"), new Error("NOT_FOUND"), null, undefined, "NOT_FOUND"]) expect(erIkkeFunnet(e)).toBe(false);
  });

  it("hvert stopp-utfall gir en synlig tekst — offline aldri stille", () => {
    expect(kortUtfallTekst({ utfall: "offline" }, "slett")).toBe("timer.kort.offlineSlett");
    expect(kortUtfallTekst({ utfall: "offline" }, "flytt")).toBe("timer.kort.offlineFlytt");
    expect(kortUtfallTekst({ utfall: "delvis" }, "flytt")).toBe("timer.kort.delvisFlyttet");
    const stopp: KortUtfall[] = [{ utfall: "laast" }, { utfall: "brudd" }, { utfall: "serverFeil", melding: "x" }, { utfall: "delvis" }];
    for (const u of stopp) for (const h of ["slett", "flytt"] as const) expect(kortUtfallTekst(u, h)).toBeTruthy();
    expect(kortUtfallTekst({ utfall: "ok" }, "slett")).toBeNull();
  });

  it("nøklene finnes i alle språkfilene", () => {
    const i18n = path.join(__dirname, "../../../../../../packages/shared/src/i18n");
    const filer = fs.readdirSync(i18n).filter((f) => f.endsWith(".json"));
    expect(filer).toHaveLength(15);
    for (const fil of filer) {
      const json = JSON.parse(fs.readFileSync(path.join(i18n, fil), "utf8")) as Record<string, string>;
      expect(json["timer.kort.delvisFlyttet"], `${fil}:delvisFlyttet`).toBeTruthy();
    }
    for (const sprak of ["nb", "en"]) {
      const json = JSON.parse(fs.readFileSync(path.join(i18n, `${sprak}.json`), "utf8")) as Record<string, string>;
      for (const n of ["timer.kort.offlineSlett", "timer.kort.offlineFlytt", "timer.detalj.laast", "timer.maskin.overstigerArbeid"])
        expect(json[n], `${sprak}:${n}`).toBeTruthy();
    }
  });

  it("kortskjermen viser teksten fra kortUtfallTekst for både flytt og slett", () => {
    const kort = fs.readFileSync(path.join(__dirname, "../../../../app/timer/[id]/kort/[projectId].tsx"), "utf8");
    // visUtfall har ingen egne unntak: alt annet enn «ok» går gjennom kortUtfallTekst.
    // 36c-kort-3: `delvis` legger serverens grunn bak teksten (avslaget skjules ikke).
    const a = kort.indexOf("const visUtfall =");
    const blokk = kort.slice(a, kort.indexOf("};", a));
    expect(blokk).toContain("const tekst = kortUtfallTekst(u, handling);");
    expect(blokk.match(/u\.utfall/g)).toEqual(["u.utfall", "u.utfall"]);
    expect(blokk).toContain('u.utfall === "ok"');
    expect(blokk).toContain('const grunn = u.utfall === "delvis" && u.melding ? `\\n${u.melding}` : "";');
    expect(blokk).toContain("setKortFeil(tekst ? t(tekst, { defaultValue: tekst }) + grunn : null);");
    expect(kort).toContain('visUtfall(u, "flytt")');
    expect(kort).toContain('visUtfall(u, "slett")');
  });
});

describe("kildevakter — kortskjermen", () => {
  const app = path.join(__dirname, "../../../../app/timer");
  const kort = fs.readFileSync(path.join(app, "[id]/kort/[projectId].tsx"), "utf8");

  it("knappene vises bare når sedelen er redigerbar", () => {
    const i = kort.indexOf("{erRedigerbar && !tomt && (");
    expect(i).toBeGreaterThan(-1);
    const blokk = kort.slice(i, kort.indexOf("</ScrollView>", i));
    expect(blokk).toContain('t("timer.kort.endre")');
    expect(blokk).toContain('t("timer.kort.slett")');
    expect(kort.split('t("timer.kort.endre")')).toHaveLength(2);
  });

  it("dagskortet importerer ikke kortfunksjonene", () => {
    const dagskort = fs.readFileSync(path.join(app, "[id].tsx"), "utf8");
    for (const navn of ["flyttKort", "slettKort", "kortInnhold", "BekreftSlettModal"]) expect(dagskort).not.toContain(navn);
  });

  it("synlige tekster går via t()", () => {
    // Kommentarer kan nevne knappene; JSX-tekst og strenglitteraler kan ikke.
    for (const tekst of ["Endre kort", "Slett kort", "Slette kortet", "siste kort"]) {
      expect(kort).not.toMatch(new RegExp(`>\\s*${tekst}`));
      expect(kort).not.toMatch(new RegExp(`["'\`]${tekst}`));
    }
    for (const n of ["slettTittel", "slettTekst", "slettUtkast", "slettReturnert", "slettSiste", "sammenslaa", "offlineFlytt", "offlineSlett"])
      expect(kort).toContain(`t("timer.kort.${n}"`);
  });

  it("rekkefølge: flytt = brudd → lokal transaksjon → push → server-vare → lokal vare; slett = server før lokal", () => {
    const kilde = fs.readFileSync(path.join(__dirname, "kortRadFlytt.ts"), "utf8");
    const flytt = kilde.slice(kilde.indexOf("export async function flyttKort"));
    const steg = ["girNyttBrudd", "db.transaction", "await server.pushSedel", "await server.flyttVare", "flyttVareLokalt(db,"].map((n) =>
      flytt.indexOf(n),
    );
    for (const i of steg) expect(i).toBeGreaterThan(-1);
    expect([...steg].sort((x, y) => x - y)).toEqual(steg);
    // Push-feil gir aldri «ok»: utfallet rett etter pushen er delvis.
    expect(flytt).toMatch(/if \(!pushet\) return \{ utfall: "delvis" \};/);
    const slett = kilde.slice(kilde.indexOf("export async function slettKort"), kilde.indexOf("export function slettKortLokalt"));
    expect(slett.indexOf("await server.slettVare")).toBeLessThan(slett.indexOf("slettKortLokalt("));
  });
});

describe("TILLEGG 2026-11-12 regel 1 — flytt av ÉN rad tar med maskiner og varer", () => {
  /** Rad r1 (p1·bp1) med koblet maskin og koblet vare; rad r2 på samme kort med egen vare; ukoblet vare. */
  function toRader() {
    const r1 = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: 6, mengde: null, enhet: null }]);
    const r2 = leggTilTimerRad(db(), K, { ...felt, fraTid: "15:00", tilTid: "17:00", timer: 2 }, []);
    const m1 = maskinAlle()[0].id;
    lagVare("v-r1", "p1", "bp1", "pending");
    lagVare("v-r1s", "p1", "bp1", "synced");
    lagVare("v-r2", "p1", "bp1", "pending");
    lagVare("v-fri", "p1", "bp1", "pending");
    db().update(vareforbrukLocal).set({ sheetTimerId: r1, antall: 3.5 }).where(eq(vareforbrukLocal.id, "v-r1")).run();
    db().update(vareforbrukLocal).set({ sheetTimerId: r1 }).where(eq(vareforbrukLocal.id, "v-r1s")).run();
    db().update(vareforbrukLocal).set({ sheetTimerId: r2 }).where(eq(vareforbrukLocal.id, "v-r2")).run();
    return { r1, r2, m1 };
  }
  const varerMedRad = () =>
    db()
      .select()
      .from(vareforbrukLocal)
      .all()
      .map((v) => ({ id: v.id, projectId: v.projectId, byggeplassId: v.byggeplassId, externalCostObjectId: v.externalCostObjectId, syncStatus: v.syncStatus, sheetTimerId: v.sheetTimerId }));

  it("flytt av rad til B: koblet maskin og varer (lokal + synket) følger, timer og mengde uendret", async () => {
    const { r1, r2, m1 } = toRader();
    const flyttVare = vi.fn(async () => {});
    const innhold = radInnhold({ rad: timerRad(r1)!, maskinRader: maskinAlle(), varer: varerMedRad() });
    expect(innhold.maskin.map((m) => m.id)).toEqual([m1]);
    expect(innhold.varer.map((v) => v.id).sort()).toEqual(["v-r1", "v-r1s"]);
    const u = await flyttKort(db(), dagFor(), innhold, A, TIL, { erPaaNettet: true, pushSedel: async () => true, flyttVare });
    expect(u).toEqual({ utfall: "ok" });
    const nokkel = { projectId: "p2", externalCostObjectId: "eco2" };
    expect(timerRad(r1)).toMatchObject({ ...nokkel, timer: felt.timer });
    expect(maskin(m1)).toMatchObject({ ...nokkel, sheetTimerId: r1, timer: 6 });
    expect(vare("v-r1")).toMatchObject({ ...nokkel, sheetTimerId: r1, antall: 3.5, enhet: "t" });
    expect(vare("v-r1s")).toMatchObject({ ...nokkel, sheetTimerId: r1, antall: 2 });
    expect(flyttVare).toHaveBeenCalledTimes(1);
    // Negativkontroll: nabo-raden og dens vare, og den ukoblede varen, blir der de er.
    expect(timerRad(r2)).toMatchObject({ projectId: "p1", byggeplassId: "bp1", externalCostObjectId: null });
    expect(vare("v-r2")).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
    expect(vare("v-fri")).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
  });

  it("negativkontroll: uten varer i innholdet (gammel timer-flytt) blir varene stående — det er det radInnhold retter", async () => {
    const { r1 } = toRader();
    const innhold = { ...radInnhold({ rad: timerRad(r1)!, maskinRader: maskinAlle(), varer: varerMedRad() }), varer: [] };
    expect(await flyttKort(db(), dagFor(), innhold, A, TIL, SERVER_OK)).toEqual({ utfall: "ok" });
    expect(timerRad(r1)).toMatchObject({ projectId: "p2" });
    expect(vare("v-r1")).toMatchObject({ projectId: "p1", byggeplassId: "bp1" });
  });
});
