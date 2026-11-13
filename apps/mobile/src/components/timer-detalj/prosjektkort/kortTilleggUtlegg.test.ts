import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * T7 + T9 (tillegg-utlegg-prosjektkort-spec.md § 9) — tillegg og utlegg hører
 * til prosjektkortet (prosjekt + effektiv byggeplass + underprosjekt).
 *  T7: `kortInnhold` gir kortets tillegg/utlegg (NULL byggeplass = arv fra sedelen).
 *  T9: «Endre kort» flytter dem, «Slett kort» sletter + tombstoner dem (B4),
 *      og løft av byggeplass-arv tar dem med (ellers hopper de kort).
 * EKTE SQLite (sql.js) + ekte migreringer, som `kortRadFlytt.test.ts`.
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
import { flyttKort, kortInnhold, loftByggeplassArv, slettKortLokalt, type KortDag } from "./kortRadFlytt";
import { skrivLonnstillegg, skrivUtlegg, type NyttUtlegg } from "../../../services/tilleggUtleggSkriv";
import type { KortValg } from "../../../lib/prosjektkortMobil";

const { dagsseddelLocal, sheetTilleggLocal, sheetUtleggLocal, slettedeRaderLocal } = schema;

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

beforeEach(() => {
  holder.uuid = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM slettede_rader_local;",
  );
  db()
    .insert(dagsseddelLocal)
    .values({
      id: "s1",
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      byggeplassId: "bpA",
      dato: "2026-11-13",
      status: "draft",
      syncStatus: "synced",
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
});

const SEDEL = { projectId: "p1", byggeplass: { id: "bpA", projectId: "p1" } };
/** Kortet sedelen arver: p1 + bpA, uten underprosjekt. */
const KORT_A: KortValg = { projectId: "p1", byggeplassId: "bpA", ecoId: null };
const KORT_ECO = { projectId: "p1", byggeplassId: "bpA", ecoId: "eco1" };
const MAAL = { projectId: "p2", byggeplassId: "bp2", ecoId: "eco2" };

type Felt = { projectId: string | null; byggeplassId?: string | null; externalCostObjectId?: string | null };
function tillegg(id: string, f: Felt) {
  db().insert(sheetTilleggLocal).values({ id, dagsseddelId: "s1", tilleggId: "t1", antall: 1, sistEndretLokalt: 1, ...f }).run();
}
function utlegg(id: string, f: Felt) {
  db()
    .insert(sheetUtleggLocal)
    .values({
      id,
      dagsseddelId: "s1",
      expenseCategoryId: "k1",
      belop: 100,
      ordningVedFoering: "utlegg",
      foertVed: 1,
      sistEndretLokalt: 1,
      ...f,
    })
    .run();
}
const tilleggRader = () => db().select().from(sheetTilleggLocal).all();
const utleggRader = () => db().select().from(sheetUtleggLocal).all();
const rad = <R extends { id: string }>(rader: R[], id: string) => rader.find((r) => r.id === id);

/** Arvende rad (A), rad på underprosjekt-kortet og rad i annet prosjekt. */
function treKort() {
  tillegg("t-arv", { projectId: "p1" });
  tillegg("t-eco", { projectId: "p1", externalCostObjectId: "eco1" });
  tillegg("t-p2", { projectId: "p2" });
  utlegg("u-arv", { projectId: "p1" });
  utlegg("u-eco", { projectId: "p1", externalCostObjectId: "eco1" });
  utlegg("u-p2", { projectId: "p2" });
}

const innholdFor = (kort: KortValg) =>
  kortInnhold({
    timerRader: [],
    maskinRader: [],
    varer: [],
    tilleggRader: tilleggRader(),
    utleggRader: utleggRader(),
    sedel: SEDEL,
    kort,
    reiseLonnsartId: null,
  });

const dag: KortDag = {
  sheetId: "s1",
  organizationId: "o1",
  status: "draft",
  pauseMin: 0,
  sedel: SEDEL,
  timerRader: [],
  maskinRader: [],
};
const server = {
  erPaaNettet: true,
  pushSedel: async () => true,
  flyttVare: async () => {},
};

describe("T7 — kortInnhold teller kortets tillegg og utlegg", () => {
  it("NULL byggeplass i sedelens prosjekt hører til sedelens byggeplass-kort", () => {
    treKort();
    const i = innholdFor(KORT_A);
    expect(i.tillegg?.map((r) => r.id)).toEqual(["t-arv"]);
    expect(i.utlegg?.map((r) => r.id)).toEqual(["u-arv"]);
    expect(innholdFor(KORT_ECO).tillegg?.map((r) => r.id)).toEqual(["t-eco"]);
  });

  it("negativkontroll: annet prosjekt og annet underprosjekt kommer ikke med; uten rader → tomt", () => {
    treKort();
    const i = innholdFor(KORT_A);
    expect(i.tillegg?.map((r) => r.id)).not.toContain("t-p2");
    expect(i.utlegg?.map((r) => r.id)).not.toContain("u-eco");
    const uten = kortInnhold({ timerRader: [], maskinRader: [], varer: [], sedel: SEDEL, kort: KORT_A, reiseLonnsartId: null });
    expect(uten.tillegg ?? []).toEqual([]);
    expect(uten.utlegg ?? []).toEqual([]);
  });
});

describe("T9 — Endre kort / Slett kort tar med tillegg og utlegg (B4)", () => {
  it("Endre kort flytter kortets tillegg og utlegg til målkortet", async () => {
    treKort();
    expect(await flyttKort(db(), dag, innholdFor(KORT_A), KORT_A, MAAL, server)).toEqual({ utfall: "ok" });
    expect(rad(tilleggRader(), "t-arv")).toMatchObject({ projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2" });
    expect(rad(utleggRader(), "u-arv")).toMatchObject({ projectId: "p2", byggeplassId: "bp2", externalCostObjectId: "eco2" });
    expect(rad(tilleggRader(), "t-arv")!.sistEndretLokalt).toBeGreaterThan(1);
  });

  it("negativkontroll: rader på andre kort røres ikke ved Endre kort", async () => {
    treKort();
    await flyttKort(db(), dag, innholdFor(KORT_A), KORT_A, MAAL, server);
    expect(rad(tilleggRader(), "t-eco")).toMatchObject({ projectId: "p1", externalCostObjectId: "eco1", sistEndretLokalt: 1 });
    expect(rad(utleggRader(), "u-p2")).toMatchObject({ projectId: "p2", byggeplassId: null, sistEndretLokalt: 1 });
  });

  it("til sedelens eget byggeplass-kort lagres NULL (arv), ikke byggeplassen", async () => {
    treKort();
    await flyttKort(db(), dag, innholdFor(KORT_ECO), KORT_ECO, KORT_A, server);
    expect(rad(tilleggRader(), "t-eco")).toMatchObject({ projectId: "p1", byggeplassId: null, externalCostObjectId: null });
  });

  it("Slett kort sletter kortets tillegg og utlegg og skriver tombstone", () => {
    treKort();
    slettKortLokalt(db(), "s1", innholdFor(KORT_A));
    expect(tilleggRader().map((r) => r.id).sort()).toEqual(["t-eco", "t-p2"]);
    expect(utleggRader().map((r) => r.id).sort()).toEqual(["u-eco", "u-p2"]);
    const tomb = db().select().from(slettedeRaderLocal).all();
    expect(tomb.map((t) => [t.radId, t.radType]).sort()).toEqual([
      ["t-arv", "tillegg"],
      ["u-arv", "utlegg"],
    ]);
  });

  it("negativkontroll: Slett kort på et annet kort lar disse radene og tombstonene være", () => {
    treKort();
    slettKortLokalt(db(), "s1", innholdFor({ projectId: "p3", byggeplassId: null, ecoId: null }));
    expect(tilleggRader()).toHaveLength(3);
    expect(utleggRader()).toHaveLength(3);
    expect(db().select().from(slettedeRaderLocal).all()).toEqual([]);
  });

  it("løft av byggeplass-arv skriver A på arvende tillegg/utlegg (ellers hopper de kort)", () => {
    treKort();
    expect(loftByggeplassArv(db(), "s1", SEDEL)).toBe(true);
    expect(rad(tilleggRader(), "t-arv")!.byggeplassId).toBe("bpA");
    expect(rad(utleggRader(), "u-arv")!.byggeplassId).toBe("bpA");
    expect(rad(tilleggRader(), "t-eco")!.byggeplassId).toBe("bpA");
  });

  it("negativkontroll: løft rører ikke rader i annet prosjekt", () => {
    treKort();
    loftByggeplassArv(db(), "s1", SEDEL);
    expect(rad(tilleggRader(), "t-p2")).toMatchObject({ byggeplassId: null, sistEndretLokalt: 1 });
    expect(rad(utleggRader(), "u-p2")).toMatchObject({ byggeplassId: null, sistEndretLokalt: 1 });
  });
});

describe("T11 — skrivevei uten kort-felt gir NULL (arv)", () => {
  const UTL: NyttUtlegg = {
    id: "u-ny", projectId: "p1", expenseCategoryId: "k1", belop: 10, kommentar: null,
    ordningVedFoering: "utlegg", foertVed: 5, kvittering: null,
  };
  const TIL = { lokalId: "t-ny", projectId: "p1", tilleggId: "t1", antall: 1, kommentar: null };

  it("dagskortet (ingen kortFelt): begge felt NULL, og raden hører til sedelens kort", () => {
    skrivLonnstillegg(db(), "s1", TIL, 5);
    skrivUtlegg(db(), "s1", UTL, () => "v");
    expect(rad(tilleggRader(), "t-ny")).toMatchObject({ byggeplassId: null, externalCostObjectId: null });
    expect(rad(utleggRader(), "u-ny")).toMatchObject({ byggeplassId: null, externalCostObjectId: null });
    const innhold = innholdFor(KORT_A);
    expect(innhold.tillegg!.map((r) => r.id)).toEqual(["t-ny"]);
    expect(innhold.utlegg!.map((r) => r.id)).toEqual(["u-ny"]);
  });

  it("negativkontroll: prosjektkortet (kortFelt satt) skriver feltene", () => {
    skrivLonnstillegg(db(), "s1", { ...TIL, byggeplassId: "bp9", externalCostObjectId: "eco9" }, 5);
    skrivUtlegg(db(), "s1", { ...UTL, byggeplassId: "bp9", externalCostObjectId: "eco9" }, () => "v");
    expect(rad(tilleggRader(), "t-ny")).toMatchObject({ byggeplassId: "bp9", externalCostObjectId: "eco9" });
    expect(rad(utleggRader(), "u-ny")).toMatchObject({ byggeplassId: "bp9", externalCostObjectId: "eco9" });
  });
});
