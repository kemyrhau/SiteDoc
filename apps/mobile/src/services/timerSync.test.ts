import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Ordre timersync-conflict-vakt — pull-guarden mot datatap på conflict-sedler.
 *
 * Kjører den EKTE `syncTimer`-pull-veien mot en EKTE SQLite (sql.js/WASM), samme
 * prinsipp som `db/migreringer.test.ts`: den native `expo-sqlite`-bindingen byttes
 * med sql.js, migreringene kjører uendret, og `hentDatabase()` gir en Drizzle-
 * instans (`drizzle-orm/sql-js`) over NØYAKTIG samme database. tRPC-klienten er
 * en stubb som returnerer server-svaret pull-veien konsumerer.
 *
 * Gate-krav:
 *  1. 🔴 Passiv utløser (rød først): en conflict-sedels lokale rader skal BESTÅ
 *     gjennom pull. Uten vakten slettes de.
 *  2. 🔴 Aktiv utløser (rød først, AVVIK 1): lederens retur skal NÅ telefonen —
 *     hodet oppdateres (status → returned), radene består, syncStatus forblir
 *     conflict. Med dagens brede `continue` hoppes hele sedelen over.
 *  3. Regresjon: pending + avvist hoppes fortsatt over (ALT, hode inkludert).
 *  4. Regresjon: en synced sedel oppdateres FORTSATT fra server (vakten må ikke
 *     ha stoppet all normal pull-oppdatering).
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
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
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

/** Server-svar-form pull-veien (`hentEndringerSiden`) leser. */
type ServerSedel = {
  id: string;
  clientUuid: string;
  userId: string;
  organizationId: string;
  projectId: string | null;
  aktivitetId: string | null;
  avdelingId: string | null;
  byggeplassId: string | null;
  dato: string;
  startAt: string | null;
  endAt: string | null;
  pauseMin: number;
  sluttTidKilde: string;
  status: string;
  beskrivelse: string | null;
  lederKommentar: string | null;
  attestertVed: string | null;
  timer: Array<Record<string, unknown>>;
  tillegg: Array<Record<string, unknown>>;
  maskiner: Array<Record<string, unknown>>;
  utlegg: Array<Record<string, unknown>>;
};

function serverSedel(over: Partial<ServerSedel> & { id: string; dato: string }): ServerSedel {
  return {
    clientUuid: over.id,
    userId: "u1",
    organizationId: "o1",
    projectId: "p1",
    aktivitetId: "a1",
    avdelingId: null,
    byggeplassId: null,
    startAt: null,
    endAt: null,
    pauseMin: 0,
    sluttTidKilde: "bruker",
    status: "accepted",
    beskrivelse: null,
    lederKommentar: null,
    attestertVed: null,
    timer: [],
    tillegg: [],
    maskiner: [],
    utlegg: [],
    ...over,
  };
}

/** tRPC-klient-stubb: push er en no-op, pull returnerer det oppgitte svaret. */
function lagKlient(pullSvar: {
  serverTid: string;
  sedler: ServerSedel[];
  levendeSedler: Array<{ id: string; clientUuid?: string }>;
  slettevindu: { fraDato: string; tilDato: string | null };
}) {
  return {
    timer: {
      dagsseddel: {
        syncBatch: { mutate: async () => ({ resultater: [] }) },
        hentEndringerSiden: { query: async () => pullSvar },
      },
    },
  } as unknown as Parameters<typeof syncTimer>[0];
}

function seedSedel(over: {
  id: string;
  dato: string;
  status?: "draft" | "sent" | "returned" | "accepted";
  syncStatus?: "pending" | "synced" | "conflict" | "avvist";
  lederKommentar?: string | null;
}) {
  db()
    .insert(dagsseddelLocal)
    .values({
      id: over.id,
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: over.dato,
      status: over.status ?? "accepted",
      syncStatus: over.syncStatus ?? "conflict",
      lederKommentar: over.lederKommentar ?? null,
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
}

function seedTimerRad(id: string, dagsseddelId: string, timer: number) {
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId,
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer,
      sistEndretLokalt: 1000,
    })
    .run();
}

function timerRaderFor(dagsseddelId: string) {
  return db()
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, dagsseddelId))
    .all();
}

function sedelFor(id: string) {
  return db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, id)).all()[0];
}

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

  // Ekte migreringer mot ekte SQLite.
  kjorMigreringer();

  // Drizzle over NØYAKTIG samme database som migreringene skrev.
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_tillegg_local; DELETE FROM sheet_machine_local; DELETE FROM sheet_utlegg_local; DELETE FROM slettede_rader_local;",
  );
});

