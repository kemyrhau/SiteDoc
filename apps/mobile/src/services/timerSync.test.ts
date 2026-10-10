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
import {
  anvendForsonetLokalt,
  byggForsonOverlappKall,
} from "../lib/forsoningSpeil";
import type { TidsromRad } from "../lib/dagskortSammenligning";
import type { ForsonRad as DeltForsonRad } from "@sitedoc/shared";

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
        // V19.9 (RETUR 1, vilkår 3): speilingen kaller hentMedId ved ok+hoppetOver.
        // Default = tomt kort (ingen hoppede rader i pull-tester → aldri kalt).
        hentMedId: { query: async () => ({ timer: [] as Array<Record<string, unknown>> }) },
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

function seedTimerRad(
  id: string,
  dagsseddelId: string,
  timer: number,
  over: { serverVersjon?: string | null; sistEndretLokalt?: number } = {},
) {
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId,
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer,
      serverVersjon: over.serverVersjon ?? null,
      sistEndretLokalt: over.sistEndretLokalt ?? 1000,
    })
    .run();
}

/** Fanger syncBatch-payloaden mobilen sender + returnerer oppgitte push-resultater. */
function lagKlientFanger(
  pushResultater: PushResultat[] = [],
  pullSvar = tomtPull,
  // V19.9 (RETUR 1, vilkår 3): hentMedId-handler for speilingen av hoppede rader.
  // Default = tomt kort. Kast for å teste feil-/timeout-grenen.
  hentMedIdHandler: () => Promise<{ timer: Array<Record<string, unknown>> }> = async () => ({
    timer: [],
  }),
) {
  const fanget: { input: unknown } = { input: null };
  const klient = {
    timer: {
      dagsseddel: {
        syncBatch: {
          mutate: async (input: unknown) => {
            fanget.input = input;
            return { resultater: pushResultater };
          },
        },
        hentEndringerSiden: { query: async () => pullSvar },
        hentMedId: { query: hentMedIdHandler },
      },
    },
  } as unknown as Parameters<typeof syncTimer>[0];
  return { klient, fanget };
}

/** Les timer-payloaden for den første sedelen i en fanget syncBatch-input. */
function pushTimer(fanget: { input: unknown }) {
  const inp = fanget.input as {
    sedler: Array<{
      timer: Array<{ id: string; serverVersjon: string | null; endretLokalt: boolean }>;
      slettedeIder?: { timerVersjoner?: Array<{ id: string; serverVersjon: string | null }> };
    }>;
  };
  return inp.sedler[0];
}

function timerRad(id: string) {
  return db()
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, id))
    .all()[0];
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

