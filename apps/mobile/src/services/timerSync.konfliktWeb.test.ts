import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Plan A (Kenneth 2026-11-13) — overlapp-konflikt løst på web: telefonen beholder linjene som
 * aldri nådde serveren. Ekte `syncTimer` mot ekte SQLite (sql.js), samme harness som
 * `timerSync-tillegg-utlegg-kort.test.ts`.
 *
 * Før fiksen slettet pullen alle lokale tillegg/utlegg/maskiner når konflikten ble sluppet
 * (`overlappLostPaaPc`) og la bare inn serverens — de usendte forsvant stille.
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

const {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetUtleggLocal,
  sheetMachineLocal,
  slettedeRaderLocal,
  vareforbrukLocal,
} = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

type ServerTimer = {
  id: string;
  projectId: string;
  fraTid: string;
  tilTid: string;
};

function serverTimer(t: ServerTimer) {
  return {
    lonnsartId: "l1",
    aktivitetId: "a1",
    externalCostObjectId: null,
    timer: 4,
    beskrivelse: null,
    byggeplassId: null,
    pauseMin: 0,
    updatedAt: "2026-07-01T20:00:00.000Z",
    ...t,
  };
}

function pullSvar(
  over: {
    timer?: ServerTimer[];
    tillegg?: Array<Record<string, unknown>>;
    maskiner?: Array<Record<string, unknown>>;
    utlegg?: Array<Record<string, unknown>>;
    konfliktVentendeSiden?: string | null;
    antallForslag?: number;
  } = {},
) {
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
        byggeplassId: null,
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
        konfliktVentendeSiden: over.konfliktVentendeSiden === undefined ? null : over.konfliktVentendeSiden,
        antallForslag: over.antallForslag ?? 0,
        timer: (over.timer ?? [{ id: "s-1", projectId: "p1", fraTid: "07:00", tilTid: "15:00" }]).map(serverTimer),
        tillegg: over.tillegg ?? [],
        maskiner: over.maskiner ?? [],
        utlegg: over.utlegg ?? [],
      },
    ],
  };
}

const pushPayloads: Array<Record<string, unknown>> = [];
/** Kjøres inne i push-kallet (simulerer en linje skrevet mens pushen er i luften). */
let underPush: (() => void) | null = null;

function lagKlient(pull: ReturnType<typeof pullSvar>) {
  return {
    timer: {
      dagsseddel: {
        syncBatch: {
          mutate: async (input: { sedler: Array<Record<string, unknown>> }) => {
            pushPayloads.push(...input.sedler);
            underPush?.();
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

/** Sedel i overlapp-konflikt, med én telefonrad 07:00–11:00 på p1. */
function seedKonflikt(aarsak: "overlapp" | "laast" = "overlapp") {
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "sheet-1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-07-01",
      status: "draft",
      syncStatus: "conflict",
      konfliktAarsak: aarsak,
      sistSynkronisert: 500,
      sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(sheetTimerLocal)
    .values({
      id: "tf-1",
      dagsseddelId: "sheet-1",
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer: 4,
      fraTid: "07:00",
      tilTid: "11:00",
      sistEndretLokalt: 1000,
    })
    .run();
}

function tillegg(id: string, paaServer: boolean | null = null) {
  db()
    .insert(sheetTilleggLocal)
    .values({ id, dagsseddelId: "sheet-1", projectId: "p1", tilleggId: "t1", antall: 1, paaServer, sistEndretLokalt: 1000 })
    .run();
}
function utlegg(id: string, paaServer: boolean | null = null) {
  db()
    .insert(sheetUtleggLocal)
    .values({
      id,
      dagsseddelId: "sheet-1",
      projectId: "p1",
      expenseCategoryId: "k1",
      belop: 60,
      ordningVedFoering: "utlegg",
      foertVed: 1000,
      paaServer,
      sistEndretLokalt: 1000,
    })
    .run();
}
function maskin(id: string, sheetTimerId: string | null, paaServer: boolean | null = null) {
  db()
    .insert(sheetMachineLocal)
    .values({
      id,
      dagsseddelId: "sheet-1",
      sheetTimerId,
      projectId: null,
      vehicleId: "v1",
      timer: 2,
      paaServer,
      sistEndretLokalt: 1000,
    })
    .run();
}
function vare(id: string, sheetTimerId: string | null, syncStatus: "pending" | "synced" = "pending") {
  db()
    .insert(vareforbrukLocal)
    .values({
      id,
      userId: "u1",
      organizationId: "o1",
      sheetId: "sheet-1",
      projectId: "p1",
      dato: "2026-07-01",
      vareId: "vare-1",
      vareNavn: "Bærelag 0-22",
      enhet: "m3",
      antall: 3,
      sheetTimerId,
      syncStatus,
      sistEndretLokalt: 1000,
    })
    .run();
}

const alle = <T,>(t: T) => db().select().from(t as typeof sheetTilleggLocal).all();
const sedel = () => db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "sheet-1")).all()[0]!;
const maskinRad = (id: string) => db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).all()[0];
const vareRad = (id: string) => db().select().from(vareforbrukLocal).where(eq(vareforbrukLocal.id, id)).all()[0];

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
  underPush = null;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM sheet_machine_local; DELETE FROM slettede_rader_local; DELETE FROM vareforbruk_local;",
  );
});

