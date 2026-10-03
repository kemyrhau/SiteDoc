import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Offline-liste fase 1 for oppgaver — oppgave_local-katalogen. Ekte SQLite
 * (sql.js/WASM), samme harness som timerSync.test.ts / arbeidstidSvarKatalog.test.ts:
 * expo-sqlite byttes med sql.js, migreringene kjører uendret, hentDatabase() gir
 * Drizzle over samme base. tRPC-klienten er en stubb.
 *
 * Gate 1:
 *  (a) refresh fyller speilet.
 *  (b) 🔴 feilet henting BEHOLDER gammel cache. Rød-først verifisert manuelt ved
 *      å flytte delete() FØR query() i en engangskopi (da tømmes cachen og testen
 *      feiler) — vakten er at pullen kaster FØR den destruktive scope-deleten.
 *  (c) prosjekt A's refresh rører ikke prosjekt B's rader.
 *  + byggeplass-scoping: tre-ledds tegningsfilter kollapser til «valgt ELLER
 *    byggeplass-løs» via utledet byggeplassId (drawing.byggeplass.id).
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
import {
  refreshOppgaveKatalog,
  hentOppgaverLokalt,
  tellOppgaverLokalt,
  hentSistOppdatertOppgaveLokalt,
} from "./oppgaveKatalog";

type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

/** Server-rad-form oppgave.hentForProsjekt leverer (kun feltene speilet leser). */
function serverOppgave(over: {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  number?: number | null;
  subdomain?: string | null;
  byggeplassId?: string | null; // utledes via drawing.byggeplass.id
  drawingId?: string | null;
}) {
  const harTegning = over.drawingId !== undefined ? over.drawingId !== null : over.byggeplassId !== undefined;
  return {
    id: over.id,
    title: over.title ?? `Oppgave ${over.id}`,
    status: over.status ?? "open",
    priority: over.priority ?? "medium",
    number: over.number ?? 1,
    dueDate: null,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    template: { name: "Mal", prefix: "OPG", subdomain: over.subdomain ?? null },
    utforerFaggruppe: { name: "Tømrer" },
    // Tegning-ledd: null drawing → oppgave uten tegning (gjelder hele prosjektet).
    drawing: harTegning ? { byggeplass: over.byggeplassId ? { id: over.byggeplassId } : null } : null,
  };
}

function lagKlient(rader: ReturnType<typeof serverOppgave>[]) {
  return {
    oppgave: { hentForProsjekt: { query: async () => rader } },
  } as unknown as Parameters<typeof refreshOppgaveKatalog>[0];
}

function kastendeKlient() {
  return {
    oppgave: {
      hentForProsjekt: {
        query: async () => {
          throw new Error("offline");
        },
      },
    },
  } as unknown as Parameters<typeof refreshOppgaveKatalog>[0];
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
  holder.raw.run("DELETE FROM oppgave_local;");
});

describe("refreshOppgaveKatalog + lesere", () => {
  it("(a) refresh fyller speilet", async () => {
    const r = await refreshOppgaveKatalog(
      lagKlient([serverOppgave({ id: "o1" }), serverOppgave({ id: "o2" })]),
      "p1",
    );
    expect(r.oppgaver).toBe(2);
    expect(tellOppgaverLokalt("p1")).toBe(2);
    const rader = hentOppgaverLokalt("p1");
    expect(rader.map((x) => x.id).sort()).toEqual(["o1", "o2"]);
    expect(rader[0].template?.prefix).toBe("OPG");
  });

  it("refresh er idempotent (full overskriving, ingen duplikater)", async () => {
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "o1" })]), "p1");
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "o1" })]), "p1");
    expect(tellOppgaverLokalt("p1")).toBe(1);
  });

  it("🔴 (b) feilet henting beholder gammel cache", async () => {
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "o1" })]), "p1");
    expect(tellOppgaverLokalt("p1")).toBe(1);
    // Pullen kaster FØR scope-deleten → cachen skal bestå.
    await expect(refreshOppgaveKatalog(kastendeKlient(), "p1")).rejects.toThrow("offline");
    expect(tellOppgaverLokalt("p1")).toBe(1);
    expect(hentOppgaverLokalt("p1")[0].id).toBe("o1");
  });

  it("(c) prosjekt A's refresh rører ikke prosjekt B's rader", async () => {
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "a1" })]), "A");
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "b1" })]), "B");
    // Ny refresh av A med tomt svar: sletter kun A, lar B stå.
    await refreshOppgaveKatalog(lagKlient([]), "A");
    expect(tellOppgaverLokalt("A")).toBe(0);
    expect(tellOppgaverLokalt("B")).toBe(1);
    expect(hentOppgaverLokalt("B")[0].id).toBe("b1");
  });

  it("byggeplass-scoping: utledet byggeplassId kollapser tre-ledds filter til «valgt ELLER løs»", async () => {
    await refreshOppgaveKatalog(
      lagKlient([
        serverOppgave({ id: "paa-bp1", byggeplassId: "bp1", drawingId: "d1" }), // tegning på bp1
        serverOppgave({ id: "prosjekt-tegning", byggeplassId: null, drawingId: "d2" }), // prosjekt-tegning
        serverOppgave({ id: "uten-tegning", drawingId: null }), // ingen tegning
      ]),
      "p1",
    );
    // Valgt bp1: oppgaven på bp1 + de to byggeplass-løse (prosjekt-tegning/ingen tegning).
    const scopeBp1 = hentOppgaverLokalt("p1", "bp1").map((x) => x.id).sort();
    expect(scopeBp1).toEqual(["paa-bp1", "prosjekt-tegning", "uten-tegning"]);
    // Valgt bp2 (annen byggeplass): bp1-oppgaven forsvinner, de løse består.
    const scopeBp2 = hentOppgaverLokalt("p1", "bp2").map((x) => x.id).sort();
    expect(scopeBp2).toEqual(["prosjekt-tegning", "uten-tegning"]);
    // Hele prosjektet (ingen byggeplass): alle tre.
    expect(hentOppgaverLokalt("p1").length).toBe(3);
  });

  it("hentSistOppdatert gir prosjektets stempel, null når ikke cachet", async () => {
    expect(hentSistOppdatertOppgaveLokalt("p1")).toBeNull();
    await refreshOppgaveKatalog(lagKlient([serverOppgave({ id: "o1" })]), "p1");
    expect(hentSistOppdatertOppgaveLokalt("p1")).toBeGreaterThan(0);
  });
});
