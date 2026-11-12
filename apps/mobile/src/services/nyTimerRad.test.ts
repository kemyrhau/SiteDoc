import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE 17 (2026-11-06) — «+» rett til timer-raden (mobil).
 *
 * EKTE SQLite (sql.js) + ekte migreringer, som `vareforbrukSync.test.ts`.
 *
 * Gate-krav (DoD), hvert med negativkontroll:
 *  - `sistBrukteRadvalg`: sist brukt på prosjektet → firma-standard → null;
 *  - Avbryt skriver ingenting: åpning (oppslagene) rører ikke databasen;
 *  - eksisterende sedel for datoen gjenbrukes (ingen ny sedel);
 *  - sendt/akseptert dag tar ikke nye rader.
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
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  erDagLaast,
  finnDagForDato,
  lagreNyTimerRad,
  sistBrukteMaskiner,
  sistBrukteRadvalg,
  startvalgForNyRad,
  type NyRad,
} from "./nyTimerRad";

const { aktivitetLocal, dagsseddelLocal, lonnsartLocal, sheetMachineLocal, sheetTimerLocal } = schema;

// Ekte sql.js bak samme spørre-API som Expo-driveren nyTimerRad tar inn.
type Db = NonNullable<ReturnType<typeof import("../db/database").hentDatabase>>;
function db(): Db {
  return holder.drizzle as Db;
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
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM lonnsart_local; DELETE FROM aktivitet_local;",
  );
});

function seedLonnsart(id: string, opts: { standard?: boolean; aktiv?: boolean } = {}) {
  db()
    .insert(lonnsartLocal)
    .values({
      id,
      organizationId: "o1",
      type: "ordinaer",
      navn: id,
      aktiv: opts.aktiv ?? true,
      erStandardvalg: opts.standard ?? false,
      sistOppdatert: 1,
    })
    .run();
}

function seedAktivitet(id: string, navn = id) {
  db()
    .insert(aktivitetLocal)
    .values({ id, organizationId: "o1", navn, aktiv: true, sistOppdatert: 1 })
    .run();
}

type Status = "draft" | "sent" | "returned" | "accepted";

