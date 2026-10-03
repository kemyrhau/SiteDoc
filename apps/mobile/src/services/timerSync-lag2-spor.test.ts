import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * LAG 2 (L2-B TILLEGG 1) — pull-hullet: reise-sporet må OVERLEVE en sync-runde.
 *
 * Kjører den EKTE `syncTimer` (push + pull) mot EKTE SQLite (sql.js/WASM), samme
 * harness som `timerSync.test.ts`. tRPC-klienten er en stubb: `syncBatch` fanger
 * push-payloaden og kvitterer «ok» (→ synced), `hentEndringerSiden` returnerer et
 * konfigurerbart pull-svar.
 *
 * Rød-først (vist i engangskopi uten TILLEGG-1-koden):
 *  A — NY server ekko-er sporet i pull → lokal rad BEHOLDER sporet (uten pull-
 *      store ble det NULLET av rad-erstatningen).
 *  B — GAMMEL server UTELATER spor-feltene (mangler ≠ null) → lokal rad BEHOLDER
 *      sitt spor (uten «bevar ved mangler» ble det NULLET mot prod).
 *  C — full runde push→pull→endring→push: ANDRE push bærer fortsatt sporet
 *      (uten A/B ville andre push sendt spor-løse rader → server mister sporet).
 *
 * Dekker IKKE: serverens egen `deleteMany`+`createMany` (stubbet). At serveren
 * FAKTISK lagrer det mobilen sender dekkes av `reise-sporbarhet.test.ts` +
 * `timer-lag2-sync.test.ts` i apps/api.
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
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { syncTimer } from "./timerSync";

const { dagsseddelLocal, sheetTimerLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const REGEL = {
  enhet: "minutter",
  terskelMin: 30,
  terskelM: null,
  underType: "arbeidstid",
  overType: "reisetid",
  kategori: "reisetid",
  grensepunktTreff: false,
};

/** En reise-rad slik serveren ville echo-et den i pull (NY server). */
function serverReiseRad(over: Record<string, unknown> = {}) {
  return {
    id: "row-reise",
    projectId: "p1",
    byggeplassId: "b1",
    lonnsartId: "L-reise",
    aktivitetId: "a1",
    externalCostObjectId: null,
    vehicleId: null,
    timer: 2,
    fraTid: "05:00",
    tilTid: "07:00",
    beskrivelse: null,
    pauseMin: 0,
    erReise: true,
    reiseRetning: "ut",
    reiseOppmotestedId: "o1",
    reiseKjoretidMin: 120,
    reiseAvstandM: 50000,
    reiseKilde: "matrise",
    reiseRegel: REGEL,
    tidKilde: "utledet",
    reiseAvvik: null,
    ...over,
  };
}

/** Pull-svar fra server. `rad` = timer-raden som echo-es (ett element). */
function pullSvar(rad: Record<string, unknown>, sedelOver: Record<string, unknown> = {}) {
  return {
    serverTid: "2026-07-02T00:00:00.000Z",
    slettevindu: { fraDato: "2026-01-01", tilDato: null as string | null },
    levendeSedler: [{ id: "sheet-1", clientUuid: "sheet-1" }],
    sedler: [
      {
        id: "sheet-1",
        clientUuid: "sheet-1",
        userId: "u1",
        organizationId: "o1",
        projectId: "p1",
        aktivitetId: "a1",
        avdelingId: null,
        byggeplassId: "b1",
        dato: "2026-07-01",
        startAt: null,
        endAt: null,
        pauseMin: 0,
        sluttTidKilde: "bruker",
        status: "draft",
        beskrivelse: null,
        lederKommentar: null,
        attestertVed: null,
        normStatus: "server",
        normSnapshot: { dagsnorm: 8, normKilde: "fast", dato: "2026-07-01", hentetAt: "x" },
        updatedAt: "2026-07-01T20:00:00.000Z",
        timer: [rad],
        tillegg: [],
        maskiner: [],
        utlegg: [],
        ...sedelOver,
      },
    ],
  };
}

const pushPayloads: Array<Record<string, unknown>> = [];

/** Stub: syncBatch fanger payload + kvitterer ok (→ synced); pull returnerer svar. */
function lagKlient(pull: ReturnType<typeof pullSvar>) {
  return {
    timer: {
      dagsseddel: {
        syncBatch: {
          mutate: async (input: { sedler: Array<Record<string, unknown>> }) => {
            pushPayloads.push(...input.sedler);
            return {
              resultater: input.sedler.map((s) => ({
                clientUuid: s.clientUuid as string,
                resultat: "ok" as const,
                serverData: {
                  clientUuid: s.clientUuid as string,
                  status: "draft" as const,
                  lederKommentar: null,
                  attestertVed: null,
                },
              })),
            };
          },
        },
        hentEndringerSiden: { query: async () => pull },
      },
    },
  } as unknown as Parameters<typeof syncTimer>[0];
}

/** Seed en PENDING sedel + reise-rad MED fullt spor (som auto-generering skrev). */
function seedMedSpor() {
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "sheet-1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      byggeplassId: "b1",
      dato: "2026-07-01",
      status: "draft",
      syncStatus: "pending",
      normStatus: "server",
      normSnapshot: JSON.stringify({ dagsnorm: 8, normKilde: "fast", dato: "2026-07-01", hentetAt: "x" }),
      sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(sheetTimerLocal)
    .values({
      id: "row-reise",
      dagsseddelId: "sheet-1",
      projectId: "p1",
      byggeplassId: "b1",
      lonnsartId: "L-reise",
      aktivitetId: "a1",
      timer: 2,
      fraTid: "05:00",
      tilTid: "07:00",
      erReise: true,
      reiseRetning: "ut",
      reiseOppmotestedId: "o1",
      reiseKjoretidMin: 120,
      reiseAvstandM: 50000,
      reiseKilde: "matrise",
      reiseRegel: JSON.stringify(REGEL),
      tidKilde: "utledet",
      sistEndretLokalt: 1000,
    })
    .run();
}

function reiseRadFor(): typeof sheetTimerLocal.$inferSelect {
  return db()
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, "row-reise"))
    .all()[0]!;
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
  pushPayloads.length = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM slettede_rader_local;",
  );
});

