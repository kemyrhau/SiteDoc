import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * L3-A (spec § 10 / § 8, ORDRE 30) — «Bekreft dag» mot EKTE SQLite (sql.js),
 * samme harness som `dagsforslagAnvend.lag2.test.ts`.
 *
 * Invarianten (G1, Kenneth 2026-11-06): GPS gir FORSLAG. Ingenting skrives til
 * sheet_timer_local, dagsseddel_local eller arbeidsdag_local.status før
 * arbeideren trykker [Bekreft og lagre]. Avbrudd = dagen står `paagaar`.
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
  avsluttDagUtenSedel,
  erTomtForslag,
  erAlleDatoerSendt,
} from "./bekreftDag";

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

describe("L3-A § 8 nr. 2 — forslaget skriver ingenting før Bekreft", () => {
  it("🔴 forbered gir rader i forslaget, men 0 rader i DB og dagen står paagaar", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(forslag.datoer[0]!.rader.length).toBeGreaterThan(0);
    expect(tell()).toEqual({ sedler: 0, rader: 0, status: "paagaar" });
  });

  it("🔴 A2: byggeplassbytte (ny lese-fase) skriver heller ingenting", () => {
    forberedBekreftDag(lokalDb(), kontekst());
    forberedBekreftDag(lokalDb(), kontekst({ valgtByggeplassId: "b-annen" }));
    expect(tell()).toEqual({ sedler: 0, rader: 0, status: "paagaar" });
  });

  it("🔴 kildevakt: «Slutt dag»-kortet kaller ikke lenger anvendDagsforslag selv", () => {
    const kort = fs.readFileSync(
      path.join(__dirname, "../components/StartSluttDagKort.tsx"),
      "utf8",
    );
    expect(kort).not.toContain("anvendDagsforslag(");
    expect(kort).not.toContain("samleDagsforslagInput(db");
  });
});

describe("L3-A § 8 nr. 4 — retting i skjermen slår gjennom ved Bekreft", () => {
  it("🔴 prosjekt, fra/til og pause fra skjermen er det som lagres", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), {
      prosjektId: "p2",
      perDato: { [DATO]: { arbeidFra: "07:30", arbeidTil: "14:30", pauseMin: 60 } },
    });
    bekreftDag(lokalDb(), forslag, skriveCtx());
    const sedel = db().select().from(dagsseddelLocal).all()[0]!;
    expect(sedel.projectId).toBe("p2");
    expect(sedel.pauseMin).toBe(60);
    const rader = db().select().from(sheetTimerLocal).all();
    expect(rader.every((r) => r.projectId === "p2")).toBe(true);
    const sortert = [...rader].sort((a, b) => (a.fraTid ?? "").localeCompare(b.fraTid ?? ""));
    expect(sortert[0]!.fraTid).toBe("07:30");
    expect(sortert[sortert.length - 1]!.tilTid).toBe("14:30");
    // 7 t − 1 t pause = 6 t.
    expect(rader.reduce((s, r) => s + Number(r.timer), 0)).toBeCloseTo(6, 5);
  });
});

describe("L3-A § 8 nr. 1 — Bekreft lagrer og avslutter", () => {
  it("🔴 bekreftDag gir sedel + rader, dagen avsluttet med generertDagsseddelId", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), forslag, skriveCtx());
    expect(handling.type).toBe("suksess");
    const t = tell();
    expect(t.sedler).toBe(1);
    expect(t.rader).toBeGreaterThan(0);
    expect(t.status).toBe("avsluttet");
    const dag = db().select().from(arbeidsdagLocal).all()[0]!;
    expect(dag.generertDagsseddelId).toBe(resultat!.startSheetId);
    expect(dag.endAt).toBe(SLUTT);
    expect(dag.endLat).toBe(59.9);
  });
});

describe("L3-A § 8 nr. 3 — sendt sedel (A4 venter Kenneth: H7 beholdes)", () => {
  it("alle datoer sendt → erAlleDatoerSendt, Bekreft skriver ingen rader og dagen står åpen", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(erAlleDatoerSendt(forslag)).toBe(true);
    const { handling } = bekreftDag(lokalDb(), forslag, skriveCtx());
    expect(handling.type).toBe("blokkertSendt");
    expect(tell()).toEqual({ sedler: 1, rader: 0, status: "paagaar" });
  });
});

describe("L3-A § 8 nr. 5 — tomt forslag", () => {
  it("ingen katalog → tomt forslag; [Avslutt dag] lukker dagen uten sedel (K14 a)", () => {
    holder.raw.run("DELETE FROM aktivitet_local;");
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(erTomtForslag(forslag)).toBe(true);
    avsluttDagUtenSedel(lokalDb(), {
      arbeidsdagId: DAG_ID, sluttIso: SLUTT, endLat: null, endLng: null, naa: () => 1000,
    });
    expect(tell()).toEqual({ sedler: 0, rader: 0, status: "avsluttet" });
    const dag = db().select().from(arbeidsdagLocal).all()[0]!;
    expect(dag.generertDagsseddelId).toBeNull();
    expect(dag.endAt).toBe(SLUTT);
  });

  it("et vanlig forslag er ikke tomt", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    expect(erTomtForslag(forslag)).toBe(false);
    expect(erAlleDatoerSendt(forslag)).toBe(false);
  });
});