describe("Plan A — konflikt løst på web beholder usendte linjer", () => {
  it("🔴 1: usendt tillegg, utlegg og maskin står etter pull, og sedelen er pending", async () => {
    seedKonflikt();
    tillegg("tl-u");
    utlegg("ut-u");
    maskin("m-u", "tf-1");
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(alle(sheetTilleggLocal).map((r) => r.id)).toEqual(["tl-u"]);
    expect(alle(sheetUtleggLocal).map((r) => r.id)).toEqual(["ut-u"]);
    expect(maskinRad("m-u")).toBeDefined();
    expect(sedel().syncStatus).toBe("pending");
    expect(sedel().konfliktAarsak).toBeNull();
    // Serverens timerrad har erstattet telefonens.
    expect(alle(sheetTimerLocal).map((r) => r.id)).toEqual(["s-1"]);
  });

  it("2 (negativkontroll): linje med paaServer sann som mangler i serversvaret, kommer ikke tilbake", async () => {
    seedKonflikt();
    tillegg("tl-slettet-web", true);
    utlegg("ut-slettet-web", true);
    maskin("m-slettet-web", "tf-1", true);
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(alle(sheetTilleggLocal)).toHaveLength(0);
    expect(alle(sheetUtleggLocal)).toHaveLength(0);
    expect(alle(sheetMachineLocal)).toHaveLength(0);
    expect(sedel().syncStatus).toBe("synced");
  });

  it("serverens egne linjer legges inn med paaServer sann og dobles ikke", async () => {
    seedKonflikt();
    tillegg("tl-1");
    await syncTimer(
      lagKlient(pullSvar({ tillegg: [{ id: "tl-1", projectId: "p1", tilleggId: "t1", antall: 1, kommentar: null, vedlegg: [] }] })),
      "u1",
    );
    const rader = alle(sheetTilleggLocal);
    expect(rader).toHaveLength(1);
    expect(rader[0]!.paaServer).toBe(true);
    expect(sedel().syncStatus).toBe("synced");
  });

  it("🔴 3a: maskin og ventende vare med én entydig kandidat-rad kobles til den", async () => {
    seedKonflikt();
    maskin("m-u", "tf-1");
    vare("vf-p", "tf-1");
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(maskinRad("m-u")!.sheetTimerId).toBe("s-1");
    expect(vareRad("vf-p")!.sheetTimerId).toBe("s-1");
  });

  it("🔴 3b: to kandidater → «Uten rad» (null)", async () => {
    seedKonflikt();
    maskin("m-u", "tf-1");
    vare("vf-p", "tf-1");
    await syncTimer(
      lagKlient(
        pullSvar({
          timer: [
            { id: "s-1", projectId: "p1", fraTid: "07:00", tilTid: "09:00" },
            { id: "s-2", projectId: "p1", fraTid: "09:00", tilTid: "15:00" },
          ],
        }),
      ),
      "u1",
    );
    expect(maskinRad("m-u")!.sheetTimerId).toBeNull();
    expect(vareRad("vf-p")!.sheetTimerId).toBeNull();
  });

  it("🔴 3c: ingen kandidat (annet prosjekt / ikke overlapp) → «Uten rad» (null)", async () => {
    seedKonflikt();
    maskin("m-u", "tf-1");
    vare("vf-p", "tf-1");
    await syncTimer(
      lagKlient(
        pullSvar({
          timer: [
            { id: "s-1", projectId: "p2", fraTid: "07:00", tilTid: "15:00" },
            { id: "s-2", projectId: "p1", fraTid: "12:00", tilTid: "15:00" },
          ],
        }),
      ),
      "u1",
    );
    expect(maskinRad("m-u")!.sheetTimerId).toBeNull();
    expect(vareRad("vf-p")!.sheetTimerId).toBeNull();
  });

  it("3d (negativkontroll): en sendt vare røres ikke", async () => {
    seedKonflikt();
    vare("vf-s", "tf-1", "synced");
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(vareRad("vf-s")!.sheetTimerId).toBe("tf-1");
    expect(vareRad("vf-s")!.sistEndretLokalt).toBe(1000);
  });

  it("4 (negativkontroll): en linje med levende tombstone legges ikke tilbake", async () => {
    seedKonflikt();
    tillegg("tl-u");
    db()
      .insert(slettedeRaderLocal)
      .values({ radId: "tl-u", dagsseddelId: "sheet-1", radType: "tillegg", slettetVed: 2000 })
      .run();
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(alle(sheetTilleggLocal)).toHaveLength(0);
  });

  it("5 (negativkontroll): annen konfliktårsak (laast) → uendret, linjer og timerrader står, conflict består", async () => {
    seedKonflikt("laast");
    tillegg("tl-u");
    maskin("m-u", "tf-1");
    await syncTimer(lagKlient(pullSvar()), "u1");
    expect(sedel().syncStatus).toBe("conflict");
    expect(alle(sheetTimerLocal).map((r) => r.id)).toEqual(["tf-1"]);
    expect(maskinRad("m-u")!.sheetTimerId).toBe("tf-1");
    expect(alle(sheetTilleggLocal).map((r) => r.id)).toEqual(["tl-u"]);
  });

  it("5b (negativkontroll): overlapp ikke løst ennå (forslag står) → uendret", async () => {
    seedKonflikt();
    tillegg("tl-u");
    await syncTimer(lagKlient(pullSvar({ konfliktVentendeSiden: "2026-07-01T12:00:00.000Z", antallForslag: 1 })), "u1");
    expect(sedel().syncStatus).toBe("conflict");
    expect(alle(sheetTimerLocal).map((r) => r.id)).toEqual(["tf-1"]);
    expect(alle(sheetTilleggLocal).map((r) => r.id)).toEqual(["tl-u"]);
  });
});