describe("syncTimer pull — conflict-vakt (datatap-ordre)", () => {
  it("🔴 PASSIV utløser: conflict-sedelens lokale rader BESTÅR gjennom pull", async () => {
    // Lokal conflict-sedel med rader som KUN finnes lokalt (server-vakten
    // returnerte før skriving). Serveren har sedelen (attestert), men ingen rader.
    seedSedel({ id: "sheet-1", dato: "2026-09-20", status: "accepted", syncStatus: "conflict" });
    seedTimerRad("row-1", "sheet-1", 7.5);
    seedTimerRad("row-2", "sheet-1", 1.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [serverSedel({ id: "sheet-1", dato: "2026-09-20", status: "accepted", timer: [] })],
      levendeSedler: [{ id: "sheet-1", clientUuid: "sheet-1" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    // Uten vakten: 0 (radene slettet). Med vakten: 2 (bevart).
    expect(timerRaderFor("sheet-1")).toHaveLength(2);
  });

  it("🔴 AKTIV utløser: lederens RETUR NÅR telefonen — status blir returned, radene BESTÅR", async () => {
    // conflict-sedel (låst accepted), rader kun lokalt. Lederen returnerer på
    // server → status "returned". Med dagens brede `continue` (rød først) hopper
    // pull over HELE sedelen → lokal status blir stående "accepted" og arbeideren
    // står fast. Med den smale conflict-grenen: hodet oppdateres (status=returned),
    // radene består, og syncStatus beholdes "conflict" (radene fortsatt beskyttet).
    seedSedel({ id: "sheet-5", dato: "2026-09-20", status: "accepted", syncStatus: "conflict" });
    seedTimerRad("row-r1", "sheet-5", 7.5);
    seedTimerRad("row-r2", "sheet-5", 1.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [
        serverSedel({
          id: "sheet-5",
          dato: "2026-09-20",
          status: "returned",
          lederKommentar: "Sjekk pausene",
          timer: [],
        }),
      ],
      levendeSedler: [{ id: "sheet-5", clientUuid: "sheet-5" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    // Radene består (eneste eksemplar).
    expect(timerRaderFor("sheet-5")).toHaveLength(2);
    // Lederens retur nådde fram: status oppdatert, kommentar med, men fortsatt
    // beskyttet (syncStatus = conflict).
    const s = sedelFor("sheet-5");
    expect(s.status).toBe("returned");
    expect(s.lederKommentar).toBe("Sjekk pausene");
    expect(s.syncStatus).toBe("conflict");
  });

  it("REGRESJON: pending-sedelens rader hoppes fortsatt over", async () => {
    seedSedel({ id: "sheet-2", dato: "2026-09-20", status: "draft", syncStatus: "pending" });
    seedTimerRad("row-p", "sheet-2", 4.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [serverSedel({ id: "sheet-2", dato: "2026-09-20", status: "draft", timer: [] })],
      levendeSedler: [{ id: "sheet-2", clientUuid: "sheet-2" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    expect(timerRaderFor("sheet-2")).toHaveLength(1);
  });

  it("REGRESJON: avvist-sedelens rader hoppes fortsatt over", async () => {
    seedSedel({ id: "sheet-3", dato: "2026-09-20", status: "sent", syncStatus: "avvist" });
    seedTimerRad("row-a", "sheet-3", 3.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [serverSedel({ id: "sheet-3", dato: "2026-09-20", status: "sent", timer: [] })],
      levendeSedler: [{ id: "sheet-3", clientUuid: "sheet-3" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    expect(timerRaderFor("sheet-3")).toHaveLength(1);
  });

  it("REGRESJON: en synced sedel oppdateres FORTSATT fra server (vakten over-hopper ikke)", async () => {
    seedSedel({
      id: "sheet-4",
      dato: "2026-09-20",
      status: "accepted",
      syncStatus: "synced",
      lederKommentar: "gammel",
    });
    seedTimerRad("row-old", "sheet-4", 5.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [
        serverSedel({
          id: "sheet-4",
          dato: "2026-09-20",
          status: "accepted",
          lederKommentar: "ny fra server",
          timer: [
            {
              id: "row-new",
              projectId: "p1",
              lonnsartId: "l1",
              aktivitetId: "a1",
              externalCostObjectId: null,
              timer: 6.0,
              fraTid: null,
              tilTid: null,
              beskrivelse: null,
              byggeplassId: null,
              pauseMin: 0,
            },
          ],
        }),
      ],
      levendeSedler: [{ id: "sheet-4", clientUuid: "sheet-4" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    // Gammel rad erstattet av server-raden.
    const rader = timerRaderFor("sheet-4");
    expect(rader).toHaveLength(1);
    expect(rader[0].id).toBe("row-new");

    // Metadata oppdatert fra server.
    const sedel = db()
      .select()
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, "sheet-4"))
      .all()[0];
    expect(sedel.lederKommentar).toBe("ny fra server");
    expect(sedel.syncStatus).toBe("synced");
  });
});
