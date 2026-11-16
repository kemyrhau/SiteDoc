import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Kort-id på telefonen (prosjektkort-kortid-spec § 3.3, § 4, § 9 T4/T5; Kenneth 2026-11-16).
 *
 *  - Regelen (`normaliserKortIder`): reise NULL, regel 3, flyttet rad, K6, K7.
 *  - Lokal backfill i migreringen: rader uten id får shared `utledKortId` — samme id som
 *    serverens SQL-backfill — og andre kjøring endrer ingenting (T4).
 *  - T5 mobil: pr. lokal skrivevei (M9) — lagret arbeidsrad uten `kort_id` = rød.
 *  - Vakt: hver kildefil som setter inn i en av de fem radtabellene, kaller
 *    `sikreLokalKortId` (eller står på lista under med begrunnelse). Ny skrivevei uten
 *    kallet = rød.
 *
 * EKTE SQLite (sql.js) + ekte migreringer, som `nyTimerRad.test.ts`.
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
vi.mock("expo-crypto", () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++holder.uuid).padStart(12, "0")}`,
}));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { utledKortId } from "@sitedoc/shared";
import * as schema from "../db/schema";
import { kjorMigreringer, KORTID_LOCAL_KOLONNER } from "../db/migreringer";
import { normaliserKortIder, type LokalKortRad, type LokalKortSedel } from "../utils/kortIdNormalisering";
import { sikreLokalKortId } from "./kortIdLokal";
import { settInnTimerRad } from "./nyTimerRad";
import { skrivLonnstillegg, skrivUtlegg } from "./tilleggUtleggSkriv";
import { skrivKobledeMaskiner } from "./kobledeMaskiner";
import { lagreLokalVarelinje } from "./vareforbrukSync";
import { leggTilMaskinRad, oppdaterTimerRad } from "../components/timer-detalj/prosjektkort/radLagring";
import { anvendForsonetLokalt } from "../lib/forsoningSpeil";

const {
  dagsseddelLocal,
  lonnsartLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetTimerLocal,
  sheetUtleggLocal,
  vareforbrukLocal,
} = schema;

type Db = NonNullable<ReturnType<typeof import("../db/database").hentDatabase>>;
const db = () => holder.drizzle as Db;

const USER = "11111111-1111-4111-8111-111111111111";
const ORG = "o1";
const SHEET = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333331";
const P2 = "33333333-3333-4333-8333-333333333332";
const ECO = "44444444-4444-4444-8444-444444444444";
const DATO = "2026-11-16";

const utledet = (projectId: string, ecoId: string | null = null, byggeplassId: string | null = null) =>
  utledKortId({ userId: USER, dato: DATO, nokkel: { projectId, byggeplassId, ecoId } });

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
  holder.raw.run(
    `DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local;
     DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM vareforbruk_local;
     DELETE FROM lonnsart_local;`,
  );
  db()
    .insert(dagsseddelLocal)
    .values({
      id: SHEET,
      userId: USER,
      organizationId: ORG,
      projectId: P1,
      aktivitetId: "a1",
      dato: DATO,
      sistEndretLokalt: 1,
    })
    .run();
  db()
    .insert(lonnsartLocal)
    .values({ id: "l1", organizationId: ORG, type: "ordinaer", navn: "Timelønn", aktiv: true, sistOppdatert: 1 })
    .run();
});

const timerRad = (id: string, felt: Partial<typeof sheetTimerLocal.$inferInsert> = {}) =>
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId: SHEET,
      projectId: P1,
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer: 2,
      sistEndretLokalt: 1,
      ...felt,
    })
    .run();
const kortAv = (id: string) =>
  db().select({ k: sheetTimerLocal.kortId }).from(sheetTimerLocal).where(eq(sheetTimerLocal.id, id)).all()[0]?.k;

// ---------------------------------------------------------------------------
// Regelen (ren)
// ---------------------------------------------------------------------------

describe("normaliserKortIder — regel 3, reise, flyttet rad, K6, K7", () => {
  const sedel: LokalKortSedel = { userId: USER, dato: DATO, projectId: P1, byggeplass: null };
  const r = (id: string, f: Partial<LokalKortRad> = {}): LokalKortRad => ({
    id,
    type: "timer",
    kortId: null,
    projectId: P1,
    byggeplassId: null,
    ecoId: null,
    ...f,
  });

  it("uten id: samme nøkkel → samme utledede id; ulik nøkkel → ulik; reise → null", () => {
    const e = normaliserKortIder(sedel, [r("a"), r("b"), r("c", { ecoId: ECO }), r("d", { erReise: true })]);
    expect(e.get("a")).toBe(utledet(P1));
    expect(e.get("b")).toBe(utledet(P1));
    expect(e.get("c")).toBe(utledet(P1, ECO));
    expect(e.has("d")).toBe(false); // null fra før → ingen endring
  });

  it("regel 3: ny rad går i ELDSTE kort med samme nøkkel, ikke utledet id", () => {
    const e = normaliserKortIder(sedel, [r("a", { kortId: "kort-x" }), r("ny")]);
    expect(e.get("ny")).toBe("kort-x");
    expect(e.has("a")).toBe(false);
  });

  it("K7: to kort med samme nøkkel forblir to", () => {
    const e = normaliserKortIder(sedel, [r("a", { kortId: "k1" }), r("b", { kortId: "k2" })]);
    expect(e.size).toBe(0);
  });

  it("flyttet rad (nøkkel endret) får regel 3; resten av kortet beholder id", () => {
    const e = normaliserKortIder(sedel, [
      r("a", { kortId: "k1" }),
      r("b", { kortId: "k1" }),
      r("c", { kortId: "k1", projectId: P2 }),
    ]);
    expect(e.get("c")).toBe(utledet(P2));
    expect(e.has("a")).toBe(false);
    expect(e.has("b")).toBe(false);
  });

  it("K6: koblet maskin/vare følger timerraden; annet prosjekt beholder eget kort", () => {
    const e = normaliserKortIder(sedel, [
      r("t", { kortId: "k1" }),
      r("m", { type: "maskin", sheetTimerId: "t", kortId: "feil" }),
      r("v", { type: "vare", sheetTimerId: "t" }),
      r("m2", { type: "maskin", sheetTimerId: "t", projectId: P2 }),
    ]);
    expect(e.get("m")).toBe("k1");
    expect(e.get("v")).toBe("k1");
    expect(e.get("m2")).toBe(utledet(P2));
  });

  it("reise-rad med id → nulles", () => {
    const e = normaliserKortIder(sedel, [r("a", { kortId: "k1", erReise: true })]);
    expect(e.get("a")).toBeNull();
  });

  it("effektiv byggeplass: sedelens byggeplass i radens prosjekt inngår i nøkkelen (M1)", () => {
    const medBp = { ...sedel, byggeplass: { id: "bp1", projectId: P1 } };
    const e = normaliserKortIder(medBp, [r("a"), r("b", { projectId: P2 })]);
    expect(e.get("a")).toBe(utledet(P1, null, "bp1"));
    expect(e.get("b")).toBe(utledet(P2));
  });
});

// ---------------------------------------------------------------------------
// Lokal migrering + backfill (§ 3.3, T4)
// ---------------------------------------------------------------------------

describe("lokal migrering — kort_id på fem tabeller + backfill (§ 3.3)", () => {
  it("kolonnen finnes på alle fem tabellene", () => {
    for (const [tabell, kol] of KORTID_LOCAL_KOLONNER) {
      const stmt = holder.raw.prepare(`PRAGMA table_info(${tabell})`);
      const navn: string[] = [];
      while (stmt.step()) navn.push(String(stmt.getAsObject().name));
      stmt.free();
      expect(navn, tabell).toContain(kol);
    }
  });

  it("🔴 rader uten id får utledet id; reise NULL; koblet maskin = radens; kjørt to ganger = samme", () => {
    timerRad("t1");
    timerRad("t2", { externalCostObjectId: ECO });
    timerRad("t3", { erReise: true });
    db()
      .insert(sheetMachineLocal)
      .values({ id: "m1", dagsseddelId: SHEET, sheetTimerId: "t2", projectId: P1, vehicleId: "v", timer: 1, sistEndretLokalt: 1 })
      .run();
    db()
      .insert(sheetTilleggLocal)
      .values({ id: "tl1", dagsseddelId: SHEET, projectId: P1, tilleggId: "x", antall: 1, sistEndretLokalt: 1 })
      .run();
    kjorMigreringer();
    expect(kortAv("t1")).toBe(utledet(P1));
    expect(kortAv("t2")).toBe(utledet(P1, ECO));
    expect(kortAv("t3")).toBeNull();
    const m1 = db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, "m1")).all()[0]!;
    expect(m1.kortId).toBe(utledet(P1, ECO));
    const tl1 = db().select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.id, "tl1")).all()[0]!;
    expect(tl1.kortId).toBe(utledet(P1));
    // Andre kjøring endrer ingenting, og sist_endret_lokalt er urørt (ingen push av id alene).
    kjorMigreringer();
    expect(kortAv("t1")).toBe(utledet(P1));
    const t1 = db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.id, "t1")).all()[0]!;
    expect(t1.sistEndretLokalt).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T5 mobil — pr. lokal skrivevei (M9): lagret arbeidsrad uten kort_id = rød
// ---------------------------------------------------------------------------

describe("T5 mobil — lokale skriveveier setter kort_id", () => {
  const radFelt = {
    projectId: P1,
    byggeplassId: null,
    lonnsartId: "l1",
    aktivitetId: "a1",
    timer: 2,
    externalCostObjectId: null,
    fraTid: "07:00",
    tilTid: "09:00",
    beskrivelse: null,
    pauseMin: 0,
  };

  it("settInnTimerRad (sedelen, «+», prosjektkortets leggTilTimerRad) + koblet maskin", () => {
    const id = settInnTimerRad(db(), SHEET, ORG, {
      ...radFelt,
      maskiner: [{ vehicleId: "v", timer: 1, mengde: null, enhet: null }],
    });
    expect(kortAv(id)).toBe(utledet(P1));
    const [m] = db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.sheetTimerId, id)).all();
    expect(m!.kortId).toBe(utledet(P1));
  });

  it("radLagring.oppdaterTimerRad: endret underprosjekt → regel 3 (nytt kort)", () => {
    timerRad("t1", { kortId: "k1" });
    timerRad("t2", { kortId: "k1" });
    oppdaterTimerRad(db(), { sheetId: SHEET, organizationId: ORG }, "t2", { ...radFelt, externalCostObjectId: ECO });
    expect(kortAv("t1")).toBe("k1");
    expect(kortAv("t2")).toBe(utledet(P1, ECO));
  });

  it("radLagring.leggTilMaskinRad (frittstående maskin)", () => {
    const id = leggTilMaskinRad(db(), { sheetId: SHEET, organizationId: ORG }, {
      projectId: P1,
      ecoId: null,
      vehicleId: "v",
      timer: 1,
      mengde: null,
      enhet: null,
      fraTid: null,
      tilTid: null,
    });
    const [m] = db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).all();
    expect(m!.kortId).toBe(utledet(P1));
  });

  it("skrivKobledeMaskiner: ny maskin på eksisterende rad følger radens kort (K6)", () => {
    timerRad("t1", { kortId: "k1" });
    skrivKobledeMaskiner(
      db(),
      SHEET,
      "t1",
      { projectId: P1, byggeplassId: null, externalCostObjectId: null, timer: 2, fraTid: null, tilTid: null },
      { linjer: [{ id: null, vehicleId: "v", timer: 1, mengde: null, enhet: null }], fjernede: [] },
    );
    const [m] = db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.sheetTimerId, "t1")).all();
    expect(m!.kortId).toBe("k1");
  });

  it("skrivLonnstillegg og skrivUtlegg går i eldste kort med samme nøkkel", () => {
    timerRad("t1", { kortId: "k1" });
    skrivLonnstillegg(db(), SHEET, { lokalId: "tl1", projectId: P1, tilleggId: "x", antall: 1, kommentar: null }, 1);
    skrivUtlegg(
      db(),
      SHEET,
      {
        id: "u1",
        projectId: P1,
        expenseCategoryId: "c",
        belop: 10,
        kommentar: null,
        ordningVedFoering: "utlegg",
        foertVed: 1,
        kvittering: null,
      },
      () => "v1",
    );
    expect(db().select().from(sheetTilleggLocal).all()[0]!.kortId).toBe("k1");
    expect(db().select().from(sheetUtleggLocal).all()[0]!.kortId).toBe("k1");
  });

  it("lagreLokalVarelinje: koblet vare følger timerraden", () => {
    timerRad("t1", { kortId: "k1" });
    lagreLokalVarelinje({
      id: "v1",
      userId: USER,
      organizationId: ORG,
      sheetId: SHEET,
      projectId: P1,
      dato: DATO,
      vareId: "vare",
      vareNavn: "Vare",
      enhet: "stk",
      antall: 1,
      byggeplassId: null,
      sheetTimerId: "t1",
    });
    expect(db().select().from(vareforbrukLocal).all()[0]!.kortId).toBe("k1");
  });

  it("anvendForsonetLokalt (V19): serverens id følger raden tilbake; rad uten id får regel 3", () => {
    anvendForsonetLokalt(
      SHEET,
      [
        {
          id: "t1",
          projectId: P1,
          byggeplassId: null,
          lonnsartId: "l1",
          aktivitetId: "a1",
          externalCostObjectId: null,
          kortId: "k-server",
          timer: 2,
          fraTid: null,
          tilTid: null,
          beskrivelse: null,
          pauseMin: 0,
          updatedAt: "2026-11-16T10:00:00.000Z",
        },
        {
          id: "t2",
          projectId: P1,
          byggeplassId: null,
          lonnsartId: "l1",
          aktivitetId: "a1",
          externalCostObjectId: null,
          timer: 1,
          fraTid: null,
          tilTid: null,
          beskrivelse: null,
          pauseMin: 0,
          updatedAt: "2026-11-16T10:00:00.000Z",
        },
      ],
      5,
    );
    expect(kortAv("t1")).toBe("k-server");
    expect(kortAv("t2")).toBe("k-server");
  });

  it("sikreLokalKortId på ukjent sedel gjør ingenting", () => {
    expect(sikreLokalKortId(db(), "finnes-ikke")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Vakt: hver lokal innsetting i radtabellene går via kort-id-regelen
// ---------------------------------------------------------------------------

describe("vakt — lokale innsettinger i radtabellene kaller sikreLokalKortId", () => {
  // Filer som setter inn rader uten selv å kalle regelen, med grunn:
  const UNNTAK: Record<string, string> = {
    // Pull: alle inserts bærer serverens kortId; `sikreLokalKortId(db, maalId)` etter løkkene,
    // og push normaliserer hver sedel før payload leses.
    "src/services/timerSync.ts": "kaller selv (pull + push)",
    // Kalles fra pull i timerSync, som normaliserer sedelen rett etter (`leggTilbakeUsendteLinjer`).
    "src/lib/konfliktWebUsendte.ts": "normaliseres av kalleren i timerSync",
  };
  const rot = path.resolve(__dirname, "../..");
  const filer: string[] = [];
  const gaa = (dir: string) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name !== "node_modules") gaa(p);
      } else if (/\.(ts|tsx)$/.test(f.name) && !/\.test\.tsx?$/.test(f.name)) filer.push(p);
    }
  };
  gaa(path.join(rot, "src"));
  gaa(path.join(rot, "app"));
  const INSERT = /insert\((sheetTimerLocal|sheetMachineLocal|sheetTilleggLocal|sheetUtleggLocal|vareforbrukLocal)\)/;

  it("negativkontroll: søket finner skriveveiene", () => {
    const treff = filer.filter((f) => INSERT.test(fs.readFileSync(f, "utf8")));
    expect(treff.length).toBeGreaterThanOrEqual(10);
  });

  it("🔴 ingen fil setter inn rader uten kort-id-regelen", () => {
    const mangler = filer
      .filter((f) => INSERT.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(rot, f))
      .filter((rel) => !UNNTAK[rel])
      .filter((rel) => !fs.readFileSync(path.join(rot, rel), "utf8").includes("sikreLokalKortId("));
    expect(mangler).toEqual([]);
  });
});
