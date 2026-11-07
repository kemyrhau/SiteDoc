import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";


/**
 * ORDRE 36a (spec dagsoversikt-beskrivelse § 3) — påkrevd «Hva gjorde du i
 * dag?» i Bekreft dag, mot EKTE SQLite (sql.js), samme harness som
 * `bekreftDag.test.ts`. Sperren står før noe skrives: tom beskrivelse = 0 rader,
 * dagen står `paagaar`. Teksten følger arbeidsradene, aldri reiseradene.
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
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${teller++}` }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  forberedBekreftDag,
  bekreftDag,
  manglerBeskrivelse,
  prosjekterMedArbeid,
  flyttBeskrivelse,
} from "./bekreftDag";
import type { Dagsforslag } from "./dagsforslag";
import { kortMedArbeid } from "./beskrivelseKort";
import { kortNokkel } from "../lib/prosjektkortMobil";
import { sisteBeskrivelser, beskrivelseChips } from "../services/beskrivelseForslag";

let teller = 0;
const {
  arbeidsdagLocal,
  dagsseddelLocal,
  sheetTimerLocal,
  prosjektLocal,
  aktivitetLocal,
  lonnsartLocal,
} = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
// sql.js-drizzle ≈ ExpoSQLite-drizzle for harnessen — cast som i lag2-testen.
function lokalDb(): Parameters<typeof bekreftDag>[0] {
  return holder.drizzle as Parameters<typeof bekreftDag>[0];
}

const ORG = "org1";
const BRUKER = "u1";
const DAG_ID = "dag1";
const DATO = "2026-07-01";
const START = "2026-07-01T07:00:00";
const SLUTT = "2026-07-01T15:00:00";

function seedKatalog() {
  db().insert(prosjektLocal).values([
    { id: "p1", organizationId: ORG, name: "Prosjekt 1", aktiv: true, sistOppdatert: 1 },
    { id: "p2", organizationId: ORG, name: "Prosjekt 2", aktiv: true, sistOppdatert: 1 },
  ]).run();
  db().insert(aktivitetLocal).values({
    id: "a1", organizationId: ORG, navn: "Anleggsarbeid", aktiv: true, sistOppdatert: 1,
  }).run();
  db().insert(lonnsartLocal).values({
    id: "L-normal", organizationId: ORG, type: "ordinaer", navn: "Normaltid",
    aktiv: true, erStandardvalg: true, sistOppdatert: 1,
  }).run();
}

function seedArbeidsdag() {
  db().insert(arbeidsdagLocal).values({
    id: DAG_ID, userId: BRUKER, dato: DATO, startAt: START, status: "paagaar",
    sistEndretLokalt: 1,
  }).run();
}

function kontekst(over: Partial<Parameters<typeof forberedBekreftDag>[1]> = {}) {
  return {
    userId: BRUKER,
    orgId: ORG,
    dag: { startAt: START, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: SLUTT,
    endLat: null,
    endLng: null,
    kontekstByggeplassId: null,
    aktivtProsjektId: "p1",
    sisteSegmentKilde: "bruker" as const,
    ...over,
  };
}

function skriveCtx() {
  return {
    userId: BRUKER,
    orgId: ORG,
    erAnsatt: true,
    nyId: () => `rad-${teller++}`,
    naa: () => 1000,
    arbeidsdagId: DAG_ID,
    sluttIso: SLUTT,
    endLat: 59.9,
    endLng: 10.7,
  };
}

function tell() {
  return {
    sedler: db().select().from(dagsseddelLocal).all().length,
    rader: db().select().from(sheetTimerLocal).all().length,
    status: db().select().from(arbeidsdagLocal).where(eq(arbeidsdagLocal.id, DAG_ID)).all()[0]!
      .status,
  };
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
  teller = 0;
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM arbeidsdag_local;" +
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local;",
  );
  seedKatalog();
  seedArbeidsdag();
});


const SKJERM = fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf-8");
const FELT = fs.readFileSync(
  path.join(__dirname, "../components/timer-detalj/BekreftDagBeskrivelse.tsx"),
  "utf-8",
);

/** Konstruert to-prosjekt-dag: første arbeidsrad kopiert med prosjekt `p`. */
function medEkstraProsjekt(f: Dagsforslag, p: string): Dagsforslag {
  const [d0, ...resten] = f.datoer;
  const arbeid = d0!.rader.find((r) => !r.erReise)!;
  return { ...f, datoer: [{ ...d0!, rader: [...d0!.rader, { ...arbeid, projectId: p }] }, ...resten] };
}
function somReise(f: Dagsforslag): Dagsforslag {
  return { ...f, datoer: f.datoer.map((d) => ({ ...d, rader: d.rader.map((r) => ({ ...r, erReise: true })) })) };
}
function medTekst(f: Dagsforslag, b: Record<string, string>): Dagsforslag {
  return { ...f, beskrivelsePerKort: b };
}

