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
  flyttKort,
  kortUtfallParametre,
  kortUtfallTekst,
  kortInnhold,
  radInnhold,
  slettKortLokalt,
  type KortDag,
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
import { radHorerTilKort } from "../../../lib/prosjektkortMobil";

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

/* ============================================================================
 *  Ordre c — T12 (prosjektkort-kortid-spec § 9): «Flytt raden» til nytt kort
 *  gir ny id og tar med koblet maskin/vare; «Endre kort» beholder id; «Slett
 *  kort» sletter bare kortets rader — også når to kort har samme nøkkel.
 *  🔴 Skrevet etter koden; negativkontroll i leveransen.
 * ============================================================================ */
describe("T12 — Flytt/Endre/Slett pr. kort-id", () => {
  const SEDEL = { projectId: "p1", byggeplass: null };
  const server = { erPaaNettet: true, pushSedel: async () => true, flyttVare: async () => {} };
  type Rad = Parameters<typeof radInnhold>[0]["rad"];
  const alleTimer = () => db().select().from(sheetTimerLocal).all() as unknown as Rad[];
  const dag = (): KortDag => ({
    sheetId: "s1",
    organizationId: "o1",
    status: "draft",
    pauseMin: 0,
    sedel: SEDEL,
    timerRader: alleTimer(),
    maskinRader: [],
    reiseLonnsartId: null,
  });
  const kortA = { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "A" };
  const toRaderPaaA = () => {
    const r1 = leggTilTimerRad(db(), K, { ...felt, kortId: "A", fraTid: "07:00", tilTid: "11:00", timer: 4, pauseMin: 0 }, [
      { vehicleId: "v1", timer: 4, mengde: null, enhet: null },
    ]);
    const r2 = leggTilTimerRad(db(), K, { ...felt, kortId: "A", fraTid: "11:00", tilTid: "15:00", timer: 4, pauseMin: 0 }, []);
    db()
      .insert(vareforbrukLocal)
      .values({ id: "v-k", userId: "u1", organizationId: "o1", sheetId: "s1", projectId: "p1", sheetTimerId: r1, dato: "2026-11-07", vareId: "x", vareNavn: "Pukk", enhet: "t", antall: 2, syncStatus: "pending", sistEndretLokalt: 1 })
      .run();
    return { r1, r2 };
  };
  const flyttRad = (radId: string, til: typeof kortA) =>
    flyttKort(
      db(),
      dag(),
      radInnhold({ rad: timerRad(radId) as unknown as Rad, maskinRader: maskinRader() as never, varer: [{ ...vare("v-k")!, syncStatus: "pending" as const }] }),
      kortA,
      til,
      server,
    );

  it("«Flytt til nytt kort» med samme nøkkel: raden får ny id, koblet maskin og vare følger; resten blir på kortet", async () => {
    const { r1, r2 } = toRaderPaaA();
    expect(await flyttRad(r1, { ...kortA, kortId: "NY" })).toEqual({ utfall: "ok" });
    expect(timerRad(r1)!.kortId).toBe("NY");
    expect(timerRad(r2)!.kortId).toBe("A");
    expect(maskinRader()[0]!.kortId).toBe("NY");
    expect(vare("v-k")!.kortId).toBe("NY");
  });

  it("«Flytt raden» til et kort som finnes: raden får det kortets id — også når den var kortets eneste rad", async () => {
    const r1 = leggTilTimerRad(db(), K, { ...felt, kortId: "A", timer: 4 }, []);
    leggTilTimerRad(db(), K, { ...felt, projectId: "p2", kortId: "B", fraTid: "15:00", tilTid: "17:00", timer: 2, pauseMin: 0 }, []);
    const tilB = { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "B" };
    expect(await flyttKort(db(), dag(), radInnhold({ rad: timerRad(r1) as unknown as Rad, maskinRader: [], varer: [] }), kortA, tilB, server)).toEqual({ utfall: "ok" });
    expect(timerRad(r1)!.kortId).toBe("B");
  });

  it("negativkontroll: samme nøkkel og samme id → uendret, ingenting skrives", async () => {
    const { r1 } = toRaderPaaA();
    const foer = timerRad(r1)!.sistEndretLokalt;
    expect(await flyttRad(r1, kortA)).toEqual({ utfall: "uendret" });
    expect(timerRad(r1)!.sistEndretLokalt).toBe(foer);
  });

  it("«Endre kort» beholder id-en (hele kortet til ny nøkkel)", async () => {
    const { r1, r2 } = toRaderPaaA();
    const innhold = kortInnhold({ timerRader: alleTimer(), maskinRader: maskinRader() as never, varer: [], sedel: SEDEL, kort: kortA, reiseLonnsartId: null });
    const til = { ...kortA, projectId: "p2" };
    expect(await flyttKort(db(), dag(), innhold, kortA, til, server)).toEqual({ utfall: "ok" });
    expect([timerRad(r1)!.kortId, timerRad(r2)!.kortId]).toEqual(["A", "A"]);
    expect(timerRad(r1)!.projectId).toBe("p2");
  });

  it("«Slett kort» på ett av to kort med samme nøkkel sletter bare det kortets rader", async () => {
    const { r1, r2 } = toRaderPaaA();
    await flyttRad(r1, { ...kortA, kortId: "NY" });
    const kortNy = { ...kortA, kortId: "NY" };
    const innhold = kortInnhold({ timerRader: alleTimer(), maskinRader: maskinRader() as never, varer: [], sedel: SEDEL, kort: kortNy, reiseLonnsartId: null });
    expect(innhold.timer.map((r) => r.id)).toEqual([r1]);
    slettKortLokalt(db(), "s1", innhold);
    expect(timerRad(r1)).toBeUndefined();
    expect(timerRad(r2)!.kortId).toBe("A");
    expect(maskinRader()).toHaveLength(0);
  });
});

