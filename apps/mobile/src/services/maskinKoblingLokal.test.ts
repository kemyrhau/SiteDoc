import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Kort-id d2c-2 (spec § 12.2 R24, H12, H13, H15 = A): maskin koblet til timerad
 * ved føring på telefonen. EKTE SQLite (sql.js) + ekte migreringer.
 *
 * Måler: maskinlista fyller enheten (stille tomhet forbudt), oppslagene for
 * kobling, sletting av timerad med maskinene som krever den, «Flytt» til en
 * timerad og at maskinskrivingen bærer koblingen. Hver kontrakt har
 * negativkontroll.
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
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
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++holder.uuid}` }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("./auth", () => ({ lagreVerdi: async () => undefined, hentVerdi: async () => null }));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { refreshMaskinKatalog } from "./maskinKatalog";
import {
  arbeidsraderIBotteLokalt,
  maskinNavnLokalt,
  maskinerSomKreverRadenLokalt,
  utleieEnhetLokalt,
} from "./maskinKoblingLokal";
import {
  fjernTimerRadMedMaskiner,
  flyttMaskinRad,
} from "../components/timer-detalj/prosjektkort/kortRadFlytt";
import {
  leggTilMaskinRad,
  oppdaterMaskinRad,
  type MaskinRadFelt,
} from "../components/timer-detalj/prosjektkort/radLagring";

const { dagsseddelLocal, equipmentLocal, sheetMachineLocal, sheetTimerLocal, slettedeRaderLocal } = schema;

type Db = NonNullable<ReturnType<typeof import("../db/database").hentDatabase>>;
const db = () => holder.drizzle as Db;
const K = { sheetId: "s1", organizationId: "o1" };

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

const utstyr = (id: string, utleieEnhet: string | null, merke = "Volvo", modell = id) =>
  db()
    .insert(equipmentLocal)
    .values({ id, organizationId: "o1", kategori: "anleggsmaskin", merke, modell, status: "tilgjengelig", utleieEnhet, sistOppdatert: 1 })
    .run();

const timerRad = (
  id: string,
  over: Partial<typeof sheetTimerLocal.$inferInsert> = {},
) =>
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId: "s1",
      projectId: "p1",
      lonnsartId: "l-arb",
      aktivitetId: "a1",
      timer: 4,
      fraTid: "07:00",
      tilTid: "11:00",
      kortId: "k1",
      sistEndretLokalt: 1,
      ...over,
    })
    .run();

const maskin = (id: string, vehicleId: string, sheetTimerId: string | null) =>
  db()
    .insert(sheetMachineLocal)
    .values({ id, dagsseddelId: "s1", sheetTimerId, projectId: "p1", vehicleId, timer: 2, kortId: "k1", sistEndretLokalt: 1 })
    .run();

const maskinRad = (id: string) => db().select().from(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).all()[0];
const tombstones = () => db().select().from(slettedeRaderLocal).all();

beforeEach(() => {
  holder.uuid = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM slettede_rader_local; DELETE FROM equipment_local;",
  );
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "s1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-11-17",
      status: "draft",
      syncStatus: "synced",
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
});

describe("maskinlista fyller enheten (stille tomhet forbudt)", () => {
  it("equipment_local har kolonnen utleie_enhet etter migrering", () => {
    const kol = holder.raw.exec("PRAGMA table_info(equipment_local)")[0]!.values.map((r) => String(r[1]));
    expect(kol).toContain("utleie_enhet");
  });

  it("refreshMaskinKatalog skriver enheten fra serveren, null når serveren ikke har den", async () => {
    const klient = {
      maskin: {
        equipment: {
          list: {
            query: async () => [
              { id: "e-time", organizationId: "o1", kategori: "anleggsmaskin", merke: "Cat", modell: "320", status: "tilgjengelig", utleieEnhet: "time" },
              { id: "e-doegn", organizationId: "o1", kategori: "smautstyr", merke: "Hilti", modell: "TE", status: "tilgjengelig", utleieEnhet: "doegn" },
              { id: "e-ukjent", organizationId: "o1", kategori: "kjoretoy", merke: "VW", modell: "Crafter", status: "tilgjengelig", utleieEnhet: null },
            ],
          },
        },
      },
      kompetanse: { minMaskinstatus: { query: async () => ({ perOrg: [] }) } },
    } as unknown as Parameters<typeof refreshMaskinKatalog>[0];
    await refreshMaskinKatalog(klient);
    expect(utleieEnhetLokalt(db(), "e-time")).toBe("time");
    expect(utleieEnhetLokalt(db(), "e-doegn")).toBe("doegn");
    expect(utleieEnhetLokalt(db(), "e-ukjent")).toBeNull();
    // Negativkontroll mot stille tomhet: minst én rad har faktisk fått enheten.
    const fylt = db().select().from(equipmentLocal).all().filter((e) => e.utleieEnhet != null);
    expect(fylt.length).toBe(2);
  });

  it("ukjent maskin gir ukjent enhet (krever timerad, H15 = A) og id som navn", () => {
    expect(utleieEnhetLokalt(db(), "finnes-ikke")).toBeNull();
    expect(maskinNavnLokalt(db(), "finnes-ikke")).toBe("finnes-ikke");
  });
});

describe("oppslag for koblingen", () => {
  it("bøttas arbeidsrader: samme prosjekt og underprosjekt, ikke reise, ikke 0 timer, sortert på fra-tid", () => {
    timerRad("t-sen", { fraTid: "12:00", tilTid: "15:00", timer: 3 });
    timerRad("t-tidlig");
    timerRad("t-reise", { lonnsartId: "l-reise", erReise: true });
    timerRad("t-null", { timer: 0 });
    timerRad("t-annet", { projectId: "p2" });
    timerRad("t-eco", { externalCostObjectId: "eco1" });
    timerRad("t-arv", { projectId: null, fraTid: "16:00", tilTid: "17:00", timer: 1 });
    const ider = arbeidsraderIBotteLokalt(db(), "s1", { projectId: "p1", ecoId: null, sedelProjectId: "p1" }, "l-reise").map(
      (r) => r.id,
    );
    expect(ider).toEqual(["t-tidlig", "t-sen", "t-arv"]);
  });

  it("maskinene som krever raden: døgn-maskin tas ikke med, ukjent enhet tas med", () => {
    utstyr("v-time", "time", "Cat", "320");
    utstyr("v-doegn", "doegn");
    timerRad("t1");
    maskin("m1", "v-time", "t1");
    maskin("m2", "v-doegn", "t1");
    maskin("m3", "v-ukjent", "t1");
    maskin("m4", "v-time", null);
    expect(maskinerSomKreverRadenLokalt(db(), "t1")).toEqual([
      { id: "m1", vehicleId: "v-time", navn: "Cat 320" },
      { id: "m3", vehicleId: "v-ukjent", navn: "v-ukjent" },
    ]);
  });
});

describe("fjernTimerRadMedMaskiner (prosjektkort: sletting av rad)", () => {
  it("sletter raden og de oppgitte maskinene, med tombstone; døgn-maskin står igjen", () => {
    utstyr("v-time", "time");
    utstyr("v-doegn", "doegn");
    timerRad("t1");
    maskin("m1", "v-time", "t1");
    maskin("m2", "v-doegn", "t1");
    const krever = maskinerSomKreverRadenLokalt(db(), "t1").map((m) => m.id);
    fjernTimerRadMedMaskiner(db(), K, "t1", krever);
    expect(db().select().from(sheetTimerLocal).all()).toHaveLength(0);
    expect(maskinRad("m1")).toBeUndefined();
    expect(maskinRad("m2")).toMatchObject({ id: "m2" });
    expect(tombstones().filter((t) => t.radType === "maskin").map((t) => t.radId)).toEqual(["m1"]);
  });

  it("negativkontroll: en maskin på en annen rad slettes ikke selv om id-en sendes med", () => {
    utstyr("v-time", "time");
    timerRad("t1");
    timerRad("t2", { fraTid: "12:00", tilTid: "14:00", timer: 2 });
    maskin("m-annen", "v-time", "t2");
    fjernTimerRadMedMaskiner(db(), K, "t1", ["m-annen"]);
    expect(maskinRad("m-annen")).toMatchObject({ sheetTimerId: "t2" });
    expect(tombstones().filter((t) => t.radType === "maskin")).toHaveLength(0);
  });
});

describe("«Flytt» av maskin til en timerad i målkortet", () => {
  it("setter timeraden når den oppgis", () => {
    maskin("m1", "v1", null);
    flyttMaskinRad(db(), "m1", { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "k2" }, "t9");
    expect(maskinRad("m1")).toMatchObject({ projectId: "p2", kortId: "k2", sheetTimerId: "t9" });
  });

  it("uten timerad (døgn-maskin) står maskinen uten kobling, som før", () => {
    maskin("m1", "v1", "t-gammel");
    flyttMaskinRad(db(), "m1", { projectId: "p2", byggeplassId: null, ecoId: null, kortId: "k2" });
    expect(maskinRad("m1")).toMatchObject({ projectId: "p2", sheetTimerId: null });
  });
});

describe("maskinvinduet lagrer koblingen (prosjektkort-modus)", () => {
  const felt: MaskinRadFelt = {
    projectId: "p1",
    ecoId: null,
    vehicleId: "v1",
    timer: 2,
    mengde: null,
    enhet: null,
    fraTid: "07:00",
    tilTid: "09:00",
    sheetTimerId: "t1",
  };

  it("ny maskin får timeraden og timeradens kort-id (K6)", () => {
    timerRad("t1", { kortId: "k-rad" });
    const id = leggTilMaskinRad(db(), K, felt);
    expect(maskinRad(id)).toMatchObject({ sheetTimerId: "t1", kortId: "k-rad" });
  });

  it("endret maskin får ny timerad; null tar koblingen bort", () => {
    timerRad("t1");
    timerRad("t2", { fraTid: "12:00", tilTid: "14:00", timer: 2 });
    maskin("m1", "v1", "t1");
    oppdaterMaskinRad(db(), K, "m1", { ...felt, sheetTimerId: "t2" });
    expect(maskinRad("m1")?.sheetTimerId).toBe("t2");
    oppdaterMaskinRad(db(), K, "m1", { ...felt, sheetTimerId: null });
    expect(maskinRad("m1")?.sheetTimerId).toBeNull();
  });
});
