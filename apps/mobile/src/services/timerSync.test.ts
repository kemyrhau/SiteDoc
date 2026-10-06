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
import { syncTimer, bekreftConflict } from "./timerSync";

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
  // V19 (A-7, V19.7b): hode-feltene pull-vakten (B-3b) leser.
  konfliktVentendeSiden: string | null;
  antallForslag: number;
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
    konfliktVentendeSiden: null,
    antallForslag: 0,
    timer: [],
    tillegg: [],
    maskiner: [],
    utlegg: [],
    ...over,
  };
}

/** En conflict-ResultatRad fra syncBatch (push-svaret mobilen leser i anvendSvar). */
type PushResultat = {
  clientUuid: string;
  resultat: "ok" | "conflict" | "avvist" | "feilet";
  aarsak?: string;
  serverData?: {
    id: string;
    clientUuid?: string;
    status: string;
    lederKommentar: string | null;
    attestertVed: string | null;
    updatedAt: string;
  };
  feilmelding?: string;
};

/** tRPC-klient-stubb: syncBatch returnerer oppgitte resultater, pull det oppgitte svaret. */
function lagKlient(
  pullSvar: {
    serverTid: string;
    sedler: ServerSedel[];
    levendeSedler: Array<{ id: string; clientUuid?: string }>;
    slettevindu: { fraDato: string; tilDato: string | null };
  },
  pushResultater: PushResultat[] = [],
) {
  return {
    timer: {
      dagsseddel: {
        syncBatch: { mutate: async () => ({ resultater: pushResultater }) },
        hentEndringerSiden: { query: async () => pullSvar },
      },
    },
  } as unknown as Parameters<typeof syncTimer>[0];
}

/** Pull-svar uten noe å slette/pulle — for rene PUSH-tester (fraDato i fremtiden). */
const tomtPull = {
  serverTid: "2027-01-01T00:00:00.000Z",
  sedler: [] as ServerSedel[],
  levendeSedler: [] as Array<{ id: string; clientUuid?: string }>,
  slettevindu: { fraDato: "2027-01-01", tilDato: null },
};