function seedSedel(id: string, dato: string, status: Status = "draft", userId = "u1") {
  db()
    .insert(dagsseddelLocal)
    .values({
      id,
      userId,
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato,
      status,
      syncStatus: "synced",
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
}

function seedRad(id: string, sheetId: string, projectId: string, lonnsartId: string, aktivitetId: string) {
  db()
    .insert(sheetTimerLocal)
    .values({ id, dagsseddelId: sheetId, projectId, lonnsartId, aktivitetId, timer: 4, sistEndretLokalt: 1000 })
    .run();
}

function antall(): { sedler: number; rader: number } {
  return {
    sedler: db().select().from(dagsseddelLocal).all().length,
    rader: db().select().from(sheetTimerLocal).all().length,
  };
}

const rad: NyRad = {
  projectId: "p1",
  byggeplassId: null,
  lonnsartId: "l1",
  aktivitetId: "a1",
  timer: 7.5,
  externalCostObjectId: null,
  fraTid: "07:00",
  tilTid: "15:00",
  beskrivelse: null,
  pauseMin: 30,
  maskiner: [],
};

describe("sistBrukteRadvalg", () => {
  it("tar lønnsart + aktivitet fra siste rad på prosjektet (nyeste dato)", () => {
    seedLonnsart("l-std", { standard: true });
    seedLonnsart("l-gml");
    seedLonnsart("l-ny");
    seedAktivitet("a-gml");
    seedAktivitet("a-ny");
    seedSedel("s1", "2026-11-01");
    seedSedel("s2", "2026-11-04");
    seedRad("r1", "s1", "p1", "l-gml", "a-gml");
    seedRad("r2", "s2", "p1", "l-ny", "a-ny");
    // Negativkontroll: nyere rad på ANNET prosjekt skal ikke telle.
    seedSedel("s3", "2026-11-05");
    seedRad("r3", "s3", "p2", "l-std", "a-gml");

    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1")).toEqual({
      lonnsartId: "l-ny",
      aktivitetId: "a-ny",
    });
    expect(sistBrukteRadvalg(db(), "u1", "p2", "o1")).toEqual({
      lonnsartId: "l-std",
      aktivitetId: "a-gml",
    });
  });

  it("M11: en annen brukers nyere valg på samme prosjekt lekker ikke inn", () => {
    seedLonnsart("l-min");
    seedLonnsart("l-annen");
    seedAktivitet("a-min");
    seedAktivitet("a-annen");
    seedSedel("s-min", "2026-11-01");
    seedRad("r-min", "s-min", "p1", "l-min", "a-min");
    seedSedel("s-annen", "2026-11-05", "draft", "u2");
    seedRad("r-annen", "s-annen", "p1", "l-annen", "a-annen");

    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1")).toEqual({
      lonnsartId: "l-min",
      aktivitetId: "a-min",
    });
    // Negativkontroll: u2 får sitt eget valg.
    expect(sistBrukteRadvalg(db(), "u2", "p1", "o1")).toEqual({
      lonnsartId: "l-annen",
      aktivitetId: "a-annen",
    });
  });

  it("faller til firma-standard når prosjektet ikke er brukt, og når sist brukte er inaktiv", () => {
    seedLonnsart("l-std", { standard: true });
    seedLonnsart("l-inaktiv", { aktiv: false });
    seedAktivitet("a-anl", "Anleggsarbeid");
    seedAktivitet("a-annen");

    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1")).toEqual({
      lonnsartId: "l-std",
      aktivitetId: "a-anl",
    });

    seedSedel("s1", "2026-11-04");
    seedRad("r1", "s1", "p1", "l-inaktiv", "a-annen");
    // Inaktiv lønnsart hoppes over; aktiv aktivitet beholdes.
    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1")).toEqual({
      lonnsartId: "l-std",
      aktivitetId: "a-annen",
    });
  });

  it("gir null når firmaet verken har historikk eller standard", () => {
    seedLonnsart("l1");
    seedAktivitet("a1");
    seedAktivitet("a2");
    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1")).toEqual({
      lonnsartId: null,
      aktivitetId: null,
    });
    // Negativkontroll: én aktiv aktivitet → den velges.
    holder.raw.run("DELETE FROM aktivitet_local WHERE id = 'a2'");
    expect(sistBrukteRadvalg(db(), "u1", "p1", "o1").aktivitetId).toBe("a1");
  });
});

describe("Avbryt skriver ingenting", () => {
  it("oppslagene ved åpning rører ikke databasen; bare Lagre skriver", () => {
    seedLonnsart("l1", { standard: true });
    seedAktivitet("a1", "Anleggsarbeid");
    const foer = antall();
    expect(foer).toEqual({ sedler: 0, rader: 0 });

    // Det dialogen gjør fra åpning til Avbryt.
    const dag = finnDagForDato(db(), "u1", "2026-11-06");
    sistBrukteRadvalg(db(), "u1", "p1", "o1");
    erDagLaast(dag);
    expect(antall()).toEqual(foer);

    // Negativkontroll: Lagre skriver sedel + rad.
    const res = lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-06", rad });
    expect(res.ok).toBe(true);
    expect(antall()).toEqual({ sedler: 1, rader: 1 });
  });
});