describe("Kontrollør A1 — maskin eller vare flyttet alene får målkortets id", () => {
  const SEDEL = { projectId: "p1", byggeplass: null };
  const tilB = { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "B" };
  /** Kort A (p1) med koblet maskin og vare, kort B (p2). */
  const toKort = () => {
    const a = leggTilTimerRad(db(), K, { ...felt, kortId: "A", timer: 4 }, [{ vehicleId: "v1", timer: 4, mengde: null, enhet: null }]);
    // ORDRE (35): B ligger etter A i tid — lagring sperrer overlapp på hele sedelen, og «Flytt raden» sjekker det nå.
    leggTilTimerRad(db(), K, { ...felt, projectId: "p2", kortId: "B", fraTid: "15:00", tilTid: "17:00", timer: 2, pauseMin: 0 }, []);
    db()
      .insert(vareforbrukLocal)
      .values({ id: "v-s", userId: "u1", organizationId: "o1", sheetId: "s1", projectId: "p1", sheetTimerId: a, kortId: "A", dato: "2026-11-07", vareId: "x", vareNavn: "Pukk", enhet: "t", antall: 2, syncStatus: "synced", sistEndretLokalt: 1 })
      .run();
    return { a };
  };
  const paaKort = (rad: { projectId: string | null; byggeplassId?: string | null; externalCostObjectId?: string | null; kortId?: string | null }, kort: typeof tilB) =>
    radHorerTilKort({ ...rad, kortId: rad.kortId ?? undefined } as never, SEDEL, kort);

  it("flyttMaskinRad: maskinen får målkortets id og hører til B, ikke A", () => {
    toKort();
    const m = maskinRader()[0]!;
    expect(m.kortId).toBe("A");
    flyttMaskinRad(db(), m.id, { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "B" });
    const etter = maskinRader()[0]!;
    expect(etter).toMatchObject({ projectId: "p2", kortId: "B", sheetTimerId: null });
    expect(paaKort(etter, tilB)).toBe(true);
    expect(paaKort(etter, { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "A" })).toBe(false);
  });

  it("flyttVareLokalt: varen får målkortets id", () => {
    toKort();
    flyttVareLokalt(db(), "v-s", { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "B" });
    expect(vare("v-s")).toMatchObject({ projectId: "p2", kortId: "B" });
  });

  it("flytt uten kort-id i målet: id-en nullstilles og utledes på nytt (aldri gammelt kort på ny nøkkel)", () => {
    toKort();
    flyttMaskinRad(db(), maskinRader()[0]!.id, { projectId: "p3", byggeplassId: null, ecoId: null });
    expect(maskinRader()[0]!.kortId).toBeNull();
    flyttVareLokalt(db(), "v-s", { projectId: "p3", byggeplassId: null, ecoId: null });
    expect(vare("v-s")!.kortId).toBeNull();
  });

  it("flyttKort: synket vare får mål-id-en etter at serveren har godtatt flyttet («Flytt raden» til B)", async () => {
    const { a } = toKort();
    type Rad = Parameters<typeof radInnhold>[0]["rad"];
    const dag: KortDag = {
      sheetId: "s1",
      organizationId: "o1",
      status: "draft",
      pauseMin: 0,
      sedel: SEDEL,
      timerRader: db().select().from(sheetTimerLocal).all() as unknown as Rad[],
      maskinRader: [],
      reiseLonnsartId: null,
    };
    const innhold = radInnhold({ rad: timerRad(a) as unknown as Rad, maskinRader: maskinRader() as never, varer: [{ ...vare("v-s")!, syncStatus: "synced" as const }] });
    const server = { erPaaNettet: true, pushSedel: async () => true, flyttVare: vi.fn(async () => {}) };
    expect(await flyttKort(db(), dag, innhold, { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "A" }, tilB, server)).toEqual({ utfall: "ok" });
    expect(server.flyttVare).toHaveBeenCalledTimes(1);
    expect(timerRad(a)!.kortId).toBe("B");
    expect(vare("v-s")).toMatchObject({ projectId: "p2", kortId: "B" });
  });

  it("vakt: «Flytt raden» for maskin og vare sender målkortets id og normaliserer etterpå", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const kilde = fs.readFileSync(path.join(__dirname, "ProsjektkortDagsoversikt.tsx"), "utf8");
    const blokk = kilde.slice(kilde.indexOf("const utforFlytt = async"), kilde.indexOf("onVarerLagret();\n", kilde.indexOf("flyttVareLokalt(db(), v.id")));
    expect(blokk).toContain("const til = flyttMaalKort(valgt, nytt);");
    expect(blokk).toContain("kortId: til.kortId");
    expect(blokk.match(/sikreLokalKortId\(db\(\), sheetId\)/g)).toHaveLength(2);
  });
});