describe("ORDRE 36a — manglerBeskrivelse", () => {
  it("🔴 ett prosjekt, tomt felt → [p1]; fylt → []", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(manglerBeskrivelse(forslag)).toEqual(["p1"]);
    expect(manglerBeskrivelse(medTekst(forslag, { p1: "Graving" }))).toEqual([]);
  });

  it("🔴 kun blanktegn er tomt", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(manglerBeskrivelse(medTekst(forslag, { p1: "   \n " }))).toEqual(["p1"]);
  });

  it("🔴 bare reise → ingen påkrevd beskrivelse", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(manglerBeskrivelse(somReise(forslag))).toEqual([]);
  });

  it("fjernArbeid via retting → ingen påkrevd beskrivelse", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), {
      perDato: { [DATO]: { fjernArbeid: true } },
    });
    expect(manglerBeskrivelse(forslag)).toEqual([]);
  });

  it("blokkert dato teller ikke", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const blokkert = { ...forslag, datoer: forslag.datoer.map((d) => ({ ...d, blokkert: true })) };
    expect(manglerBeskrivelse(blokkert)).toEqual([]);
  });

  it("🔴 to prosjekter samme dag, det ene tomt → bare det tomme", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const to = medEkstraProsjekt(forslag, "p2");
    expect(prosjekterMedArbeid(to).sort()).toEqual(["p1", "p2"]);
    expect(manglerBeskrivelse(medTekst(to, { p1: "Graving" }))).toEqual(["p2"]);
    expect(manglerBeskrivelse(medTekst(to, { p1: "Graving", p2: "Rør" }))).toEqual([]);
  });
});

describe("ORDRE 36a — bekreftDag sperrer tom beskrivelse", () => {
  it("🔴 tomt felt → manglerBeskrivelse [p1], 0 rader, dagen står paagaar", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), forslag, skriveCtx());
    expect(handling).toEqual({ type: "manglerBeskrivelse", nokler: ["p1"] });
    expect(resultat).toBeNull();
    expect(tell()).toEqual({ sedler: 0, rader: 0, status: "paagaar" });
  });

  it("🔴 arbeidsradene får teksten (trimmet), reiseradene får null", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const d0 = forslag.datoer[0]!;
    const reise = { ...d0.rader[0]!, erReise: true };
    const medReise = { ...forslag, datoer: [{ ...d0, rader: [...d0.rader, reise] }, ...forslag.datoer.slice(1)] };
    const { handling } = bekreftDag(lokalDb(), medTekst(medReise, { p1: "  Graving grøft  " }), skriveCtx());
    expect(handling.type).toBe("suksess");
    const rader = db().select().from(sheetTimerLocal).all();
    const arbeid = rader.filter((r) => !r.erReise);
    expect(arbeid.length).toBeGreaterThan(0);
    expect(arbeid.every((r) => r.beskrivelse === "Graving grøft")).toBe(true);
    const reiseRader = rader.filter((r) => r.erReise);
    expect(reiseRader).toHaveLength(1);
    expect(reiseRader[0]!.beskrivelse).toBeNull();
  });

  it("🔴 klikktelling (22): ett trykk på chip fyller retting → Bekreft passerer", () => {
    // Skjermens chip-trykk = settBeskrivelse(p, chip) = retting.beskrivelse[p] = chip.
    const chip = beskrivelseChips([], "Anleggsarbeid")[0]!;
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), { beskrivelse: { p1: chip } });
    expect(manglerBeskrivelse(forslag)).toEqual([]);
    expect(bekreftDag(lokalDb(), forslag, skriveCtx()).handling.type).toBe("suksess");
  });
});

