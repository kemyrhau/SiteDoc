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
import { bekreftDag, bekreftSperre, forberedBekreftDag, prosjekterMedArbeid } from "./bekreftDag";
import { linjerIDag, ryddLonnsartPerLinje, velgLinjeLonnsart } from "./linjeLonnsart";
import { hentFravaerLonnsartIderLokalt } from "../services/timerKatalog";
import { manuellDag, lesManuellGrunnlag, forberedManuellDag } from "./manuellDag";
import { beregnDagsforslag, vekslOvertidNivaa, type Dagsforslag } from "./dagsforslag";
import { entydigByggeplass, radTilleggNokkel, type BekreftDagTillegg, type TilleggPerRad } from "./bekreftDagTillegg";

/** PRESISERING TILLEGG: linjene ligger på forslagets første arbeidsrad. */
function paaForsteRad(forslag: Dagsforslag, tillegg?: BekreftDagTillegg): TilleggPerRad | undefined {
  if (!tillegg) return undefined;
  for (const d of forslag.datoer) {
    for (const r of d.rader) {
      const n = radTilleggNokkel(d.dato, r);
      if (n) return { [n]: tillegg };
    }
  }
  throw new Error("ingen arbeidsrad i forslaget");
}
import { kortNokkel } from "../lib/prosjektkortMobil";

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
  tillegg?: BekreftDagTillegg,
) {
  const { forslag, sluttIso } = forberedManuellDag(lokalDb(), manuellKontekst(over), retting);
  return bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(sluttIso, ecoId), paaForsteRad(forslag, tillegg));
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
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local; DELETE FROM byggeplass_local;",
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
    // ORDRE (27b): også arbeid som alt bruker av normen (rad1 = 7,5 t).
    expect(lesManuellGrunnlag(lokalDb(), BRUKER, DATO)).toEqual({ tilTider: ["15:00"], hodePauseMin: 30 });
    // ORDRE (29) a2: normgrunnlaget leses i `lesEksisterendeSedel` (delt med GPS-dagen).
    expect(forberedManuellDag(lokalDb(), manuellKontekst()).input.eksisterendeSedelPerDato[DATO]!.bruktAvNorm).toBe(7.5);
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
    // Prosjektbytte tømmer fortsatt valget (utkast-gjenoppretting er grunnlinjen).
    expect(skjerm).toMatch(
      /if \(ecoProsjektRef\.current !== prosjektId\) \{\s*ecoProsjektRef\.current = prosjektId;\s*setEcoId\(null\);/,
    );
    expect(skjerm).toContain("setEcoId(valgt ? null : e.id);");
    expect(skjerm).toContain("ecoId: manuell ? ecoId : null,");
    expect(skjerm).not.toMatch(/setEcoId\(underprosjekter\[0\]/);
  });
});

describe("RETUR 36c pkt 1 — kortets byggeplass i skrivestien (også når sedelen finnes)", () => {
  const tillegg = (bp: string | null) => ({
    maskiner: [{ lokalId: "m", projectId: "p2", vehicleId: "v1", timer: 1, mengde: null, enhet: null }],
    varer: [{ lokalId: "v", projectId: "p2", vareId: "vare1", vareNavn: "Pukk", enhet: "t", antall: 2, byggeplassId: bp }],
  });
  const sedelMedA = () => {
    seedSedel();
    db().update(dagsseddelLocal).set({ byggeplassId: "A" }).where(eq(dagsseddelLocal.id, "sedel1")).run();
  };
  const ny = () => rader().find((r) => r.id !== "rad1")!;
  const maskiner = () => db().select().from(schema.sheetMachineLocal).all();
  const varer = () => db().select().from(schema.vareforbrukLocal).all();
  const lagreKort = (bp: string | null, eco: string | null = null) => {
    const { forslag, sluttIso } = forberedManuellDag(lokalDb(), manuellKontekst(), { prosjektId: "p2", byggeplassId: bp });
    // Skjermen sender varens byggeplass fra KortVareforbrukModal (sedelByggeplassId = entydigByggeplass).
    return bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(sluttIso, eco), paaForsteRad(forslag, tillegg(entydigByggeplass(forslag, "p2"))));
  };

  it("🔴 sedel med A + nytt kort B: rad, maskin og vare har B, og kortet grupperes under B", () => {
    sedelMedA();
    lagreKort("B", "eco1");
    expect(sedler()).toHaveLength(1);
    expect(ny().dagsseddelId).toBe("sedel1");
    expect(ny().byggeplassId).toBe("B");
    expect(maskiner()[0].byggeplassId).toBe("B");
    expect(varer()[0].byggeplassId).toBe("B");
    const sedelBp = sedler()[0].byggeplassId;
    expect(kortNokkel({ projectId: ny().projectId ?? "", byggeplassId: ny().byggeplassId ?? sedelBp, ecoId: ny().externalCostObjectId }))
      .toBe(kortNokkel({ projectId: "p2", byggeplassId: "B", ecoId: "eco1" }));
    // rad1 (sedelens egen) er urørt.
    expect(rader().find((r) => r.id === "rad1")!.byggeplassId).toBeNull();
  });

  it("negativkontroll: sedel med A + kort A → arv (null) som før", () => {
    sedelMedA();
    lagreKort("A");
    expect(ny().byggeplassId).toBeNull();
    expect(maskiner()[0].byggeplassId).toBeNull();
  });

  it("negativkontroll: ny sedel med B → arv (null), sedelen bærer B", () => {
    lagreKort("B");
    expect(sedler()[0].byggeplassId).toBe("B");
    expect(rader()[0].byggeplassId).toBeNull();
    expect(maskiner()[0].byggeplassId).toBeNull();
  });

  it("🔴 GPS-veien: «Slutt dag» nr. 2 med byggeplass B på sedel med A skriver B på arbeidsraden", () => {
    sedelMedA();
    const { forslag } = forberedBekreftDag(lokalDb(), {
      userId: BRUKER, orgId: ORG,
      dag: { startAt: `${DATO}T16:00:00`, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: "B" },
      sluttIso: `${DATO}T18:00:00`, endLat: null, endLng: null,
      kontekstByggeplassId: null, aktivtProsjektId: "p2", sisteSegmentKilde: "bruker",
    });
    expect(forslag.datoer[0].byggeplassId).toBe("B");
    // Reiserad med egen (tom) byggeplass i samme dag.
    const d0 = forslag.datoer[0];
    const medReise = { ...forslag, datoer: [{ ...d0, rader: [...d0.rader, { ...d0.rader[0]!, erReise: true, byggeplassId: null }] }] };
    bekreftDag(lokalDb(), medBeskrivelse(medReise), skriveCtx(`${DATO}T18:00:00`));
    const arbeid = rader().filter((r) => r.id !== "rad1" && !r.erReise);
    expect(arbeid.length).toBeGreaterThan(0);
    expect(arbeid.every((r) => r.byggeplassId === "B")).toBe(true);
    // Reiseraden beholder sin egen byggeplass — kortets B gjelder bare arbeid.
    const reise = rader().filter((r) => r.id !== "rad1" && r.erReise);
    expect(reise.length).toBeGreaterThan(0);
    expect(reise.every((r) => r.byggeplassId === null)).toBe(true);
  });
});

