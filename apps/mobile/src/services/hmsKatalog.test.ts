import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Offline-liste fase 1 for HMS — hms_local-katalogen. Ekte SQLite (sql.js/WASM),
 * samme harness som oppgaveKatalog.test.ts.
 *
 * Gate 1: (a) refresh fyller · (b) 🔴 feilet henting beholder cache · (c) prosjekt-
 *   isolasjon · byggeplass-scoping (Task via tegning + Checklist direkte).
 * Gate 2: 🔴 HMS-speilet inneholder INGEN URL-/data-felt (signerte vedleggs-URL-er
 *   fra hms.hentDokumenter utløper 15 min og skal aldri lagres).
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
  refreshHmsKatalog,
  hentHmsLokalt,
  tellHmsLokalt,
  hentSistOppdatertHmsLokalt,
} from "./hmsKatalog";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const SIGNERT_URL = "https://signed.example/vedlegg.jpg?X-Amz-Signature=abc123";

/** Task-rad (avvik/ruh): byggeplass via tegning (drawing.byggeplassId). */
function task(over: { id: string; byggeplassId?: string | null; status?: string }) {
  return {
    id: over.id,
    title: `Task ${over.id}`,
    status: over.status ?? "open",
    number: 1,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    template: { name: "Avvik", prefix: "AVV" },
    bestillerFaggruppe: { name: "Tømrer" },
    drawing: over.byggeplassId !== undefined ? { byggeplassId: over.byggeplassId } : null,
    // Signert vedleggs-URL i data — SKAL ALDRI havne i speilet.
    data: { bilder: [{ url: SIGNERT_URL }] },
  };
}

/** Checklist-rad (sja): byggeplass direkte (byggeplassId). */
function checklist(over: { id: string; byggeplassId?: string | null }) {
  return {
    id: over.id,
    title: `SJA ${over.id}`,
    status: "open",
    number: 2,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    template: { name: "SJA", prefix: "SJA" },
    bestillerFaggruppe: { name: "Grunn" },
    byggeplassId: over.byggeplassId ?? null,
    data: { bilder: [{ url: SIGNERT_URL }] },
  };
}

function lagKlient(svar: {
  avvik?: ReturnType<typeof task>[];
  sja?: ReturnType<typeof checklist>[];
  ruh?: ReturnType<typeof task>[];
}) {
  return {
    hms: {
      hentDokumenter: {
        query: async () => ({ avvik: svar.avvik ?? [], sja: svar.sja ?? [], ruh: svar.ruh ?? [] }),
      },
    },
  } as unknown as Parameters<typeof refreshHmsKatalog>[0];
}

function kastendeKlient() {
  return {
    hms: {
      hentDokumenter: {
        query: async () => {
          throw new Error("offline");
        },
      },
    },
  } as unknown as Parameters<typeof refreshHmsKatalog>[0];
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
  holder.raw.run("DELETE FROM hms_local;");
});

describe("refreshHmsKatalog + lesere", () => {
  it("(a) refresh fyller speilet, gruppert på kategori", async () => {
    const r = await refreshHmsKatalog(
      lagKlient({
        avvik: [task({ id: "a1" })],
        sja: [checklist({ id: "s1" })],
        ruh: [task({ id: "r1" }), task({ id: "r2" })],
      }),
      "p1",
    );
    expect(r.hms).toBe(4);
    const dok = hentHmsLokalt("p1");
    expect(dok.avvik.map((x) => x.id)).toEqual(["a1"]);
    expect(dok.sja.map((x) => x.id)).toEqual(["s1"]);
    expect(dok.ruh.map((x) => x.id).sort()).toEqual(["r1", "r2"]);
  });

  it("🔴 (Gate 2) speilet inneholder INGEN URL-/data-felt", async () => {
    // Strukturelt: ingen kolonne heter noe med url/data.
    const kolonner = (
      holder.raw.exec("PRAGMA table_info(hms_local);")[0]?.values ?? []
    ).map((rad) => String(rad[1]).toLowerCase());
    expect(kolonner.some((k) => k.includes("url") || k.includes("data"))).toBe(false);

    // Verdi-nivå: selv når serveren sender signerte URL-er i `data`, lagres de ikke.
    await refreshHmsKatalog(lagKlient({ avvik: [task({ id: "a1" })] }), "p1");
    const raader = holder.raw.exec("SELECT * FROM hms_local;");
    const alleVerdier = JSON.stringify(raader);
    expect(alleVerdier).not.toContain("X-Amz-Signature");
    expect(alleVerdier).not.toContain(SIGNERT_URL);
  });

  it("🔴 (b) feilet henting beholder gammel cache", async () => {
    await refreshHmsKatalog(lagKlient({ avvik: [task({ id: "a1" })] }), "p1");
    expect(tellHmsLokalt("p1")).toBe(1);
    await expect(refreshHmsKatalog(kastendeKlient(), "p1")).rejects.toThrow("offline");
    expect(tellHmsLokalt("p1")).toBe(1);
    expect(hentHmsLokalt("p1").avvik[0].id).toBe("a1");
  });

  it("(c) prosjekt A's refresh rører ikke prosjekt B's rader", async () => {
    await refreshHmsKatalog(lagKlient({ avvik: [task({ id: "a1" })] }), "A");
    await refreshHmsKatalog(lagKlient({ avvik: [task({ id: "b1" })] }), "B");
    await refreshHmsKatalog(lagKlient({}), "A"); // tomt svar for A
    expect(tellHmsLokalt("A")).toBe(0);
    expect(tellHmsLokalt("B")).toBe(1);
  });

  it("byggeplass-scoping: Task via tegning + Checklist direkte, «valgt ELLER løs»", async () => {
    await refreshHmsKatalog(
      lagKlient({
        avvik: [
          task({ id: "avv-bp1", byggeplassId: "bp1" }), // tegning på bp1
          task({ id: "avv-los", byggeplassId: null }), // tegning uten byggeplass (prosjekt-tegning)
          task({ id: "avv-ingen-tegning" }), // ingen tegning (drawing === null)
        ],
        sja: [
          checklist({ id: "sja-bp1", byggeplassId: "bp1" }),
          checklist({ id: "sja-los", byggeplassId: null }),
        ],
      }),
      "p1",
    );
    // Valgt bp1: bp1-radene + alle byggeplass-løse.
    const bp1 = hentHmsLokalt("p1", "bp1");
    expect(bp1.avvik.map((x) => x.id).sort()).toEqual(["avv-bp1", "avv-ingen-tegning", "avv-los"]);
    expect(bp1.sja.map((x) => x.id).sort()).toEqual(["sja-bp1", "sja-los"]);
    // Valgt bp2: bp1-radene forsvinner, løse består.
    const bp2 = hentHmsLokalt("p1", "bp2");
    expect(bp2.avvik.map((x) => x.id).sort()).toEqual(["avv-ingen-tegning", "avv-los"]);
    expect(bp2.sja.map((x) => x.id)).toEqual(["sja-los"]);
    // Hele prosjektet: alt.
    expect(tellHmsLokalt("p1")).toBe(5);
  });

  it("hentSistOppdatert gir prosjektets stempel, null når ikke cachet", async () => {
    expect(hentSistOppdatertHmsLokalt("p1")).toBeNull();
    await refreshHmsKatalog(lagKlient({ avvik: [task({ id: "a1" })] }), "p1");
    expect(hentSistOppdatertHmsLokalt("p1")).toBeGreaterThan(0);
  });
});
