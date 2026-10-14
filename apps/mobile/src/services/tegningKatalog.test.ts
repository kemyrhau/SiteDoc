import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Tegning-katalog + viewer-speil (offline-navigasjon, RETUR 2). Ekte SQLite (sql.js/WASM),
 * samme harness som dokumentSpeil.test.ts: expo-sqlite byttes med sql.js, migreringene
 * kjører uendret, hentDatabase() gir Drizzle over samme base.
 *
 * Dekker (rød-først):
 *  - refreshTegningKatalog + hentTegningerLokalt (roundtrip, revisjonsnøkkel = filnavn).
 *  - 🔴 userId-synlighetsvakt: bruker B ser ALDRI bruker As tegninger/byggeplasser/detalj.
 *  - refreshByggeplassNavKatalog + hentByggeplasserNavLokalt (prosjekt-scopet, standalone).
 *  - lagreTegningDetaljSpeil/-FraData + hentTegningDetaljLokalt (hentMedId + markører).
 *  - 🔴 tomTegningSpeil (utlogging) tømmer tegning-speilet, men RØRER IKKE sjekkliste/oppgave.
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
  refreshTegningKatalog,
  hentTegningerLokalt,
  hentTegningSistOppdatert,
  refreshByggeplassNavKatalog,
  hentByggeplasserNavLokalt,
  lagreTegningDetaljSpeil,
  lagreTegningDetaljFraData,
  hentTegningDetaljLokalt,
  tomTegningSpeil,
} from "./tegningKatalog";
import { lagreDokumentSpeil, hentDokumentSpeil } from "./dokumentSpeil";

const A = "bruker-A";
const B = "bruker-B";
const P = "prosjekt-1";

/** tRPC-klient-stubb: tegning.hentForProsjekt. */
function lagListeKlient(rader: unknown[]) {
  return {
    tegning: { hentForProsjekt: { query: async () => rader } },
  } as unknown as Parameters<typeof refreshTegningKatalog>[0];
}
function lagByggeplassKlient(rader: unknown[]) {
  return {
    bygning: { hentForProsjekt: { query: async () => rader } },
  } as unknown as Parameters<typeof refreshByggeplassNavKatalog>[0];
}
function lagDetaljKlient(
  detalj: unknown,
  oppgaver: unknown[],
  kontrollpunkter: unknown[],
  omrader: unknown[],
) {
  return {
    tegning: { hentMedId: { query: async () => detalj } },
    oppgave: { hentForTegning: { query: async () => oppgaver } },
    kontrollplan: { hentForTegning: { query: async () => kontrollpunkter } },
    omrade: { hentForTegning: { query: async () => omrader } },
  } as unknown as Parameters<typeof lagreTegningDetaljSpeil>[0];
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
    "DELETE FROM tegning_local; DELETE FROM byggeplass_nav_local; DELETE FROM dokument_speil;",
  );
});

describe("tegning_local — katalog + synlighetsvakt + revisjonsnøkkel", () => {
  const tegninger = [
    {
      id: "t1",
      name: "Plan 1. etasje",
      drawingNumber: "A-20-01",
      discipline: "ARK",
      floor: "1",
      byggeplassId: "bp-1",
      fileType: "svg",
      fileUrl: "/uploads/aaa.svg",
      mobilFileUrl: "/uploads/bbb-mobil.svg",
      _count: { revisions: 3 },
    },
    {
      id: "t2",
      name: "Snitt",
      drawingNumber: null,
      byggeplassId: null,
      fileType: "pdf",
      fileUrl: "/uploads/ccc.pdf",
      mobilFileUrl: null,
      _count: { revisions: 1 },
    },
  ];

  it("roundtrip: lagrer og leser tegningslista med revisjonsnøkkel = filnavn", async () => {
    await refreshTegningKatalog(lagListeKlient(tegninger), P, A);
    const rader = hentTegningerLokalt(P, A);
    expect(rader.map((r) => r.id).sort()).toEqual(["t1", "t2"]);
    const t1 = rader.find((r) => r.id === "t1")!;
    expect(t1.mobilFileUrl).toBe("/uploads/bbb-mobil.svg");
    expect(t1.antallRevisjoner).toBe(3);
    // Revisjonsnøkkel = siste ledd av effektiv vis-URL (mobilvariant) = filcache-nøkkel.
    const rad = holder.raw.exec("SELECT revisjons_nokkel FROM tegning_local WHERE id='t1'");
    expect(rad[0]?.values[0]?.[0]).toBe("bbb-mobil.svg");
    expect(hentTegningSistOppdatert(P, A)).toBeGreaterThan(0);
  });

  it("🔴 synlighetsvakt: bruker B ser ALDRI bruker As tegninger", async () => {
    await refreshTegningKatalog(lagListeKlient(tegninger), P, A);
    expect(hentTegningerLokalt(P, A).length).toBe(2);
    expect(hentTegningerLokalt(P, B)).toEqual([]);
    // Full overskriving per prosjekt: når B synker fjernes As rader AKTIVT (id er global
    // PK). A ser da ingenting (ikke bare skjult) — B ser sine egne.
    await refreshTegningKatalog(lagListeKlient([tegninger[0]]), P, B);
    expect(hentTegningerLokalt(P, A)).toEqual([]);
    expect(hentTegningerLokalt(P, B).map((r) => r.id)).toEqual(["t1"]);
  });

  it("ny revisjon (ny fil-URL) gir ny revisjonsnøkkel ved refresh", async () => {
    await refreshTegningKatalog(lagListeKlient([tegninger[0]]), P, A);
    const nyRev = [{ ...tegninger[0], mobilFileUrl: "/uploads/ddd-nyrev.svg" }];
    await refreshTegningKatalog(lagListeKlient(nyRev), P, A);
    const rad = holder.raw.exec("SELECT revisjons_nokkel FROM tegning_local WHERE id='t1'");
    expect(rad[0]?.values[0]?.[0]).toBe("ddd-nyrev.svg");
    expect(hentTegningerLokalt(P, A).length).toBe(1); // ingen duplikat
  });
});