describe("RETUR 36c-3 — «Ingen byggeplass» fra Bekreft dag løfter arven (Kontrollør 1b)", () => {
  /** sedel1 (p1) med A i p1: rad1 arver A, en p1-maskin arver A, og en reiserad uten byggeplass. */
  const sedelMedA = () => {
    seedSedel();
    db().insert(schema.byggeplassLocal).values({ id: "A", organizationId: ORG, projectId: "p1", navn: "A", sistOppdatert: 1 }).run();
    db().update(dagsseddelLocal).set({ byggeplassId: "A", syncStatus: "synced" }).where(eq(dagsseddelLocal.id, "sedel1")).run();
    db().insert(sheetTimerLocal).values({
      id: "reise1", dagsseddelId: "sedel1", projectId: "p1", lonnsartId: "L-normal", aktivitetId: "a1",
      timer: 0.5, fraTid: "06:30", tilTid: "07:00", pauseMin: 0, erReise: true, sistEndretLokalt: 1,
    }).run();
    db().insert(schema.sheetMachineLocal).values({
      id: "mask1", dagsseddelId: "sedel1", projectId: "p1", vehicleId: "v1", timer: 2, sistEndretLokalt: 1,
    }).run();
  };
  const lagreUten = (utenByggeplassValgt: boolean, retting: Parameters<typeof forberedManuellDag>[2] = { byggeplassId: null }) => {
    const { forslag, sluttIso } = forberedManuellDag(lokalDb(), manuellKontekst(), retting);
    return bekreftDag(lokalDb(), medBeskrivelse(forslag), { ...skriveCtx(sluttIso), utenByggeplassValgt });
  };
  const rad = (id: string) => rader().find((r) => r.id === id)!;
  const nye = () => rader().filter((r) => !["rad1", "reise1"].includes(r.id));
  const maskin = () => db().select().from(schema.sheetMachineLocal).all().find((m) => m.id === "mask1")!;

  it("🔴 sedel med A + «Ingen byggeplass»: arvende rad og maskin får A, hodet NULL + pending, ny rad NULL", () => {
    sedelMedA();
    const { handling } = lagreUten(true);
    expect(handling.type).toBe("suksess");
    expect(sedler()).toHaveLength(1);
    expect(rad("rad1").byggeplassId).toBe("A");
    expect(maskin().byggeplassId).toBe("A");
    expect(sedler()[0].byggeplassId).toBeNull();
    expect(sedler()[0].syncStatus).toBe("pending");
    expect(nye().length).toBeGreaterThan(0);
    expect(nye().every((r) => r.dagsseddelId === "sedel1" && r.byggeplassId === null)).toBe(true);
    // Effektiv byggeplass (rad ?? sedel): det gamle kortet står under A, det nye er ekte «uten».
    expect(rad("rad1").byggeplassId ?? sedler()[0].byggeplassId).toBe("A");
    expect(nye()[0].byggeplassId ?? sedler()[0].byggeplassId).toBeNull();
  });

  it("🔴 reise er urørt", () => {
    sedelMedA();
    lagreUten(true);
    expect(rad("reise1").byggeplassId).toBeNull();
    expect(rad("reise1").sistEndretLokalt).toBe(1);
  });

  it("negativkontroll: GPS-veien (uten flagg) skriver som før — ny rad arver A, ingenting løftes", () => {
    sedelMedA();
    lagreUten(false);
    expect(sedler()[0].byggeplassId).toBe("A");
    expect(rad("rad1").byggeplassId).toBeNull();
    expect(maskin().byggeplassId).toBeNull();
    expect(nye().every((r) => r.byggeplassId === null)).toBe(true);
  });

  it("negativkontroll: ny sedel (ingen A) løftes ikke — ingen eksisterende rader røres", () => {
    lagreUten(true);
    expect(sedler()).toHaveLength(1);
    expect(sedler()[0].byggeplassId).toBeNull();
    expect(rader().every((r) => r.byggeplassId === null)).toBe(true);
  });

  it("negativkontroll: «Ingen byggeplass» i annet prosjekt enn A — ingen arv å løfte", () => {
    sedelMedA();
    lagreUten(true, { prosjektId: "p2", byggeplassId: null });
    expect(sedler()[0].byggeplassId).toBe("A");
    expect(rad("rad1").byggeplassId).toBeNull();
  });

  it("🔴 skjermen sender flagget bare i manuell modus ved eksplisitt «Ingen byggeplass»", () => {
    const skjerm = fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf8");
    expect(skjerm).toContain("utenByggeplassValgt: manuell && retting.byggeplassId === null,");
  });
});