describe("V19.9-B — versjonssjekk pr. rad (§ 9.6 test 10 + 11)", () => {
  // § 9.6 test 10 (a): pull SKAL sette server_versjon på alle hentede rader.
  it("🔴 test 10a: pull setter server_versjon = updatedAt på hentede rader (feiler ved NULL)", async () => {
    const klient = lagKlient({
      serverTid: "2026-10-06T10:00:00.000Z",
      sedler: [
        serverSedel({
          id: "sheet-v1",
          dato: "2026-10-05",
          status: "draft",
          timer: [
            {
              id: "rad-v1",
              projectId: "p1",
              lonnsartId: "l1",
              aktivitetId: "a1",
              timer: 7.5,
              updatedAt: "2026-10-06T09:00:00.000Z",
            },
          ],
        }),
      ],
      levendeSedler: [{ id: "sheet-v1", clientUuid: "sheet-v1" }],
      slettevindu: { fraDato: "2026-01-01", tilDato: null },
    });

    await syncTimer(klient, "u1");

    expect(timerRad("rad-v1")?.serverVersjon).toBe("2026-10-06T09:00:00.000Z");
  });

  // § 9.6 test 10 (b): push SENDER serverVersjon + endretLokalt korrekt for
  // (a) hentet-og-urørt, (b) hentet-og-redigert, (c) født lokalt.
  it("🔴 test 10b: push sender serverVersjon + endretLokalt for urørt/redigert/født-lokalt", async () => {
    // sedel.sistSynkronisert = 1000 (via seedSedel). endretLokalt = rad.sistEndretLokalt !== 1000.
    seedSedel({ id: "sheet-v2", dato: "2026-10-05", status: "draft", syncStatus: "pending" });
    // (a) hentet-og-urørt: versjon satt, stempel == sist synket.
    seedTimerRad("rad-urort", "sheet-v2", 7.5, {
      serverVersjon: "2026-10-06T09:00:00.000Z",
      sistEndretLokalt: 1000,
    });
    // (b) hentet-og-redigert: versjon satt, stempel endret etter synk.
    seedTimerRad("rad-redigert", "sheet-v2", 3.0, {
      serverVersjon: "2026-10-06T09:00:00.000Z",
      sistEndretLokalt: 2000,
    });
    // (c) født lokalt: ingen versjon, stempel != sist synket.
    seedTimerRad("rad-nyfodt", "sheet-v2", 1.0, {
      serverVersjon: null,
      sistEndretLokalt: 2000,
    });

    const { klient, fanget } = lagKlientFanger([]);
    await syncTimer(klient, "u1");

    const rader = pushTimer(fanget).timer;
    const etterId = new Map(rader.map((r) => [r.id, r]));
    expect(etterId.get("rad-urort")).toMatchObject({
      serverVersjon: "2026-10-06T09:00:00.000Z",
      endretLokalt: false,
    });
    expect(etterId.get("rad-redigert")).toMatchObject({
      serverVersjon: "2026-10-06T09:00:00.000Z",
      endretLokalt: true,
    });
    expect(etterId.get("rad-nyfodt")).toMatchObject({
      serverVersjon: null,
      endretLokalt: true,
    });
  });

  // § 9.6 test 10 (c): push-`ok` skriver server_versjon for `rader`, IKKE for
  // `hoppetOver`, og restempler kun rader med sistEndretLokalt <= byggetVed.
  it("🔴 test 10c: push-ok skriver versjon for skrevne rader, ikke hoppetOver, restempler kun <= byggetVed", async () => {
    seedSedel({ id: "sheet-v3", dato: "2026-10-05", status: "draft", syncStatus: "pending" });
    // skrevet, stempel i fortiden → skal restemples.
    seedTimerRad("rad-skrevet", "sheet-v3", 7.5, {
      serverVersjon: "V_gammel",
      sistEndretLokalt: 1000,
    });
    // hoppet over → versjon + stempel skal stå urørt (serverraden er nyere).
    seedTimerRad("rad-hoppet", "sheet-v3", 3.0, {
      serverVersjon: "V_hoppet",
      sistEndretLokalt: 1000,
    });
    // skrevet, men redigert ETTER byggetVed (stempel i framtiden) → versjon skrives,
    // men IKKE restemplet (brukerens nyere endring må pushes på nytt).
    const framtid = 4102444800000; // 2100-01-01
    seedTimerRad("rad-midpush", "sheet-v3", 2.0, {
      serverVersjon: "V_mid",
      sistEndretLokalt: framtid,
    });

    const { klient } = lagKlientFanger(
      [
        {
          clientUuid: "sheet-v3",
          resultat: "ok",
          serverData: {
            id: "sheet-v3",
            status: "draft",
            lederKommentar: null,
            attestertVed: null,
            updatedAt: "2026-10-06T10:00:00.000Z",
            rader: [
              { id: "rad-skrevet", updatedAt: "V_ny_skrevet" },
              { id: "rad-midpush", updatedAt: "V_ny_mid" },
            ],
            hoppetOver: ["rad-hoppet"],
          },
        } as unknown as PushResultat,
      ],
      tomtPull,
      // V19.9 (RETUR 1, vilkår 3): hentMedId leverer serverens nyere rad-hoppet.
      async () => ({
        timer: [
          {
            id: "rad-hoppet",
            projectId: "p1",
            lonnsartId: "l1",
            aktivitetId: "a1",
            timer: 9.0,
            fraTid: null,
            tilTid: null,
            beskrivelse: "serverinnhold",
            pauseMin: 0,
            updatedAt: "V_server_hoppet",
          },
        ],
      }),
    );
    await syncTimer(klient, "u1");

    // Skrevet rad: versjon oppdatert + restemplet (stempel != 1000 lenger).
    expect(timerRad("rad-skrevet")?.serverVersjon).toBe("V_ny_skrevet");
    expect(timerRad("rad-skrevet")?.sistEndretLokalt).not.toBe(1000);
    // Mid-push-redigert: versjon skrevet, men stempel IKKE restemplet (> byggetVed).
    expect(timerRad("rad-midpush")?.serverVersjon).toBe("V_ny_mid");
    expect(timerRad("rad-midpush")?.sistEndretLokalt).toBe(framtid);
    // Hoppet over (RETUR 1 vilkår 3): SPEILET fra hentMedId — serverens innhold,
    // server_versjon = serverens updatedAt, sistEndretLokalt = naa (= sistSynkronisert).
    const hoppet = timerRad("rad-hoppet");
    expect(hoppet?.serverVersjon).toBe("V_server_hoppet");
    expect(hoppet?.timer).toBe(9.0);
    expect(hoppet?.beskrivelse).toBe("serverinnhold");
    expect(hoppet?.sistEndretLokalt).toBe(sedelFor("sheet-v3").sistSynkronisert);
    expect(hoppet?.sistEndretLokalt).not.toBe(1000);
  });

  // RETUR 1 vilkår 3 — henting feiler: de hoppede radene restemples til
  // sistEndretLokalt = naa (neste push → endretLokalt = false → R3), server_versjon
  // URØRT, og innholdet står (speiles på nytt ved neste ok med hoppetOver).
  it("🔴 vilkår 3b: hentMedId feiler → hoppet rad restemples, versjon urørt, innhold står", async () => {
    seedSedel({ id: "sheet-v5", dato: "2026-10-05", status: "draft", syncStatus: "pending" });
    seedTimerRad("rad-hoppet-feil", "sheet-v5", 7.5, {
      serverVersjon: "V_stale",
      sistEndretLokalt: 1000,
    });

    const { klient } = lagKlientFanger(
      [
        {
          clientUuid: "sheet-v5",
          resultat: "ok",
          serverData: {
            id: "sheet-v5",
            status: "draft",
            lederKommentar: null,
            attestertVed: null,
            updatedAt: "2026-10-06T10:00:00.000Z",
            rader: [],
            hoppetOver: ["rad-hoppet-feil"],
          },
        } as unknown as PushResultat,
      ],
      tomtPull,
      // Henting feiler (speiler timeout/nettfeil).
      async () => {
        throw new Error("hentMedId feilet");
      },
    );
    await syncTimer(klient, "u1");

    const rad = timerRad("rad-hoppet-feil");
    // Versjon URØRT (stale) + innhold står (7.5) — speiles på nytt neste ok.
    expect(rad?.serverVersjon).toBe("V_stale");
    expect(rad?.timer).toBe(7.5);
    // Restemplet til naa = sedelens sistSynkronisert → endretLokalt = false neste push.
    expect(rad?.sistEndretLokalt).toBe(sedelFor("sheet-v5").sistSynkronisert);
    expect(rad?.sistEndretLokalt).not.toBe(1000);
  });

  // RETUR 1 vilkår 1 — byggForsonOverlappKall BÆRER slettinger: valg «lokal» (appen)
  // på en slettet_telefon-slot → slettinger = [sedelRadId] (ellers blir raden stående).
  it("🔴 vilkår 1: byggForsonOverlappKall gir slettinger for slettet_telefon-valg «lokal»", () => {
    const sedelRad: DeltForsonRad = {
      id: "rad-x",
      projectId: "p1",
      byggeplassId: null,
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer: 7.5,
      fraTid: "07:00",
      tilTid: "15:00",
      beskrivelse: null,
      externalCostObjectId: null,
      vehicleId: null,
    };
    // slettet_telefon-forslaget er en KOPI av serverraden (samme id) m/ grunn.
    const forslag: DeltForsonRad = { ...sedelRad, grunn: "slettet_telefon" };
    const rader: TidsromRad[] = [
      {
        nokkel: "rad-x",
        tidsrom: "07:00–15:00",
        lokal: { id: "rad-x", fraTid: "07:00", tilTid: "15:00", timer: 7.5 },
        server: { id: "rad-x", fraTid: "07:00", tilTid: "15:00", timer: 7.5 },
        valgt: "server",
        valgbar: true,
        grunn: "slettet_telefon",
      },
    ];
    // Valg «lokal» (appen = slett).
    const input = byggForsonOverlappKall(rader, { "rad-x": "lokal" }, [sedelRad], [forslag]);
    expect(input.slettinger).toEqual(["rad-x"]);
    // Valg «server» (behold PC) → ingen sletting.
    const input2 = byggForsonOverlappKall(rader, { "rad-x": "server" }, [sedelRad], [forslag]);
    expect(input2.slettinger).toEqual([]);
  });

  // RETUR 1 vilkår 2 — anvendForsonetLokalt setter server_versjon ≠ NULL + stempler.
  it("🔴 vilkår 2: anvendForsonetLokalt setter server_versjon + sistEndretLokalt === sedel.sistSynkronisert", () => {
    seedSedel({ id: "sheet-v6", dato: "2026-10-05", status: "draft", syncStatus: "conflict" });
    seedTimerRad("gammel-rad", "sheet-v6", 5.0, { serverVersjon: null, sistEndretLokalt: 1000 });

    const naa = 9_000_000;
    anvendForsonetLokalt(
      "sheet-v6",
      [
        {
          id: "forsonet-1",
          projectId: "p1",
          byggeplassId: null,
          lonnsartId: "l1",
          aktivitetId: "a1",
          externalCostObjectId: null,
          timer: 7.5,
          fraTid: "07:00",
          tilTid: "15:00",
          beskrivelse: null,
          pauseMin: 0,
          updatedAt: "2026-10-06T11:00:00.000Z",
        },
      ],
      naa,
    );

    // Gamle rader borte, serverens forsonede rad inne med versjon + stempel.
    expect(timerRad("gammel-rad")).toBeUndefined();
    const rad = timerRad("forsonet-1");
    expect(rad?.serverVersjon).toBe("2026-10-06T11:00:00.000Z");
    expect(rad?.sistEndretLokalt).toBe(naa);
    // Sedelen stemplet synket = naa → raden er «ren» ved neste push (ingen R10).
    expect(sedelFor("sheet-v6").sistSynkronisert).toBe(naa);
    expect(rad?.sistEndretLokalt).toBe(sedelFor("sheet-v6").sistSynkronisert);
  });

  // § 9.6 test 11: tombstonen BÆRER radens server_versjon (feiler ved NULL for en
  // hentet rad). Her testes push-serialiseringen: en tombstone med versjon → payloadens
  // slettedeIder.timerVersjoner; eldre tombstone uten versjon → null (S4, trygg retning).
  it("🔴 test 11: tombstone-versjon bæres i slettedeIder.timerVersjoner (hentet rad != NULL)", async () => {
    seedSedel({ id: "sheet-v4", dato: "2026-10-05", status: "draft", syncStatus: "pending" });
    db()
      .insert(schema.slettedeRaderLocal)
      .values([
        {
          radId: "slettet-hentet",
          dagsseddelId: "sheet-v4",
          radType: "timer",
          serverVersjon: "2026-10-06T09:00:00.000Z",
          slettetVed: 1500,
        },
        {
          radId: "slettet-eldre",
          dagsseddelId: "sheet-v4",
          radType: "timer",
          serverVersjon: null,
          slettetVed: 1500,
        },
      ])
      .run();

    const { klient, fanget } = lagKlientFanger([]);
    await syncTimer(klient, "u1");

    const versjoner = pushTimer(fanget).slettedeIder?.timerVersjoner ?? [];
    const etterId = new Map(versjoner.map((v) => [v.id, v.serverVersjon]));
    expect(etterId.get("slettet-hentet")).toBe("2026-10-06T09:00:00.000Z");
    expect(etterId.get("slettet-eldre")).toBe(null);
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

describe("FUNN 2026-10-06 — transient push-feil skriver feilmelding på ALLE sedlene i batchen", () => {
  // Klient der syncBatch kaster en transient feil (ingen httpStatus 400 →
  // erPermanentFeil=false). Da beholdes alle pending (ingen tap), og
  // feilmeldingen skal nå stå på HVER sedel i batchen — ikke bare den første.
  function klientTransientPush() {
    return {
      timer: {
        dagsseddel: {
          syncBatch: {
            mutate: async () => {
              throw new Error("Nettverksfeil");
            },
          },
          hentEndringerSiden: { query: async () => tomtPull },
        },
      },
    } as unknown as Parameters<typeof syncTimer>[0];
  }

  it("🔴 to pending sedler + transient feil → BEGGE får feilmelding", async () => {
    // Begge pending for samme bruker → samme batch (slice på 100).
    seedSedel({ id: "b1", dato: "2026-10-06", status: "draft", syncStatus: "pending" });
    seedTimerRad("rb1", "b1", 7.5);
    seedSedel({ id: "b2", dato: "2026-10-06", status: "draft", syncStatus: "pending" });
    seedTimerRad("rb2", "b2", 6);

    const res = await syncTimer(klientTransientPush(), "u1", 50);

    const s1 = sedelFor("b1");
    const s2 = sedelFor("b2");
    // Transient: ingen tap — begge beholdes pending.
    expect(s1.syncStatus).toBe("pending");
    expect(s2.syncStatus).toBe("pending");
    // Kjernen: feilmeldingen står på BEGGE. Rød før fiksen (kun batch[0]=b1 fikk den).
    expect(s1.feilmelding).toBe("Nettverksfeil");
    expect(s2.feilmelding).toBe("Nettverksfeil");
    expect(res.push.feilet).toBe(2);
  });
});

describe("syncTimer — firma følger «Mitt firma» (Kenneth-vedtak 2026-10-09)", () => {
  // Fanger både PUSH- (syncBatch) og PULL-input (hentEndringerSiden) så vi kan bevise
  // at organizationId propagerer riktig vei: PUSH = sedelens egen org, PULL = valgt firma.
  function lagFanger() {
    const fanget: { push: unknown; pull: unknown } = { push: null, pull: null };
    const klient = {
      timer: {
        dagsseddel: {
          syncBatch: {
            mutate: async (input: unknown) => {
              fanget.push = input;
              return { resultater: [] };
            },
          },
          hentEndringerSiden: {
            query: async (input: unknown) => {
              fanget.pull = input;
              return tomtPull;
            },
          },
          hentMedId: { query: async () => ({ timer: [] }) },
        },
      },
    } as unknown as Parameters<typeof syncTimer>[0];
    return { klient, fanget };
  }

  it("PUSH sender sedelens egen organizationId; PULL sender valgt firma", async () => {
    seedSedel({ id: "fs-1", dato: "2026-09-20", status: "draft", syncStatus: "pending" });
    seedTimerRad("fr-1", "fs-1", 7.5);

    const { klient, fanget } = lagFanger();
    await syncTimer(klient, "u1", undefined, "valgt-firma-x");

    // seedSedel setter organizationId "o1" → PUSH må bære den (ikke det valgte firmaet,
    // som kan avvike ved firma-bytte; sedelen tilhører firmaet den ble ført på).
    expect((fanget.push as { organizationId?: string }).organizationId).toBe("o1");
    // PULL henter endringer for det valgte firmaet.
    expect((fanget.pull as { organizationId?: string }).organizationId).toBe("valgt-firma-x");
  });

  it("uten firmaId (eldre kall) sendes organizationId=undefined på PULL (server-fallback)", async () => {
    const { klient, fanget } = lagFanger();
    await syncTimer(klient, "u1");
    expect((fanget.pull as { organizationId?: string }).organizationId).toBeUndefined();
  });
});
