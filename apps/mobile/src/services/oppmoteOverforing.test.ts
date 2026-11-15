import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * POST 2026-11-15 (13) del B — overføring fra reise-kortet på mobil.
 * EKTE SQLite (sql.js) + ekte migreringer. tRPC-klienten er en stubb.
 *  - optimistisk skriving følger planleggOverforing (lukk/slett åpen, ny åpen);
 *  - konflikt mot admin-periode → ingen lokal endring, ingenting i køen;
 *  - kø-id = periodens id (serveren er idempotent på den);
 *  - suksess og CONFLICT fjerner kallet, refresh overskriver lokal tilstand;
 *  - nettfeil lar køen stå (forsøk +1) og stopper resten (rekkefølge).
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as { run: (sql: string, params?: unknown[]) => void; prepare: (sql: string) => { step(): boolean; getAsObject(): Record<string, unknown>; bind(p: unknown[]): void; free(): void }; getRowsModified(): number },
  shim: null as unknown,
  drizzle: null as unknown,
  uuid: 0,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("expo-crypto", () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++holder.uuid).padStart(12, "0")}` }));
vi.mock("../db/database", () => ({ erDatabaseTilgjengelig: () => true, hentDatabase: () => holder.drizzle }));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { registrerOverforing, sendOverforingKo } from "./oppmoteOverforing";
import { hentOppmotePerioderLokalt, skrivOppmotePerioderLokalt } from "./oppmotePeriodeKatalog";

const U = "u1";
const O = "o1";
const FAST = { id: "fast", type: "kontor" as const, fast: true, oppmotestedId: "narvik", projectId: null, fraDato: "2026-01-01", tilDato: null, kilde: "admin" as const };

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
  holder.raw.run("DELETE FROM oppmote_periode_local; DELETE FROM oppmote_overforing_ko;");
  skrivOppmotePerioderLokalt(U, O, [FAST]);
});

function ko() {
  return (holder.drizzle as ReturnType<typeof drizzle<typeof schema>>).select().from(schema.oppmoteOverforingKo).all();
}
function apne() {
  return hentOppmotePerioderLokalt(U, O).filter((p) => !p.fast);
}

/** Stubb-klient: `overforing` gjør det `oppforsel` sier; hentMine gir `server`. */
function klient(oppforsel: (input: unknown) => Promise<unknown>, server: unknown[] = [FAST]) {
  const kall: unknown[] = [];
  const k = {
    oppmotePeriode: {
      overforing: { mutate: async (i: unknown) => { kall.push(i); return oppforsel(i); } },
      hentMine: { query: async () => ({ perioder: server, trengerValg: false }) },
    },
  };
  return { k: k as never, kall };
}

describe("registrerOverforing (optimistisk)", () => {
  it("start skriver åpen kilde=overforing lokalt og legger kallet i køen med samme id", () => {
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" }).utfall).toBe("opprettet");
    const [p] = apne();
    expect(p).toMatchObject({ oppmotestedId: "ramsund", fraDato: "2026-11-10", tilDato: null, kilde: "overforing" });
    expect(ko()).toHaveLength(1);
    expect(ko()[0]).toMatchObject({ id: p!.id, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" });
  });

  it("ny Tur lukker forrige overføring dagen før; Tur hjem lukker den", () => {
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-01" });
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "harstad", dato: "2026-11-10" });
    expect(apne().map((p) => [p.oppmotestedId, p.fraDato, p.tilDato])).toEqual(
      expect.arrayContaining([["ramsund", "2026-11-01", "2026-11-09"], ["harstad", "2026-11-10", null]]),
    );
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "narvik", dato: "2026-11-20" }).utfall).toBe("lukket");
    expect(apne().find((p) => p.oppmotestedId === "harstad")?.tilDato).toBe("2026-11-19");
    expect(ko()).toHaveLength(3);
  });

  it("oppgitt id blir periodens og kallets id; periodeId peker på perioden reisen hører til", () => {
    const start = registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10", id: "fast-id" });
    expect(start).toEqual({ utfall: "opprettet", periodeId: "fast-id" });
    expect(apne()[0]?.id).toBe("fast-id");
    expect(ko()[0]?.id).toBe("fast-id");
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-12" }))
      .toEqual({ utfall: "ingen", periodeId: "fast-id" });
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "slutt", dato: "2026-11-15" }))
      .toEqual({ utfall: "lukket", periodeId: "fast-id" });
  });

  it("Avslutt før start sletter overføringen lokalt (angre)", () => {
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" });
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "slutt", dato: "2026-11-09" }).utfall).toBe("slettet");
    expect(apne()).toEqual([]);
  });

  it("åpen admin-periode → konflikt, ingen lokal endring og tom kø", () => {
    skrivOppmotePerioderLokalt(U, O, [FAST, { ...FAST, id: "adm", fast: false, oppmotestedId: "harstad", fraDato: "2026-11-01", kilde: "admin" }]);
    expect(registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" }).utfall).toBe("konflikt");
    expect(apne().map((p) => p.id)).toEqual(["adm"]);
    expect(ko()).toEqual([]);
  });
});

describe("sendOverforingKo", () => {
  it("suksess fjerner kallet og refresh overskriver lokal tilstand", async () => {
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" });
    const id = ko()[0]!.id;
    const server = [FAST, { id, type: "kontor", fast: false, oppmotestedId: "ramsund", projectId: null, fraDato: "2026-11-10", tilDato: null, kilde: "overforing" }];
    const { k, kall } = klient(async () => ({ utfall: "opprettet" }), server);
    expect(await sendOverforingKo(k, U)).toEqual({ sendt: 1, avvist: 0, venter: 0 });
    expect(kall).toEqual([{ id, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" }]);
    expect(ko()).toEqual([]);
    expect(apne().map((p) => p.id)).toEqual([id]);
  });

  it("CONFLICT fjerner kallet og serveren vinner (lokal overføring forsvinner)", async () => {
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" });
    const { k } = klient(async () => { throw Object.assign(new Error("Overlapper"), { data: { code: "CONFLICT" } }); }, [FAST]);
    expect(await sendOverforingKo(k, U)).toEqual({ sendt: 0, avvist: 1, venter: 0 });
    expect(ko()).toEqual([]);
    expect(apne()).toEqual([]);
  });

  it("nettfeil lar køen stå, teller forsøk og stopper resten", async () => {
    registrerOverforing({ userId: U, organizationId: O, handling: "start", oppmotestedId: "ramsund", dato: "2026-11-01" });
    registrerOverforing({ userId: U, organizationId: O, handling: "slutt", dato: "2026-11-10" });
    const { k, kall } = klient(async () => { throw new Error("Network request failed"); });
    expect(await sendOverforingKo(k, U)).toEqual({ sendt: 0, avvist: 0, venter: 2 });
    expect(kall).toHaveLength(1);
    expect(ko().map((r) => [r.handling, r.forsok])).toEqual([["start", 1], ["slutt", 0]]);
    // Optimistisk tilstand står til serveren har svart.
    expect(apne()[0]).toMatchObject({ oppmotestedId: "ramsund", tilDato: "2026-11-10" });
  });
});
