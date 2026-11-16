import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * F1 (2026-11-13) — utlegg og vedlegg mistes når sedelen får ny id.
 *
 * `forsonSedelIdentitet` (timerSync.ts) re-nøkler sedelens lokale rader fra gammel
 * til ny sedel-id. Før F1 manglet `sheet_utlegg_local` (og arbeidsdagens peker):
 * utlegget ble stående på en id uten hode og ble aldri pushet.
 *
 * Samme oppsett som timerSync.test.ts: EKTE migreringer mot EKTE SQLite (sql.js),
 * EKTE `syncTimer`, stubbet tRPC-klient.
 *
 *  1. 🔴 Vakt (rød før fiksen): utlegg + vedlegg på gammel id er flyttet etter
 *     forsoning — både når målet er nytt (re-nøkling) og når det finnes (merge) —
 *     og utlegget er med i neste push.
 *  2. 🔴 Strukturvakt: hver lokal kolonne som bærer en sedel-id er med i
 *     forsoningen. Negativkontroll: en ny tabell med `dagsseddel_id` som
 *     forsoningen ikke kjenner, SKAL fanges.
 *  3. Redning av foreldreløse utlegg fra før F1 — kun ved entydig kobling;
 *     negativkontroller: uten kobling / tvetydig kobling røres ingenting.
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
import { syncTimer, reddForeldreloseUtlegg } from "./timerSync";
import type { LokalDb } from "./dagsforslagInput";

const {
  dagsseddelLocal,
  sheetUtleggLocal,
  sheetUtleggVedleggLocal,
  sheetTilleggLocal,
  sheetTilleggVedleggLocal,
  arbeidsdagLocal,
  opplastingsKo,
} = schema;

function db(): LokalDb {
  return holder.drizzle as unknown as LokalDb;
}

