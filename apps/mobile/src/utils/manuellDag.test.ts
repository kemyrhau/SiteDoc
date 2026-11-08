import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * ORDRE 36c — Bekreft dag i MANUELL modus mot EKTE SQLite (sql.js), samme
 * harness som `bekreftDag.test.ts`.
 *
 * Grunnprinsipp (OK PLAN 36c): prosjektkortet er primærenheten. Finnes det en
 * dagsseddel datoen, legges registreringen inn i den — som nytt kort eller i
 * kortet med samme prosjekt/byggeplass. Aldri en ny dagsseddel.
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
import { bekreftDag, forberedBekreftDag, prosjekterMedArbeid } from "./bekreftDag";
import { manuellDag, lesManuellGrunnlag, forberedManuellDag } from "./manuellDag";
import type { Dagsforslag } from "./dagsforslag";

function medBeskrivelse(f: Dagsforslag): Dagsforslag {
  return { ...f, beskrivelsePerKort: Object.fromEntries(prosjekterMedArbeid(f).map((p) => [p, "Graving"])) };
}

let teller = 0;
const { arbeidsdagLocal, dagsseddelLocal, sheetTimerLocal, prosjektLocal, aktivitetLocal, lonnsartLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
function lokalDb(): Parameters<typeof bekreftDag>[0] {
  return holder.drizzle as Parameters<typeof bekreftDag>[0];
}

const ORG = "org1";
const BRUKER = "u1";
const DATO = "2026-07-01";
const FIRMA = { startTid: "07:00", sluttTid: "15:00", pauseMin: 30 };

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

/** Eksisterende sedel på DATO med én p1-rad 07:00–15:00 (30 min pause i hodet). */
function seedSedel(status: "draft" | "sent" = "draft") {
  db().insert(dagsseddelLocal).values({
    id: "sedel1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
    dato: DATO, status, pauseMin: 30, sistEndretLokalt: 1,
  }).run();
  db().insert(sheetTimerLocal).values({
    id: "rad1", dagsseddelId: "sedel1", projectId: "p1", lonnsartId: "L-normal", aktivitetId: "a1",
    timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, sistEndretLokalt: 1,
  }).run();
}

function manuellKontekst(over: Partial<Parameters<typeof forberedManuellDag>[1]> = {}) {
  return { userId: BRUKER, orgId: ORG, dato: DATO, kontekstByggeplassId: null, aktivtProsjektId: "p1", ...over };
}

function skriveCtx(sluttIso: string, ecoId?: string | null) {
  return {
    userId: BRUKER, orgId: ORG, erAnsatt: true, nyId: () => `ny-${teller++}`, naa: () => 1000,
    arbeidsdagId: null, sluttIso, endLat: null, endLng: null,
    ...(ecoId === undefined ? {} : { ecoId }),
  };
}

function lagreManuelt(
  retting?: Parameters<typeof forberedManuellDag>[2],
  over = {},
  ecoId?: string | null,
  tillegg?: Parameters<typeof bekreftDag>[3],
) {
  const { forslag, sluttIso } = forberedManuellDag(lokalDb(), manuellKontekst(over), retting);
  return bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(sluttIso, ecoId), tillegg);
}

const sedler = () => db().select().from(dagsseddelLocal).all();
const rader = () => db().select().from(sheetTimerLocal).all();

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
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM sheet_machine_local; DELETE FROM vareforbruk_local; DELETE FROM arbeidsdag_local;" +
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local;",
  );
  seedKatalog();
});

describe("ORDRE 36c — manuellDag (ren)", () => {
  it("ingen sedel → firmaets start, slutt og pause", () => {
    const md = manuellDag(DATO, FIRMA, null);
    expect(md.startAt).toBe(new Date(`${DATO}T07:00:00`).toISOString());
    expect(md.sluttIso).toBe(new Date(`${DATO}T15:00:00`).toISOString());
    expect(md.pauseMin).toBe(30);
  });

  it("🔴 sedel finnes → start = seneste tilTid, slutt +1 t, ingen ny matpause", () => {
    const md = manuellDag(DATO, FIRMA, { tilTider: ["11:00", "15:00", null], hodePauseMin: 30 });
    expect(md.startAt).toBe(new Date(`${DATO}T15:00:00`).toISOString());
    expect(md.sluttIso).toBe(new Date(`${DATO}T16:00:00`).toISOString());
    expect(md.pauseMin).toBe(0);
  });

  it("sedel uten pause i hodet → firmapausen trekkes", () => {
    expect(manuellDag(DATO, FIRMA, { tilTider: ["10:00"], hodePauseMin: 0 }).pauseMin).toBe(30);
  });

  it("🔴 aldri over midnatt: 23:30 gir slutt 23:59", () => {
    const md = manuellDag(DATO, FIRMA, { tilTider: ["23:30"], hodePauseMin: 30 });
    expect(md.sluttIso).toBe(new Date(`${DATO}T23:59:00`).toISOString());
  });

  it("lesManuellGrunnlag: null uten sedel, tider + hodepause med", () => {
    expect(lesManuellGrunnlag(lokalDb(), BRUKER, DATO)).toBeNull();
    seedSedel();
    expect(lesManuellGrunnlag(lokalDb(), BRUKER, DATO)).toEqual({ tilTider: ["15:00"], hodePauseMin: 30 });
  });
});

