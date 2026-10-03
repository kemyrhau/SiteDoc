import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Offline-LESING fase 2 — dokument_speil + sjekkliste_local-lekkasjefiks. Ekte SQLite
 * (sql.js/WASM), samme harness som oppgaveKatalog.test.ts / timerSync.test.ts:
 * expo-sqlite byttes med sql.js, migreringene kjører uendret, hentDatabase() gir
 * Drizzle over samme base.
 *
 * Gate 1 (ordre § 5):
 *  (a) write-through lagrer svaret (roundtrip).
 *  (b) 🔴 bruker B ser IKKE bruker As speil (synlighetsvakt) — rød-først: uten userId-
 *      leddet i WHERE ville B fått As rad. Vist ved at B får null på As dokument.
 *  (c) speilet inneholder ingen `sig=` (signaturer strippet før lagring).
 *  (d) sjekkliste_local filtrerer på bruker etter migrering (lekkasjen lukket).
 *  (e) forhånds-nedlasting respekterer taket + stopper ikke på ett feilet dokument,
 *      og hopper over hele jobben stille på gammel server (NOT_FOUND).
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
  lagreDokumentSpeil,
  hentDokumentSpeil,
  forhaandslastDokumenter,
  FORHAANDSLAST_TAK,
  type ForhaandslastDokument,
} from "./dokumentSpeil";
import { refreshSjekklisteKatalog, hentSjekklisterLokalt } from "./sjekklisteKatalog";

type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

const A = "bruker-A";
const B = "bruker-B";

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
  holder.raw.run("DELETE FROM dokument_speil; DELETE FROM sjekkliste_local;");
});

describe("dokument_speil — write-through + synlighetsvakt + strip", () => {
  it("(a) write-through: lagrer svaret, leses tilbake med hentet-tid", () => {
    lagreDokumentSpeil("sjekkliste", "sjekk-1", "p1", A, {
      id: "sjekk-1",
      title: "Befaring",
      template: { objects: [] },
    });
    const res = hentDokumentSpeil("sjekkliste", "sjekk-1", A);
    expect(res).not.toBeNull();
    expect((res!.dokument as { title: string }).title).toBe("Befaring");
    expect(res!.hentetVed).toBeGreaterThan(0);
  });

  it("🔴 (b) synlighetsvakt: bruker B ser IKKE bruker As speil", () => {
    lagreDokumentSpeil("oppgave", "opg-1", "p1", A, { id: "opg-1", title: "As private" });
    // A ser sin egen; B får null (ingen rad i Bs scope).
    expect(hentDokumentSpeil("oppgave", "opg-1", A)).not.toBeNull();
    expect(hentDokumentSpeil("oppgave", "opg-1", B)).toBeNull();
  });

  it("samme id, ulik dokumenttype og bruker kolliderer ikke (komposit-PK)", () => {
    lagreDokumentSpeil("sjekkliste", "delt-id", "p1", A, { id: "delt-id", title: "Sjekk" });
    lagreDokumentSpeil("oppgave", "delt-id", "p1", A, { id: "delt-id", title: "Oppg" });
    lagreDokumentSpeil("sjekkliste", "delt-id", "p1", B, { id: "delt-id", title: "Bs sjekk" });
    expect((hentDokumentSpeil("sjekkliste", "delt-id", A)!.dokument as { title: string }).title).toBe("Sjekk");
    expect((hentDokumentSpeil("oppgave", "delt-id", A)!.dokument as { title: string }).title).toBe("Oppg");
    expect((hentDokumentSpeil("sjekkliste", "delt-id", B)!.dokument as { title: string }).title).toBe("Bs sjekk");
  });

  it("idempotent: ny lagring overskriver samme rad (ingen duplikat)", () => {
    lagreDokumentSpeil("sjekkliste", "s", "p1", A, { id: "s", title: "v1" });
    lagreDokumentSpeil("sjekkliste", "s", "p1", A, { id: "s", title: "v2" });
    expect((hentDokumentSpeil("sjekkliste", "s", A)!.dokument as { title: string }).title).toBe("v2");
    const antall = db().select().from(schema.dokumentSpeil).all().length;
    expect(antall).toBe(1);
  });

  it("🔴 (c) speilet inneholder INGEN signatur (`sig=` strippet før lagring)", () => {
    lagreDokumentSpeil("sjekkliste", "sig-doc", "p1", A, {
      id: "sig-doc",
      data: {
        felt1: { verdi: "/uploads/privat/bilde.jpg?exp=9999&sig=hemmelig123" },
        felt2: { vedlegg: [{ url: "/uploads/privat/vedlegg.pdf?exp=1&sig=xyz" }] },
      },
      images: [{ url: "/uploads/privat/img.png?exp=2&sig=abc" }],
    });
    const rad = db().select().from(schema.dokumentSpeil).all()[0];
    expect(rad.json).not.toContain("sig=");
    expect(rad.json).not.toContain("exp=");
    // Rå sti beholdt (så visning kan re-signere online).
    expect(rad.json).toContain("/uploads/privat/bilde.jpg");
  });
});

