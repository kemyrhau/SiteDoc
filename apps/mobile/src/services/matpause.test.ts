import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import { effektiveTimerFraSpenn } from "@sitedoc/shared";

/**
 * V20 PK2 — matpause-bæreren på manuell føring. Lønnsdata: hver skrivevei testes.
 *
 * `avgjorRadPauseMin` er regelen leggTil/oppdater (ny rad + redigering) bruker for
 * å sette radens `pauseMin`; den testes rent. settMatpauseBaerer/fjernMatpause
 * testes mot EKTE SQLite (sql.js) — samme harness som timerSync-testene.
 *
 * Gate (rød i engangskopi uten fiksen):
 *  (a) toggle på 07:00–15:00 gir uendret fraTid/tilTid
 *  (b) manuell rad 07:00–15:00 lagret gir pauseMin=30, avkrysset, timer=7.50
 *  (c) toggle av, og så på igjen, gir tilbake samme tilstand
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
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
// Firma: standardPauseMin 30, pause 4,0 t inn → 07:00-skift → vindu fra 11:00.
vi.mock("./organizationSettingKatalog", () => ({
  hentOrganizationSettingLokalt: () => ({
    standardPauseMin: 30,
    standardPauseEtterTimer: 4.0,
  }),
}));
vi.mock("./kalenderKatalog", () => ({
  hentArbeidsdagTiderLokalt: () => ({
    startTid: "07:00",
    sluttTid: "15:00",
    pauseMin: 30,
  }),
}));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  avgjorRadPauseMin,
  settMatpauseBaerer,
  fjernMatpause,
} from "./matpause";

const { dagsseddelLocal, sheetTimerLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const PAUSE_FRA = "11:00"; // pauseVinduFra("07:00", 4.0)

// ============================================================================
//  PK2-regelen — ren (brukt av leggTil + oppdater ved lagring)
// ============================================================================
describe("avgjorRadPauseMin (V20 PK2)", () => {
  const base = { pauseFra: PAUSE_FRA, standardPauseMin: 30 };

  it("(b) én manuell rad 07:00–15:00 blir bærer → 30, og timer = 7.50", () => {
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [],
      radId: null,
      fraTid: "07:00",
      tilTid: "15:00",
    });
    expect(pm).toBe(30);
    expect(effektiveTimerFraSpenn("07:00", "15:00", PAUSE_FRA, pm)).toBe(7.5);
  });

  it("dag ≤ 5,5 t (07:00–12:00) → 0 (ingen pause under terskel), timer = fullt spenn", () => {
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [],
      radId: null,
      fraTid: "07:00",
      tilTid: "12:00",
    });
    expect(pm).toBe(0);
    expect(effektiveTimerFraSpenn("07:00", "12:00", PAUSE_FRA, pm)).toBe(5);
  });

  it("raden krysser ikke pausevinduet (12:00–18:00) → 0", () => {
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [],
      radId: null,
      fraTid: "12:00",
      tilTid: "18:00",
    });
    expect(pm).toBe(0);
  });

  it("en ANNEN rad bærer alt → 0 (kun-én-pr.-dag)", () => {
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [
        { id: "a", fraTid: "07:00", tilTid: "15:00", pauseMin: 30 },
      ],
      radId: null,
      fraTid: "07:00",
      tilTid: "15:30",
    });
    expect(pm).toBe(0);
  });

  it("redigering av DEN eksisterende bæreren → forblir 30 (ser ikke seg selv)", () => {
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [
        { id: "a", fraTid: "07:00", tilTid: "15:00", pauseMin: 30 },
      ],
      radId: "a",
      fraTid: "07:00",
      tilTid: "15:00",
    });
    expect(pm).toBe(30);
  });

  it("to korte rader der SUM > 5,5 t: bæreren er den som krysser vinduet", () => {
    // Rad 1 finnes (07:00–11:30, krysser), ny rad 12:00–16:00 krysser ikke → 0.
    const pm = avgjorRadPauseMin({
      ...base,
      alleRader: [
        { id: "a", fraTid: "07:00", tilTid: "11:30", pauseMin: 30 },
      ],
      radId: null,
      fraTid: "12:00",
      tilTid: "16:00",
    });
    expect(pm).toBe(0);
  });
});

// ============================================================================
//  settMatpauseBaerer / fjernMatpause — mot ekte SQLite
// ============================================================================
function radFor(id: string): typeof sheetTimerLocal.$inferSelect {
  return db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0]!;
}

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

/** Én manuell rad 07:00–15:00, LAGRET slik leggTil nå gjør (PK2): bærer med
 *  pauseMin=30 og timer=effektiveTimerFraSpenn(…,30)=7.5. */
function seedLagretManuellRad() {
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "sheet-1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-10-06",
      status: "draft",
      syncStatus: "pending",
      pauseMin: 30,
      normStatus: "server",
      sistEndretLokalt: 1000,
    } as never)
    .run();
  const pauseMin = avgjorRadPauseMin({
    alleRader: [],
    radId: null,
    fraTid: "07:00",
    tilTid: "15:00",
    pauseFra: PAUSE_FRA,
    standardPauseMin: 30,
  });
  db()
    .insert(sheetTimerLocal)
    .values({
      id: "row-1",
      dagsseddelId: "sheet-1",
      projectId: "p1",
      lonnsartId: "L-time",
      aktivitetId: "a1",
      pauseMin,
      timer: effektiveTimerFraSpenn("07:00", "15:00", PAUSE_FRA, pauseMin),
      fraTid: "07:00",
      tilTid: "15:00",
      tidKilde: "manuell",
      sistEndretLokalt: 1000,
    } as never)
    .run();
}

describe("settMatpause/fjernMatpause (sql.js)", () => {
  it("(b) leggTil-persist gir pauseMin=30, avkrysset, timer=7.50", () => {
    seedLagretManuellRad();
    const rad = radFor("row-1");
    expect(rad.pauseMin).toBe(30); // avkrysset = pauseMin > 0
    expect(rad.timer).toBe(7.5);
    expect(rad.tilTid).toBe("15:00");
  });

  it("(a) settMatpauseBaerer endrer ALDRI fraTid/tilTid", () => {
    seedLagretManuellRad();
    const res = settMatpauseBaerer("sheet-1", "row-1", "o1", "2026-10-06");
    const rad = radFor("row-1");
    expect(res.utfall).toBe("satt");
    expect(rad.fraTid).toBe("07:00");
    expect(rad.tilTid).toBe("15:00");
    expect(rad.timer).toBe(7.5);
    expect(rad.pauseMin).toBe(30);
  });

  it("(c) fjern (av) og sett (på) igjen gir tilbake samme tilstand", () => {
    seedLagretManuellRad();
    const av = fjernMatpause("sheet-1", "o1", "2026-10-06");
    const etterAv = radFor("row-1");
    expect(av.utfall).toBe("fjernet");
    expect(etterAv.pauseMin).toBe(0);
    expect(etterAv.tilTid).toBe("15:00"); // tid urørt
    expect(etterAv.timer).toBe(8); // fullt spenn uten bærer

    const paa = settMatpauseBaerer("sheet-1", "row-1", "o1", "2026-10-06");
    const etterPaa = radFor("row-1");
    expect(paa.utfall).toBe("satt");
    expect(etterPaa.pauseMin).toBe(30);
    expect(etterPaa.tilTid).toBe("15:00");
    expect(etterPaa.timer).toBe(7.5);
  });
});