describe("ORDRE 36b — beskrivelse pr. kort (prosjekt + byggeplass)", () => {
  /** Første arbeidsrad kopiert med egen byggeplass `bp` på samme prosjekt. */
  function medEkstraByggeplass(f: Dagsforslag, bp: string): Dagsforslag {
    const [d0, ...resten] = f.datoer;
    const arbeid = d0!.rader.find((r) => !r.erReise)!;
    return { ...f, datoer: [{ ...d0!, rader: [...d0!.rader, { ...arbeid, byggeplassId: bp }] }, ...resten] };
  }
  const K_ARV = kortNokkel({ projectId: "p1", byggeplassId: null, ecoId: null });
  const K_B2 = kortNokkel({ projectId: "p1", byggeplassId: "b2", ecoId: null });

  it("🔴 to byggeplasser på ett prosjekt → to påkrevde felt", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const to = medEkstraByggeplass(forslag, "b2");
    const kort = kortMedArbeid(to);
    expect(kort.map((k) => k.nokkel)).toEqual([K_ARV, K_B2]);
    expect(kort.every((k) => k.delerProsjekt)).toBe(true);
    expect(manglerBeskrivelse(to)).toEqual([K_ARV, K_B2]);
    expect(manglerBeskrivelse(medTekst(to, { [K_ARV]: "Graving" }))).toEqual([K_B2]);
    // projectId-nøkkelen dekker IKKE kort når prosjektet har flere.
    expect(manglerBeskrivelse(medTekst(to, { p1: "Graving" }))).toEqual([K_ARV, K_B2]);
  });

  it("🔴 hver tekst lander kun på eget korts rader", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const to = medTekst(medEkstraByggeplass(forslag, "b2"), { [K_ARV]: "Graving", [K_B2]: " Rør " });
    expect(bekreftDag(lokalDb(), to, skriveCtx()).handling.type).toBe("suksess");
    const arbeid = db().select().from(sheetTimerLocal).all().filter((r) => !r.erReise);
    const b2 = arbeid.filter((r) => r.byggeplassId === "b2");
    const arv = arbeid.filter((r) => r.byggeplassId !== "b2");
    expect(b2.length).toBeGreaterThan(0);
    expect(arv.length).toBeGreaterThan(0);
    expect(b2.every((r) => r.beskrivelse === "Rør")).toBe(true);
    expect(arv.every((r) => r.beskrivelse === "Graving")).toBe(true);
  });

  it("🔴 regresjon: ett kort pr. prosjekt → nøkkel = projectId, som 36a", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(kortMedArbeid(forslag)).toEqual([
      { nokkel: "p1", projectId: "p1", byggeplassId: null, delerProsjekt: false },
    ]);
    const to = medEkstraProsjekt(forslag, "p2");
    expect(kortMedArbeid(to).map((k) => k.nokkel)).toEqual(["p1", "p2"]);
    expect(manglerBeskrivelse(medTekst(to, { p1: "A", p2: "B" }))).toEqual([]);
  });
});

