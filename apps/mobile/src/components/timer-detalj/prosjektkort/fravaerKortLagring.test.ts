import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE (33) c2 — fraværskortets lagring (harness som radLagring.test.ts).
 *
 * EKTE SQLite (sql.js) + ekte migreringer, som `nyTimerRad.test.ts`. Måler
 * DB-effekten feltvis: oppdaterte felt, tidKilde/reise-spor, koblet maskin,
 * transaksjon og tombstone (timer MED serverVersjon, maskin UTEN). Hver
 * kontrakt har negativkontroll (det som ikke skal skje, skjer ikke).
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
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++holder.uuid}` }));
vi.mock("../../../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../../../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../../../db/schema";
import { kjorMigreringer } from "../../../db/migreringer";
import { lagreFravaerKort } from "./fravaerKortLagring";

const { dagsseddelLocal, lonnsartLocal, sheetMachineLocal, sheetTimerLocal, slettedeRaderLocal } = schema;

type Db = NonNullable<ReturnType<typeof import("../../../db/database").hentDatabase>>;
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


/**
 * ORDRE (33) c2 — lagring av fraværskortet (spec § 11.5). TF9 (lagret rad uten prosjekt,
 * bare-fravær-dag uten prosjekt, felles beskrivelse), TF3 (ikke-fravær-art avvises),
 * TF27 (framtidig dato lagres — vakt mot stille datosperre), U6 gren 3.
 */
const { aktivitetLocal } = schema;

beforeEach(() => {
  holder.uuid = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM slettede_rader_local; DELETE FROM lonnsart_local; DELETE FROM aktivitet_local;",
  );
  const arter: Array<[string, string, string, boolean | null]> = [
    ["l-egen", "fravaer", "Egenmelding", true],
    ["l-ferie", "fravaer", "Ferie u/lønn", false],
    ["l-arb", "ordinaer", "Normaltid", null],
  ];
  for (const [id, type, navn, tak] of arter) {
    db()
      .insert(lonnsartLocal)
      .values({ id, organizationId: "o1", type, navn, aktiv: true, erStandardvalg: false, fravaerNormtak: tak, sistOppdatert: 1 })
      .run();
  }
  db().insert(aktivitetLocal).values({ id: "a-anl", organizationId: "o1", navn: "Anleggsarbeid", aktiv: true, sistOppdatert: 1 }).run();
});

const grunn = { userId: "u1", organizationId: "o1", fjernede: [] as string[] };
const rader = () => db().select().from(sheetTimerLocal).all();
const sedler = () => db().select().from(dagsseddelLocal).all();

describe("TF9 — fraværskortet lagres uten prosjekt", () => {
  it("bare-fravær-dag: ny sedel uten prosjekt, raden har uten_prosjekt og standard-aktivitet", () => {
    const r = lagreFravaerKort(db(), {
      ...grunn,
      dato: "2026-11-16",
      linjer: [{ id: null, lonnsartId: "l-egen", timer: 7.5 }],
      beskrivelse: "Syk",
    });
    expect(r.ok).toBe(true);
    expect(sedler()).toHaveLength(1);
    expect(sedler()[0]!.projectId).toBe("");
    const [rad] = rader();
    expect(rad!.utenProsjekt).toBe(true);
    expect(rad!.projectId).toBeNull();
    expect(rad!.byggeplassId).toBeNull();
    expect(rad!.externalCostObjectId).toBeNull();
    expect(rad!.aktivitetId).toBe("a-anl");
    expect(rad!.fraTid).toBeNull();
    expect(rad!.beskrivelse).toBe("Syk");
  });

  it("dag med prosjekt: fraværsraden havner ikke på sedelens prosjekt", () => {
    db().insert(dagsseddelLocal).values({
      id: "s1", userId: "u1", organizationId: "o1", projectId: "p1", aktivitetId: "a-anl",
      dato: "2026-11-16", status: "draft", syncStatus: "synced", sistEndretLokalt: 1, sistSynkronisert: 1,
    }).run();
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-egen", timer: 4.5 }], beskrivelse: "Syk" });
    expect(r).toMatchObject({ ok: true, sheetId: "s1" });
    expect(rader()[0]!.projectId).toBeNull();
    expect(rader()[0]!.utenProsjekt).toBe(true);
  });

  it("flere linjer slås aldri sammen; én beskrivelse skrives på alle kortets rader (U7, U11)", () => {
    lagreFravaerKort(db(), {
      ...grunn,
      dato: "2026-11-16",
      linjer: [
        { id: null, lonnsartId: "l-egen", timer: 4 },
        { id: null, lonnsartId: "l-egen", timer: 2 },
      ],
      beskrivelse: "Først",
    });
    const id1 = rader()[0]!.id;
    const id2 = rader()[1]!.id;
    lagreFravaerKort(db(), {
      ...grunn,
      dato: "2026-11-16",
      linjer: [
        { id: id1, lonnsartId: "l-ferie", timer: 3 },
        { id: id2, lonnsartId: "l-egen", timer: 2 },
      ],
      beskrivelse: "Endret",
    });
    const etter = rader();
    expect(etter).toHaveLength(2);
    expect(etter.map((r) => r.beskrivelse)).toEqual(["Endret", "Endret"]);
    expect(etter.find((r) => r.id === id1)).toMatchObject({ lonnsartId: "l-ferie", timer: 3, utenProsjekt: true });
  });

  it("fjernet linje slettes med tombstone", () => {
    lagreFravaerKort(db(), { ...grunn, dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-egen", timer: 4 }], beskrivelse: "x" });
    const id = rader()[0]!.id;
    lagreFravaerKort(db(), { ...grunn, fjernede: [id], dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-ferie", timer: 1 }], beskrivelse: "x" });
    expect(rader().map((r) => r.lonnsartId)).toEqual(["l-ferie"]);
    expect(db().select().from(slettedeRaderLocal).all().map((s) => s.radId)).toEqual([id]);
  });
});

describe("TF3 — arbeidsrad uten prosjekt kan ikke lagres", () => {
  it("ordinær art i fraværskortet avvises, ingenting skrevet", () => {
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-arb", timer: 2 }], beskrivelse: "x" });
    expect(r).toEqual({ ok: false, grunn: "ikkeFravaerArt", sheetId: null });
    expect(rader()).toHaveLength(0);
    expect(sedler()).toHaveLength(0);
  });
  it("manglende beskrivelse avvises (F4), ingenting skrevet", () => {
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-egen", timer: 2 }], beskrivelse: " " });
    expect(r).toMatchObject({ ok: false, grunn: "manglerBeskrivelse" });
    expect(sedler()).toHaveLength(0);
  });
});

describe("U6 gren 3 — firma uten aktiv aktivitet", () => {
  it("«+ Fravær» kan ikke lagre; aldri \"\" mot serveren", () => {
    holder.raw.run("DELETE FROM aktivitet_local;");
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2026-11-16", linjer: [{ id: null, lonnsartId: "l-egen", timer: 2 }], beskrivelse: "x" });
    expect(r).toEqual({ ok: false, grunn: "manglerAktivitet", sheetId: null });
    expect(rader()).toHaveLength(0);
  });
});

describe("TF27 — fravær på framtidig dato (F8)", () => {
  it("framtidig dato lagres som en vanlig dag (vakt: ingen stille datosperre)", () => {
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2099-07-01", linjer: [{ id: null, lonnsartId: "l-ferie", timer: 7.5 }], beskrivelse: "Ferie" });
    expect(r.ok).toBe(true);
    expect(sedler()[0]!.dato).toBe("2099-07-01");
    expect(sedler()[0]!.status).toBe("draft");
  });
  it("sendt dag tar ikke nytt fravær", () => {
    db().insert(dagsseddelLocal).values({
      id: "s2", userId: "u1", organizationId: "o1", projectId: "", aktivitetId: "a-anl",
      dato: "2099-07-02", status: "sent", syncStatus: "synced", sistEndretLokalt: 1, sistSynkronisert: 1,
    }).run();
    const r = lagreFravaerKort(db(), { ...grunn, dato: "2099-07-02", linjer: [{ id: null, lonnsartId: "l-ferie", timer: 7.5 }], beskrivelse: "Ferie" });
    expect(r).toMatchObject({ ok: false, grunn: "dagLaast" });
  });
});
