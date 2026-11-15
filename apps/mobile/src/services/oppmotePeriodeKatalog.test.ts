import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-15 (12) D — oppmøtested-periode-cachen (`oppmote_periode_local`).
 * Ekte SQLite (sql.js), samme harness som arbeidstidSvarKatalog.test.ts.
 *
 * Gate: pr.-bruker/pr.-firma-isolasjon · full overskriving · feilet pull beholder
 * cachen · offline etterregistrering i gammel periode gir gammelt sted.
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

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { løsOppmote, type OppmotePeriodeInput } from "@sitedoc/shared";
import {
  hentOppmotePerioderLokalt,
  refreshOppmotePeriodeKatalog,
  skrivOppmotePerioderLokalt,
} from "./oppmotePeriodeKatalog";

type Periode = OppmotePeriodeInput & { id: string };

const NARVIK_GAMMEL: Periode = {
  id: "p1", type: "kontor", fast: true, oppmotestedId: "narvik", projectId: null,
  fraDato: "2026-01-01", tilDato: "2026-10-31",
};
const TROMSO_NY: Periode = {
  id: "p2", type: "kontor", fast: true, oppmotestedId: "tromso", projectId: null,
  fraDato: "2026-11-01", tilDato: null,
};
const BYGGEPLASS: Periode = {
  id: "p3", type: "byggeplass", fast: false, oppmotestedId: null, projectId: "e6",
  fraDato: "2026-12-01", tilDato: "2027-01-31",
};

function klientSom(svar: () => Promise<{ perioder: Periode[]; trengerValg: boolean }>) {
  return { oppmotePeriode: { hentMine: { query: svar } } } as unknown as Parameters<
    typeof refreshOppmotePeriodeKatalog
  >[0];
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
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  holder.raw.run("DELETE FROM oppmote_periode_local;");
});

describe("oppmotePeriodeKatalog", () => {
  it("skriver og leser tilbake perioder med fast-flagg og datoer", () => {
    skrivOppmotePerioderLokalt("u1", "o1", [NARVIK_GAMMEL, TROMSO_NY, BYGGEPLASS]);
    const lest = hentOppmotePerioderLokalt("u1", "o1");
    expect(lest).toHaveLength(3);
    // id leses tilbake (L2): overføringen fører periode-id-en til reiseRegel.
    expect(lest).toContainEqual({
      id: "p1", type: "kontor", fast: true, oppmotestedId: "narvik", projectId: null,
      fraDato: "2026-01-01", tilDato: "2026-10-31", kilde: "admin",
    });
    expect(lest).toContainEqual({
      id: "p3", type: "byggeplass", fast: false, oppmotestedId: null, projectId: "e6",
      fraDato: "2026-12-01", tilDato: "2027-01-31", kilde: "admin",
    });
  });

  it("isolert pr. bruker og pr. firma", () => {
    skrivOppmotePerioderLokalt("u1", "o1", [NARVIK_GAMMEL]);
    skrivOppmotePerioderLokalt("u2", "o1", [TROMSO_NY]);
    skrivOppmotePerioderLokalt("u1", "o2", [BYGGEPLASS]);
    expect(hentOppmotePerioderLokalt("u1", "o1").map((p) => p.oppmotestedId)).toEqual(["narvik"]);
    expect(hentOppmotePerioderLokalt("u2", "o1").map((p) => p.oppmotestedId)).toEqual(["tromso"]);
    expect(hentOppmotePerioderLokalt("u1", "o2").map((p) => p.projectId)).toEqual(["e6"]);
    expect(hentOppmotePerioderLokalt("u2", "o2")).toEqual([]);
  });

  it("full overskriving: slettet periode på server forsvinner lokalt, andre brukere urørt", () => {
    skrivOppmotePerioderLokalt("u1", "o1", [NARVIK_GAMMEL, TROMSO_NY]);
    skrivOppmotePerioderLokalt("u2", "o1", [NARVIK_GAMMEL].map((p) => ({ ...p, id: "u2p" })));
    skrivOppmotePerioderLokalt("u1", "o1", [TROMSO_NY]);
    expect(hentOppmotePerioderLokalt("u1", "o1").map((p) => p.oppmotestedId)).toEqual(["tromso"]);
    expect(hentOppmotePerioderLokalt("u2", "o1")).toHaveLength(1);
    // Tom liste er gyldig → cachen tømmes.
    skrivOppmotePerioderLokalt("u1", "o1", []);
    expect(hentOppmotePerioderLokalt("u1", "o1")).toEqual([]);
  });

  it("refresh skriver serverens svar og returnerer trengerValg", async () => {
    const r = await refreshOppmotePeriodeKatalog(
      klientSom(async () => ({ perioder: [TROMSO_NY], trengerValg: false })), "u1", "o1",
    );
    expect(r).toEqual({ perioder: 1, trengerValg: false });
    expect(hentOppmotePerioderLokalt("u1", "o1")).toHaveLength(1);
  });

  it("feilet pull beholder eksisterende cache", async () => {
    skrivOppmotePerioderLokalt("u1", "o1", [NARVIK_GAMMEL, TROMSO_NY]);
    await expect(
      refreshOppmotePeriodeKatalog(klientSom(async () => { throw new Error("nett"); }), "u1", "o1"),
    ).rejects.toThrow("nett");
    expect(hentOppmotePerioderLokalt("u1", "o1")).toHaveLength(2);
  });

  it("offline etterregistrering: gammel dato gir gammelt fast sted fra cachen", () => {
    skrivOppmotePerioderLokalt("u1", "o1", [NARVIK_GAMMEL, TROMSO_NY, BYGGEPLASS]);
    const perioder = hentOppmotePerioderLokalt("u1", "o1");
    expect(løsOppmote("2026-10-15", null, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: "narvik" });
    expect(løsOppmote("2026-11-15", null, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: "tromso" });
    expect(løsOppmote("2026-12-10", "e6", perioder, null)).toEqual({ kilde: "byggeplass", projectId: "e6" });
  });

  it("negativkontroll: tom cache gir ikkeValgt, aldri gjetting", () => {
    expect(løsOppmote("2026-10-15", null, hentOppmotePerioderLokalt("u1", "o1"), null)).toEqual({
      kilde: "ikkeValgt",
    });
  });
});