describe("syncTimer — reise-sporet overlever pull (TILLEGG 1)", () => {
  it("🔴 A: NY server ekko-er sporet → lokal rad BEHOLDER det gjennom pull", async () => {
    seedMedSpor();
    await syncTimer(lagKlient(pullSvar(serverReiseRad())), "u1");
    const rad = reiseRadFor();
    // Uten pull-store: rad-erstatningen setter disse null.
    expect(rad.reiseKilde).toBe("matrise");
    expect(rad.reiseRetning).toBe("ut");
    expect(rad.reiseAvstandM).toBe(50000);
    expect(rad.tidKilde).toBe("utledet");
    expect(rad.erReise).toBe(true);
    expect(JSON.parse(rad.reiseRegel!)).toMatchObject({ kategori: "reisetid" });
  });

  it("🔴 B: GAMMEL server UTELATER spor-feltene (mangler ≠ null) → lokal rad BEHOLDER sitt spor", async () => {
    seedMedSpor();
    // Gammel server: timeraden har KUN de gamle feltene — ingen spor-nøkler.
    const gammelRad = {
      id: "row-reise",
      projectId: "p1",
      byggeplassId: "b1",
      lonnsartId: "L-reise",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      timer: 2,
      fraTid: "05:00",
      tilTid: "07:00",
      beskrivelse: null,
      pauseMin: 0,
    };
    // Sedelen mangler også normStatus/normSnapshot (gammel server).
    const svar = pullSvar(gammelRad);
    delete (svar.sedler[0] as Record<string, unknown>).normStatus;
    delete (svar.sedler[0] as Record<string, unknown>).normSnapshot;
    await syncTimer(lagKlient(svar), "u1");

    const rad = reiseRadFor();
    // Uten «bevar ved mangler»: nullet mot prod (samme hull som før).
    expect(rad.reiseKilde).toBe("matrise");
    expect(rad.reiseRetning).toBe("ut");
    expect(rad.erReise).toBe(true);
    expect(JSON.parse(rad.reiseRegel!)).toMatchObject({ kategori: "reisetid" });
    // Sedelens norm-spor bevart in-place (ikke i .set() når feltet mangler).
    const sedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "sheet-1")).all()[0]!;
    expect(sedel.normStatus).toBe("server");
    expect(sedel.normSnapshot).not.toBeNull();
  });

  it("🔴 C: full runde push→pull→endring→push — ANDRE push bærer fortsatt sporet", async () => {
    seedMedSpor();
    // Runde 1: push (capture #1) + pull (NY server echo).
    await syncTimer(lagKlient(pullSvar(serverReiseRad())), "u1");
    // Arbeideren endrer noe på dagen → raden re-pushes.
    db().update(sheetTimerLocal).set({ timer: 3 }).where(eq(sheetTimerLocal.id, "row-reise")).run();
    db().update(dagsseddelLocal).set({ syncStatus: "pending" }).where(eq(dagsseddelLocal.id, "sheet-1")).run();
    pushPayloads.length = 0; // bare runde 2
    await syncTimer(lagKlient(pullSvar(serverReiseRad({ timer: 3 }))), "u1");

    // Andre push sin reise-rad bærer fortsatt sporet (ellers mister server det).
    const sendtReise = pushPayloads
      .flatMap((s) => (s.timer as Array<Record<string, unknown>>) ?? [])
      .find((t) => t.id === "row-reise");
    expect(sendtReise).toBeDefined();
    expect(sendtReise!.reiseKilde).toBe("matrise");
    expect(sendtReise!.reiseRetning).toBe("ut");
    expect(sendtReise!.tidKilde).toBe("utledet");
    expect(sendtReise!.reiseRegel).toMatchObject({ kategori: "reisetid" });
  });
});
