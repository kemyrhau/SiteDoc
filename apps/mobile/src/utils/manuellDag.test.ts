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
import { entydigByggeplass } from "./bekreftDagTillegg";
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
    return bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(sluttIso, eco), tillegg(entydigByggeplass(forslag, "p2")));
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

  it("🔴 K10: skjermen sender kortets entydige byggeplass til tilleggsseksjonen", () => {
    expect(les("../../app/timer/bekreft-dag.tsx")).toContain("byggeplassId={entydigByggeplass(forslag, prosjektId)}");
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

describe("ORDRE 36e pkt. 4 — manuell kort dag bærer pausen", () => {
  it("🔴 manuell 08–12 + 30 → rad 08:00–12:00, pauseMin 30, timer 3,5; hodet Σ = 30", () => {
    const { handling } = lagreManuelt({ perDato: { [DATO]: { arbeidFra: "08:00", arbeidTil: "12:00" } } });
    expect(handling.type).toBe("suksess");
    const r = rader();
    expect(r.map((x) => [x.fraTid, x.tilTid, x.timer, x.pauseMin])).toEqual([["08:00", "12:00", 3.5, 30]]);
    expect(sedler()[0]!.pauseMin).toBe(30);
  });
});