describe("byggeplass_nav_local — prosjekt-scopet (standalone)", () => {
  it("roundtrip + synlighetsvakt", async () => {
    const bp = [
      { id: "bp-1", name: "Testområde 1", number: 1, status: "aktiv" },
      { id: "bp-2", name: "Testområde 2", number: 2, status: "aktiv" },
    ];
    await refreshByggeplassNavKatalog(lagByggeplassKlient(bp), P, A);
    expect(hentByggeplasserNavLokalt(P, A).map((b) => b.name).sort()).toEqual([
      "Testområde 1",
      "Testområde 2",
    ]);
    expect(hentByggeplasserNavLokalt(P, B)).toEqual([]);
  });
});

describe("tegning-detalj-speil — hentMedId + markører", () => {
  const detalj = { id: "t1", name: "Plan", fileUrl: "/uploads/aaa.svg", startutsnitt: { x: 0, y: 0, w: 1, h: 1 } };

  it("fetch-vei: lagrer detalj + markører, leses tilbake", async () => {
    await lagreTegningDetaljSpeil(
      lagDetaljKlient(detalj, [{ id: "o1" }], [{ id: "kp1" }], [{ id: "om1" }]),
      P,
      A,
      "t1",
    );
    const res = hentTegningDetaljLokalt("t1", A);
    expect(res).not.toBeNull();
    expect((res!.blob.detalj as { name: string }).name).toBe("Plan");
    expect(res!.blob.oppgaver).toHaveLength(1);
    expect(res!.blob.kontrollpunkter).toHaveLength(1);
    expect(res!.blob.omrader).toHaveLength(1);
    expect(res!.hentetVed).toBeGreaterThan(0);
  });

  it("write-through-vei (fra data): roundtrip + 🔴 synlighetsvakt", () => {
    lagreTegningDetaljFraData(P, A, "t1", { detalj, oppgaver: [], kontrollpunkter: [], omrader: [] });
    expect(hentTegningDetaljLokalt("t1", A)).not.toBeNull();
    expect(hentTegningDetaljLokalt("t1", B)).toBeNull();
  });
});

describe("tomTegningSpeil — utlogging tømmer tegning, men ikke sjekkliste/oppgave", () => {
  it("🔴 fjerner tegning-speil, bevarer andre dokumenttyper", async () => {
    await refreshTegningKatalog(lagListeKlient([{ id: "t1", name: "P", byggeplassId: null, fileUrl: "/u/a.svg", mobilFileUrl: null, fileType: "svg", _count: { revisions: 1 } }]), P, A);
    await refreshByggeplassNavKatalog(lagByggeplassKlient([{ id: "bp1", name: "BP", number: 1, status: "aktiv" }]), P, A);
    lagreTegningDetaljFraData(P, A, "t1", { detalj: { id: "t1" }, oppgaver: [], kontrollpunkter: [], omrader: [] });
    // En sjekkliste-speil-rad som IKKE skal røres av tegning-oppryddingen.
    lagreDokumentSpeil("sjekkliste", "s1", P, A, { id: "s1", title: "Behold" });

    tomTegningSpeil();

    expect(hentTegningerLokalt(P, A)).toEqual([]);
    expect(hentByggeplasserNavLokalt(P, A)).toEqual([]);
    expect(hentTegningDetaljLokalt("t1", A)).toBeNull();
    // Sjekkliste-speilet står igjen (egen dokumenttype).
    expect(hentDokumentSpeil("sjekkliste", "s1", A)).not.toBeNull();
  });
});
