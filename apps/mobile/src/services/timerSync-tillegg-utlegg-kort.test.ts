import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * T6 (tillegg-utlegg-prosjektkort-spec.md § 9) — byggeplass og underprosjekt på
 * tillegg/utlegg gjennom en sync-runde, med den EKTE `syncTimer` mot EKTE SQLite
 * (sql.js), samme harness som `timerSync-lag2-spor.test.ts`.
 *
 *  A — push-payloaden bærer `byggeplassId`/`externalCostObjectId` på tillegg og utlegg.
 *  B — NY server ekko-er feltene i pull → lokale rader får dem.
 *  C — GAMMEL server utelater feltene (mangler ≠ null) → lokale rader BEHOLDER sine
 *      verdier, og pullen krasjer ikke (ny klient mot gammel server).
 *  D — NY server sier eksplisitt null → lokale felt nulles (server er fasit).
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

const { dagsseddelLocal, sheetTilleggLocal, sheetUtleggLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const KORT = { byggeplassId: "b-kort", externalCostObjectId: "eco-kort" };

function serverTillegg(over: Record<string, unknown> = {}) {
  return { id: "tl-1", projectId: "p1", tilleggId: "t1", antall: 1, kommentar: null, vedlegg: [], ...KORT, ...over };
}
function serverUtlegg(over: Record<string, unknown> = {}) {
  return {
    id: "ut-1",
    projectId: "p1",
    expenseCategoryId: "k1",
    belop: 250,
    kommentar: null,
    ordningVedFoering: "utlegg",
    foertVed: "2026-07-01T10:00:00.000Z",
    vedlegg: [],
    ...KORT,
    ...over,
  };
}

function pullSvar(tillegg: Record<string, unknown>, utlegg: Record<string, unknown>) {
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
        byggeplassId: "b-dag",
        dato: "2026-07-01",
        startAt: null,
        endAt: null,
        pauseMin: 0,
        sluttTidKilde: "bruker",
        status: "draft",
        beskrivelse: null,
        lederKommentar: null,
        attestertVed: null,
        updatedAt: "2026-07-01T20:00:00.000Z",
        timer: [],
        tillegg: [tillegg],
        maskiner: [],
        utlegg: [utlegg],
      },
    ],
  };
}

const pushPayloads: Array<Record<string, unknown>> = [];

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

function seed() {
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "sheet-1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      byggeplassId: "b-dag",
      dato: "2026-07-01",
      status: "draft",
      syncStatus: "pending",
      sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(sheetTilleggLocal)
    .values({ id: "tl-1", dagsseddelId: "sheet-1", projectId: "p1", tilleggId: "t1", antall: 1, ...KORT, sistEndretLokalt: 1000 })
    .run();
  db()
    .insert(sheetUtleggLocal)
    .values({
      id: "ut-1",
      dagsseddelId: "sheet-1",
      projectId: "p1",
      expenseCategoryId: "k1",
      belop: 250,
      ordningVedFoering: "utlegg",
      foertVed: Date.parse("2026-07-01T10:00:00.000Z"),
      ...KORT,
      sistEndretLokalt: 1000,
    })
    .run();
}

function lokalTillegg() {
  return db().select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.id, "tl-1")).all()[0]!;
}
function lokalUtlegg() {
  return db().select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.id, "ut-1")).all()[0]!;
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
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM slettede_rader_local;",
  );
});

describe("T6 — tillegg/utlegg bærer byggeplass og underprosjekt gjennom sync", () => {
  it("A: push-payloaden har feltene på tillegg og utlegg", async () => {
    seed();
    await syncTimer(lagKlient(pullSvar(serverTillegg(), serverUtlegg())), "u1");
    const sedel = pushPayloads.find((s) => s.clientUuid === "sheet-1")!;
    expect((sedel.tillegg as Array<Record<string, unknown>>)[0]).toMatchObject(KORT);
    expect((sedel.utlegg as Array<Record<string, unknown>>)[0]).toMatchObject(KORT);
  });

  it("B: ny server ekko-er feltene → lokale rader får serverens verdier", async () => {
    seed();
    const ny = { byggeplassId: "b-ny", externalCostObjectId: "eco-ny" };
    await syncTimer(lagKlient(pullSvar(serverTillegg(ny), serverUtlegg(ny))), "u1");
    expect(lokalTillegg()).toMatchObject(ny);
    expect(lokalUtlegg()).toMatchObject(ny);
  });

  it("C: gammel server utelater feltene → lokale verdier beholdes, ingen krasj", async () => {
    seed();
    const tl = serverTillegg();
    const ut = serverUtlegg();
    for (const r of [tl, ut] as Array<Record<string, unknown>>) {
      delete r.byggeplassId;
      delete r.externalCostObjectId;
    }
    await syncTimer(lagKlient(pullSvar(tl, ut)), "u1");
    expect(lokalTillegg()).toMatchObject(KORT);
    expect(lokalUtlegg()).toMatchObject(KORT);
  });

  it("D: ny server sier null → lokale felt nulles (arv)", async () => {
    seed();
    const tomt = { byggeplassId: null, externalCostObjectId: null };
    await syncTimer(lagKlient(pullSvar(serverTillegg(tomt), serverUtlegg(tomt))), "u1");
    expect(lokalTillegg()).toMatchObject(tomt);
    expect(lokalUtlegg()).toMatchObject(tomt);
  });
});