describe("lagreNyTimerRad", () => {
  it("gjenbruker eksisterende sedel for datoen", () => {
    seedSedel("s-fins", "2026-11-06");
    const res = lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-06", rad });
    expect(res).toEqual({ ok: true, sheetId: "s-fins", eksisterte: true });
    expect(antall()).toEqual({ sedler: 1, rader: 1 });
    const lagret = db().select().from(sheetTimerLocal).all()[0]!;
    expect(lagret.dagsseddelId).toBe("s-fins");
    expect(lagret.timer).toBe(7.5);

    // Negativkontroll: annen dato → ny sedel.
    const ny = lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-07", rad });
    expect(ny.ok && ny.eksisterte).toBe(false);
    expect(ny.sheetId).not.toBe("s-fins");
    expect(antall()).toEqual({ sedler: 2, rader: 2 });
  });

  it("M9: ny sedel får radens aktivitet", () => {
    const res = lagreNyTimerRad(db(), {
      userId: "u1",
      organizationId: "o1",
      dato: "2026-11-06",
      rad: { ...rad, aktivitetId: "a-rad" },
    });
    expect(res.ok && res.eksisterte).toBe(false);
    const sedel = db().select().from(dagsseddelLocal).all()[0]!;
    expect(sedel.id).toBe(res.sheetId);
    expect(sedel.aktivitetId).toBe("a-rad");
    expect(sedel.projectId).toBe("p1");
  });

  it("M10: en annen brukers sendte dag på samme dato sperrer ikke", () => {
    seedSedel("s-u2", "2026-11-06", "sent", "u2");
    expect(finnDagForDato(db(), "u1", "2026-11-06")).toBeNull();
    const res = lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-06", rad });
    expect(res.ok).toBe(true);
    expect(res.sheetId).not.toBe("s-u2");
    // Negativkontroll: u2 selv er sperret på sin sendte dag.
    expect(erDagLaast(finnDagForDato(db(), "u2", "2026-11-06"))).toBe(true);
    expect(
      lagreNyTimerRad(db(), { userId: "u2", organizationId: "o1", dato: "2026-11-06", rad }),
    ).toEqual({ ok: false, grunn: "dagLaast", sheetId: "s-u2" });
  });

  it("nekter rad på sendt og akseptert dag", () => {
    for (const status of ["sent", "accepted"] as const) {
      holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local;");
      seedSedel("s-laast", "2026-11-06", status);
      expect(erDagLaast(finnDagForDato(db(), "u1", "2026-11-06"))).toBe(true);
      const res = lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-06", rad });
      expect(res).toEqual({ ok: false, grunn: "dagLaast", sheetId: "s-laast" });
      expect(antall().rader).toBe(0);
    }
    // Negativkontroll: returnert og utkast tar rader.
    for (const status of ["returned", "draft"] as const) {
      holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local;");
      seedSedel("s-aapen", "2026-11-06", status);
      expect(erDagLaast(finnDagForDato(db(), "u1", "2026-11-06"))).toBe(false);
      expect(lagreNyTimerRad(db(), { userId: "u1", organizationId: "o1", dato: "2026-11-06", rad }).ok).toBe(true);
      expect(antall().rader).toBe(1);
    }
  });
});

describe("ORDRE 29: startvalgForNyRad — innlogget byggeplass forhåndsvalgt", () => {
  const byggeplasser = [
    { id: "bp1", projectId: "p1" },
    { id: "bp2", projectId: "p1" },
    { id: "bp9", projectId: "p9" },
  ];
  const kilder = (
    innlogget: { projectId: string; byggeplassId: string | null } | null,
    gps: { projectId: string; byggeplassId: string | null } | null = null,
  ) => ({ innlogget, gps, byggeplasser });

  it("innlogget prosjekt i firmaets liste → rett til raden med innlogget byggeplass", () => {
    expect(startvalgForNyRad(["p1", "p2"], kilder({ projectId: "p1", byggeplassId: "bp2" }))).toEqual({
      projectId: "p1",
      byggeplassId: "bp2",
    });
  });

  it("innlogget byggeplass slår GPS; uten innlogget byggeplass brukes GPS på samme prosjekt", () => {
    const gps = { projectId: "p1", byggeplassId: "bp1" };
    expect(startvalgForNyRad(["p1"], kilder({ projectId: "p1", byggeplassId: "bp2" }, gps))?.byggeplassId).toBe("bp2");
    expect(startvalgForNyRad(["p1"], kilder({ projectId: "p1", byggeplassId: null }, gps))?.byggeplassId).toBe("bp1");
  });

  it("byggeplass fra annet prosjekt eller ukjent i katalogen forkastes", () => {
    expect(startvalgForNyRad(["p1", "p2"], kilder({ projectId: "p1", byggeplassId: "bp9" }))?.byggeplassId).toBeNull();
    expect(startvalgForNyRad(["p1", "p2"], kilder({ projectId: "p1", byggeplassId: "ukjent" }))?.byggeplassId).toBeNull();
    // GPS på et annet prosjekt enn det valgte gir ingen byggeplass.
    expect(
      startvalgForNyRad(["p1", "p9"], kilder({ projectId: "p1", byggeplassId: null }, { projectId: "p9", byggeplassId: "bp9" }))
        ?.byggeplassId,
    ).toBeNull();
  });

  it("innlogget prosjekt utenfor firmaets liste → prosjektlista (null) ved flere prosjekter", () => {
    expect(startvalgForNyRad(["p1", "p2"], kilder({ projectId: "p9", byggeplassId: "bp9" }))).toBeNull();
    expect(startvalgForNyRad(["p1", "p2"], kilder(null))).toBeNull();
    // Ett prosjekt hoppes fortsatt over (som før ORDRE 29).
    expect(startvalgForNyRad(["p1"], kilder(null))).toEqual({ projectId: "p1", byggeplassId: null });
  });
});

