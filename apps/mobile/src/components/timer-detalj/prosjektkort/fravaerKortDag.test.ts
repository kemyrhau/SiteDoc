import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * TILLEGG (33) pkt 4.1 — fraværskortet i Bekreft dag (harness som fravaerKortLagring.test.ts).
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

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../../../db/schema";
import { kjorMigreringer } from "../../../db/migreringer";
import { lagreFravaerKort } from "./fravaerKortLagring";
import { forslagSomDagRader, fravaerVedBekreft, hentFravaerKortDag } from "./fravaerKortDag";
import { fravaerRest } from "../../../utils/fravaerKort";
import { finnNormtakArtLokalt } from "../../../services/timerKatalog";

const { dagsseddelLocal, lonnsartLocal, sheetTimerLocal } = schema;

type Db = NonNullable<ReturnType<typeof import("../../../db/database").hentDatabase>>;
const db = () => holder.drizzle as Db;

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
const sedler = () => db().select().from(dagsseddelLocal).all();

const sedel = (id: string, dato: string, status: "draft" | "sent" = "draft", projectId = "p1") =>
  db().insert(dagsseddelLocal).values({
    id, userId: "u1", organizationId: "o1", projectId, aktivitetId: "a-anl",
    dato, status, syncStatus: "synced", sistEndretLokalt: 1, sistSynkronisert: 1,
  }).run();
const timerRad = (id: string, sheetId: string, lonnsartId: string, timer: number, ekstra: Partial<typeof sheetTimerLocal.$inferInsert> = {}) =>
  db().insert(sheetTimerLocal).values({
    id, dagsseddelId: sheetId, projectId: "p1", lonnsartId, aktivitetId: "a-anl", timer, sistEndretLokalt: 1, ...ekstra,
  } as typeof sheetTimerLocal.$inferInsert).run();

describe("TF9 (Bekreft dag) — datoens fraværskort leses for seg", () => {
  it("dato uten sedel → tomt kort, ikke låst", () => {
    expect(hentFravaerKortDag(db(), { userId: "u1", dato: "2026-11-16" })).toEqual({
      sheetId: null, laast: false, fravaerRader: [], andreRader: [],
    });
  });

  it("fraværsrader og øvrige rader skilles; reise teller ikke som arbeid", () => {
    sedel("s1", "2026-11-16");
    timerRad("t-arb", "s1", "l-arb", 3);
    timerRad("t-reise", "s1", "l-arb", 1, { erReise: true });
    timerRad("t-fra", "s1", "l-egen", 4.5, { projectId: null, utenProsjekt: true, beskrivelse: "Syk" });
    const d = hentFravaerKortDag(db(), { userId: "u1", dato: "2026-11-16" });
    expect(d.sheetId).toBe("s1");
    expect(d.fravaerRader).toEqual([{ id: "t-fra", lonnsartId: "l-egen", timer: 4.5, beskrivelse: "Syk" }]);
    expect(d.andreRader.map((r) => [r.id, r.erReise])).toEqual([["t-arb", false], ["t-reise", true]]);
  });

  it("forhåndsutfylling i Bekreft dag teller forslagets arbeid: norm 7,5 − 3 t forslag → 4,5; + 2 t annet fravær → 2,5", () => {
    const forslag = forslagSomDagRader([
      { lonnsartId: "l-arb", timer: 3, erReise: false },
      { lonnsartId: "l-arb", timer: 1, erReise: true },
    ]);
    const rest = (dagRader: typeof forslag) =>
      fravaerRest({ dagsnorm: 7.5, dagRader, kortLinjer: [], key: null, finnArt: finnNormtakArtLokalt });
    expect(rest(forslag)).toBe(4.5);
    expect(rest([...forslag, { id: "x", lonnsartId: "l-ferie", timer: 2, erReise: false }])).toBe(2.5);
  });

  it("sendt dag er låst", () => {
    sedel("s1", "2026-11-16", "sent");
    expect(hentFravaerKortDag(db(), { userId: "u1", dato: "2026-11-16" }).laast).toBe(true);
  });
});

describe("U8 — «Bekreft og lagre» med fraværskort", () => {
  it("intet prosjekt + lagret fraværskort → til dagen (manglerProsjekt sperrer bare arbeidskort)", () => {
    expect(fravaerVedBekreft({ manglerProsjekt: true, fravaerRader: [{ beskrivelse: "Syk" }] })).toBe("tilDagen");
  });
  it("intet prosjekt og intet fraværskort → vanlig sperre (null her, `manglerProsjekt` gjelder)", () => {
    expect(fravaerVedBekreft({ manglerProsjekt: true, fravaerRader: [] })).toBeNull();
  });
  it("prosjekt valgt → vanlig Bekreft", () => {
    expect(fravaerVedBekreft({ manglerProsjekt: false, fravaerRader: [{ beskrivelse: "Syk" }] })).toBeNull();
  });
  it("TF9: fraværskort uten beskrivelse sperrer Bekreft (F4), også med prosjekt", () => {
    expect(fravaerVedBekreft({ manglerProsjekt: false, fravaerRader: [{ beskrivelse: "  " }] })).toBe("manglerBeskrivelse");
    expect(fravaerVedBekreft({ manglerProsjekt: true, fravaerRader: [{ beskrivelse: null }] })).toBe("manglerBeskrivelse");
  });
});

describe("TF27 (Bekreft dag, manuell) — framtidig dato", () => {
  it("«+ Fravær» på framtidig dato lagres, leses tilbake i Bekreft dag og går til dagen uten prosjekt", () => {
    const dato = "2027-01-15";
    const r = lagreFravaerKort(db(), {
      ...grunn, dato, linjer: [{ id: null, lonnsartId: "l-egen", timer: 7.5 }], beskrivelse: "Legetime",
    });
    expect(r.ok).toBe(true);
    const d = hentFravaerKortDag(db(), { userId: "u1", dato });
    expect(d.laast).toBe(false);
    expect(d.fravaerRader).toHaveLength(1);
    expect(sedler()[0]!.status).toBe("draft");
    expect(fravaerVedBekreft({ manglerProsjekt: true, fravaerRader: d.fravaerRader })).toBe("tilDagen");
  });
});
