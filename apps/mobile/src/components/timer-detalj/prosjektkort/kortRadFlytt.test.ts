import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE 36b «Flytt raden» — kontrakt for kort-skrivingene i `kortRadFlytt.ts`.
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
  flyttMaskinRad,
  flyttTimerRad,
  endreVareMengde,
  flyttVareLokalt,
  foelgKobletMaskin,
  kanEndreVare,
  slettVarelinje,
  loftByggeplassArv,
  trengerByggeplassLoft,
} from "./kortRadFlytt";
import { leggTilTimerRad, type TimerRadFelt } from "./radLagring";

const { dagsseddelLocal, lonnsartLocal, sheetMachineLocal, sheetTimerLocal, vareforbrukLocal } = schema;

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
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM slettede_rader_local; DELETE FROM lonnsart_local; DELETE FROM vareforbruk_local;",
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
  beskrivelse: "Graving",
  pauseMin: 30,
};
const MAAL = { projectId: "p2", byggeplassId: "bp2", ecoId: "eco2" };

const timerRad = (id: string) => db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0];
const maskinRader = () => db().select().from(sheetMachineLocal).all();
const vare = (id: string) => db().select().from(vareforbrukLocal).where(eq(vareforbrukLocal.id, id)).all()[0];

describe("flyttTimerRad", () => {
  it("bytter prosjekt/byggeplass/underprosjekt, beholder tider, lønnsart, beskrivelse og matpause", () => {
    const id = leggTilTimerRad(db(), K, felt, []);
    flyttTimerRad(db(), K, timerRad(id), MAAL);
    expect(timerRad(id)).toMatchObject({
      projectId: "p2",
      byggeplassId: "bp2",
      externalCostObjectId: "eco2",
      lonnsartId: "l-arb",
      aktivitetId: "a1",
      fraTid: "07:00",
      tilTid: "15:00",
      beskrivelse: "Graving",
      pauseMin: 30,
    });
  });

  it("koblet maskin følger raden (prosjekt, byggeplass, underprosjekt) og forblir koblet", () => {
    const id = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
    flyttTimerRad(db(), K, timerRad(id), MAAL);
    expect(maskinRader()).toHaveLength(1);
    expect(maskinRader()[0]).toMatchObject({ sheetTimerId: id, projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2", vehicleId: "v1" });
  });

  it("negativkontroll: maskin som ikke er koblet til raden flyttes ikke", () => {
    const id = leggTilTimerRad(db(), K, felt, []);
    db().insert(sheetMachineLocal).values({ id: "m-fri", dagsseddelId: "s1", projectId: "p1", vehicleId: "v9", timer: 2, sistEndretLokalt: 1 }).run();
    flyttTimerRad(db(), K, timerRad(id), MAAL);
    expect(maskinRader()[0]).toMatchObject({ id: "m-fri", projectId: "p1", byggeplassId: null, sistEndretLokalt: 1 });
  });
});

describe("foelgKobletMaskin", () => {
  it("kopierer timer-radens byggeplass til koblet maskin", () => {
    const id = leggTilTimerRad(db(), K, { ...felt, byggeplassId: "bp1" }, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
    // Maskin skrives nå med radens bøtte; simuler en eldre maskin uten byggeplass.
    db().update(sheetMachineLocal).set({ byggeplassId: null }).run();
    expect(maskinRader()[0].byggeplassId).toBeNull();
    foelgKobletMaskin(db(), id);
    expect(maskinRader()[0].byggeplassId).toBe("bp1");
  });

  it("negativkontroll: allerede lik → ingen skriving (ingen unødig pending-sync)", () => {
    const id = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
    db().update(sheetMachineLocal).set({ sistEndretLokalt: 1 }).run();
    foelgKobletMaskin(db(), id);
    expect(maskinRader()[0].sistEndretLokalt).toBe(1);
    foelgKobletMaskin(db(), "finnes-ikke");
    expect(maskinRader()[0].sistEndretLokalt).toBe(1);
  });
});

describe("foelgKobletMaskin — flere maskiner (NY BESLUTNING 2026-11-12)", () => {
  it("ALLE koblede maskiner følger raden ved flytt; timene røres ikke", () => {
    const id = leggTilTimerRad(db(), K, { ...felt, timer: 8 }, [
      { vehicleId: "grave", timer: 8, mengde: null, enhet: null },
      { vehicleId: "bil", timer: 3, mengde: null, enhet: null },
    ]);
    flyttTimerRad(db(), K, timerRad(id), MAAL);
    const m = maskinRader();
    expect(m).toHaveLength(2);
    for (const x of m) expect(x).toMatchObject({ sheetTimerId: id, projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2" });
    // Negativkontroll: bilen beholder sine 3 t (ikke løftet til radens 8).
    expect(m.find((x) => x.vehicleId === "bil")!.timer).toBe(3);
  });
});

describe("flyttMaskinRad", () => {
  it("flytter maskin alene og kobler den løs fra timer-raden", () => {
    const id = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
    const m = maskinRader()[0];
    flyttMaskinRad(db(), m.id, MAAL);
    expect(maskinRader()[0]).toMatchObject({ projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2", sheetTimerId: null, vehicleId: "v1" });
    // Timer-raden er urørt.
    expect(timerRad(id)).toMatchObject({ projectId: "p1", byggeplassId: null });
  });
});

describe("flyttVareLokalt", () => {
  it("bytter prosjekt/byggeplass/underprosjekt, beholder syncStatus", () => {
    db()
      .insert(vareforbrukLocal)
      .values({ id: "v-1", userId: "u1", organizationId: "o1", sheetId: "s1", projectId: "p1", dato: "2026-11-07", vareId: "x", vareNavn: "Pukk", enhet: "t", antall: 2, syncStatus: "pending", sistEndretLokalt: 1 })
      .run();
    flyttVareLokalt(db(), "v-1", MAAL);
    expect(vare("v-1")).toMatchObject({ projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2", syncStatus: "pending", antall: 2 });
  });

  it("negativkontroll: ukjent linje → ingenting endres", () => {
    flyttVareLokalt(db(), "finnes-ikke", MAAL);
    expect(db().select().from(vareforbrukLocal).all()).toHaveLength(0);
  });
});

describe("RETUR 36c-2 P1 (a2) — løft byggeplass-arv ved «Uten byggeplass»", () => {
  const SEDEL_A = { projectId: "p1", byggeplass: { id: "bpA", projectId: "p1" } };
  const sedelRad = () => db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "s1")).all()[0];
  const medHeaderA = () => db().update(dagsseddelLocal).set({ byggeplassId: "bpA" }).where(eq(dagsseddelLocal.id, "s1")).run();

  it("arvende timer- og maskinrader får A eksplisitt; sedelens byggeplass nullstilles og blir pending", () => {
    medHeaderA();
    const id = leggTilTimerRad(db(), K, felt, [{ vehicleId: "v1", timer: felt.timer, mengde: null, enhet: null }]);
    db().insert(sheetMachineLocal).values({ id: "m-fri", dagsseddelId: "s1", projectId: null, vehicleId: "v9", timer: 2, sistEndretLokalt: 1 }).run();
    expect(loftByggeplassArv(db(), "s1", SEDEL_A)).toBe(true);
    expect(timerRad(id).byggeplassId).toBe("bpA");
    expect(maskinRader().map((m) => m.byggeplassId)).toEqual(["bpA", "bpA"]);
    expect(sedelRad()).toMatchObject({ byggeplassId: null, syncStatus: "pending" });
    expect(sedelRad().sistEndretLokalt).toBeGreaterThan(1000);
  });

  it("negativkontroll: reise, rader i annet prosjekt og rader med egen byggeplass røres ikke", () => {
    medHeaderA();
    const reise = leggTilTimerRad(db(), K, felt, []);
    db().update(sheetTimerLocal).set({ erReise: true, sistEndretLokalt: 1 }).where(eq(sheetTimerLocal.id, reise)).run();
    const annet = leggTilTimerRad(db(), K, { ...felt, projectId: "p2" }, []);
    const egen = leggTilTimerRad(db(), K, { ...felt, byggeplassId: "bpB" }, []);
    db().insert(sheetMachineLocal).values({ id: "m-p2", dagsseddelId: "s1", projectId: "p2", vehicleId: "v9", timer: 2, sistEndretLokalt: 1 }).run();
    loftByggeplassArv(db(), "s1", SEDEL_A);
    expect(timerRad(reise)).toMatchObject({ byggeplassId: null, sistEndretLokalt: 1 });
    expect(timerRad(annet).byggeplassId).toBeNull();
    expect(timerRad(egen).byggeplassId).toBe("bpB");
    expect(maskinRader()[0]).toMatchObject({ id: "m-p2", byggeplassId: null, sistEndretLokalt: 1 });
  });

  it("negativkontroll: sedel uten byggeplass → no-op (false), ingen pending", () => {
    const id = leggTilTimerRad(db(), K, felt, []);
    expect(loftByggeplassArv(db(), "s1", { projectId: "p1", byggeplass: null })).toBe(false);
    expect(timerRad(id).byggeplassId).toBeNull();
    expect(sedelRad().syncStatus).toBe("synced");
  });

  it("trengerByggeplassLoft: bare «uten» i samme prosjekt som sedelens byggeplass", () => {
    expect(trengerByggeplassLoft({ projectId: "p1", byggeplassId: null, ecoId: null }, SEDEL_A)).toBe(true);
    expect(trengerByggeplassLoft({ projectId: "p1", byggeplassId: "bpA", ecoId: null }, SEDEL_A)).toBe(false);
    expect(trengerByggeplassLoft({ projectId: "p2", byggeplassId: null, ecoId: null }, SEDEL_A)).toBe(false);
    expect(trengerByggeplassLoft({ projectId: "p1", byggeplassId: null, ecoId: null }, { projectId: "p1", byggeplass: null })).toBe(false);
  });

  it("kildevakt: lagring og flytt løfter før byggeplass beregnes; «Uten» tilbys alltid", async () => {
    const fs = await import("node:fs");
    const kilde = fs.readFileSync(path.join(__dirname, "ProsjektkortDagsoversikt.tsx"), "utf8");
    expect(kilde).toMatch(/loftArvVedBehov\(til\);\s*const maal/);
    expect(kilde).toMatch(/loftArvVedBehov\(timerModal\.kort\);\s*const felt/);
    const modal = fs.readFileSync(path.join(__dirname, "KortValgModal.tsx"), "utf8");
    expect(modal).toMatch(/kanVelgeUtenByggeplass\([^)]*\): boolean \{\s*return true;/);
  });
});

describe("Punkt 7 — «Endre mengde» og «Slett» i vare-arket", () => {
  const seed = (id: string, syncStatus: "pending" | "synced") =>
    db()
      .insert(vareforbrukLocal)
      .values({ id, userId: "u1", organizationId: "o1", sheetId: "s1", projectId: "p1", dato: "2026-11-07", vareId: "x", vareNavn: "Pukk", enhet: "t", antall: 2, syncStatus, sistEndretLokalt: 1 })
      .run();

  it("ventende vare slettes lokalt uten serverkall", async () => {
    seed("v-p", "pending");
    const slettVare = vi.fn();
    const u = await slettVarelinje(db(), { id: "v-p", projectId: "p1", syncStatus: "pending" }, { erPaaNettet: false, slettVare });
    expect(u).toEqual({ utfall: "ok" });
    expect(slettVare).not.toHaveBeenCalled();
    expect(vare("v-p")).toBeUndefined();
  });

  it("synket vare kaller slett og fjernes lokalt", async () => {
    seed("v-s", "synced");
    const slettVare = vi.fn().mockResolvedValue(undefined);
    const u = await slettVarelinje(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, { erPaaNettet: true, slettVare });
    expect(u).toEqual({ utfall: "ok" });
    expect(slettVare).toHaveBeenCalledWith("v-s");
    expect(vare("v-s")).toBeUndefined();
  });

  it("vare kjent bare fra server (uten syncStatus) kaller slett; NOT_FOUND regnes som slettet", async () => {
    const slettVare = vi.fn().mockRejectedValue({ data: { code: "NOT_FOUND" } });
    const u = await slettVarelinje(db(), { id: "v-srv", projectId: "p1" }, { erPaaNettet: true, slettVare });
    expect(u).toEqual({ utfall: "ok" });
    expect(slettVare).toHaveBeenCalledWith("v-srv");
  });

  it("negativkontroll: synket vare offline → «offline», ingen kall, raden står", async () => {
    seed("v-s", "synced");
    const slettVare = vi.fn();
    const u = await slettVarelinje(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, { erPaaNettet: false, slettVare });
    expect(u).toEqual({ utfall: "offline" });
    expect(slettVare).not.toHaveBeenCalled();
    expect(vare("v-s")).toBeDefined();
  });

  it("negativkontroll: serverfeil → serverFeil, raden står lokalt", async () => {
    seed("v-s", "synced");
    const slettVare = vi.fn().mockRejectedValue(new Error("Vareforbruket er attestert og kan ikke endres"));
    const u = await slettVarelinje(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, { erPaaNettet: true, slettVare });
    expect(u).toEqual({ utfall: "serverFeil", melding: "Vareforbruket er attestert og kan ikke endres" });
    expect(vare("v-s")).toBeDefined();
  });

  it("ventende vare: mengden endres lokalt uten serverkall", async () => {
    seed("v-p", "pending");
    const oppdaterVare = vi.fn();
    const u = await endreVareMengde(db(), { id: "v-p", projectId: "p1", syncStatus: "pending" }, 5.5, { erPaaNettet: false, oppdaterVare });
    expect(u).toEqual({ utfall: "ok" });
    expect(oppdaterVare).not.toHaveBeenCalled();
    expect(vare("v-p")).toMatchObject({ antall: 5.5, syncStatus: "pending" });
    expect(vare("v-p").sistEndretLokalt).toBeGreaterThan(1);
  });

  it("synket vare: oppdater kalles med ny mengde, så lokal kopi", async () => {
    seed("v-s", "synced");
    const oppdaterVare = vi.fn().mockResolvedValue(undefined);
    const u = await endreVareMengde(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, 3, { erPaaNettet: true, oppdaterVare });
    expect(u).toEqual({ utfall: "ok" });
    expect(oppdaterVare).toHaveBeenCalledWith({ id: "v-s", antall: 3 });
    expect(vare("v-s")).toMatchObject({ antall: 3, syncStatus: "synced" });
  });

  it("negativkontroll: synket vare offline eller serverfeil → ingen lokal endring", async () => {
    seed("v-s", "synced");
    const oppdaterVare = vi.fn().mockRejectedValue(new Error("nei"));
    expect(await endreVareMengde(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, 3, { erPaaNettet: false, oppdaterVare })).toEqual({ utfall: "offline" });
    expect(oppdaterVare).not.toHaveBeenCalled();
    expect(await endreVareMengde(db(), { id: "v-s", projectId: "p1", syncStatus: "synced" }, 3, { erPaaNettet: true, oppdaterVare })).toEqual({ utfall: "serverFeil", melding: "nei" });
    expect(vare("v-s").antall).toBe(2);
  });

  it("negativkontroll: mengde ≤ 0 eller ikke et tall → uendret, ingen skriving", async () => {
    seed("v-p", "pending");
    const oppdaterVare = vi.fn();
    for (const n of [0, -1, Number.NaN]) {
      expect(await endreVareMengde(db(), { id: "v-p", projectId: "p1", syncStatus: "pending" }, n, { erPaaNettet: true, oppdaterVare })).toEqual({ utfall: "uendret" });
    }
    expect(vare("v-p").antall).toBe(2);
  });

  it("kanEndreVare: redigerbar vare får knapper, også koblet", () => {
    expect(kanEndreVare({ id: "v", projectId: "p1", syncStatus: "synced" }, true)).toBe(true);
    expect(kanEndreVare({ id: "v", projectId: "p1", syncStatus: "pending" }, true)).toBe(true);
    expect(kanEndreVare({ id: "v", projectId: "p1" }, true)).toBe(true);
  });

  it("negativkontroll: låst vare (attestert, avvist, ikke redigerbar) får ingen knapper", () => {
    expect(kanEndreVare({ id: "v", projectId: "p1", syncStatus: "synced", attestert: true }, true)).toBe(false);
    expect(kanEndreVare({ id: "v", projectId: "p1", syncStatus: "avvist" }, true)).toBe(false);
    expect(kanEndreVare({ id: "v", projectId: "p1", syncStatus: "synced" }, false)).toBe(false);
  });

  it("kildevakt: arket styrer knappene med kanEndreVare og bekrefter sletting i BekreftSlettModal", async () => {
    const fs = await import("node:fs");
    const kilde = fs.readFileSync(path.join(__dirname, "ProsjektkortDagsoversikt.tsx"), "utf8");
    expect(kilde).toMatch(/kanEndreVare\(vareValgt/);
    expect(kilde).toMatch(/<BekreftSlettModal/);
    expect(kilde).toMatch(/slettVarelinje\(/);
    expect(kilde).toMatch(/endreVareMengde\(/);
    expect(kilde).toMatch(/trpc\.vareforbruk\.slett\.useMutation/);
  });
});