function sql(q: string): Array<Record<string, unknown>> {
  const res = holder.raw.exec(q);
  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

const tomtPull = {
  serverTid: "2027-01-01T00:00:00.000Z",
  sedler: [],
  levendeSedler: [],
  slettevindu: { fraDato: "2027-01-01", tilDato: null },
};

/** Stubb: syncBatch svarer `dato_kollisjon` fra `fraId` til `tilId`, fanger payloaden. */
function lagKlient(svar: Array<{ fraId: string; tilId: string }>) {
  const fanget: { input: unknown[] } = { input: [] };
  const klient = {
    timer: {
      dagsseddel: {
        syncBatch: {
          mutate: async (input: unknown) => {
            fanget.input.push(input);
            return {
              resultater: svar.map((s) => ({
                clientUuid: s.fraId,
                resultat: "conflict",
                aarsak: "dato_kollisjon",
                serverData: {
                  id: s.tilId,
                  clientUuid: s.tilId,
                  status: "draft",
                  lederKommentar: null,
                  attestertVed: null,
                  updatedAt: "2026-11-13T12:00:00.000Z",
                },
              })),
            };
          },
        },
        hentEndringerSiden: { query: async () => tomtPull },
        hentMedId: { query: async () => ({ timer: [] }) },
      },
    },
  } as unknown as Parameters<typeof syncTimer>[0];
  return { klient, fanget };
}

function seedSedel(id: string, dato: string, syncStatus: "pending" | "synced" = "pending") {
  db()
    .insert(dagsseddelLocal)
    .values({
      id,
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato,
      status: "draft",
      syncStatus,
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
}

function seedUtleggMedVedlegg(utleggId: string, sedelId: string) {
  db()
    .insert(sheetUtleggLocal)
    .values({
      id: utleggId,
      dagsseddelId: sedelId,
      projectId: "p1",
      expenseCategoryId: "kat1",
      belop: 250,
      kommentar: null,
      ordningVedFoering: "utlegg",
      foertVed: 1000,
      sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(sheetUtleggVedleggLocal)
    .values({
      id: `${utleggId}-v`,
      sheetUtleggId: utleggId,
      lokalSti: "file:///kvittering.jpg",
      serverUrl: null,
      filnavn: "kvittering.jpg",
      mimeType: "image/jpeg",
      filstorrelse: 1000,
      sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(opplastingsKo)
    .values({
      id: `${utleggId}-ko`,
      sheetUtleggId: utleggId,
      objektId: utleggId,
      vedleggId: `${utleggId}-v`,
      lokalSti: "file:///kvittering.jpg",
      filnavn: "kvittering.jpg",
      mimeType: "image/jpeg",
      opprettet: 1000,
    })
    .run();
}

function seedArbeidsdag(id: string, dato: string, generertDagsseddelId: string) {
  db()
    .insert(arbeidsdagLocal)
    .values({
      id,
      userId: "u1",
      dato,
      startAt: `${dato}T07:00:00.000Z`,
      status: "avsluttet",
      generertDagsseddelId,
      sistEndretLokalt: 1000,
    })
    .run();
}

function utleggPaa(sedelId: string) {
  return db().select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.dagsseddelId, sedelId)).all();
}

/** Vedlegget henger fortsatt på utlegget, og utlegget henger på `sedelId`. */
function vedleggViaSedel(sedelId: string) {
  return sql(
    `SELECT v.id FROM sheet_utlegg_vedlegg_local v
       JOIN sheet_utlegg_local u ON u.id = v.sheet_utlegg_id
      WHERE u.dagsseddel_id = '${sedelId}'`,
  );
}

const ALLE_TABELLER = [
  "dagsseddel_local",
  "sheet_timer_local",
  "sheet_tillegg_local",
  "sheet_machine_local",
  "sheet_utlegg_local",
  "sheet_tillegg_vedlegg_local",
  "sheet_utlegg_vedlegg_local",
  "slettede_rader_local",
  "vareforbruk_local",
  "arbeidsdag_local",
  "opplastings_ko",
];

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (q: string) => {
      raw.run(q);
    },
    getAllSync: (q: string, ...params: unknown[]) => {
      const stmt = raw.prepare(q);
      if (params.length) stmt.bind(params.flat());
      const rader: Record<string, unknown>[] = [];
      while (stmt.step()) rader.push(stmt.getAsObject());
      stmt.free();
      return rader;
    },
    runSync: (q: string, ...params: unknown[]) => {
      raw.run(q, params.length ? (params.flat() as unknown[]) : undefined);
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
  };
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  holder.raw.run(ALLE_TABELLER.map((t) => `DELETE FROM ${t};`).join(" "));
});

describe("F1 — forsoning flytter utlegg og vedlegg", () => {
  it("🔴 nytt mål (re-nøkling): utlegg + vedlegg følger sedelen, og utlegget pushes", async () => {
    seedSedel("gammel", "2026-11-10");
    seedUtleggMedVedlegg("u-1", "gammel");
    seedArbeidsdag("dag-1", "2026-11-10", "gammel");

    const { klient } = lagKlient([{ fraId: "gammel", tilId: "ny" }]);
    await syncTimer(klient, "u1");

    expect(utleggPaa("gammel")).toHaveLength(0);
    expect(utleggPaa("ny").map((u) => u.id)).toEqual(["u-1"]);
    expect(vedleggViaSedel("ny")).toEqual([{ id: "u-1-v" }]);
    // Opplastingskøen peker på rad-id → uendret og fortsatt gyldig.
    const ko = db().select().from(opplastingsKo).all();
    expect(ko.map((k) => k.sheetUtleggId)).toEqual(["u-1"]);
    // Arbeidsdagens peker følger sedelen.
    const dag = db().select().from(arbeidsdagLocal).where(eq(arbeidsdagLocal.id, "dag-1")).all()[0];
    expect(dag.generertDagsseddelId).toBe("ny");

    // Neste tick: sedelen er `pending` på ny id, og utlegget er med i payloaden.
    const neste = lagKlient([]);
    await syncTimer(neste.klient, "u1");
    const input = neste.fanget.input[0] as { sedler: Array<{ clientUuid: string; utlegg: Array<{ id: string }> }> };
    expect(input.sedler[0].clientUuid).toBe("ny");
    expect(input.sedler[0].utlegg.map((u) => u.id)).toEqual(["u-1"]);
  });

  it("🔴 mål finnes lokalt (merge): utlegg flyttes inn, målets egne utlegg urørt", async () => {
    seedSedel("gammel", "2026-11-10");
    seedSedel("ny", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-gammel", "gammel");
    seedUtleggMedVedlegg("u-ny", "ny");
    // En annen sedels utlegg skal aldri røres.
    seedSedel("annen", "2026-11-11", "synced");
    seedUtleggMedVedlegg("u-annen", "annen");

    const { klient } = lagKlient([{ fraId: "gammel", tilId: "ny" }]);
    await syncTimer(klient, "u1");

    expect(db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "gammel")).all()).toHaveLength(0);
    expect(utleggPaa("ny").map((u) => u.id).sort()).toEqual(["u-gammel", "u-ny"]);
    expect(vedleggViaSedel("ny").map((v) => v.id).sort()).toEqual(["u-gammel-v", "u-ny-v"]);
    expect(utleggPaa("annen").map((u) => u.id)).toEqual(["u-annen"]);
  });

  it("tillegg-vedlegg følger tillegg-raden (rad-id uendret)", async () => {
    seedSedel("gammel", "2026-11-10");
    db()
      .insert(sheetTilleggLocal)
      .values({ id: "t-1", dagsseddelId: "gammel", tilleggId: "tl1", antall: 1, sistEndretLokalt: 1000 } as typeof sheetTilleggLocal.$inferInsert)
      .run();
    db()
      .insert(sheetTilleggVedleggLocal)
      .values({ id: "t-1-v", sheetTilleggId: "t-1", filnavn: "k.jpg", mimeType: "image/jpeg", sistEndretLokalt: 1000 })
      .run();

    const { klient } = lagKlient([{ fraId: "gammel", tilId: "ny" }]);
    await syncTimer(klient, "u1");

    expect(
      sql(`SELECT v.id FROM sheet_tillegg_vedlegg_local v JOIN sheet_tillegg_local t ON t.id = v.sheet_tillegg_id WHERE t.dagsseddel_id = 'ny'`),
    ).toEqual([{ id: "t-1-v" }]);
  });
});

/**
 * Kolonner som bærer en sedel-id lokalt. Navnemønster: inneholder `dagsseddel`
 * eller `sheet`. Unntak (med grunn): kolonner som peker på en RAD
 * (tillegg/utlegg/timer), ikke på sedelen — rad-id endres aldri ved forsoning.
 */
const RAD_PEKERE = new Set(["sheet_tillegg_id", "sheet_utlegg_id", "sheet_timer_id"]);

function sedelIdKolonner(): Array<{ tabell: string; kolonne: string }> {
  const tabeller = sql(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).map((r) => String(r.name));
  const ut: Array<{ tabell: string; kolonne: string }> = [];
  for (const tabell of tabeller) {
    for (const k of sql(`PRAGMA table_info(${tabell})`)) {
      const kolonne = String(k.name);
      if (!/dagsseddel|sheet/.test(kolonne) || RAD_PEKERE.has(kolonne)) continue;
      ut.push({ tabell, kolonne });
    }
  }
  return ut;
}

/** Sett inn én rad med `kolonne = fraId` i hver tabell (dummy-verdier for NOT NULL). */
function seedEnRadPerKolonne(kolonner: Array<{ tabell: string; kolonne: string }>, fraId: string) {
  for (const { tabell, kolonne } of kolonner) {
    const info = sql(`PRAGMA table_info(${tabell})`);
    const navn: string[] = [];
    const verdier: unknown[] = [];
    for (const k of info) {
      const n = String(k.name);
      const type = String(k.type).toUpperCase();
      if (n === kolonne) {
        navn.push(n);
        verdier.push(fraId);
      } else if (Number(k.pk) > 0) {
        navn.push(n);
        verdier.push(`${tabell}-rad`);
      } else if (Number(k.notnull) === 1 && k.dflt_value === null) {
        navn.push(n);
        verdier.push(type.includes("INT") || type.includes("REAL") ? 0 : "x");
      }
    }
    holder.raw.run(
      `INSERT INTO ${tabell} (${navn.join(", ")}) VALUES (${navn.map(() => "?").join(", ")})`,
      verdier,
    );
  }
}

/** Kjør M1-forsoning `fraId` → `tilId` og returner kolonnene som FORTSATT har `fraId`. */
async function hullEtterForsoning(fraId: string): Promise<string[]> {
  const kolonner = sedelIdKolonner().filter((k) => !(k.tabell === "dagsseddel_local"));
  seedSedel(fraId, "2026-11-10");
  seedEnRadPerKolonne(kolonner, fraId);
  const { klient } = lagKlient([{ fraId, tilId: `${fraId}-ny` }]);
  await syncTimer(klient, "u1");
  return kolonner
    .filter(({ tabell, kolonne }) => sql(`SELECT 1 FROM ${tabell} WHERE ${kolonne} = '${fraId}'`).length > 0)
    .map(({ tabell, kolonne }) => `${tabell}.${kolonne}`);
}

describe("F1 — strukturvakt: alle lokale sedel-id-kolonner er med i forsoningen", () => {
  it("detektoren finner de kjente sedel-id-kolonnene (vakten måler noe)", () => {
    const funnet = sedelIdKolonner().map((k) => `${k.tabell}.${k.kolonne}`).sort();
    // Negativkontroll for tom måling: kjente kolonner MÅ være med.
    expect(funnet).toEqual(
      expect.arrayContaining([
        "sheet_timer_local.dagsseddel_id",
        "sheet_tillegg_local.dagsseddel_id",
        "sheet_machine_local.dagsseddel_id",
        "sheet_utlegg_local.dagsseddel_id",
        "slettede_rader_local.dagsseddel_id",
        "vareforbruk_local.sheet_id",
        "arbeidsdag_local.generert_dagsseddel_id",
      ]),
    );
  });

  it("🔴 ingen sedel-id-kolonne blir liggende igjen på gammel id", async () => {
    expect(await hullEtterForsoning("gammel-s")).toEqual([]);
  });

  it("negativkontroll: en ny tabell med sedel-id som forsoningen ikke kjenner, fanges", async () => {
    holder.raw.run("CREATE TABLE ny_test_local (id TEXT PRIMARY KEY, dagsseddel_id TEXT NOT NULL)");
    try {
      expect(await hullEtterForsoning("gammel-n")).toEqual(["ny_test_local.dagsseddel_id"]);
    } finally {
      holder.raw.run("DROP TABLE ny_test_local");
    }
  });
});

describe("F1 — redning av foreldreløse utlegg fra før fiksen", () => {
  it("🔴 entydig kobling via arbeidsdagen: utlegget flyttes og synket sedel blir pending", () => {
    // Tilstanden en eldre app etterlot: sedelen er forsonet til «ny», utlegget og
    // arbeidsdagens peker står på «gammel» (som ikke har noe hode lenger).
    seedSedel("ny", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-1", "gammel");
    seedArbeidsdag("dag-1", "2026-11-10", "gammel");

    expect(reddForeldreloseUtlegg(db(), "u1", 5000)).toBe(1);

    expect(utleggPaa("ny").map((u) => u.id)).toEqual(["u-1"]);
    expect(vedleggViaSedel("ny")).toEqual([{ id: "u-1-v" }]);
    const sedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "ny")).all()[0];
    expect(sedel.syncStatus).toBe("pending");
    expect(sedel.sistEndretLokalt).toBe(5000);
    const dag = db().select().from(arbeidsdagLocal).where(eq(arbeidsdagLocal.id, "dag-1")).all()[0];
    expect(dag.generertDagsseddelId).toBe("ny");
  });

  it("redningen kjører i syncTimer før push: utlegget er med i payloaden", async () => {
    seedSedel("ny", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-1", "gammel");
    seedArbeidsdag("dag-1", "2026-11-10", "gammel");

    const { klient, fanget } = lagKlient([]);
    await syncTimer(klient, "u1");
    const input = fanget.input[0] as { sedler: Array<{ clientUuid: string; utlegg: Array<{ id: string }> }> };
    expect(input.sedler[0].clientUuid).toBe("ny");
    expect(input.sedler[0].utlegg.map((u) => u.id)).toEqual(["u-1"]);
  });

  it("negativkontroll: uten kobling (manuell dag) røres utlegget ikke — ingen gjetting", () => {
    seedSedel("ny", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-1", "gammel");

    expect(reddForeldreloseUtlegg(db(), "u1", 5000)).toBe(0);
    expect(utleggPaa("gammel").map((u) => u.id)).toEqual(["u-1"]);
    const sedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "ny")).all()[0];
    expect(sedel.syncStatus).toBe("synced");
  });

  it("negativkontroll: tvetydig kobling (to lokale sedler samme dato) røres ikke", () => {
    seedSedel("ny-a", "2026-11-10", "synced");
    seedSedel("ny-b", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-1", "gammel");
    seedArbeidsdag("dag-1", "2026-11-10", "gammel");

    expect(reddForeldreloseUtlegg(db(), "u1", 5000)).toBe(0);
    expect(utleggPaa("gammel").map((u) => u.id)).toEqual(["u-1"]);
  });

  it("negativkontroll: utlegg på en levende sedel røres aldri", () => {
    seedSedel("levende", "2026-11-10", "synced");
    seedUtleggMedVedlegg("u-1", "levende");
    seedArbeidsdag("dag-1", "2026-11-10", "levende");

    expect(reddForeldreloseUtlegg(db(), "u1", 5000)).toBe(0);
    const sedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "levende")).all()[0];
    expect(sedel.syncStatus).toBe("synced");
  });
});