function seedSedel(over: {
  id: string;
  dato: string;
  status?: "draft" | "sent" | "returned" | "accepted";
  syncStatus?: "pending" | "synced" | "conflict" | "avvist";
  lederKommentar?: string | null;
  konfliktAarsak?: string | null;
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
      konfliktAarsak: over.konfliktAarsak ?? null,
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

describe("bekreftConflict — kvitterer ut en LØST konflikt (U-BEKREFT steg 2)", () => {
  it("conflict → synced, feilmelding nulles (dødkoden vekkes med dekning)", () => {
    // Sedel i conflict med en feilmelding fra sync-forsøket.
    seedSedel({ id: "bc-1", dato: "2026-09-20", status: "returned", syncStatus: "conflict" });
    db()
      .update(dagsseddelLocal)
      .set({ feilmelding: "server har en innsendt versjon" })
      .where(eq(dagsseddelLocal.id, "bc-1"))
      .run();

    bekreftConflict("bc-1");

    const sedel = sedelFor("bc-1");
    expect(sedel.syncStatus).toBe("synced");
    expect(sedel.feilmelding).toBeNull();
  });

  it("rører ikke andre sedler", () => {
    seedSedel({ id: "bc-2", dato: "2026-09-20", status: "returned", syncStatus: "conflict" });
    seedSedel({ id: "bc-3", dato: "2026-09-21", status: "accepted", syncStatus: "conflict" });

    bekreftConflict("bc-2");

    expect(sedelFor("bc-2").syncStatus).toBe("synced");
    expect(sedelFor("bc-3").syncStatus).toBe("conflict");
  });
});

describe("V19-B — overlapp PC ↔ mobil: aarsak-branch (push) + V19.7b-slipp (pull)", () => {
  it("🔴 test 6 (B-1, A-1a): aarsak='overlapp' + ulik identitet → omnøkle, syncStatus=conflict (IKKE pending), konflikt_aarsak='overlapp', rader urørt", async () => {
    // PC har dagen (server-6). Telefonen pushet sin egen (local-6) → S2 → P2002 →
    // conflict/overlapp med serverens identitet. Mobilen skal nøkle om OG sette
    // conflict (ikke pending/merge) → ingen re-push av rader.
    seedSedel({ id: "local-6", dato: "2026-09-20", status: "draft", syncStatus: "pending" });
    seedTimerRad("r6a", "local-6", 7.5);
    seedTimerRad("r6b", "local-6", 0.5);

    const klient = lagKlient(tomtPull, [
      {
        clientUuid: "local-6",
        resultat: "conflict",
        aarsak: "overlapp",
        serverData: {
          id: "server-6",
          clientUuid: "server-6",
          status: "draft",
          lederKommentar: null,
          attestertVed: null,
          updatedAt: "2026-09-20T12:00:00.000Z",
        },
      },
    ]);

    const res = await syncTimer(klient, "u1");

    // Omnøklet til serverens identitet; rader fulgte med (urørt).
    expect(timerRaderFor("local-6")).toHaveLength(0);
    expect(timerRaderFor("server-6")).toHaveLength(2);
    const s = sedelFor("server-6");
    expect(s.syncStatus).toBe("conflict");
    expect(s.konfliktAarsak).toBe("overlapp");
    // Talt som konflikt, ALDRI merge.
    expect(res.push.conflict).toBe(1);
    expect(res.push.merged).toBe(0);
  });

  it("test 6b (dato_kollisjon): ulik identitet uten overlapp → merge som i dag (pending), IKKE conflict", async () => {
    seedSedel({ id: "local-6b", dato: "2026-09-20", status: "draft", syncStatus: "pending" });
    seedTimerRad("r6b1", "local-6b", 4.0);

    const klient = lagKlient(tomtPull, [
      {
        clientUuid: "local-6b",
        resultat: "conflict",
        aarsak: "dato_kollisjon",
        serverData: {
          id: "server-6b",
          clientUuid: "server-6b",
          status: "draft",
          lederKommentar: null,
          attestertVed: null,
          updatedAt: "2026-09-20T12:00:00.000Z",
        },
      },
    ]);

    const res = await syncTimer(klient, "u1");

    expect(timerRaderFor("server-6b")).toHaveLength(1);
    const s = sedelFor("server-6b");
    expect(s.syncStatus).toBe("pending"); // additiv re-push neste tick
    expect(s.konfliktAarsak).toBeNull();
    expect(res.push.merged).toBe(1);
    expect(res.push.conflict).toBe(0);
  });

  it("🔴 test 8 (A-2): ukjent aarsak → behandles som 'laast' (conflict, IKKE merge), rader urørt", async () => {
    seedSedel({ id: "local-8", dato: "2026-09-20", status: "accepted", syncStatus: "pending" });
    seedTimerRad("r8", "local-8", 6.0);

    const klient = lagKlient(tomtPull, [
      {
        clientUuid: "local-8",
        resultat: "conflict",
        aarsak: "noe_helt_nytt", // ukjent verdi fra en fremtidig server
        serverData: {
          id: "local-8",
          clientUuid: "local-8", // samme identitet
          status: "accepted",
          lederKommentar: null,
          attestertVed: null,
          updatedAt: "2026-09-20T12:00:00.000Z",
        },
      },
    ]);

    const res = await syncTimer(klient, "u1");

    expect(timerRaderFor("local-8")).toHaveLength(1);
    const s = sedelFor("local-8");
    expect(s.syncStatus).toBe("conflict");
    expect(s.konfliktAarsak).toBe("laast");
    expect(res.push.merged).toBe(0);
    expect(res.push.conflict).toBe(1);
  });

  it("🔴 test 12 (A-1b/mobildelen): aarsak='overlapp' med LIK identitet → conflict, INGEN omnøkling/loop, rader urørt", async () => {
    // Andre push (sedelen er alt nøklet) eller eldre-app-steg: overlapp med lik
    // clientUuid. Faller i den vanlige conflict-grenen — ingen re-push av rader.
    seedSedel({ id: "sheet-12", dato: "2026-09-20", status: "draft", syncStatus: "pending" });
    seedTimerRad("r12", "sheet-12", 8.0);

    const klient = lagKlient(tomtPull, [
      {
        clientUuid: "sheet-12",
        resultat: "conflict",
        aarsak: "overlapp",
        serverData: {
          id: "sheet-12",
          clientUuid: "sheet-12",
          status: "draft",
          lederKommentar: null,
          attestertVed: null,
          updatedAt: "2026-09-20T12:00:00.000Z",
        },
      },
    ]);

    await syncTimer(klient, "u1");

    expect(timerRaderFor("sheet-12")).toHaveLength(1);
    const s = sedelFor("sheet-12");
    expect(s.syncStatus).toBe("conflict");
    expect(s.konfliktAarsak).toBe("overlapp");
  });

  it("🔴 test 10 (M14 + M8): overlapp-conflict, pull leverer sedelen under ANNEN id med forslag fortsatt på server → fortsatt conflict, rader urørt", async () => {
    // Lokal overlapp-conflict (local-10) med rader kun lokalt. Pull leverer server-
    // sedelen (server-10) for samme dato, konfliktVentendeSiden SATT + antallForslag>0
    // (valget er IKKE tatt). M2 nøkler om (ufarlig, M14); M8 beskytter radene.
    seedSedel({
      id: "local-10",
      dato: "2026-09-20",
      status: "draft",
      syncStatus: "conflict",
      konfliktAarsak: "overlapp",
    });
    seedTimerRad("r10a", "local-10", 7.5);
    seedTimerRad("r10b", "local-10", 0.5);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [
        serverSedel({
          id: "server-10",
          dato: "2026-09-20",
          status: "draft",
          konfliktVentendeSiden: "2026-09-20T12:00:00.000Z",
          antallForslag: 1,
          timer: [],
        }),
      ],
      levendeSedler: [{ id: "server-10", clientUuid: "server-10" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    // Omnøklet til server-identiteten; radene fulgte med og er urørt.
    expect(timerRaderFor("local-10")).toHaveLength(0);
    expect(timerRaderFor("server-10")).toHaveLength(2);
    const s = sedelFor("server-10");
    expect(s.syncStatus).toBe("conflict");
    expect(s.konfliktAarsak).toBe("overlapp");
  });

  it("🔴 test 11 (V19.7b): valget tatt på PC (konfliktVentendeSiden=null ∧ antallForslag=0) → synced, rader erstattes av serverens forsonede sett", async () => {
    seedSedel({
      id: "sheet-11",
      dato: "2026-09-20",
      status: "draft",
      syncStatus: "conflict",
      konfliktAarsak: "overlapp",
    });
    seedTimerRad("r11a", "sheet-11", 7.5);
    seedTimerRad("r11b", "sheet-11", 0.5);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [
        serverSedel({
          id: "sheet-11",
          dato: "2026-09-20",
          status: "draft",
          konfliktVentendeSiden: null,
          antallForslag: 0,
          timer: [
            {
              id: "forsonet-11",
              projectId: "p1",
              lonnsartId: "l1",
              aktivitetId: "a1",
              externalCostObjectId: null,
              timer: 8.0,
              fraTid: "07:00",
              tilTid: "15:30",
              beskrivelse: null,
              byggeplassId: null,
              pauseMin: 0,
            },
          ],
        }),
      ],
      levendeSedler: [{ id: "sheet-11", clientUuid: "sheet-11" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    const rader = timerRaderFor("sheet-11");
    expect(rader).toHaveLength(1);
    expect(rader[0].id).toBe("forsonet-11");
    const s = sedelFor("sheet-11");
    expect(s.syncStatus).toBe("synced");
    expect(s.konfliktAarsak).toBeNull();
  });

  it("🔴 test 11b (V19.7b-vakt): en 'laast'-konflikt slippes ALDRI av samme pull-regel (M8 består)", async () => {
    // Samme serversvar som slipper en overlapp (konfliktVentendeSiden=null,
    // antallForslag=0), men årsaken er 'laast' → M8 skal bestå: rader urørt,
    // fortsatt conflict. Hindrer at vakten lekker til feil årsak.
    seedSedel({
      id: "sheet-11b",
      dato: "2026-09-20",
      status: "accepted",
      syncStatus: "conflict",
      konfliktAarsak: "laast",
    });
    seedTimerRad("r11b1", "sheet-11b", 7.5);
    seedTimerRad("r11b2", "sheet-11b", 1.0);

    const klient = lagKlient({
      serverTid: "2026-09-21T00:00:00.000Z",
      sedler: [
        serverSedel({
          id: "sheet-11b",
          dato: "2026-09-20",
          status: "accepted",
          konfliktVentendeSiden: null,
          antallForslag: 0,
          timer: [
            {
              id: "server-11b",
              projectId: "p1",
              lonnsartId: "l1",
              aktivitetId: "a1",
              externalCostObjectId: null,
              timer: 9.0,
              fraTid: null,
              tilTid: null,
              beskrivelse: null,
              byggeplassId: null,
              pauseMin: 0,
            },
          ],
        }),
      ],
      levendeSedler: [{ id: "sheet-11b", clientUuid: "sheet-11b" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    // M8 består: lokale rader urørt, fortsatt conflict (serverens rad IKKE innsatt).
    const rader = timerRaderFor("sheet-11b");
    expect(rader).toHaveLength(2);
    expect(rader.some((r) => r.id === "server-11b")).toBe(false);
    const s = sedelFor("sheet-11b");
    expect(s.syncStatus).toBe("conflict");
    expect(s.konfliktAarsak).toBe("laast");
  });
});

describe("FUNN 2026-10-05 — et hengende nettkall låser ikke synken (timeout)", () => {
  // Klient der ETT kall aldri settler (speiler 22:17: server committet, svaret kom
  // aldri tilbake). Uten timeout henger syncTimer for alltid → testen tidsavbrytes
  // (vitest 5s) = RØD. Med timeout settler syncTimer og markerer transient feil.
  function klientMedHengendePush() {
    return {
      timer: {
        dagsseddel: {
          syncBatch: { mutate: () => new Promise(() => {}) }, // henger
          hentEndringerSiden: {
            query: async () => ({
              serverTid: "2026-10-05T00:00:00.000Z",
              sedler: [],
              levendeSedler: [],
              slettevindu: { fraDato: "2027-01-01", tilDato: null },
            }),
          },
        },
      },
    } as unknown as Parameters<typeof syncTimer>[0];
  }

  function klientMedHengendePull() {
    return {
      timer: {
        dagsseddel: {
          syncBatch: { mutate: async () => ({ resultater: [] }) },
          hentEndringerSiden: { query: () => new Promise(() => {}) }, // henger
        },
      },
    } as unknown as Parameters<typeof syncTimer>[0];
  }

  it("🔴 PUSH henger → syncTimer SETTLER innen tidsgrensen (ikke evig), sedelen beholdes pending med feilmelding", async () => {
    seedSedel({ id: "hang-1", dato: "2026-10-05", status: "draft", syncStatus: "pending" });
    seedTimerRad("rh1", "hang-1", 7.5);

    const start = Date.now();
    const res = await syncTimer(klientMedHengendePush(), "u1", 50);
    const brukt = Date.now() - start;

    // Settlet raskt (ikke hengt) — langt under vitest-timeouten.
    expect(brukt).toBeLessThan(2000);
    // Transient: sedelen BEHOLDES pending (push er idempotent → retry neste tick).
    const s = sedelFor("hang-1");
    expect(s.syncStatus).toBe("pending");
    expect(timerRaderFor("hang-1")).toHaveLength(1);
    // Feilmeldingen er satt (synliggjøres i pending-banneret, item 3) = timeout-teksten.
    expect(s.feilmelding).toBe("timer.sync.tidsavbrudd");
    expect(res.push.feilet).toBe(1);
  });

  it("🔴 PULL henger → syncTimer SETTLER innen tidsgrensen, feil rapporteres", async () => {
    // Ingen pending → push hoppes over, pull-kallet henger.
    seedSedel({ id: "hang-2", dato: "2026-10-05", status: "accepted", syncStatus: "synced" });

    const start = Date.now();
    const res = await syncTimer(klientMedHengendePull(), "u1", 50);
    const brukt = Date.now() - start;

    expect(brukt).toBeLessThan(2000);
    expect(res.feil).toBe("timer.sync.tidsavbrudd");
  });
});