describe("RETUR 36c-3 — testhull K10 og K12/P12 (kildevakter)", () => {
  const les = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8");

  it("🔴 K10 (PRESISERING TILLEGG, ORDRE 24): skjermen sender første arbeidsrads byggeplass til kortets maskin/vare", () => {
    expect(les("../../app/timer/bekreft-dag.tsx")).toContain("byggeplassId={forste.byggeplassId}");
  });

  it("🔴 K12/P12: «+ Legg til arbeid/maskin» vises bare når sedelen er redigerbar (ikke låst)", () => {
    const kort = les("../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx");
    expect(kort).toContain('leggTil={redigerbar ? t("timer.prosjektkort.leggTilArbeid") : undefined}');
    expect(kort).toContain('leggTil={redigerbar ? t("timer.prosjektkort.leggTilMaskin") : undefined}');
    expect(kort).not.toMatch(/leggTil=\{t\(/);
  });
});

describe("RETUR 36c pkt 3 og 4 — kildevakter for Bekreft dag", () => {
  const skjerm = () => fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf8");
  const felt = () => fs.readFileSync(path.join(__dirname, "../components/timer-detalj/BekreftDagBeskrivelse.tsx"), "utf8");

  it("🔴 pkt 4: reise-meldingen vises ikke i manuell modus", () => {
    expect(skjerm()).toContain("{!manuell && (forslag.reiseAarsak || forslag.destinasjonAarsak) ? (");
  });

  it("🔴 pkt 3: feltet ruller over tastaturet ved fokus", () => {
    expect(skjerm()).toContain("onFokus={() => rullTilBeskrivelse(k.nokkel)}");
    expect(skjerm()).toContain('Keyboard.addListener("keyboardDidShow"');
    expect(felt()).toContain("onFokus?.();");
  });

  it("🔴 pkt 3: «Ferdig» over tastaturet (iOS) og under feltet (Android), tom flate/drag lukker", () => {
    expect(skjerm()).toContain("<InputAccessoryView nativeID={TASTATUR_ID}>");
    expect(skjerm()).toContain("tastaturId={TASTATUR_ID}");
    expect(felt()).toContain('inputAccessoryViewID={Platform.OS === "ios" ? tastaturId : undefined}');
    expect(felt()).toContain('Platform.OS === "android" && harFokus && tastaturOppe ? (');
    expect(skjerm()).toContain('keyboardShouldPersistTaps="handled"');
    expect(skjerm()).toContain('keyboardDismissMode="none"');
  });
});

describe("RETUR 36c-2 D4 — kildevakter for tastatur i Bekreft dag", () => {
  const skjerm = () => fs.readFileSync(path.join(__dirname, "../../app/timer/bekreft-dag.tsx"), "utf8");
  const felt = () => fs.readFileSync(path.join(__dirname, "../components/timer-detalj/BekreftDagBeskrivelse.tsx"), "utf8");

  it("🔴 a: feltet har makshøyde og intern scroll", () => {
    expect(felt()).toContain("max-h-[140px]");
    expect(felt()).toContain("scrollEnabled");
  });

  it("🔴 b: rullemålet er tekstfeltet, rulles på nytt når innholdet vokser, luft under", () => {
    expect(felt()).toContain("onLayout={(e) => onFeltY?.(e.nativeEvent.layout.y)}");
    expect(felt()).toContain("if (harFokus) onInnholdEndret?.();");
    expect(skjerm()).toContain("y + feltY - 16");
    expect(skjerm()).toContain("onInnholdEndret={() => rullTilBeskrivelse(k.nokkel)}");
    expect(skjerm()).toContain('{tastaturOppe ? <View className="h-[120px]" /> : null}');
  });

  it("🔴 c: «Ferdig» er fullbredde-knapp ≥ 44 pt på iOS og Android", () => {
    const knapp = "min-h-[44px] items-center justify-center rounded-lg bg-blue-600";
    expect(skjerm()).toContain(knapp);
    expect(felt()).toContain(knapp);
  });

  it("🔴 d: scroll lukker ikke tastaturet", () => {
    expect(skjerm()).not.toContain('keyboardDismissMode="on-drag"');
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

// ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer» (SVAR a): 08–12 er
// 4,0 t arbeid ≤ 5,5 t → ingen pause. Erstatter 36e pkt. 4 (3,5 t / 30).
describe("ORDRE 2026-11-13 — manuell kort dag (4 t) får ingen pause", () => {
  it("🔴 manuell 08–12 → rad 08:00–12:00, pauseMin 0, timer 4,0; hodet Σ = 0", () => {
    const { handling } = lagreManuelt({ perDato: { [DATO]: { arbeidFra: "08:00", arbeidTil: "12:00" } } });
    expect(handling.type).toBe("suksess");
    const r = rader();
    expect(r.map((x) => [x.fraTid, x.tilTid, x.timer, x.pauseMin])).toEqual([["08:00", "12:00", 4, 0]]);
    expect(sedler()[0]!.pauseMin).toBe(0);
  });
});

// ORDRE 2026-11-16 (27b) — spec prosjektkort-kortid-spec.md § 6 L1–L4, L7 og
// § 6.1 V5a, mot ekte SQLite. Norm 7,5 t fra svar-cachen.
describe("ORDRE (27b) — manuelt kort regnes mot døgnets registreringer", () => {
  const L_OT50 = "L-ot50";
  const settNorm = () =>
    db().insert(schema.arbeidstidSvarLocal).values({
      organizationId: ORG, dato: DATO, dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30,
      normKilde: "fast", pauseEtterTimer: 5.5, pauseReferanse: "ankomst", hentetAt: Date.now(),
    }).run();
  const sedelMed = (rader: Array<{ id: string; timer: number; fra: string; til: string; lonnsart?: string; erReise?: boolean; pause?: number }>) => {
    db().insert(dagsseddelLocal).values({
      id: "sedel1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 30, sistEndretLokalt: 1,
    }).run();
    for (const r of rader) {
      db().insert(sheetTimerLocal).values({
        id: r.id, dagsseddelId: "sedel1", projectId: "p1", lonnsartId: r.lonnsart ?? "L-normal", aktivitetId: "a1",
        timer: r.timer, fraTid: r.fra, tilTid: r.til, pauseMin: r.pause ?? 0, erReise: r.erReise ?? false,
        beskrivelse: "Graving", sistEndretLokalt: 1,
      }).run();
    }
  };
  /** Kenneths mandag 16.11: 07–15 Timelønn + 15–17 Overtid 50 %. */
  const kennethsDag = () =>
    sedelMed([
      { id: "rad1", timer: 7.5, fra: "07:00", til: "15:00", pause: 30 },
      { id: "rad2", timer: 2, fra: "15:00", til: "17:00", lonnsart: L_OT50 },
    ]);
  const forslagArbeid = (retting?: Parameters<typeof forberedManuellDag>[2]) =>
    forberedManuellDag(lokalDb(), manuellKontekst(), retting).forslag.datoer[0]!.rader.filter((r) => !r.erReise);
  const nivaa = (r: { lonnsartId: string }) => (r.lonnsartId === L_OT50 ? "OT50" : "normal");
  const sum = (filter: (r: { lonnsartId: string; erReise: boolean | null }) => boolean) =>
    Math.round(rader().filter((r) => !r.erReise && filter(r)).reduce((s, r) => s + r.timer, 0) * 100) / 100;

  beforeEach(() => {
    holder.raw.run("DELETE FROM arbeidstid_svar_local;");
    db().insert(lonnsartLocal).values({
      id: L_OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %",
      aktiv: true, overtidsnivaa: 50, rekkefolge: 1, sistOppdatert: 1,
    }).run();
  });

  it("🔴 Kenneths dag: 17–18 og 18–19 (p2) blir Overtid 50 %; overtid 4,0, normal 7,5, sum 11,5", () => {
    settNorm();
    kennethsDag();
    expect(lagreManuelt().handling.type).toBe("suksess");
    expect(lagreManuelt({ prosjektId: "p2" }).handling.type).toBe("suksess");
    const nye = rader().filter((r) => !["rad1", "rad2"].includes(r.id)).sort((a, b) => a.fraTid!.localeCompare(b.fraTid!));
    expect(nye.map((r) => [r.projectId, r.fraTid, r.tilTid, r.timer, nivaa(r)])).toEqual([
      ["p1", "17:00", "18:00", 1, "OT50"],
      ["p2", "18:00", "19:00", 1, "OT50"],
    ]);
    expect(sum((r) => r.lonnsartId === L_OT50)).toBe(4);
    expect(sum((r) => r.lonnsartId === "L-normal")).toBe(7.5);
    expect(sum(() => true)).toBe(11.5);
    // L5: eksisterende rader røres aldri.
    expect(rader().filter((r) => ["rad1", "rad2"].includes(r.id)).map((r) => [r.id, r.timer, r.lonnsartId]))
      .toEqual([["rad1", 7.5, "L-normal"], ["rad2", 2, L_OT50]]);
  });

  it("🔴 delvis brukt norm: 6 t registrert, kort 2,5 t → 1,5 normal + 1 overtid", () => {
    settNorm();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    const r = forslagArbeid({ perDato: { [DATO]: { arbeidFra: "13:30", arbeidTil: "16:00" } } });
    expect(r.map((x) => [x.fraTid, x.tilTid, x.timer, nivaa(x)])).toEqual([
      ["13:30", "15:00", 1.5, "normal"],
      ["15:00", "16:00", 1, "OT50"],
    ]);
  });

  it("🔴 delvis brukt norm, to kort: 1,5 t → normal, deretter 1 t → overtid", () => {
    settNorm();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    lagreManuelt({ perDato: { [DATO]: { arbeidFra: "13:30", arbeidTil: "15:00" } } });
    lagreManuelt({ prosjektId: "p2", perDato: { [DATO]: { arbeidFra: "15:00", arbeidTil: "16:00" } } });
    const nye = rader().filter((r) => r.id !== "rad1").sort((a, b) => a.fraTid!.localeCompare(b.fraTid!));
    expect(nye.map((r) => [r.projectId, r.timer, nivaa(r)])).toEqual([["p1", 1.5, "normal"], ["p2", 1, "OT50"]]);
  });

  it("🔴 reise teller ikke mot normen", () => {
    settNorm();
    sedelMed([
      { id: "reise1", timer: 2, fra: "05:00", til: "07:00", erReise: true },
      { id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 },
    ]);
    const r = forslagArbeid({ perDato: { [DATO]: { arbeidFra: "13:30", arbeidTil: "16:00" } } });
    expect(r.map((x) => [x.timer, nivaa(x)])).toEqual([[1.5, "normal"], [1, "OT50"]]);
  });

  it("ingen registrert tid → som i dag (normen fra 0)", () => {
    settNorm();
    const r = forslagArbeid({ perDato: { [DATO]: { arbeidFra: "07:00", arbeidTil: "09:00" } } });
    expect(r.map((x) => [x.timer, nivaa(x)])).toEqual([[2, "normal"]]);
  });

  it("🔴 ukjent norm → ingen splitt, markøren står (normStatus ukjent)", () => {
    kennethsDag();
    const { forslag } = forberedManuellDag(lokalDb(), manuellKontekst());
    expect(forslag.normStatus).toBe("ukjent");
    expect(forslag.datoer[0]!.rader.filter((r) => !r.erReise).map((x) => [x.timer, nivaa(x)])).toEqual([[1, "normal"]]);
  });

  it("🔴 L7 overstyring til ordinær: overtidAv → Timelønn", () => {
    settNorm();
    kennethsDag();
    const r = forslagArbeid({ perDato: { [DATO]: { overtidAv: true } } });
    expect(r.map((x) => [x.fraTid, x.tilTid, x.timer, nivaa(x)])).toEqual([["17:00", "18:00", 1, "normal"]]);
  });

  // ORDRE (29) a2, T2 (spec § 9) + L4: GPS-dagen i Bekreft dag får samme grunnlag
  // som manuelt kort — `lesEksisterendeSedel` bærer `bruktAvNorm`.
  const gpsKontekst = (fra: string, til: string) => ({
    userId: BRUKER, orgId: ORG,
    dag: { startAt: new Date(`${DATO}T${fra}:00`).toISOString(), startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: new Date(`${DATO}T${til}:00`).toISOString(),
    endLat: null, endLng: null, kontekstByggeplassId: null, aktivtProsjektId: "p1",
    sisteSegmentKilde: "bruker" as const,
  });
  const gpsArbeid = (fra: string, til: string) =>
    forberedBekreftDag(lokalDb(), gpsKontekst(fra, til)).forslag.datoer[0]!.rader.filter((r) => !r.erReise);

  it("🔴 a2 T2 GPS: Kenneths dag, GPS-økt 17–18 → Overtid 50 %; eksisterende rader uendret etter lagring (L5)", () => {
    settNorm();
    kennethsDag();
    const { forslag } = forberedBekreftDag(lokalDb(), gpsKontekst("17:00", "18:00"));
    expect(forslag.datoer[0]!.rader.filter((r) => !r.erReise).map((x) => [x.fraTid, x.tilTid, x.timer, nivaa(x)]))
      .toEqual([["17:00", "18:00", 1, "OT50"]]);
    expect(bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(gpsKontekst("17:00", "18:00").sluttIso)).handling.type)
      .toBe("suksess");
    expect(rader().filter((r) => ["rad1", "rad2"].includes(r.id)).map((r) => [r.id, r.fraTid, r.tilTid, r.timer, r.lonnsartId]))
      .toEqual([["rad1", "07:00", "15:00", 7.5, "L-normal"], ["rad2", "15:00", "17:00", 2, L_OT50]]);
    const nye = rader().filter((r) => !["rad1", "rad2"].includes(r.id) && !r.erReise);
    expect(nye.map((r) => [r.fraTid, r.tilTid, r.timer, nivaa(r)])).toEqual([["17:00", "18:00", 1, "OT50"]]);
  });

  it("🔴 a2 T2 GPS: delvis brukt norm (6 t), GPS 13:30–16 → 1,5 normal + 1 overtid", () => {
    settNorm();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    expect(gpsArbeid("13:30", "16:00").map((x) => [x.fraTid, x.tilTid, x.timer, nivaa(x)])).toEqual([
      ["13:30", "15:00", 1.5, "normal"],
      ["15:00", "16:00", 1, "OT50"],
    ]);
  });

  it("🔴 a2 T2 GPS: reise teller ikke mot normen", () => {
    settNorm();
    sedelMed([
      { id: "reise1", timer: 2, fra: "05:00", til: "07:00", erReise: true },
      { id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 },
    ]);
    expect(gpsArbeid("13:30", "16:00").map((x) => [x.timer, nivaa(x)])).toEqual([[1.5, "normal"], [1, "OT50"]]);
  });

  it("a2 T2 GPS: fravær teller ikke mot normen (B8)", () => {
    settNorm();
    db().insert(lonnsartLocal).values({
      id: "L-fravaer", organizationId: ORG, type: "fravaer", navn: "Velferdspermisjon",
      aktiv: true, rekkefolge: 9, sistOppdatert: 1,
    }).run();
    sedelMed([{ id: "frav1", timer: 6, fra: "07:00", til: "13:30", pause: 30, lonnsart: "L-fravaer" }]);
    expect(gpsArbeid("13:30", "16:00").map((x) => [x.timer, nivaa(x)])).toEqual([[2.5, "normal"]]);
  });

  it("a2 GPS uten rader fra før → som i dag", () => {
    settNorm();
    expect(gpsArbeid("07:00", "09:00").map((x) => [x.timer, nivaa(x)])).toEqual([[2, "normal"]]);
  });

  it("a2 GPS: GPS-dagen og manuelt kort gir samme bruktAvNorm (én kilde)", () => {
    settNorm();
    kennethsDag();
    const gps = forberedBekreftDag(lokalDb(), gpsKontekst("17:00", "18:00")).input;
    const man = forberedManuellDag(lokalDb(), manuellKontekst()).input;
    expect(gps.eksisterendeSedelPerDato[DATO]!.bruktAvNorm).toBe(9.5);
    expect(man.eksisterendeSedelPerDato[DATO]!.bruktAvNorm).toBe(9.5);
  });

  it("negativkontroll: uten brukt norm i forslaget (dagens kode) blir 17–18 Timelønn", () => {
    settNorm();
    kennethsDag();
    const { input } = forberedManuellDag(lokalDb(), manuellKontekst());
    expect(input.eksisterendeSedelPerDato[DATO]!.bruktAvNorm).toBe(9.5);
    const utenBrukt = {
      ...input,
      eksisterendeSedelPerDato: { [DATO]: { ...input.eksisterendeSedelPerDato[DATO]!, bruktAvNorm: undefined } },
    };
    const r = beregnDagsforslag(utenBrukt).datoer[0]!.rader.filter((x) => !x.erReise);
    expect(r.map((x) => [x.timer, nivaa(x)])).toEqual([[1, "normal"]]);
  });
});

describe("ORDRE (27b) V5a — overtid av/på med samme knapp (Kenneths kort 19–20)", () => {
  const L_OT50 = "L-ot50";
  beforeEach(() => {
    holder.raw.run("DELETE FROM arbeidstid_svar_local;");
    db().insert(lonnsartLocal).values({
      id: L_OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %",
      aktiv: true, overtidsnivaa: 50, rekkefolge: 1, sistOppdatert: 1,
    }).run();
    db().insert(schema.arbeidstidSvarLocal).values({
      organizationId: ORG, dato: DATO, dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30,
      normKilde: "fast", pauseEtterTimer: 5.5, pauseReferanse: "ankomst", hentetAt: Date.now(),
    }).run();
    db().insert(dagsseddelLocal).values({
      id: "sedel1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 30, sistEndretLokalt: 1,
    }).run();
    db().insert(sheetTimerLocal).values([
      { id: "rad1", dagsseddelId: "sedel1", projectId: "p1", lonnsartId: "L-normal", aktivitetId: "a1", timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, sistEndretLokalt: 1 },
      { id: "rad2", dagsseddelId: "sedel1", projectId: "p1", lonnsartId: L_OT50, aktivitetId: "a1", timer: 4, fraTid: "15:00", tilTid: "19:00", pauseMin: 0, sistEndretLokalt: 1 },
    ]).run();
  });
  const arbeid = (retting?: Parameters<typeof forberedManuellDag>[2]) =>
    forberedManuellDag(lokalDb(), manuellKontekst(), retting).forslag.datoer[0]!.rader.filter((r) => !r.erReise);
  const vis = (r: ReturnType<typeof arbeid>) => r.map((x) => [x.fraTid, x.tilTid, x.timer, x.lonnsartId]);

  it("🔴 19–20 er Overtid 50 % fra 19:00; ett trykk på blå → 1 t Timelønn; trykk igjen → overtid tilbake", () => {
    const foer = arbeid();
    expect(vis(foer)).toEqual([["19:00", "20:00", 1, L_OT50]]);
    const ot = foer[0]!;
    // Trykk på blå knapp (nivået kortet står på).
    const av = vekslOvertidNivaa({
      trykketId: L_OT50, valgtId: ot.lonnsartId, forsteOtFra: ot.fraTid, rettetOvertidFra: undefined, arbeidFra: "19:00",
    });
    const etterAv = arbeid({ perDato: { [DATO]: av } });
    expect(vis(etterAv)).toEqual([["19:00", "20:00", 1, "L-normal"]]);
    // Trykk igjen (knappen er nå hvit — ingen overtidsrad).
    const paa = vekslOvertidNivaa({
      trykketId: L_OT50, valgtId: null, forsteOtFra: null, rettetOvertidFra: av.overtidFra, arbeidFra: "19:00",
    });
    expect(vis(arbeid({ perDato: { [DATO]: { ...av, ...paa } } }))).toEqual([["19:00", "20:00", 1, L_OT50]]);
  });

  it("negativkontroll: dagens trykk (bare nivå-id) fjerner ikke overtiden", () => {
    expect(vis(arbeid({ perDato: { [DATO]: { overtidLonnsartId: L_OT50 } } }))).toEqual([["19:00", "20:00", 1, L_OT50]]);
  });
});

// ORDRE 2026-11-16 (28) — spec § 6.1 V1–V7 (a3) og § 10 B8, mot ekte SQLite.
// Norm 7,5 t fra svar-cachen. Kenneth: «jeg syns det er feil å opprette et
// prosjektkort først, for så å redigere kortet til å endre lønnsart».
describe("ORDRE (28) — lønnsart pr. linje før lagring, fravær bruker ikke normen", () => {
  const L_OT50 = "L-ot50";
  const L_EGEN = "L-egenmelding";
  const L_SYK = "L-sykdom";
  const L_REGNING = "L-regning";
  const settNorm = () =>
    db().insert(schema.arbeidstidSvarLocal).values({
      organizationId: ORG, dato: DATO, dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30,
      normKilde: "fast", pauseEtterTimer: 5.5, pauseReferanse: "ankomst", hentetAt: Date.now(),
    }).run();
  const arter = (medOvertid = true) => {
    db().insert(lonnsartLocal).values([
      ...(medOvertid
        ? [{ id: L_OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %", aktiv: true, overtidsnivaa: 50, rekkefolge: 1, sistOppdatert: 1 }]
        : []),
      { id: L_REGNING, organizationId: ORG, type: "ordinaer", navn: "Regningsarbeid", aktiv: true, rekkefolge: 2, sistOppdatert: 1 },
      { id: L_EGEN, organizationId: ORG, type: "fravaer", navn: "Egenmelding", aktiv: true, rekkefolge: 3, sistOppdatert: 1 },
      { id: L_SYK, organizationId: ORG, type: "fravaer", navn: "Sykdom", aktiv: true, rekkefolge: 4, sistOppdatert: 1 },
    ]).run();
  };
  const sedelMed = (rader: Array<{ id: string; timer: number; fra: string; til: string; lonnsart?: string; pause?: number }>) => {
    db().insert(dagsseddelLocal).values({
      id: "sedel1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 30, sistEndretLokalt: 1,
    }).run();
    for (const r of rader) {
      db().insert(sheetTimerLocal).values({
        id: r.id, dagsseddelId: "sedel1", projectId: "p1", lonnsartId: r.lonnsart ?? "L-normal", aktivitetId: "a1",
        timer: r.timer, fraTid: r.fra, tilTid: r.til, pauseMin: r.pause ?? 0, erReise: false,
        beskrivelse: "Graving", sistEndretLokalt: 1,
      }).run();
    }
  };
  const forslag = (retting?: Parameters<typeof forberedManuellDag>[2]) =>
    forberedManuellDag(lokalDb(), manuellKontekst(), retting).forslag;
  const arbeid = (retting?: Parameters<typeof forberedManuellDag>[2]) =>
    forslag(retting).datoer[0]!.rader.filter((r) => !r.erReise);
  const vis = (r: Array<{ fraTid: string | null; tilTid: string | null; timer: number; lonnsartId: string }>) =>
    r.map((x) => [x.fraTid, x.tilTid, x.timer, x.lonnsartId]);
  const nye = () => rader().filter((r) => !r.id.startsWith("rad")).sort((a, b) => a.fraTid!.localeCompare(b.fraTid!));
  const egenmelding = { id: L_EGEN, navn: "Egenmelding", type: "fravaer", overtidsnivaa: null, aktiv: true, rekkefolge: 3 };
  const sykdom = { ...egenmelding, id: L_SYK, navn: "Sykdom" };
  const regning = { id: L_REGNING, navn: "Regningsarbeid", type: "ordinaer", overtidsnivaa: null, aktiv: true, rekkefolge: 2 };
  const timelonn = { id: "L-normal", navn: "Normaltid", type: "ordinaer", overtidsnivaa: null, aktiv: true, rekkefolge: 0 };

  beforeEach(() => {
    holder.raw.run("DELETE FROM arbeidstid_svar_local;");
  });

  it("🔴 Kenneths flyt: «+» → nytt kort 08–15 → «Egenmelding» på linja → lagret med fravær-art, uten rad-vinduet", () => {
    settNorm();
    arter();
    const tider = { arbeidFra: "08:00", arbeidTil: "15:00" };
    const linje = arbeid({ perDato: { [DATO]: tider } });
    expect(vis(linje)).toEqual([["08:00", "15:00", 6.5, "L-normal"]]);
    expect(linje[0]!.linje).toBe("normal");
    const valg = velgLinjeLonnsart({
      linje: "normal", art: egenmelding, rettDato: tider, naboArtId: null, overtidFra: null, arbeidFra: "08:00",
    });
    const retting = { perDato: { [DATO]: { ...tider, ...valg } } };
    expect(vis(arbeid(retting))).toEqual([["08:00", "15:00", 6.5, L_EGEN]]);
    expect(lagreManuelt(retting).handling.type).toBe("suksess");
    expect(nye().map((r) => [r.fraTid, r.tilTid, r.timer, r.lonnsartId])).toEqual([["08:00", "15:00", 6.5, L_EGEN]]);
  });

  it("negativkontroll: uten valg på linja lagres standardarten (dagens oppførsel)", () => {
    settNorm();
    arter();
    lagreManuelt({ perDato: { [DATO]: { arbeidFra: "08:00", arbeidTil: "15:00" } } });
    expect(nye().map((r) => r.lonnsartId)).toEqual(["L-normal"]);
  });

  it("🔴 T17: annen ordinær art på normaldelen lagres; ordinær art etter normen lagres som ordinær", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    const tider = { arbeidFra: "13:30", arbeidTil: "16:00" };
    expect(vis(arbeid({ perDato: { [DATO]: tider } }))).toEqual([
      ["13:30", "15:00", 1.5, "L-normal"],
      ["15:00", "16:00", 1, L_OT50],
    ]);
    const retting = { perDato: { [DATO]: { ...tider, lonnsartPerLinje: { normal: L_REGNING, overtid: "L-normal" } } } };
    expect(lagreManuelt(retting).handling.type).toBe("suksess");
    expect(nye().map((r) => [r.fraTid, r.tilTid, r.timer, r.lonnsartId])).toEqual([
      ["13:30", "15:00", 1.5, L_REGNING],
      ["15:00", "16:00", 1, "L-normal"],
    ]);
  });

  it("🔴 T17/V6: samme art på begge linjer → én linje", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    const tider = { arbeidFra: "13:30", arbeidTil: "16:00" };
    const ot = arbeid({ perDato: { [DATO]: tider } })[1]!;
    const valg = velgLinjeLonnsart({
      linje: "overtid", art: timelonn, rettDato: tider, naboArtId: "L-normal", overtidFra: ot.fraTid, arbeidFra: "13:30",
    });
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, ...valg } } }))).toEqual([["13:30", "16:00", 2.5, "L-normal"]]);
  });

  it("🔴 T17: regningsart på normaldelen og samme art etter normen → én regningslinje", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 6, fra: "07:00", til: "13:30", pause: 30 }]);
    const tider = { arbeidFra: "13:30", arbeidTil: "16:00", lonnsartPerLinje: { normal: L_REGNING } };
    const ot = arbeid({ perDato: { [DATO]: tider } })[1]!;
    const valg = velgLinjeLonnsart({
      linje: "overtid", art: regning, rettDato: tider, naboArtId: L_REGNING, overtidFra: ot.fraTid, arbeidFra: "13:30",
    });
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, ...valg } } }))).toEqual([["13:30", "16:00", 2.5, L_REGNING]]);
  });

  it("🔴 T19: firma uten overtidsart — linja etter normen vises «Velg lønnsart», sperrer, og lagres etter valg", () => {
    settNorm();
    arter(false);
    seedSedel();
    const f = forslag();
    const dag = f.datoer[0]!;
    expect(dag.rader.filter((r) => !r.erReise)).toEqual([]);
    expect(dag.raderDroppetUtenLonnsart).toBe(1);
    expect(dag.linjerUtenLonnsart).toEqual([{ linje: "overtid", fraTid: "15:00", tilTid: "16:00", timer: 1 }]);
    const grunn = {
      harDb: true, harBeregnet: true, harBruker: true, manuell: true, harArbeidsdagId: false,
      manglerProsjekt: false, sluttIkkeGodkjent: false,
    };
    expect(bekreftSperre({ ...grunn, manglerLonnsart: (dag.linjerUtenLonnsart?.length ?? 0) > 0 })).toBe("manglerLonnsart");
    const valg = velgLinjeLonnsart({
      linje: "overtid", art: timelonn, rettDato: undefined, naboArtId: null, overtidFra: "15:00", arbeidFra: "15:00",
    });
    const etter = forslag({ perDato: { [DATO]: valg } }).datoer[0]!;
    expect(etter.linjerUtenLonnsart).toBeUndefined();
    expect(lagreManuelt({ perDato: { [DATO]: valg } }).handling.type).toBe("suksess");
    expect(nye().map((r) => [r.fraTid, r.tilTid, r.timer, r.lonnsartId])).toEqual([["15:00", "16:00", 1, "L-normal"]]);
  });

  it("🔴 B8: 7,5 t fravær + manuelt 2 t → 2 t normaltid", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 7.5, fra: "07:00", til: "15:00", lonnsart: L_EGEN, pause: 30 }]);
    expect(forberedManuellDag(lokalDb(), manuellKontekst()).input.eksisterendeSedelPerDato[DATO]!.bruktAvNorm).toBe(0);
    expect(vis(arbeid({ perDato: { [DATO]: { arbeidFra: "15:00", arbeidTil: "17:00" } } }))).toEqual([
      ["15:00", "17:00", 2, "L-normal"],
    ]);
  });

  it("🔴 B8: 3 t arbeid + 4,5 t sykdom lagres begge, ingen sperre", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 3, fra: "07:00", til: "10:00" }]);
    const tider = { arbeidFra: "10:00", arbeidTil: "14:30" };
    const valg = velgLinjeLonnsart({
      linje: "normal", art: sykdom, rettDato: tider, naboArtId: null, overtidFra: null, arbeidFra: "10:00",
    });
    const retting = { perDato: { [DATO]: { ...tider, ...valg } } };
    const dag = forslag(retting).datoer[0]!;
    expect(dag.kjedeKonflikt ?? null).toBeNull();
    expect(dag.linjerUtenLonnsart).toBeUndefined();
    expect(lagreManuelt(retting).handling.type).toBe("suksess");
    expect(rader().sort((a, b) => a.fraTid!.localeCompare(b.fraTid!)).map((r) => [r.timer, r.lonnsartId])).toEqual([
      [3, "L-normal"],
      [4.5, L_SYK],
    ]);
  });

  it("🔴 ukjent eller fremmed art i linjevalget faller tilbake til forhåndsvalget", () => {
    settNorm();
    arter();
    const tider = { arbeidFra: "08:00", arbeidTil: "10:00" };
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, lonnsartPerLinje: { normal: "fremmed" } } } }))).toEqual([
      ["08:00", "10:00", 2, "L-normal"],
    ]);
  });

  // RETUR (28) 2026-11-16 — A1 (Kontrollør GATE (57)) og B9 (spec § 10 B9).
  // B9-scenarioene i ordren regner uten pause (9 t på 08–17) → `pauseMin: 0`.
  it("🔴 A1: reise-art i linjevalget avvises — faller tilbake til standardarten", () => {
    settNorm();
    arter();
    db().insert(lonnsartLocal).values({
      id: "L-reise", organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true, rekkefolge: 5, sistOppdatert: 1,
    }).run();
    const tider = { arbeidFra: "08:00", arbeidTil: "10:00" };
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, lonnsartPerLinje: { normal: "L-reise" } } } }))).toEqual([
      ["08:00", "10:00", 2, "L-normal"],
    ]);
  });

  it("🔴 B9: kort 08–17 med fravær 08–15:30 → 7,5 t fravær + 1,5 t normaltid + 0 overtid", () => {
    settNorm();
    arter();
    const tider = { arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 0 };
    const før = arbeid({ perDato: { [DATO]: tider } });
    expect(vis(før)).toEqual([
      ["08:00", "15:30", 7.5, "L-normal"],
      ["15:30", "17:00", 1.5, L_OT50],
    ]);
    const valg = velgLinjeLonnsart({
      linje: "normal", art: egenmelding, rettDato: tider, naboArtId: null,
      overtidFra: "15:30", arbeidFra: "08:00", linjeTil: før[0]!.tilTid,
    });
    expect(valg.fravaerTil).toBe("15:30");
    const retting = { perDato: { [DATO]: { ...tider, ...valg } } };
    const dag = forslag(retting).datoer[0]!;
    expect(vis(dag.rader.filter((r) => !r.erReise))).toEqual([
      ["08:00", "15:30", 7.5, L_EGEN],
      ["15:30", "17:00", 1.5, "L-normal"],
    ]);
    expect(dag.rader.map((r) => r.linje)).toEqual(["normal", "arbeid"]);
    expect(dag.fravaerTil).toBe("15:30");
    expect(lagreManuelt(retting).handling.type).toBe("suksess");
    expect(nye().map((r) => [r.fraTid, r.tilTid, r.timer, r.lonnsartId])).toEqual([
      ["08:00", "15:30", 7.5, L_EGEN],
      ["15:30", "17:00", 1.5, "L-normal"],
    ]);
  });

  it("🔴 B9: kort 08–19 med fravær 08–10 → 9 t arbeid = 7,5 t normaltid + 1,5 t overtid", () => {
    settNorm();
    arter();
    // Arbeiderens vei: «Overtid fra» 10:00 gir normallinja 08–10, fravær velges på den.
    const tider = { arbeidFra: "08:00", arbeidTil: "19:00", pauseMin: 0, overtidFra: "10:00" };
    const før = arbeid({ perDato: { [DATO]: tider } });
    expect(vis(før)).toEqual([
      ["08:00", "10:00", 2, "L-normal"],
      ["10:00", "19:00", 9, L_OT50],
    ]);
    const valg = velgLinjeLonnsart({
      linje: "normal", art: egenmelding, rettDato: tider, naboArtId: null,
      overtidFra: "10:00", arbeidFra: "08:00", linjeTil: før[0]!.tilTid,
    });
    const forventet = [
      ["08:00", "10:00", 2, L_EGEN],
      ["10:00", "17:30", 7.5, "L-normal"],
      ["17:30", "19:00", 1.5, L_OT50],
    ];
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, ...valg } } }))).toEqual(forventet);
    // Samme svar med «Fravær til» alene (uten «Overtid fra»).
    expect(vis(arbeid({ perDato: { [DATO]: {
      arbeidFra: "08:00", arbeidTil: "19:00", pauseMin: 0, fravaerTil: "10:00", lonnsartPerLinje: { normal: L_EGEN },
    } } }))).toEqual(forventet);
  });

  it("🔴 B9: dagen alt fylt med 7,5 t arbeid — nytt kort med fravær 1 t + arbeid 1 t → 1 t overtid", () => {
    settNorm();
    arter();
    sedelMed([{ id: "rad1", timer: 7.5, fra: "07:00", til: "15:00", pause: 30 }]);
    const tider = { arbeidFra: "15:00", arbeidTil: "17:00", pauseMin: 0, overtidFra: "16:00" };
    const før = arbeid({ perDato: { [DATO]: tider } });
    expect(vis(før)).toEqual([
      ["15:00", "16:00", 1, "L-normal"],
      ["16:00", "17:00", 1, L_OT50],
    ]);
    const valg = velgLinjeLonnsart({
      linje: "normal", art: sykdom, rettDato: tider, naboArtId: null,
      overtidFra: "16:00", arbeidFra: "15:00", linjeTil: før[0]!.tilTid,
    });
    expect(vis(arbeid({ perDato: { [DATO]: { ...tider, ...valg } } }))).toEqual([
      ["15:00", "16:00", 1, L_SYK],
      ["16:00", "17:00", 1, L_OT50],
    ]);
  });

  it("🔴 B9/V7: annen art på normallinja fjerner fraværsdelingen; valget på arbeidslinja ryddes når linja forsvinner", () => {
    settNorm();
    arter();
    const tider = { arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 0 };
    const medFravaer = { ...tider, lonnsartPerLinje: { normal: L_EGEN, arbeid: L_REGNING }, fravaerTil: "15:30" };
    expect(vis(arbeid({ perDato: { [DATO]: medFravaer } }))).toEqual([
      ["08:00", "15:30", 7.5, L_EGEN],
      ["15:30", "17:00", 1.5, L_REGNING],
    ]);
    const tilbake = velgLinjeLonnsart({
      linje: "normal", art: timelonn, rettDato: medFravaer, naboArtId: null,
      overtidFra: null, arbeidFra: "08:00", linjeTil: "15:30",
    });
    expect(tilbake.fravaerTil).toBeUndefined();
    const dag = forslag({ perDato: { [DATO]: { ...medFravaer, ...tilbake } } }).datoer[0]!;
    expect(vis(dag.rader.filter((r) => !r.erReise))).toEqual([
      ["08:00", "15:30", 7.5, "L-normal"],
      ["15:30", "17:00", 1.5, L_OT50],
    ]);
    expect(dag.fravaerTil).toBeUndefined();
    expect(ryddLonnsartPerLinje({ normal: "L-normal", arbeid: L_REGNING }, linjerIDag(dag))).toEqual({
      lonnsartPerLinje: { normal: "L-normal" },
    });
  });

  it("🔴 B9: fravær «Fravær til» = kortets slutt → hele kortet fravær, delingspunktet står", () => {
    settNorm();
    arter();
    const dag = forslag({ perDato: { [DATO]: {
      arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 0, fravaerTil: "17:00", lonnsartPerLinje: { normal: L_EGEN },
    } } }).datoer[0]!;
    expect(vis(dag.rader.filter((r) => !r.erReise))).toEqual([["08:00", "17:00", 9, L_EGEN]]);
    expect(dag.fravaerTil).toBe("17:00");
  });

  it("🔴 V8-merknad: fravær slås opp også når arten er deaktivert", () => {
    arter();
    db().insert(lonnsartLocal).values({
      id: "L-gammel-fravaer", organizationId: ORG, type: "fravaer", navn: "Velferdspermisjon", aktiv: false, rekkefolge: 9, sistOppdatert: 1,
    }).run();
    const ider = hentFravaerLonnsartIderLokalt();
    expect([...ider].sort()).toEqual(["L-gammel-fravaer", L_EGEN, L_SYK].sort());
  });

  // RETUR 2 (28) — Kontrollør GATE (58) A2: fravær bruker ALDRI normen, uansett
  // hvor «Fravær til» står. Punktet klemmes til tidligst arbeidsstart + 15 min
  // (ingen tidsrunding i testfirmaet). Målt med og uten pause.
  const sjekkB9 = (dag: Dagsforslag["datoer"][number], fravaerArt: string, fravaerTil: string) => {
    const r = dag.rader.filter((x) => !x.erReise);
    const fravaer = r.filter((x) => x.lonnsartId === fravaerArt);
    const arbeidRader = r.filter((x) => x.lonnsartId !== fravaerArt);
    const arbeidSum = arbeidRader.reduce((s, x) => s + x.timer, 0);
    const ot = arbeidRader.filter((x) => x.lonnsartId === L_OT50).reduce((s, x) => s + x.timer, 0);
    const normal = arbeidRader.filter((x) => x.lonnsartId === "L-normal").reduce((s, x) => s + x.timer, 0);
    expect(dag.fravaerTil).toBe(fravaerTil); // «Fravær til» synlig
    expect(fravaer).toHaveLength(1);
    expect(fravaer[0]!.linje).toBe("normal");
    expect(fravaer[0]!.tilTid).toBe(fravaerTil);
    // Overtid først når faktisk arbeid har brukt normen (7,5 t).
    expect(Math.round(normal * 100) / 100).toBe(Math.min(7.5, Math.round(arbeidSum * 100) / 100));
    expect(Math.round(ot * 100) / 100).toBe(Math.max(0, Math.round((arbeidSum - 7.5) * 100) / 100));
    // Ingen overtidsrad før siste normaltidsrad.
    const forsteOt = r.findIndex((x) => x.lonnsartId === L_OT50);
    if (forsteOt >= 0) expect(r.slice(forsteOt).every((x) => x.lonnsartId === L_OT50)).toBe(true);
    return r;
  };
  const dagMed = (rett: Record<string, unknown>) => forslag({ perDato: { [DATO]: rett } }).datoer[0]!;

  it.each([
    ["uten pause", 0],
    ["med pause", 30],
  ])("🔴 A2 (a): «Fravær til» = arbeidsstart, med og uten husket «Overtid fra» — %s", (_navn, pauseMin) => {
    settNorm();
    arter();
    for (const ekstra of [{}, { overtidFra: "10:00" }]) {
      const dag = dagMed({
        arbeidFra: "08:00", arbeidTil: "17:00", pauseMin, ...ekstra,
        fravaerTil: "08:00", lonnsartPerLinje: { normal: L_EGEN },
      });
      const r = sjekkB9(dag, L_EGEN, "08:15");
      expect(r[0]!.fraTid).toBe("08:00");
    }
  });

  it.each([
    ["uten pause", 0],
    ["med pause", 30],
  ])("🔴 A2 (b): «Fravær til» før arbeidsstart, med og uten husket «Overtid fra» — %s", (_navn, pauseMin) => {
    settNorm();
    arter();
    for (const ekstra of [{}, { overtidFra: "10:00" }]) {
      sjekkB9(
        dagMed({
          arbeidFra: "08:00", arbeidTil: "17:00", pauseMin, ...ekstra,
          fravaerTil: "06:30", lonnsartPerLinje: { normal: L_EGEN },
        }),
        L_EGEN,
        "08:15",
      );
    }
  });

  it.each([
    ["uten pause", 0],
    ["med pause", 30],
  ])("🔴 A2 (c): arbeidsstart flyttet forbi punktet — %s", (_navn, pauseMin) => {
    settNorm();
    arter();
    const dag = dagMed({
      arbeidFra: "09:00", arbeidTil: "17:00", pauseMin, overtidFra: "10:00",
      fravaerTil: "08:30", lonnsartPerLinje: { normal: L_EGEN },
    });
    const r = sjekkB9(dag, L_EGEN, "09:15");
    expect(r[0]!.fraTid).toBe("09:00");
  });

  it("🔴 A2 (d): Sykdom på arbeid-linja godtas ikke — arbeidet fyller normen, overtid først etter 7,5 t", () => {
    settNorm();
    arter();
    const dag = dagMed({
      arbeidFra: "08:00", arbeidTil: "19:00", pauseMin: 0,
      fravaerTil: "10:00", lonnsartPerLinje: { normal: L_EGEN, arbeid: L_SYK },
    });
    expect(vis(dag.rader.filter((r) => !r.erReise))).toEqual([
      ["08:00", "10:00", 2, L_EGEN],
      ["10:00", "17:30", 7.5, "L-normal"],
      ["17:30", "19:00", 1.5, L_OT50],
    ]);
    sjekkB9(dag, L_EGEN, "10:00");
  });

  it("🔴 A2 (d) med pause: Sykdom på arbeid-linja godtas ikke", () => {
    settNorm();
    arter();
    const dag = dagMed({
      arbeidFra: "08:00", arbeidTil: "19:00", pauseMin: 30,
      fravaerTil: "10:00", lonnsartPerLinje: { normal: L_EGEN, arbeid: L_SYK },
    });
    expect(dag.rader.some((r) => r.lonnsartId === L_SYK)).toBe(false);
    sjekkB9(dag, L_EGEN, "10:00");
  });

  // RETUR 3 (28) — Kontrollør GATE (59) A3: fastStart-firma (start 07:00,
  // pause etter 5,5 t = 12:30), kort 12:30–17:00, pause 30 ligger ved
  // arbeidsstart. Tidligste punkt med fravær > 0 er 13:15 (forbi pausen) —
  // «−» skal aldri gi hele kortet som fravær.
  const settNormFastStart = () =>
    db().insert(schema.arbeidstidSvarLocal).values({
      organizationId: ORG, dato: DATO, dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30,
      normKilde: "fast", pauseEtterTimer: 5.5, pauseReferanse: "fastStart", hentetAt: Date.now(),
    }).run();

  it.each([
    ["12:30", {}], ["12:45", {}], ["13:00", {}],
    ["12:30", { overtidFra: "14:00" }], ["12:45", { overtidFra: "14:00" }], ["13:00", { overtidFra: "14:00" }],
  ])("🔴 A3: pause ved arbeidsstart — «Fravær til» %s %j klemmes til 13:15, aldri hele kortet", (fravaerTil, ekstra) => {
    settNormFastStart();
    arter();
    const dag = dagMed({
      arbeidFra: "12:30", arbeidTil: "17:00", pauseMin: 30, ...ekstra,
      fravaerTil, lonnsartPerLinje: { normal: L_EGEN },
    });
    const r = sjekkB9(dag, L_EGEN, "13:15");
    const fravaer = r.filter((x) => x.lonnsartId === L_EGEN).reduce((s, x) => s + x.timer, 0);
    expect(fravaer).toBeCloseTo(0.25, 5);
    expect(r.reduce((s, x) => s + x.timer, 0)).toBeCloseTo(4, 5);
    // Stepperen: «−» sperret på grensen, «+» neste punkt som endrer timene.
    expect(dag.fravaerSteg).toEqual({ ned: null, opp: "13:30" });
  });

  it("🔴 A3 stepper: fra 13:30 går «−» til grensen 13:15, aldri forbi", () => {
    settNormFastStart();
    arter();
    const dag = dagMed({
      arbeidFra: "12:30", arbeidTil: "17:00", pauseMin: 30,
      fravaerTil: "13:30", lonnsartPerLinje: { normal: L_EGEN },
    });
    sjekkB9(dag, L_EGEN, "13:30");
    expect(dag.fravaerSteg).toEqual({ ned: "13:15", opp: "13:45" });
  });

  it("A3: kort kortere enn grensen (12:30–13:00, kun pause-tid) → hele kortet som fravær, stepper sperret", () => {
    settNormFastStart();
    arter();
    const dag = dagMed({
      arbeidFra: "12:30", arbeidTil: "13:10", pauseMin: 30,
      fravaerTil: "12:45", lonnsartPerLinje: { normal: L_EGEN },
    });
    const r = dag.rader.filter((x) => !x.erReise);
    expect(r.every((x) => x.lonnsartId === L_EGEN)).toBe(true);
    expect(dag.fravaerSteg?.ned ?? null).toBeNull();
  });

  it("🔴 A3 feilklasse: pause slutter på punktet (08:00, pause 13:30–14:00) — stepperen hopper over pausen, sitter aldri fast", () => {
    settNorm();
    arter();
    const dag = dagMed({
      arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 30,
      fravaerTil: "14:00", lonnsartPerLinje: { normal: L_EGEN },
    });
    // Fraværsraden slutter før pausen (5,5 t); «Fravær til» viser 13:30.
    const r = sjekkB9(dag, L_EGEN, "13:30");
    expect(r.filter((x) => x.lonnsartId === L_EGEN).reduce((s, x) => s + x.timer, 0)).toBeCloseTo(5.5, 5);
    // «+» fra den viste verdien må gi mer fravær — ikke tilbake til 13:30.
    expect(dag.fravaerSteg).toEqual({ ned: "13:15", opp: "14:15" });
    const fraVist = dagMed({
      arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 30,
      fravaerTil: "13:30", lonnsartPerLinje: { normal: L_EGEN },
    });
    expect(fraVist.fravaerSteg?.opp).toBe("14:15");
  });

  it("A3 feilklasse: pause midt i fraværet (08:00, «Fravær til» 15:00) — pausen trekkes, fravær 6,5 t", () => {
    settNorm();
    arter();
    const dag = dagMed({
      arbeidFra: "08:00", arbeidTil: "17:00", pauseMin: 30,
      fravaerTil: "15:00", lonnsartPerLinje: { normal: L_EGEN },
    });
    const r = sjekkB9(dag, L_EGEN, "15:00");
    expect(r.filter((x) => x.lonnsartId === L_EGEN).reduce((s, x) => s + x.timer, 0)).toBeCloseTo(6.5, 5);
    expect(dag.fravaerSteg).toEqual({ ned: "14:45", opp: "15:15" });
  });
});
