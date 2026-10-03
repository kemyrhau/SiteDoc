import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * LAG 2 (L2-B) gate-test (c) — rød-først mot EKTE SQLite (sql.js/WASM), samme
 * harness-prinsipp som `timerSync.test.ts`: `anvendDagsforslag` skriver reise-
 * sporet på sheet_timer_local og norm-sporet på dagsseddel_local. Uten
 * leveransens insert-endringer står kolonnene null → testen feiler.
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
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${teller++}` }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { anvendDagsforslag } from "./dagsforslagAnvend";
import type { Dagsforslag } from "./dagsforslag";
import type { ReiseRegelSnapshot, NormSnapshot } from "@sitedoc/shared";

let teller = 0;
const { dagsseddelLocal, sheetTimerLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
// sql.js-drizzle er strukturelt ulik ExpoSQLite-drizzle (anvend-param) men
// identisk i praksis for harnessen — cast via unknown, som i timerSync.test.ts.
function anvendDb(): Parameters<typeof anvendDagsforslag>[0] {
  return holder.drizzle as Parameters<typeof anvendDagsforslag>[0];
}

const REGEL: ReiseRegelSnapshot = {
  enhet: "minutter",
  terskelMin: 30,
  terskelM: null,
  underType: "arbeidstid",
  overType: "reisetid",
  kategori: "reisetid",
  grensepunktTreff: false,
};
const NORM: NormSnapshot = {
  dagsnorm: 8,
  normKilde: "fast",
  dato: "2026-07-01",
  hentetAt: "2026-07-01T04:00:00.000Z",
};

/** Ett-dags forslag: én arbeidsrad + én reise-rad (ut, matrise). */
function forslag(): Dagsforslag {
  return {
    prosjektId: "p1",
    aktivitetId: "a1",
    kappet: false,
    prosjektUkjent: false,
    reiseAarsak: null,
    destinasjonAarsak: null,
    normStatus: "server",
    datoer: [
      {
        dato: "2026-07-01",
        erStartSegment: true,
        segmentStartIso: "2026-07-01T05:00:00",
        segmentSluttIso: "2026-07-01T15:00:00",
        blokkert: false,
        eksisterendeStatus: null,
        erNy: true,
        harEksisterendeRader: false,
        byggeplassId: "b1",
        pauseMin: 30,
        deltVedMidnatt: false,
        sluttTidKilde: "bruker",
        normStatus: "server",
        normSnapshot: NORM,
        vekForOverlapp: [],
        rader: [
          {
            projectId: "p1",
            lonnsartId: "L-normal",
            aktivitetId: "a1",
            timer: 7.5,
            fraTid: "07:00",
            tilTid: "15:00",
            pauseMin: 30,
            erReise: false,
            reiseRetning: null,
            reiseOppmotestedId: null,
            byggeplassId: null,
            reiseKjoretidMin: null,
            reiseAvstandM: null,
            reiseKilde: null,
            reiseRegel: null,
            tidKilde: null,
          },
          {
            projectId: "p1",
            lonnsartId: "L-reise",
            aktivitetId: "a1",
            timer: 2,
            fraTid: "05:00",
            tilTid: "07:00",
            pauseMin: 0,
            erReise: true,
            reiseRetning: "ut",
            reiseOppmotestedId: "o1",
            byggeplassId: "b1",
            reiseKjoretidMin: 120,
            reiseAvstandM: 50000,
            reiseKilde: "matrise",
            reiseRegel: REGEL,
            tidKilde: "utledet",
          },
        ],
      },
    ],
  };
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
  teller = 0;
  holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local;");
});

describe("anvendDagsforslag — L2-B skriver sporet (gate c)", () => {
  it("🔴 (c) reise-raden lagres MED alle etappe-felt + V8-vindu i sheet_timer_local", () => {
    const resultat = anvendDagsforslag(anvendDb(), forslag(), {
      userId: "u1",
      orgId: "o1",
      nyId: () => `rad-${teller++}`,
      naa: () => 1000,
    });
    expect(resultat.startSheetId).not.toBeNull();

    const rader = db()
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, resultat.startSheetId!))
      .all();
    expect(rader).toHaveLength(2);

    const reise = rader.find((r) => r.erReise === true);
    expect(reise).toBeDefined();
    // Rød uten anvend-endringen: disse kolonnene sto null.
    expect(reise!.reiseRetning).toBe("ut");
    expect(reise!.reiseKilde).toBe("matrise");
    expect(reise!.reiseOppmotestedId).toBe("o1");
    expect(reise!.byggeplassId).toBe("b1");
    expect(reise!.reiseKjoretidMin).toBe(120);
    expect(reise!.reiseAvstandM).toBe(50000);
    expect(reise!.tidKilde).toBe("utledet");
    expect(reise!.fraTid).toBe("05:00");
    expect(reise!.tilTid).toBe("07:00");
    // reiseRegel lagres som JSON-streng → parses til snapshotet.
    expect(reise!.reiseRegel).not.toBeNull();
    expect(JSON.parse(reise!.reiseRegel!)).toMatchObject({ kategori: "reisetid" });

    const arbeid = rader.find((r) => r.erReise === false);
    expect(arbeid).toBeDefined();
    expect(arbeid!.reiseKilde).toBeNull();
    expect(arbeid!.tidKilde).toBeNull();
  });

  it("🔴 (c) sedelen lagres med normStatus + normSnapshot (B5)", () => {
    const resultat = anvendDagsforslag(anvendDb(), forslag(), {
      userId: "u1",
      orgId: "o1",
      nyId: () => `rad-${teller++}`,
      naa: () => 1000,
    });
    const sedel = db()
      .select()
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, resultat.startSheetId!))
      .all()[0];
    expect(sedel!.normStatus).toBe("server");
    expect(sedel!.normSnapshot).not.toBeNull();
    expect(JSON.parse(sedel!.normSnapshot!)).toMatchObject({
      dagsnorm: 8,
      normKilde: "fast",
    });
  });
});
