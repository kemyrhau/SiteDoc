import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Ordre c (prosjektkort-kortid-spec § 5.1, § 9 T10 + T14) mot EKTE SQLite
 * (sql.js), samme harness som `bekreftDagBeskrivelse.test.ts`:
 *  - T10: «Del til eget kort» kl. 11 på 07–15 lagres som to kort med hver sin
 *    id, beskrivelse og underprosjekt.
 *  - T14: et utkast fra før kort-id (skjemaversjon 1) lastes med teksten på
 *    riktig kort; tekst uten kort er foreldreløs, aldri droppet.
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
import { forberedBekreftDag, bekreftDag, manglerBeskrivelse } from "./bekreftDag";
import type { DagsforslagRetting } from "./dagsforslag";
import { kortMedArbeid, foreldreloseBeskrivelser } from "./beskrivelseKort";
import { finnUtkast, lagreUtkast, manuellUtkastNokkel, UTKAST_SKJEMA_VERSJON } from "./prosjektkortUtkast";
import { utledKortId } from "@sitedoc/shared";

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
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local;" +
      " DELETE FROM prosjektkort_utkast_local;",
  );
  seedKatalog();
  seedArbeidsdag();
});



// 07–15 med pause: arbeidsraden(e) på p1, utledet kort-id for (p1, uten byggeplass).
const KORT1 = utledKortId({ userId: BRUKER, dato: DATO, nokkel: { projectId: "p1", byggeplassId: null, ecoId: null } });

function delt(over: DagsforslagRetting = {}): DagsforslagRetting {
  return { kortDeling: [{ dato: DATO, fraKortId: KORT1, fra: "11:00", kortId: "kort-2" }], ...over };
}

describe("T10 — «Del til eget kort» lagres som to kort", () => {
  it("forslaget har to kort; hvert krever sin beskrivelse", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), delt({ beskrivelse: { p1: "Grøft" } }));
    expect(kortMedArbeid(forslag).map((k) => k.nokkel)).toEqual(["p1", "kort-2"]);
    expect(manglerBeskrivelse(forslag)).toEqual(["kort-2"]);
  });

  it("lagret: to kort-id-er, hver med egen tekst og eget underprosjekt", () => {
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst(),
      delt({ beskrivelse: { p1: "Grøft", "kort-2": "Skifer" }, ecoPerKort: { "kort-2": "eco-2" } }),
    );
    const { handling } = bekreftDag(lokalDb(), forslag, { ...skriveCtx(), ecoId: null, ecoPerKort: { "kort-2": "eco-2" } });
    expect(handling.type).toBe("suksess");
    const rader = db().select().from(sheetTimerLocal).all().filter((r) => !r.erReise);
    const perKort = new Map<string, typeof rader>();
    for (const r of rader) perKort.set(r.kortId ?? "", [...(perKort.get(r.kortId ?? "") ?? []), r]);
    expect([...perKort.keys()].sort()).toEqual([KORT1, "kort-2"].sort());
    expect(perKort.get(KORT1)!.every((r) => r.beskrivelse === "Grøft" && r.externalCostObjectId === null)).toBe(true);
    expect(perKort.get("kort-2")!.every((r) => r.beskrivelse === "Skifer" && r.externalCostObjectId === "eco-2")).toBe(true);
    expect(perKort.get(KORT1)!.map((r) => r.fraTid)).toEqual(["07:00"]);
    expect(perKort.get("kort-2")!.map((r) => r.fraTid)[0]).toBe("11:00");
  });

  it("uten deling: ett kort, utledet id (samme som backfill/regel 3)", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), { beskrivelse: { p1: "Grøft" } });
    bekreftDag(lokalDb(), forslag, skriveCtx());
    const ider = new Set(db().select().from(sheetTimerLocal).all().filter((r) => !r.erReise).map((r) => r.kortId));
    expect([...ider]).toEqual([KORT1]);
  });

  it("sedelen har alt kortet med annet underprosjekt → nytt kort, det gamle røres ikke (K3)", () => {
    const forst = forberedBekreftDag(lokalDb(), kontekst(), { beskrivelse: { p1: "Morgen" } }).forslag;
    bekreftDag(lokalDb(), forst, { ...skriveCtx(), ecoId: "eco-1" });
    const foer = db().select().from(sheetTimerLocal).all().map((r) => [r.id, r.kortId]);
    db().update(arbeidsdagLocal).set({ status: "paagaar" }).run();
    const andre = forberedBekreftDag(lokalDb(), kontekst({ sluttIso: "2026-07-01T18:00:00", dag: { startAt: "2026-07-01T16:00:00", startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null } }), { beskrivelse: { p1: "Kveld" } }).forslag;
    bekreftDag(lokalDb(), andre, { ...skriveCtx(), ecoId: null });
    const etter = db().select().from(sheetTimerLocal).all();
    for (const [id, kortId] of foer) expect(etter.find((r) => r.id === id)?.kortId).toBe(kortId);
    const nye = etter.filter((r) => !foer.some(([id]) => id === r.id) && !r.erReise);
    expect(nye.length).toBeGreaterThan(0);
    expect(nye.every((r) => r.kortId !== KORT1)).toBe(true);
  });
});

