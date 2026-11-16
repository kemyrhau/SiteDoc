import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-15 (14) punkt 1 / test (i) — timer-lista, ukesummen,
 * statusbarens konflikt-sedel og konflikt-/avvist-tellerne viser bare VALGT
 * firma. EKTE spørringer mot EKTE SQLite (sql.js), samme harness som
 * `timerSync-firma-gruppering.test.ts`.
 * 🔴 Feiler når `organizationId`-filteret fjernes fra noen av lesingene.
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
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { lesDagssedlerLokalt, lesUkeTotalLokalt, finnEldsteKonfliktSedelId } from "./timerListeLokal";
import { tellAvvist, tellConflict } from "./timerSync";

const { dagsseddelLocal, sheetTimerLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

// Onsdag i uke 46 — begge sedlene under ligger i samme uke.
const NAA = new Date(2026, 10, 11, 12, 0, 0);

function sedel(id: string, organizationId: string, dato: string, syncStatus: "pending" | "synced" | "conflict" | "avvist", timer: number) {
  db()
    .insert(dagsseddelLocal)
    .values({
      id, userId: "u1", organizationId, projectId: "p1", aktivitetId: "a1",
      dato, status: "draft", syncStatus, sistEndretLokalt: 1000,
    })
    .run();
  db()
    .insert(sheetTimerLocal)
    .values({ id: `${id}-r`, dagsseddelId: id, lonnsartId: "l1", aktivitetId: "a1", timer, sistEndretLokalt: 1000 })
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
  holder.raw.run("DELETE FROM sheet_timer_local;");
  holder.raw.run("DELETE FROM dagsseddel_local;");
  // Firma A: én konflikt + én avvist; firma B: én konflikt.
  sedel("a-1", "firma-a", "2026-11-09", "conflict", 7.5);
  sedel("a-2", "firma-a", "2026-11-10", "avvist", 4);
  sedel("b-1", "firma-b", "2026-11-09", "conflict", 2);
});

describe("POST (14) (i) — bare valgt firma", () => {
  it("lista: bare sedlene i valgt firma (B-sedel samme dato som A vises ikke)", () => {
    expect(lesDagssedlerLokalt("u1", "firma-a").map((r) => r.id).sort()).toEqual(["a-1", "a-2"]);
    expect(lesDagssedlerLokalt("u1", "firma-b").map((r) => r.id)).toEqual(["b-1"]);
  });
  it("lista: firma der brukeren ikke har sedler → tom; intet firma valgt → tom", () => {
    expect(lesDagssedlerLokalt("u1", "firma-c")).toEqual([]);
    expect(lesDagssedlerLokalt("u1", null)).toEqual([]);
  });
  it("ukesum: bare valgt firma", () => {
    expect(lesUkeTotalLokalt("u1", "firma-a", NAA)).toMatchObject({ totalt: 11.5, antall: 2 });
    expect(lesUkeTotalLokalt("u1", "firma-b", NAA)).toMatchObject({ totalt: 2, antall: 1 });
    expect(lesUkeTotalLokalt("u1", null, NAA)).toMatchObject({ totalt: 0, antall: 0 });
  });
  it("statusbar: konflikt-sedelen som åpnes er i valgt firma", () => {
    expect(finnEldsteKonfliktSedelId("u1", "firma-a")).toBe("a-1");
    expect(finnEldsteKonfliktSedelId("u1", "firma-b")).toBe("b-1");
    expect(finnEldsteKonfliktSedelId("u1", "firma-c")).toBeNull();
  });
  it("tellere: konflikt/avvist pr. valgt firma; uten orgId firma-bredt (provider-signal)", () => {
    expect([tellConflict("u1", "firma-a"), tellAvvist("u1", "firma-a")]).toEqual([1, 1]);
    expect([tellConflict("u1", "firma-b"), tellAvvist("u1", "firma-b")]).toEqual([1, 0]);
    expect([tellConflict("u1", null), tellAvvist("u1", null)]).toEqual([0, 0]);
    expect([tellConflict("u1"), tellAvvist("u1")]).toEqual([2, 1]);
  });
});

describe("(16) punkt 5 — ukeintervall på lokal dato (TZ=Europe/Oslo)", () => {
  let forrigeTz: string | undefined;
  beforeAll(() => {
    forrigeTz = process.env.TZ;
    process.env.TZ = "Europe/Oslo";
  });
  afterAll(() => {
    if (forrigeTz === undefined) delete process.env.TZ;
    else process.env.TZ = forrigeTz;
  });

  it("søndag 15.11 tas med i uka, forrige søndag 08.11 ikke", () => {
    // Bevis på at TZ faktisk virker i denne prosessen (CET = UTC+1).
    expect(new Date(2026, 10, 15).getTimezoneOffset()).toBe(-60);
    sedel("tz-man", "firma-tz", "2026-11-09", "synced", 1);
    sedel("tz-son", "firma-tz", "2026-11-15", "synced", 3);
    sedel("tz-forrige-son", "firma-tz", "2026-11-08", "synced", 5);
    const sondag = new Date(2026, 10, 15, 12, 0, 0);
    expect(lesUkeTotalLokalt("u1", "firma-tz", sondag)).toMatchObject({ totalt: 4, antall: 2, ukeNr: 46 });
  });
});

describe("(16) punkt 5 — vakter", () => {
  const les = (rel: string) => readFileSync(path.join(__dirname, rel), "utf8");

  it("ingen UTC-dato fra lokal midnatt i timer-lesingene", () => {
    for (const f of ["./timerListeLokal.ts", "./kalenderKatalog.ts", "../../app/timer/mine.tsx"]) {
      const kode = les(f).replace(/datoRaw\.toISOString\(\)\.slice\(0, 10\)/g, "");
      expect(kode, f).not.toContain("toISOString().slice(0, 10)");
    }
  });

  it("ukesummen leses sammen med lista (følger lagring/synk), ikke i en memo i banneret", () => {
    expect(les("../components/UkeTotalBanner.tsx")).not.toContain("lesUkeTotalLokalt");
    expect(les("../components/DagsseddelListe.tsx")).toContain(
      "setUkeTotal(lesUkeTotalLokalt(bruker.id, valgtFirmaId));",
    );
  });
});