/* ============================================================================
 *  ORDRE (35) 2026-11-16 (spec § 12.8.3 «Flytt raden — kollisjonssjekk»):
 *  «Flytt raden» kjører samme kollisjonssjekk som «Endre kort»
 *  (`finnKortKollisjon`) — samme utfall og samme melding. Ingen ny regel.
 *  Overlappen lages direkte i SQLite: lagring av en rad sperrer overlapp på hele
 *  sedelen, så sjekken treffer bare overlapp som fantes fra før.
 *  🔴 Rød før koden (flyttKort hoppet over sjekken uten `kollisjonssjekk: true`).
 * ============================================================================ */
describe("ORDRE (35) — «Flytt raden» får kollisjonssjekk", () => {
  const SEDEL = { projectId: "p1", byggeplass: null };
  const server = { erPaaNettet: true, pushSedel: async () => true, flyttVare: async () => {} };
  type Rad = Parameters<typeof radInnhold>[0]["rad"];
  const dag = (): KortDag => ({
    sheetId: "s1",
    organizationId: "o1",
    status: "draft",
    pauseMin: 0,
    sedel: SEDEL,
    timerRader: db().select().from(sheetTimerLocal).all() as unknown as Rad[],
    maskinRader: [],
    reiseLonnsartId: null,
  });
  const kortA = { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "A" };
  const tilB = { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "B" };
  /** Rad a på kort A (07–11) og rad b på kort B (p2) med gitte tider. */
  const toKort = (bFra: string, bTil: string) => {
    const a = leggTilTimerRad(db(), K, { ...felt, kortId: "A", fraTid: "07:00", tilTid: "11:00", timer: 4, pauseMin: 0 }, []);
    const b = leggTilTimerRad(db(), K, { ...felt, projectId: "p2", byggeplassId: null, kortId: "B", fraTid: bFra, tilTid: bTil, timer: 4, pauseMin: 0 }, []);
    db().update(sheetTimerLocal).set({ kortId: "A" }).where(eq(sheetTimerLocal.id, a)).run();
    db().update(sheetTimerLocal).set({ kortId: "B" }).where(eq(sheetTimerLocal.id, b)).run();
    return { a, b };
  };
  // Samme kall som `utforFlytt` i ProsjektkortDagsoversikt (rad-innhold, ingen ekstra valg).
  const flyttRad = (radId: string, til: typeof tilB) =>
    flyttKort(db(), dag(), radInnhold({ rad: timerRad(radId) as unknown as Rad, maskinRader: [], varer: [] }), kortA, til, server);

  it("med overlapp: samme utfall som «Endre kort» (`overlapp`, `timer.feil.overlapp` med tidene) — ingen skriving", async () => {
    const { a } = toKort("10:00", "15:00");
    const foer = timerRad(a)!.sistEndretLokalt;
    const u = await flyttRad(a, tilB);
    expect(u).toEqual({ utfall: "overlapp", fra: "07:00", til: "11:00", annenFra: "10:00", annenTil: "15:00" });
    expect(kortUtfallTekst(u, "flytt")).toBe("timer.feil.overlapp");
    expect(kortUtfallParametre(u)).toEqual({ fra: "07:00", til: "11:00", annenFra: "10:00", annenTil: "15:00" });
    expect(timerRad(a)).toMatchObject({ projectId: "p1", kortId: "A", sistEndretLokalt: foer });
  });

  it("«Flytt til nytt kort» på en nøkkel med overlappende kort sperres likt (alle kort med nøkkelen)", async () => {
    const { a } = toKort("10:00", "15:00");
    expect((await flyttRad(a, { ...tilB, kortId: "NY" })).utfall).toBe("overlapp");
    expect(timerRad(a)).toMatchObject({ projectId: "p1", kortId: "A" });
  });

  it("negativkontroll: uten overlapp flyttes raden som før (berøring i endepunkt er ikke overlapp)", async () => {
    const { a } = toKort("11:00", "15:00");
    expect(await flyttRad(a, tilB)).toEqual({ utfall: "ok" });
    expect(timerRad(a)).toMatchObject({ projectId: "p2", kortId: "B" });
  });

  it("negativkontroll: overlapp med et kort på en ANNEN nøkkel stopper ikke flyttet", async () => {
    const { a } = toKort("10:00", "15:00");
    expect(await flyttRad(a, { projectId: "p3", byggeplassId: null, ecoId: null, kortId: "C" })).toEqual({ utfall: "ok" });
    expect(timerRad(a)).toMatchObject({ projectId: "p3", kortId: "C" });
  });

  it("kildevakt: «Flytt raden» viser meldingen med tidene, som kortskjermen", async () => {
    const fs = await import("node:fs");
    const kilde = fs.readFileSync(path.join(__dirname, "ProsjektkortDagsoversikt.tsx"), "utf8");
    const blokk = kilde.slice(kilde.indexOf("const utforFlytt = async"), kilde.indexOf("} else if (flytt.radType === \"maskin\")"));
    expect(blokk).toContain("...kortUtfallParametre(u)");
  });
});
