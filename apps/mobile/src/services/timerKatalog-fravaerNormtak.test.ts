import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import { harNormtak } from "@sitedoc/shared";

/**
 * 🔴 TF20 (ORDRE (33) c3, spec § 11.10.4 «Mobil (ordre c)»): lokal katalogkolonne
 * `lonnsart_local.fravaer_normtak`.
 *  1. En eksisterende installasjon (tabellen i formen FØR kolonnen, med én gammel rad)
 *     får kolonnen av migreringen; den gamle raden står med NULL → tak (`harNormtak`).
 *  2. `refreshKatalog` skriver serverens verdi (true/false) til kolonnen.
 *  3. Et svar uten feltet (gammel API) → NULL → tak.
 * EKTE SQLite (sql.js). Negativkontroll: kolonnen mangler før migrering.
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
import { refreshKatalog, finnLonnsartLokalt } from "./timerKatalog";

function kolonner(tabell: string): string[] {
  const res = holder.raw.exec(`PRAGMA table_info(${tabell})`);
  return res[0]?.values.map((r) => String(r[1])) ?? [];
}

let kolonnerFoer: string[] = [];

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
  // Installasjon fra før kolonnen: lonnsart_local i gammel form med én rad.
  raw.run(`
    CREATE TABLE lonnsart_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      kode TEXT,
      navn TEXT NOT NULL,
      pris_mot_kunde TEXT,
      internkostnad TEXT,
      sats TEXT,
      sats_enhet TEXT,
      rekkefolge INTEGER NOT NULL DEFAULT 0,
      aktiv INTEGER NOT NULL DEFAULT 1,
      seed_nivaa INTEGER,
      sist_oppdatert INTEGER NOT NULL
    );
  `);
  raw.run(
    "INSERT INTO lonnsart_local (id, organization_id, type, navn, sist_oppdatert) VALUES ('gammel', 'o1', 'fravaer', 'Egenmelding', 1)",
  );
  kolonnerFoer = kolonner("lonnsart_local");
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

function lonnsart(id: string, fravaerNormtak?: boolean | null) {
  return {
    id,
    organizationId: "o1",
    type: "fravaer",
    kode: null,
    navn: id,
    prisMotKunde: null,
    internkostnad: null,
    sats: null,
    satsEnhet: null,
    rekkefolge: 0,
    aktiv: true,
    erStandardvalg: false,
    overtidsnivaa: null,
    seedNivaa: null,
    ...(fravaerNormtak === undefined ? {} : { fravaerNormtak }),
  };
}

function klient(lonnsarter: unknown[]) {
  const q = (v: unknown) => ({ query: async () => v });
  return {
    timer: {
      lonnsart: { list: q(lonnsarter) },
      aktivitet: { list: q([]) },
      tillegg: { list: q([]) },
      expenseCategory: { katalogForMobil: q({ kategorier: [], overstyringer: [] }) },
    },
    eksternKostObjekt: { list: q([]) },
  } as unknown as Parameters<typeof refreshKatalog>[0];
}

describe("🔴 TF20 — lokal katalogkolonne fravaer_normtak", () => {
  it("migreringen legger kolonnen på en eksisterende installasjon (negativkontroll: manglet før)", () => {
    expect(kolonnerFoer).not.toContain("fravaer_normtak");
    expect(kolonner("lonnsart_local")).toContain("fravaer_normtak");
  });

  it("gammel rad står med NULL → tak (harNormtak)", () => {
    const rad = finnLonnsartLokalt("gammel");
    expect(rad?.fravaerNormtak ?? null).toBeNull();
    expect(harNormtak(rad ?? {})).toBe(true);
  });

  it("andre kjøring er idempotent", () => {
    expect(() => kjorMigreringer()).not.toThrow();
  });

  it("refreshKatalog skriver serverens verdi; manglende felt → NULL → tak", async () => {
    await refreshKatalog(
      klient([lonnsart("permisjon", false), lonnsart("sykmelding", true), lonnsart("gammelApi")]),
    );
    expect(finnLonnsartLokalt("permisjon")?.fravaerNormtak).toBe(false);
    expect(harNormtak(finnLonnsartLokalt("permisjon")!)).toBe(false);
    expect(finnLonnsartLokalt("sykmelding")?.fravaerNormtak).toBe(true);
    expect(finnLonnsartLokalt("gammelApi")?.fravaerNormtak ?? null).toBeNull();
    expect(harNormtak(finnLonnsartLokalt("gammelApi")!)).toBe(true);
  });
});
