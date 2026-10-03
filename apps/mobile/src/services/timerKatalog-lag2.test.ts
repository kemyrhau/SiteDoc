import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * LAG 2 (L2-B TILLEGG 2, gate-test c) — `erReiseLonnsartLokalt`: mobilens B4-
 * deteksjon av om en manuelt valgt lønnsart ER en reise-art. Avgjørelsen styrer
 * at en manuell reise-rad skrives med `erReise=true` + `reiseKilde="manuell"`
 * (M3: eksplisitt, ikke server-gjetting). Delt regel `erReiseLonnsart` fra
 * @sitedoc/shared — her verifiseres at mobilen bygger konteksten riktig fra
 * lokal cache (reiseLonnsartId ∪ grensepunkt-arter, ellers navne-match).
 *
 * EKTE SQLite (sql.js), samme harness som `timerSync.test.ts`.
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

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { erReiseLonnsartLokalt } from "./timerKatalog";

const { lonnsartLocal, organizationSettingLocal, reiseGrensepunktLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

function seedLonnsart(id: string, navn: string) {
  db()
    .insert(lonnsartLocal)
    .values({ id, organizationId: "o1", type: "ordinaer", navn, sistOppdatert: 1 })
    .run();
}

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
  holder.raw.run(
    "DELETE FROM lonnsart_local; DELETE FROM organization_setting_local; DELETE FROM reise_grensepunkt_local;",
  );
});

describe("erReiseLonnsartLokalt — B4 reise-deteksjon (gate c)", () => {
  it("🔴 (c) konfigurert reise-art → true (manuell rad får erReise=true + reiseKilde=manuell)", () => {
    db()
      .insert(organizationSettingLocal)
      .values({ organizationId: "o1", reiseLonnsartId: "reise-art", sistOppdatert: 1 })
      .run();
    seedLonnsart("reise-art", "Reise til prosjekt");
    seedLonnsart("timelonn", "Timelønn");
    // Rød uten erReiseLonnsartLokalt/B4: manuell rad bar ikke erReise (server utledet).
    expect(erReiseLonnsartLokalt("o1", "reise-art")).toBe(true);
    // Ikke-reise art → false (manuell rad: erReise=false, reiseKilde=null).
    expect(erReiseLonnsartLokalt("o1", "timelonn")).toBe(false);
  });

  it("grensepunkt-art (avstandsbånd) → true, uansett navn", () => {
    db()
      .insert(organizationSettingLocal)
      .values({ organizationId: "o1", reiseLonnsartId: "reise-art", sistOppdatert: 1 })
      .run();
    seedLonnsart("band-25", "Transporttillegg sone 2");
    db()
      .insert(reiseGrensepunktLocal)
      .values({ organizationId: "o1", grenseM: 25000, lonnsartId: "band-25", sistOppdatert: 1 })
      .run();
    expect(erReiseLonnsartLokalt("o1", "band-25")).toBe(true);
  });

  it("navne-match KUN når firmaet IKKE har konfigurert reiseLonnsartId", () => {
    // Uten konfigurert art: navnet avgjør (speiler serverens utledErReise).
    db()
      .insert(organizationSettingLocal)
      .values({ organizationId: "o1", reiseLonnsartId: null, sistOppdatert: 1 })
      .run();
    seedLonnsart("x", "Transport av masser");
    seedLonnsart("y", "Akkord");
    expect(erReiseLonnsartLokalt("o1", "x")).toBe(true);
    expect(erReiseLonnsartLokalt("o1", "y")).toBe(false);
  });
});