/** tRPC-klient-stubb for forhaandslastDokumenter. */
function lagKlient(handler: (type: "sjekkliste" | "oppgave", id: string) => unknown) {
  return {
    sjekkliste: { hentForOffline: { query: async ({ id }: { id: string }) => handler("sjekkliste", id) } },
    oppgave: { hentForOffline: { query: async ({ id }: { id: string }) => handler("oppgave", id) } },
  } as unknown as Parameters<typeof forhaandslastDokumenter>[0];
}

describe("forhaandslastDokumenter — tak + feiltoleranse + gammel server", () => {
  it("(e) laster ned ikke-terminale, hopper over terminale", async () => {
    const dok: ForhaandslastDokument[] = [
      { id: "a", type: "sjekkliste", status: "sent" },
      { id: "b", type: "oppgave", status: "closed" }, // terminal → hoppes
      { id: "c", type: "oppgave", status: "in_progress" },
    ];
    const r = await forhaandslastDokumenter(
      lagKlient((type, id) => ({ id, title: `${type}-${id}` })),
      "p1",
      A,
      dok,
    );
    expect(r.lastet).toBe(2);
    expect(r.hoppet).toBe(1);
    expect(hentDokumentSpeil("sjekkliste", "a", A)).not.toBeNull();
    expect(hentDokumentSpeil("oppgave", "b", A)).toBeNull(); // terminal, ikke lastet
    expect(hentDokumentSpeil("oppgave", "c", A)).not.toBeNull();
  });

  it("(e) stopper IKKE på ett feilet dokument", async () => {
    const dok: ForhaandslastDokument[] = [
      { id: "ok1", type: "sjekkliste", status: "sent" },
      { id: "feil", type: "oppgave", status: "sent" },
      { id: "ok2", type: "sjekkliste", status: "sent" },
    ];
    const r = await forhaandslastDokumenter(
      lagKlient((_type, id) => {
        if (id === "feil") throw new Error("nettfeil");
        return { id, title: id };
      }),
      "p1",
      A,
      dok,
    );
    expect(r.lastet).toBe(2);
    expect(r.feilet).toBe(1);
    expect(hentDokumentSpeil("sjekkliste", "ok2", A)).not.toBeNull();
  });

  it("(e) respekterer taket", async () => {
    const dok: ForhaandslastDokument[] = Array.from({ length: FORHAANDSLAST_TAK + 5 }, (_, i) => ({
      id: `d${i}`,
      type: "sjekkliste" as const,
      status: "sent",
    }));
    const r = await forhaandslastDokumenter(lagKlient((_t, id) => ({ id })), "p1", A, dok);
    expect(r.lastet).toBe(FORHAANDSLAST_TAK);
    expect(r.hoppet).toBe(5);
  });

  it("🔴 gammel server (NOT_FOUND): hopper over forhånds-nedlasting stille", async () => {
    const dok: ForhaandslastDokument[] = [
      { id: "a", type: "sjekkliste", status: "sent" },
      { id: "b", type: "oppgave", status: "sent" },
    ];
    const r = await forhaandslastDokumenter(
      lagKlient(() => {
        throw { data: { code: "NOT_FOUND" } };
      }),
      "p1",
      A,
      dok,
    );
    expect(r.serverManglerProsedyre).toBe(true);
    expect(r.lastet).toBe(0);
    // Ikke talt som per-dokument-feil — det er ikke dokumentet som er galt.
    expect(r.feilet).toBe(0);
  });
});

describe("sjekkliste_local — lekkasjefiks (user_id-filter)", () => {
  function lagListeKlient(ider: Array<{ id: string }>) {
    const rader = ider.map((r) => ({
      id: r.id,
      title: `Sjekk ${r.id}`,
      status: "draft",
      number: 1,
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-01T09:00:00.000Z",
      subject: null,
      dueDate: null,
      byggeplass: null,
      template: { name: "Mal", prefix: "SJ" },
      utforerFaggruppe: null,
      drawing: null,
      dokumentflyt: null,
      recipientUser: null,
      recipientGroup: null,
      bestiller: null,
    }));
    return {
      sjekkliste: { hentForProsjekt: { query: async () => rader } },
    } as unknown as Parameters<typeof refreshSjekklisteKatalog>[0];
  }

  it("🔴 (d) bruker B ser ALDRI bruker As sjekkliste-cache for samme prosjekt", async () => {
    await refreshSjekklisteKatalog(lagListeKlient([{ id: "a-privat" }]), "p1", A);
    expect(hentSjekklisterLokalt("p1", A).map((x) => x.id)).toEqual(["a-privat"]);
    // B har ingen rader → tom. Uten user_id-leddet i WHERE ville B fått As rad.
    expect(hentSjekklisterLokalt("p1", B)).toEqual([]);
    // Når B synker, fjernes As rader aktivt (full overskriv per prosjekt).
    await refreshSjekklisteKatalog(lagListeKlient([{ id: "b-egen" }]), "p1", B);
    expect(hentSjekklisterLokalt("p1", A)).toEqual([]);
    expect(hentSjekklisterLokalt("p1", B).map((x) => x.id)).toEqual(["b-egen"]);
  });
});