describe("ORDRE 36c — manuell Bekreft skriver uten arbeidsdag", () => {
  it("🔴 ingen sedel → én ny sedel med rader; arbeidsdag_local røres ikke", () => {
    db().insert(arbeidsdagLocal).values({
      id: "aapen", userId: BRUKER, dato: DATO, startAt: `${DATO}T07:00:00`, status: "paagaar", sistEndretLokalt: 1,
    }).run();
    expect(sedler()).toHaveLength(0);
    const { handling } = lagreManuelt();
    expect(handling.type).toBe("suksess");
    expect(sedler()).toHaveLength(1);
    expect(rader().length).toBeGreaterThan(0);
    const dag = db().select().from(arbeidsdagLocal).where(eq(arbeidsdagLocal.id, "aapen")).all()[0]!;
    expect(dag.status).toBe("paagaar");
    expect(dag.generertDagsseddelId ?? null).toBeNull();
    expect(dag.endAt ?? null).toBeNull();
  });
});

describe("ORDRE 36c — prosjektkortet er primærenheten (aldri ny dagsseddel)", () => {
  it("🔴 eksisterende draft + annet prosjekt → nytt kort i SAMME sedel", () => {
    seedSedel();
    expect(sedler()).toHaveLength(1);
    const { handling } = lagreManuelt({ prosjektId: "p2" });
    expect(handling.type).toBe("suksess");
    if (handling.type === "suksess") expect(handling.sheetId).toBe("sedel1");
    expect(sedler()).toHaveLength(1);
    const nye = rader().filter((r) => r.id !== "rad1");
    expect(nye.length).toBeGreaterThan(0);
    expect(nye.every((r) => r.dagsseddelId === "sedel1" && r.projectId === "p2")).toBe(true);
    // Fortsetter der dagen slapp, uten ny matpause.
    expect(nye.map((r) => r.fraTid).sort()[0]).toBe("15:00");
    expect(nye.reduce((s, r) => s + r.pauseMin, 0)).toBe(0);
    // Den eksisterende raden står urørt.
    const gammel = rader().find((r) => r.id === "rad1")!;
    expect([gammel.fraTid, gammel.tilTid, gammel.timer]).toEqual(["07:00", "15:00", 7.5]);
  });

  it("🔴 eksisterende draft + samme prosjekt → inn i kortet (samme sedel, samme prosjekt)", () => {
    seedSedel();
    lagreManuelt();
    expect(sedler()).toHaveLength(1);
    const nye = rader().filter((r) => r.id !== "rad1");
    expect(nye.length).toBeGreaterThan(0);
    expect(nye.every((r) => r.dagsseddelId === "sedel1" && r.projectId === "p1")).toBe(true);
  });

  it("negativkontroll: annen dato gir en annen sedel — tellingen måler faktisk", () => {
    seedSedel();
    lagreManuelt(undefined, { dato: "2026-07-02" });
    expect(sedler()).toHaveLength(2);
  });

  it("🔴 sendt sedel → blokkertSendt, ingenting skrives", () => {
    seedSedel("sent");
    const { handling } = lagreManuelt({ prosjektId: "p2" });
    expect(handling.type).toBe("blokkertSendt");
    expect(sedler()).toHaveLength(1);
    expect(rader()).toHaveLength(1);
  });
});