describe("Plan A — paaServer settes av push ok", () => {
  it("🔴 linjene payloaden bar, merkes; en linje skrevet under pushen merkes ikke", async () => {
    db()
      .insert(dagsseddelLocal)
      .values({
        id: "sheet-1",
        userId: "u1",
        organizationId: "o1",
        projectId: "p1",
        aktivitetId: "a1",
        dato: "2026-07-01",
        status: "draft",
        syncStatus: "pending",
        sistEndretLokalt: 1000,
      })
      .run();
    tillegg("tl-sendt");
    utlegg("ut-sendt");
    maskin("m-sendt", null);
    underPush = () => {
      db()
        .insert(sheetTilleggLocal)
        .values({ id: "tl-ny", dagsseddelId: "sheet-1", projectId: "p1", tilleggId: "t1", antall: 1, sistEndretLokalt: Date.now() + 60_000 })
        .run();
    };
    // Pull uten sedler: push-resultatet alene avgjør merkingen.
    const pull = { ...pullSvar(), sedler: [] };
    await syncTimer(lagKlient(pull as unknown as ReturnType<typeof pullSvar>), "u1");
    const tl = new Map(alle(sheetTilleggLocal).map((r) => [r.id, r.paaServer]));
    expect(tl.get("tl-sendt")).toBe(true);
    expect(tl.get("tl-ny")).not.toBe(true);
    expect(alle(sheetUtleggLocal)[0]!.paaServer).toBe(true);
    expect(maskinRad("m-sendt")!.paaServer).toBe(true);
  });
});