describe("ORDRE 29: ny sedel arver radens byggeplass", () => {
  it("NY sedel får radens byggeplass; eksisterende sedel røres ikke", () => {
    const ny = lagreNyTimerRad(db(), {
      userId: "u1",
      organizationId: "o1",
      dato: "2026-11-06",
      rad: { ...rad, byggeplassId: "bp1" },
    });
    expect(ny.ok && ny.eksisterte).toBe(false);
    const sedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, ny.sheetId!)).get()!;
    expect(sedel.byggeplassId).toBe("bp1");

    seedSedel("s-fins", "2026-11-07");
    const igjen = lagreNyTimerRad(db(), {
      userId: "u1",
      organizationId: "o1",
      dato: "2026-11-07",
      rad: { ...rad, byggeplassId: "bp2" },
    });
    expect(igjen).toEqual({ ok: true, sheetId: "s-fins", eksisterte: true });
    const fins = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.id, "s-fins")).get()!;
    expect(fins.byggeplassId).toBeNull();
  });
});

describe("ORDRE 29: sistBrukteMaskiner (egne, i firmaet, nyeste først, N = 5)", () => {
  function seedMaskin(id: string, sheetId: string, vehicleId: string, sistEndret: number) {
    db()
      .insert(sheetMachineLocal)
      .values({ id, dagsseddelId: sheetId, vehicleId, timer: 1, sistEndretLokalt: sistEndret })
      .run();
  }

  it("🔴 rekkefølge etter dato og endring, unike, maks 5", () => {
    seedSedel("s-gml", "2026-11-01");
    seedSedel("s-ny", "2026-11-05");
    seedMaskin("m1", "s-gml", "v-gammel", 1);
    seedMaskin("m2", "s-ny", "v-a", 1);
    seedMaskin("m3", "s-ny", "v-b", 2);
    seedMaskin("m4", "s-gml", "v-a", 5); // duplikat — teller kun nyeste forekomst
    seedMaskin("m5", "s-gml", "v-c", 3);
    seedMaskin("m6", "s-gml", "v-d", 2);
    seedMaskin("m7", "s-gml", "v-e", 0);
    expect(sistBrukteMaskiner(db(), "u1", "o1")).toEqual(["v-b", "v-a", "v-c", "v-d", "v-gammel"]);
  });

  it("🔴 annen brukers og annet firmas sedler teller ikke", () => {
    seedSedel("s-annen", "2026-11-05", "draft", "u2");
    seedMaskin("m1", "s-annen", "v-annen-bruker", 1);
    db()
      .insert(dagsseddelLocal)
      .values({
        id: "s-firma2",
        userId: "u1",
        organizationId: "o2",
        projectId: "p1",
        aktivitetId: "a1",
        dato: "2026-11-05",
        status: "draft",
        syncStatus: "synced",
        sistEndretLokalt: 1000,
        sistSynkronisert: 1000,
      })
      .run();
    seedMaskin("m2", "s-firma2", "v-annet-firma", 1);
    expect(sistBrukteMaskiner(db(), "u1", "o1")).toEqual([]);
    expect(sistBrukteMaskiner(db(), "u1", "o2")).toEqual(["v-annet-firma"]);
  });
});