describe("ORDRE 36c S3 — «Slutt dag» etter en manuell registrering med åpen arbeidsdag", () => {
  const sluttDag = () =>
    forberedBekreftDag(lokalDb(), {
      userId: BRUKER, orgId: ORG,
      dag: { startAt: `${DATO}T07:00:00`, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
      sluttIso: `${DATO}T16:00:00`, endLat: null, endLng: null,
      kontekstByggeplassId: null, aktivtProsjektId: "p1", sisteSegmentKilde: "bruker",
    }).forslag;
  const apneDag = () =>
    db().insert(arbeidsdagLocal).values({
      id: "aapen", userId: BRUKER, dato: DATO, startAt: `${DATO}T07:00:00`, status: "paagaar", sistEndretLokalt: 1,
    }).run();
  const arbeid = (f: ReturnType<typeof sluttDag>) =>
    f.datoer.flatMap((d) => d.rader).filter((r) => !r.erReise && r.timer > 0);

  it("negativkontroll: uten manuell registrering foreslår Slutt dag arbeid 07:00–16:00", () => {
    apneDag();
    const r = arbeid(sluttDag());
    expect(r.map((x) => [x.projectId, x.fraTid, x.tilTid])).toEqual([["p1", "07:00", "16:00"]]);
  });

  it("🔴 måling: etter manuelt kort 07–15 dobbeltfører ikke Slutt dag — play-raden viker (1b)", () => {
    apneDag();
    lagreManuelt({ prosjektId: "p2" });
    expect(rader().map((x) => [x.projectId, x.fraTid, x.tilTid])).toEqual([["p2", "07:00", "15:00"]]);
    const f = sluttDag();
    expect(arbeid(f)).toEqual([]);
    // Målt atferd (meldt): hele play-vinduet viker, også 15–16 som ikke er ført.
    expect(f.datoer[0].vekForOverlapp).toEqual([{ fraTid: "07:00", tilTid: "16:00" }]);
  });
});

describe("ORDRE 36c rettelse S2 — valgfritt underprosjekt på kortet", () => {
  const maskin = { maskiner: [{ lokalId: "m", projectId: "p2", vehicleId: "v1", timer: 1, mengde: null, enhet: null }],
    varer: [{ lokalId: "v", projectId: "p2", vareId: "vare1", vareNavn: "Pukk", enhet: "t", antall: 2, byggeplassId: null }] };
  const varer = () => db().select().from(schema.vareforbrukLocal).all();

  it("🔴 P1: valgt underprosjekt lagres på arbeidsraden og maskinen", () => {
    lagreManuelt({ prosjektId: "p2" }, {}, "eco1", maskin);
    expect(rader().map((r) => r.externalCostObjectId)).toEqual(["eco1"]);
    expect(db().select().from(schema.sheetMachineLocal).all().map((m) => m.externalCostObjectId)).toEqual(["eco1"]);
    expect(varer().map((v) => v.externalCostObjectId)).toEqual(["eco1"]);
  });

  it("🔴 P4: inn i eksisterende sedel som eget kort (prosjekt + byggeplass + underprosjekt), rad1 urørt", () => {
    seedSedel();
    lagreManuelt({ prosjektId: "p1" }, {}, "eco1");
    expect(sedler()).toHaveLength(1);
    const ny = rader().find((r) => r.id !== "rad1")!;
    expect(ny.dagsseddelId).toBe("sedel1");
    expect(ny.externalCostObjectId).toBe("eco1");
    expect(rader().find((r) => r.id === "rad1")!.externalCostObjectId).toBeNull();
  });

  it("🔴 tomt underprosjekt: Bekreft lagrer, og tomt lagres som null (rad og maskin)", () => {
    const r = lagreManuelt({ prosjektId: "p2" }, {}, null, maskin);
    expect(r.resultat).not.toBeNull();
    expect(rader()).toHaveLength(1);
    expect(rader()[0].externalCostObjectId).toBeNull();
    expect(db().select().from(schema.sheetMachineLocal).all()[0].externalCostObjectId).toBeNull();
    expect(varer()[0].externalCostObjectId).toBeNull();
  });

  it("negativkontroll: uten ecoId i ctx (P3/GPS-veien) skrives null som før", () => {
    lagreManuelt({ prosjektId: "p2" });
    expect(rader()[0].externalCostObjectId).toBeNull();
  });

  it("🔴 skjermen: valget bare i manuell modus og bare med underprosjekter; tomt ved åpning, kan tømmes", () => {
    const skjerm = fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf8");
    expect(skjerm).toContain("manuell && prosjektId\n        ? hentUnderprosjekterLokalt(prosjektId)");
    expect(skjerm).toContain("{underprosjekter.length > 0 ? (");
    // Aldri forhåndsvalgt — heller ikke med ett underprosjekt.
    expect(skjerm).toContain("const [ecoId, setEcoId] = useState<string | null>(null);");
    expect(skjerm).toContain("useEffect(() => setEcoId(null), [prosjektId]);");
    expect(skjerm).toContain("onPress={() => setEcoId(valgt ? null : e.id)}");
    expect(skjerm).toContain("ecoId: manuell ? ecoId : null,");
    expect(skjerm).not.toMatch(/setEcoId\(underprosjekter\[0\]/);
  });
});

describe("ORDRE 36c — kildevakter for inngangene", () => {
  const les = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8");

  it("🔴 P1: «+» går til Bekreft dag i prosjektkort-modus, dagskort beholder timer-raden", () => {
    const liste = les("../components/DagsseddelListe.tsx");
    expect(liste).toContain('lesTimerModusLokalt(valgtFirmaId) !== "prosjektkort"');
    expect(liste).toContain('params: { opprinnelse: "manuell", dato: lokalIsoDato(new Date()) }');
    expect(liste).toContain("<NyTimerRadFlyt");
  });

  it("🔴 P4: «+ Nytt prosjektkort» sender kortets dato og låser den", () => {
    const kort = les("../../app/timer/[id]/prosjektkort.tsx");
    expect(kort).toContain('params: { opprinnelse: "manuell", dato: sedel.dato, laastDato: "1" }');
    expect(kort).not.toContain("ProsjektVelgerModal");
  });

  it("🔴 skjermen: datofeltet skjules ved låst dato, manuell modus sender arbeidsdagId null", () => {
    const skjerm = les("../../app/timer/bekreft-dag.tsx");
    expect(skjerm).toContain("{manuell && !laastDato ? (");
    expect(skjerm).toContain("arbeidsdagId: manuell ? null : params.arbeidsdagId,");
  });
});