describe("ORDRE 36a — chips og siste beskrivelser", () => {
  let n = 0;
  function seedRad(o: { dato: string; tekst: string | null; projectId?: string; userId?: string; erReise?: boolean | null; endret?: number }) {
    const id = `s-${n++}`;
    db().insert(dagsseddelLocal).values({
      id, userId: o.userId ?? BRUKER, organizationId: ORG, projectId: o.projectId ?? "p1",
      aktivitetId: "a1", dato: o.dato, status: "draft", sistEndretLokalt: 1,
    }).run();
    db().insert(sheetTimerLocal).values({
      id: `${id}-r`, dagsseddelId: id, projectId: o.projectId ?? "p1", lonnsartId: "L-normal",
      aktivitetId: "a1", timer: 7, beskrivelse: o.tekst, erReise: o.erReise ?? false,
      sistEndretLokalt: o.endret ?? 1,
    }).run();
  }
  const siste = () => sisteBeskrivelser(lokalDb(), { userId: BRUKER, projectId: "p1", dato: DATO });

  it("🔴 nyeste først, distinkt etter trim, maks 2", () => {
    seedRad({ dato: "2026-06-30", tekst: "Graving" });
    seedRad({ dato: "2026-06-29", tekst: " Graving " });
    seedRad({ dato: "2026-06-28", tekst: "Rør" });
    seedRad({ dato: "2026-06-27", tekst: "Kum" });
    expect(siste()).toEqual(["Graving", "Rør"]);
  });

  it("🔴 30-dagersvinduet: dag 30 med, dag 31 ute, fremtid ute", () => {
    seedRad({ dato: "2026-05-31", tekst: "Gammel" }); // 31 dager før
    seedRad({ dato: "2026-07-02", tekst: "Fremtid" });
    expect(siste()).toEqual([]);
    seedRad({ dato: "2026-06-01", tekst: "Innenfor" }); // 30 dager før
    expect(siste()).toEqual(["Innenfor"]);
  });

  it("🔴 reise, annet prosjekt og annen bruker utelates; erReise null = arbeid", () => {
    seedRad({ dato: "2026-06-30", tekst: "Reise", erReise: true });
    seedRad({ dato: "2026-06-30", tekst: "P2", projectId: "p2" });
    seedRad({ dato: "2026-06-30", tekst: "Annen", userId: "u2" });
    seedRad({ dato: "2026-06-29", tekst: "Eldre rad", erReise: null });
    expect(siste()).toEqual(["Eldre rad"]);
  });

  it("🔴 chips = siste + aktivitetsnavnet, uten duplikat", () => {
    expect(beskrivelseChips(["Graving"], "Anleggsarbeid")).toEqual(["Graving", "Anleggsarbeid"]);
    expect(beskrivelseChips(["Anleggsarbeid"], "Anleggsarbeid")).toEqual(["Anleggsarbeid"]);
    expect(beskrivelseChips([], null)).toEqual([]);
  });
});

describe("ORDRE 36a — flyttBeskrivelse ved prosjektbytte", () => {
  it("flytter teksten til nytt prosjekt når det er tomt", () => {
    expect(flyttBeskrivelse({ p1: "Graving" }, "p1", "p2")).toEqual({ p1: "Graving", p2: "Graving" });
  });
  it("overskriver aldri tekst som alt står på målprosjektet", () => {
    expect(flyttBeskrivelse({ p1: "A", p2: "B" }, "p1", "p2")).toEqual({ p1: "A", p2: "B" });
  });
  it("uendret uten kilde, uten tekst eller samme prosjekt", () => {
    expect(flyttBeskrivelse(undefined, "p1", "p2")).toBeUndefined();
    expect(flyttBeskrivelse({ p1: " " }, "p1", "p2")).toEqual({ p1: " " });
    expect(flyttBeskrivelse({ p1: "A" }, "p1", "p1")).toEqual({ p1: "A" });
  });
});

describe("ORDRE 36a — kildevakter i bekreft-dag.tsx", () => {
  const i = (s: string) => SKJERM.indexOf(s);
  const sperre = SKJERM.slice(i("const tomme = manglerBeskrivelse("), i("setLagrer(true);"));

  it("negativkontroll: skjermkilden er lest", () => {
    expect(SKJERM.length).toBeGreaterThan(1000);
    expect(sperre.length).toBeGreaterThan(20);
  });
  it("🔴 sperren står før setLagrer og bekreftDag(", () => {
    expect(i("const tomme = manglerBeskrivelse(")).toBeGreaterThan(0);
    expect(i("const tomme = manglerBeskrivelse(")).toBeLessThan(i("setLagrer(true);"));
    expect(i("setLagrer(true);")).toBeLessThan(i("bekreftDag(db"));
  });
  it("🔴 sperregrenen: ingen Alert, ingen sync/nett (offline)", () => {
    expect(sperre).toContain("visTomBeskrivelse(");
    expect(sperre).not.toContain("Alert");
    expect(sperre).not.toContain("triggerSync");
    expect(sperre).not.toContain("trpc");
  });
  it("🔴 rød ramme kun etter forsøk på tomt felt", () => {
    expect(SKJERM).toMatch(/visFeil=\{forsoktBekreft && !retting\.beskrivelse\?\.\[k\.nokkel\]\?\.trim\(\)\}/);
    const flat = FELT.replace(/\s+/g, " ");
    expect(flat).toContain('visFeil ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"');
    expect(flat).toMatch(/\{visFeil \? \( <Text className="text-xs text-red-700">/);
  });
});