describe("T14 — gammelt utkast (før kort-id) lastes", () => {
  const eier = { userId: BRUKER, orgId: ORG };

  it("skjemaversjon 1: teksten havner på riktig kort, ingenting foreldreløst", () => {
    holder.raw.run(
      "INSERT INTO prosjektkort_utkast_local (id, user_id, organization_id, nokkel, dato, arbeidsdag_id, skjema_versjon, data, kvitteringer, opprettet, sist_endret)" +
        " VALUES ('u1', ?, ?, ?, ?, NULL, 1, ?, '[]', '2026-07-01', '2026-07-01')",
      [BRUKER, ORG, manuellUtkastNokkel(DATO), DATO, JSON.stringify({ retting: { beskrivelse: { p1: "Grøft" } }, tilleggPerRad: {}, lonnUtlegg: { tillegg: [], utlegg: [] } })],
    );
    const u = finnUtkast(lokalDb(), { ...eier, nokkel: manuellUtkastNokkel(DATO) })!;
    expect(u.skjemaVersjon).toBe(1);
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), u.data.retting);
    expect(manglerBeskrivelse(forslag)).toEqual([]);
    expect(foreldreloseBeskrivelser(forslag)).toEqual([]);
    expect(forslag.datoer[0]!.rader.filter((r) => !r.erReise).every((r) => r.kortId === KORT1)).toBe(true);
  });

  it("skjemaversjon 2: delingen og teksten pr. kort overlever lagring og lesing", () => {
    const retting = delt({ beskrivelse: { p1: "Grøft", "kort-2": "Skifer" }, ecoPerKort: { "kort-2": null } });
    expect(
      lagreUtkast(lokalDb(), {
        ...eier,
        nokkel: manuellUtkastNokkel(DATO),
        dato: DATO,
        arbeidsdagId: null,
        data: { retting, tilleggPerRad: {}, lonnUtlegg: { tillegg: [], utlegg: [] } },
        naa: "2026-07-01T10:00:00Z",
        nyId: () => "u2",
      }),
    ).toBe("lagret");
    const u = finnUtkast(lokalDb(), { ...eier, nokkel: manuellUtkastNokkel(DATO) })!;
    expect(u.skjemaVersjon).toBe(UTKAST_SKJEMA_VERSJON);
    expect(UTKAST_SKJEMA_VERSJON).toBe(2);
    expect(u.data.retting).toEqual(retting);
  });

  it("bare en deling i utkastet er ikke tomt (skrives)", () => {
    expect(
      lagreUtkast(lokalDb(), {
        ...eier,
        nokkel: manuellUtkastNokkel(DATO),
        dato: DATO,
        arbeidsdagId: null,
        data: { retting: delt(), tilleggPerRad: {}, lonnUtlegg: { tillegg: [], utlegg: [] } },
        naa: "2026-07-01T10:00:00Z",
        nyId: () => "u3",
      }),
    ).toBe("lagret");
  });

  it("tekst til et kort som ikke finnes lenger, er foreldreløs (vises, droppes ikke)", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), { beskrivelse: { p1: "Grøft", "kort-2": "Skifer" } });
    expect(foreldreloseBeskrivelser(forslag)).toEqual(["kort-2"]);
    expect(forslag.beskrivelsePerKort?.["kort-2"]).toBe("Skifer");
  });
});
