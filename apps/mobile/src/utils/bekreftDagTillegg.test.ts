import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * L3-D (spec § 3.5 / § 8 nr. 15–21, ORDRE 31) — «Maskin og varer» i
 * `/timer/bekreft-dag`, mot EKTE SQLite (sql.js), samme harness som
 * `bekreftDag.test.ts`.
 *
 * Invarianten (G1/H26): maskin og varer holdes i skjermens minne og skrives
 * FØRST ved [Bekreft og lagre]. PRESISERING TILLEGG (2026-11-12/13): linjene
 * eies av en arbeidsrad (`radTilleggNokkel` = dato|radIndeks — ORDRE
 * Tillegg/Utlegg 3a: uten lønnsart, så linjene følger raden ved lønnsartbytte) og
 * skrives på den radens sedel med radens id — ingen dagsliste, ingen
 * automatisk kobling.
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
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { forberedBekreftDag, bekreftDag, prosjekterMedArbeid, prosjektMedFlestTimer } from "./bekreftDag";
import { skrivUtlegg, type NyttUtlegg } from "../services/tilleggUtleggSkriv";
import type { LonnUtlegg } from "./dagsforslagAnvend";
import type { Dagsforslag, DagsforslagRad } from "./dagsforslag";

/** ORDRE 36a: beskrivelse er påkrevd ved Bekreft — testene her måler noe annet. */
function medBeskrivelse(f: Dagsforslag): Dagsforslag {
  return { ...f, beskrivelsePerKort: Object.fromEntries(prosjekterMedArbeid(f).map((p) => [p, "Graving"])) };
}
import {
  tilleggSynlighet,
  entydigByggeplass,
  maskinBruddForTillegg,
  vaktGrunnlag,
  nyTilleggMaskin,
  fortIDagLinjer,
  radTilleggNokkel,
  sedelKontekstLokalt,
  tilleggRader,
  tilleggUtenRad,
  type BekreftDagTillegg,
  type TilleggPerRad,
} from "./bekreftDagTillegg";
import { fullforVarelinje, planleggVaresending } from "../services/vareforbrukSync";

let teller = 0;
const {
  arbeidsdagLocal,
  dagsseddelLocal,
  sheetTimerLocal,
  sheetMachineLocal,
  vareforbrukLocal,
  prosjektLocal,
  aktivitetLocal,
  lonnsartLocal,
  organizationSettingLocal,
  oppmotestedLocal,
  byggeplassLocal,
  reisetidMatriseLocal,
} = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
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

function seedArbeidsdag(startAt = START) {
  db().insert(arbeidsdagLocal).values({
    id: DAG_ID, userId: BRUKER, dato: DATO, startAt, status: "paagaar",
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
    endLat: null,
    endLng: null,
  };
}

const MASKIN_3: BekreftDagTillegg = {
  maskiner: [
    { lokalId: "m1", projectId: "p1", vehicleId: "eq-1", timer: 3, mengde: null, enhet: null },
  ],
  varer: [],
};
const VARE: BekreftDagTillegg = {
  maskiner: [],
  varer: [
    {
      lokalId: "v1", projectId: "p1", vareId: "vare-1", vareNavn: "Pukk 0-32",
      enhet: "tonn", antall: 12.5, byggeplassId: "b1",
    },
  ],
};

function tellTillegg() {
  return {
    maskin: db().select().from(sheetMachineLocal).all().length,
    varer: db().select().from(vareforbrukLocal).all().length,
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
      " DELETE FROM sheet_machine_local; DELETE FROM vareforbruk_local;" +
      " DELETE FROM organization_setting_local; DELETE FROM oppmotested_local;" +
      " DELETE FROM byggeplass_local; DELETE FROM reisetid_matrise_local;",
  );
  seedKatalog();
  seedArbeidsdag();
});

/** Nøkkelen til arbeidsraden med `radIndeks` på `dato` (default startdatoen, første rad). */
function radNokkel(forslag: Dagsforslag, radIndeks = 0, dato?: string): string {
  const d = dato ? forslag.datoer.find((x) => x.dato === dato)! : forslag.datoer.find((x) => x.erStartSegment)!;
  const rad = d.rader.find((r) => !r.erReise && r.radIndeks === radIndeks)!;
  return radTilleggNokkel(d.dato, rad)!;
}

/** Linjene på én arbeidsrad. */
function paaRad(forslag: Dagsforslag, tillegg: BekreftDagTillegg, radIndeks = 0, dato?: string): TilleggPerRad {
  return { [radNokkel(forslag, radIndeks, dato)]: tillegg };
}

const arbeidsrader = () => db().select().from(sheetTimerLocal).all().filter((r) => !r.erReise);

describe("L3-D § 8 nr. 15 — maskin med antall", () => {
  it("🔴 maskin 3,0 → én rad koblet til raden den ble lagt på, uten fra/til", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, MASKIN_3));
    expect(handling.type).toBe("suksess");
    const rader = db().select().from(sheetMachineLocal).all();
    expect(rader).toHaveLength(1);
    const m = rader[0]!;
    expect(m.dagsseddelId).toBe(resultat!.startSheetId);
    expect(m.projectId).toBe("p1");
    expect(m.vehicleId).toBe("eq-1");
    expect(arbeidsrader()).toHaveLength(1);
    expect(m.sheetTimerId).toBe(arbeidsrader()[0]!.id);
    expect(m.fraTid).toBeNull();
    expect(m.tilTid).toBeNull();
    expect(m.externalCostObjectId).toBeNull();
    expect(m.timer).toBe(3);
  });
});

describe("L3-D § 8 nr. 16 — vare", () => {
  it("🔴 vare → pending-rad på radens sedel; sending venter til sedelen er synket", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, VARE));
    const rader = db().select().from(vareforbrukLocal).all();
    expect(rader).toHaveLength(1);
    const v = rader[0]!;
    expect(v.sheetId).toBe(resultat!.startSheetId);
    expect(v.projectId).toBe("p1");
    // TILLEGG 2026-11-12: varen arver radens effektive byggeplass (her ingen),
    // ikke valget i arket.
    expect(v.byggeplassId).toBeNull();
    expect(v.dato).toBe(DATO);
    expect(v.userId).toBe(BRUKER);
    expect(v.organizationId).toBe(ORG);
    expect(v.antall).toBe(12.5);
    expect(v.syncStatus).toBe("pending");
    const rad = db().select().from(sheetTimerLocal).all().find((r) => r.id === v.sheetTimerId);
    expect(rad).toBeDefined();
    expect(rad!.erReise).toBeFalsy();
    expect(rad!.projectId).toBe("p1");
    const sedel = db().select().from(dagsseddelLocal).all()[0]!;
    expect(sedel.syncStatus).not.toBe("synced");
    expect(planleggVaresending(v, sedel, [{ projectId: "p1" }]).handling).toBe("vent");
  });
});

describe("L3-D § 8 nr. 17 — uten maskin/vare er Bekreft som før", () => {
  it("tillegg utelatt og tomt tillegg gir samme rader og 0 maskin/vare", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx());
    const utenRader = db().select().from(sheetTimerLocal).all().map((r) => ({ ...r, id: "", dagsseddelId: "" }));
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });

    holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM arbeidsdag_local;");
    seedArbeidsdag();
    const { forslag: f2 } = forberedBekreftDag(lokalDb(), kontekst());
    bekreftDag(lokalDb(), medBeskrivelse(f2), skriveCtx(), { [radNokkel(f2)]: { maskiner: [], varer: [] } });
    const medTomt = db().select().from(sheetTimerLocal).all().map((r) => ({ ...r, id: "", dagsseddelId: "" }));
    expect(medTomt).toEqual(utenRader);
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
  });
});

describe("L3-D § 8 nr. 18 — synlighet (vedtak D: skjul, ingen «ikke lastet»-tekst)", () => {
  it("knappene følger modul/buffer; seksjonen skjules når begge mangler", () => {
    expect(tilleggSynlighet({ harEquipment: true, varelagerProsjektIder: ["p1"], projectId: "p1" }))
      .toEqual({ maskin: true, varer: true, seksjon: true });
    expect(tilleggSynlighet({ harEquipment: false, varelagerProsjektIder: ["p1"], projectId: "p1" }))
      .toEqual({ maskin: false, varer: true, seksjon: true });
    expect(tilleggSynlighet({ harEquipment: true, varelagerProsjektIder: ["p2"], projectId: "p1" }))
      .toEqual({ maskin: true, varer: false, seksjon: true });
    expect(tilleggSynlighet({ harEquipment: false, varelagerProsjektIder: [], projectId: "p1" }))
      .toEqual({ maskin: false, varer: false, seksjon: false });
    expect(tilleggSynlighet({ harEquipment: true, varelagerProsjektIder: ["p1"], projectId: null }))
      .toEqual({ maskin: false, varer: false, seksjon: false });
  });
});

describe("L3-D § 8 nr. 19 — avbrudd", () => {
  it("🔴 tillegg i minnet uten Bekreft → 0 maskin- og varerader, dagen står paagaar", () => {
    const tillegg: BekreftDagTillegg = { maskiner: MASKIN_3.maskiner, varer: VARE.varer };
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    // Skjermen regner vakten mens arbeideren legger til — det er kun lesing.
    expect(maskinBruddForTillegg(vaktGrunnlag(lokalDb(), BRUKER, forslag), tillegg.maskiner)).toEqual([]);
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
    const dag = db().select().from(arbeidsdagLocal).all()[0]!;
    expect(dag.status).toBe("paagaar");
    expect(db().select().from(dagsseddelLocal).all()).toHaveLength(0);
  });
});

describe("L3-D § 8 nr. 20 — byggeplass", () => {
  it("én byggeplass → den; to segmenter med ulike byggeplasser → null", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), { byggeplassId: "b1" });
    expect(entydigByggeplass(forslag, "p1")).toBe("b1");
    const toSegmenter = {
      ...forslag,
      datoer: [
        { ...forslag.datoer[0]!, byggeplassId: "b1" },
        { ...forslag.datoer[0]!, dato: "2026-07-02", erStartSegment: false, byggeplassId: "b2" },
      ],
    };
    expect(entydigByggeplass(toSegmenter, "p1")).toBeNull();
    expect(entydigByggeplass(forslag, "p2")).toBeNull();
  });

  it("🔴 to segmenter: maskinen havner på sedelen til raden den ble lagt på (negativkontroll: den andre datoen)", () => {
    holder.raw.run("DELETE FROM arbeidsdag_local;");
    seedArbeidsdag("2026-07-01T20:00:00");
    const ctx = kontekst({
      dag: { startAt: "2026-07-01T20:00:00", startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
      sluttIso: "2026-07-02T04:00:00",
    });
    const { forslag } = forberedBekreftDag(lokalDb(), ctx);
    expect(forslag.datoer).toHaveLength(2);
    const nesteDato = forslag.datoer.find((d) => !d.erStartSegment)!.dato;
    const { resultat } = bekreftDag(
      lokalDb(),
      medBeskrivelse(forslag),
      { ...skriveCtx(), sluttIso: "2026-07-02T04:00:00" },
      paaRad(forslag, MASKIN_3, 0, nesteDato),
    );
    const maskin = db().select().from(sheetMachineLocal).all();
    expect(maskin).toHaveLength(1);
    const sedel = db().select().from(dagsseddelLocal).all().find((s) => s.id === maskin[0]!.dagsseddelId)!;
    expect(sedel.dato).toBe(nesteDato);
    expect(maskin[0]!.dagsseddelId).not.toBe(resultat!.startSheetId);
    const rad = arbeidsrader().find((r) => r.id === maskin[0]!.sheetTimerId)!;
    expect(rad.dagsseddelId).toBe(sedel.id);
  });
});

describe("L3-D § 8 nr. 21 — maskin ≤ arbeid + pause (samme regel som serveren)", () => {
  it("🔴 9,0 maskintimer mot 3,4 t arbeid + 0,5 t pause → brudd", () => {
    const grunnlag = {
      timerRader: [{ projectId: "p1", externalCostObjectId: null, timer: 3.4 }],
      maskinRader: [],
      pauseMin: 30,
    };
    const ni = [{ ...MASKIN_3.maskiner[0]!, timer: 9 }];
    const brudd = maskinBruddForTillegg(grunnlag, ni);
    expect(brudd).toHaveLength(1);
    expect(brudd[0]).toMatchObject({ projectId: "p1", timerSum: 3.4, maskinSum: 9 });
    const tre9 = [{ ...MASKIN_3.maskiner[0]!, timer: 3.9 }];
    expect(maskinBruddForTillegg(grunnlag, tre9)).toEqual([]);
  });

  it("🔴 Bekreft med brudd skriver ingenting og dagen står paagaar", () => {
    // 07:00–10:54 med 30 min pause = 3,4 t arbeid.
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst(), {
      perDato: { [DATO]: { arbeidFra: "07:00", arbeidTil: "10:54", pauseMin: 30 } },
    });
    const ni: BekreftDagTillegg = {
      maskiner: [{ ...MASKIN_3.maskiner[0]!, timer: 9 }],
      varer: VARE.varer,
    };
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, ni));
    expect(handling.type).toBe("maskinBrudd");
    expect(resultat).toBeNull();
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
    expect(db().select().from(dagsseddelLocal).all()).toHaveLength(0);
    expect(db().select().from(sheetTimerLocal).all()).toHaveLength(0);
    expect(db().select().from(arbeidsdagLocal).all()[0]!.status).toBe("paagaar");
  });

  it("vakten teller eksisterende rader på draft-sedelen (append), som serveren", () => {
    db().insert(dagsseddelLocal).values({
      id: "eks", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    db().insert(sheetMachineLocal).values({
      id: "m-eks", dagsseddelId: "eks", projectId: "p1", vehicleId: "eq-9", timer: 7.5,
      sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const grunnlag = vaktGrunnlag(lokalDb(), BRUKER, forslag);
    expect(grunnlag!.maskinRader).toEqual([{ projectId: "p1", externalCostObjectId: null, timer: 7.5 }]);
    // 7,5 eksisterende + 3 nye > forslagets arbeid (7,5 t) + pause.
    expect(maskinBruddForTillegg(grunnlag, MASKIN_3.maskiner)).toHaveLength(1);
  });
});

describe("Vedtak C — sendt start-sedel", () => {
  it("sendt start-sedel → ingen maskin/varer skrives", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    // Blokkert dato har ingen rad å legge linjer på.
    expect(tilleggRader(forslag)).toEqual([]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx());
    expect(handling.type).toBe("blokkertSendt");
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
  });
});

describe("Vedtak B — KortVareforbrukModal: begge stier", () => {
  const valg = {
    vareId: "vare-1", vareNavn: "Pukk", enhet: "tonn", antall: 2, byggeplassId: null,
  };
  it("med onVelgLinje → linja returneres, ingenting lagres", () => {
    const onVelgLinje = vi.fn();
    const lagre = vi.fn();
    expect(fullforVarelinje(valg, { onVelgLinje, lagre })).toBe("valgt");
    expect(onVelgLinje).toHaveBeenCalledWith(valg);
    expect(lagre).not.toHaveBeenCalled();
    expect(tellTillegg().varer).toBe(0);
  });
  it("uten onVelgLinje → lagres som før (prosjektkortet)", () => {
    const lagre = vi.fn();
    expect(fullforVarelinje(valg, { lagre })).toBe("lagret");
    expect(lagre).toHaveBeenCalledWith(valg);
  });
});

describe("Dom (56) merknad 1 — A2: byggeplass på et annet prosjekt", () => {
  it("valgtByggeplassId i p2 gir prosjekt p2 og reise-destinasjon til den byggeplassen", () => {
    db().insert(organizationSettingLocal).values({
      organizationId: ORG, reiseLonnsartId: "L-reise", sistOppdatert: 1,
    } as typeof organizationSettingLocal.$inferInsert).run();
    db().insert(lonnsartLocal).values({
      id: "L-reise", organizationId: ORG, type: "ordinaer", navn: "Reisetid",
      aktiv: true, erStandardvalg: false, sistOppdatert: 1,
    }).run();
    db().insert(oppmotestedLocal).values({
      id: "o1", organizationId: ORG, navn: "Kontor", lat: 59.9, lng: 10.7, radiusM: 150, sistOppdatert: 1,
    }).run();
    db().insert(byggeplassLocal).values([
      { id: "b1", organizationId: ORG, projectId: "p1", navn: "B1", lat: 60.0, lng: 10.8, radiusM: 150, sistOppdatert: 1 },
      { id: "b2", organizationId: ORG, projectId: "p2", navn: "B2", lat: 60.5, lng: 11.2, radiusM: 150, sistOppdatert: 1 },
    ]).run();
    db().insert(reisetidMatriseLocal).values([
      { organizationId: ORG, oppmotestedId: "o1", byggeplassId: "b1", kjoretidMin: 45, sistOppdatert: 1 },
      { organizationId: ORG, oppmotestedId: "o1", byggeplassId: "b2", kjoretidMin: 60, sistOppdatert: 1 },
    ]).run();
    const kontor = {
      dag: { startAt: START, startLat: 59.9, startLng: 10.7, oppmotestedId: "o1", byggeplassId: null },
      endLat: 59.9,
      endLng: 10.7,
    };
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst({ ...kontor, valgtByggeplassId: "b2" }),
    );
    expect(forslag.prosjektId).toBe("p2");
    const reise = forslag.datoer.flatMap((d) => d.rader).filter((r) => r.erReise);
    expect(reise.length).toBeGreaterThan(0);
    expect(reise.every((r) => r.byggeplassId === "b2")).toBe(true);
    expect(reise.every((r) => r.reiseKjoretidMin === 60)).toBe(true);
    // Reiserader bærer aldri maskin/vare.
    expect(reise.every((r) => radTilleggNokkel(DATO, r) === null)).toBe(true);
  });
});

describe("Dom (57) m1 — M7: lokal maskinrad uten prosjekt arver sedelens", () => {
  it("🔴 eksisterende maskinrad med projectId null teller mot sedelens prosjekt", () => {
    db().insert(dagsseddelLocal).values({
      id: "eks", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    db().insert(sheetMachineLocal).values({
      id: "m-null", dagsseddelId: "eks", projectId: null, vehicleId: "eq-9", timer: 7.5,
      sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const grunnlag = vaktGrunnlag(lokalDb(), BRUKER, forslag);
    expect(grunnlag!.maskinRader).toEqual([{ projectId: "p1", externalCostObjectId: null, timer: 7.5 }]);
    // 7,5 arvet + 3 nye på p1 > forslagets arbeid + pause → brudd. Uten arv havner
    // raden i en egen null-bøtte og bruddet forsvinner.
    expect(maskinBruddForTillegg(grunnlag, MASKIN_3.maskiner)).toHaveLength(1);
  });
});

/** Draft-sedel på startdatoen med én eksisterende arbeidsrad for p1 (2 t). */
function seedEksisterendeRad() {
  db().insert(dagsseddelLocal).values({
    id: "eks", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
    dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
  }).run();
  db().insert(sheetTimerLocal).values({
    id: "t-eks", dagsseddelId: "eks", projectId: "", aktivitetId: "a1", lonnsartId: "L-normal", timer: 2,
    sistEndretLokalt: 1,
  }).run();
}

type ToRaderTid = { a: [string, string]; b: [string, string] };
/**
 * Startdatoen delt i to arbeidsrader med SAMME lønnsart (samme bøtte):
 * A (radIndeks 0, 4 t) og B (radIndeks 1, 3,5 t). `tid` bestemmer klokka;
 * radene sorteres etter fra-tid som skjermen viser dem.
 */
function toRader(tid: ToRaderTid): Dagsforslag {
  const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
  const d = forslag.datoer.find((x) => x.erStartSegment)!;
  const mal = d.rader.find((r) => !r.erReise)!;
  const a: DagsforslagRad = { ...mal, radIndeks: 0, fraTid: tid.a[0], tilTid: tid.a[1], timer: 4, pauseMin: 0 };
  const b: DagsforslagRad = { ...mal, radIndeks: 1, fraTid: tid.b[0], tilTid: tid.b[1], timer: 3.5, pauseMin: 0 };
  const rader = [a, b].sort((x, y) => (x.fraTid ?? "").localeCompare(y.fraTid ?? ""));
  return { ...forslag, datoer: forslag.datoer.map((x) => (x === d ? { ...d, rader } : x)) };
}
const VANLIG: ToRaderTid = { a: ["07:00", "11:00"], b: ["11:30", "15:00"] };
/** Tidsretting som bytter rekkefølgen: B ligger nå først på dagen. */
const BYTTET: ToRaderTid = { a: ["11:00", "15:00"], b: ["07:00", "10:30"] };
const radMedTimer = (timer: number) => arbeidsrader().find((r) => r.timer === timer)!;

describe("PRESISERING TILLEGG (GO 2026-11-13) — maskin/vare pr. arbeidsrad", () => {
  it("🔴 flere rader på kortet → ingenting uten rad: eksisterende rad får aldri linjer, tomt tillegg skriver ingenting", () => {
    seedEksisterendeRad();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    // Bare forslagets egne rader kan bære linjer — ikke kortets eksisterende rad.
    expect(tilleggRader(forslag).map((r) => r.nokkel)).toEqual([radNokkel(forslag)]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {});
    expect(handling.type).toBe("suksess");
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
  });

  it("negativkontroll: samme kort, vare lagt på forslagets rad → skrevet på den raden, ikke på t-eks", () => {
    seedEksisterendeRad();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, VARE));
    const v = db().select().from(vareforbrukLocal).all();
    expect(v).toHaveLength(1);
    expect(v[0]!.sheetTimerId).not.toBe("t-eks");
    expect(arbeidsrader().find((r) => r.id === v[0]!.sheetTimerId)).toBeDefined();
  });

  it("🔴 linje på rad 2 får rad 2s id (negativkontroll: rad 1s id er en annen)", () => {
    const forslag = toRader(VANLIG);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, MASKIN_3, 1));
    expect(handling.type).toBe("suksess");
    const m = db().select().from(sheetMachineLocal).all();
    expect(m).toHaveLength(1);
    expect(m[0]!.sheetTimerId).toBe(radMedTimer(3.5).id);
    expect(m[0]!.sheetTimerId).not.toBe(radMedTimer(4).id);
  });

  it("🔴 maskin over radens timer → maskinBrudd og ingenting skrevet, selv om bøtta har plass", () => {
    const forslag = toRader(VANLIG);
    const fire: BekreftDagTillegg = { maskiner: [{ ...MASKIN_3.maskiner[0]!, timer: 4 }], varer: VARE.varer };
    // Bøtta (7,5 t) har plass — bare radregelen stopper.
    expect(maskinBruddForTillegg(vaktGrunnlag(lokalDb(), BRUKER, forslag, DATO), fire.maskiner)).toEqual([]);
    const r = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, fire, 1));
    expect(r.handling.type).toBe("maskinBrudd");
    expect(r.resultat).toBeNull();
    expect(db().select().from(dagsseddelLocal).all()).toHaveLength(0);
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
  });

  it("negativkontroll: samme 4 t på rad 1 (4 t) → suksess", () => {
    const forslag = toRader(VANLIG);
    const fire: BekreftDagTillegg = { maskiner: [{ ...MASKIN_3.maskiner[0]!, timer: 4 }], varer: [] };
    const r = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, fire, 0));
    expect(r.handling.type).toBe("suksess");
    expect(db().select().from(sheetMachineLocal).all()[0]!.sheetTimerId).toBe(radMedTimer(4).id);
  });

  it("🔴 raden forsvant → tilleggUtenRad, ingenting skrevet, dagen står paagaar", () => {
    const { forslag: foer } = forberedBekreftDag(lokalDb(), kontekst());
    const perRad = paaRad(foer, { maskiner: MASKIN_3.maskiner, varer: VARE.varer });
    const { forslag: etter } = forberedBekreftDag(lokalDb(), kontekst(), { perDato: { [DATO]: { fjernArbeid: true } } });
    expect(tilleggUtenRad(etter, perRad)).toEqual(Object.keys(perRad));
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), perRad);
    expect(handling).toEqual({ type: "tilleggUtenRad", nokler: Object.keys(perRad) });
    expect(resultat).toBeNull();
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
    expect(db().select().from(sheetTimerLocal).all()).toHaveLength(0);
    expect(db().select().from(arbeidsdagLocal).all()[0]!.status).toBe("paagaar");
  });

  it("🔴 fra-tid rettet → samme nøkkel, linjene står og skrives på den rettede raden (negativkontroll: fjernet rad over)", () => {
    const { forslag: foer } = forberedBekreftDag(lokalDb(), kontekst());
    const perRad = paaRad(foer, VARE);
    const { forslag: rettet } = forberedBekreftDag(lokalDb(), kontekst(), { perDato: { [DATO]: { arbeidFra: "08:00" } } });
    expect(radNokkel(rettet)).toBe(radNokkel(foer));
    expect(tilleggUtenRad(rettet, perRad)).toEqual([]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(rettet), skriveCtx(), perRad);
    expect(handling.type).toBe("suksess");
    const v = db().select().from(vareforbrukLocal).all();
    expect(v).toHaveLength(1);
    expect(arbeidsrader().find((r) => r.id === v[0]!.sheetTimerId)!.fraTid).toBe("08:00");
  });

  it("🔴 tidsretting bytter rekkefølgen → linjen blir på samme rad (B), ikke på posisjonen", () => {
    const foer = toRader(VANLIG);
    const perRad = paaRad(foer, MASKIN_3, 1);
    const etter = toRader(BYTTET);
    // B ligger nå først på dagen, men nøkkelen følger B.
    const startEtter = etter.datoer.find((d) => d.erStartSegment)!.rader.filter((r) => !r.erReise);
    expect(startEtter.map((r) => r.radIndeks)).toEqual([1, 0]);
    expect(tilleggUtenRad(etter, perRad)).toEqual([]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), perRad);
    expect(handling.type).toBe("suksess");
    const m = db().select().from(sheetMachineLocal).all();
    expect(m).toHaveLength(1);
    expect(m[0]!.sheetTimerId).toBe(radMedTimer(3.5).id);
    expect(radMedTimer(3.5).fraTid).toBe("07:00");
  });

  it("negativkontroll: nøkkel etter posisjon (B = indeks 0 etter sortering) ville lagt linjen på A", () => {
    const etter = toRader(BYTTET);
    const d = etter.datoer.find((x) => x.erStartSegment)!;
    const posisjonB = d.rader.filter((r) => !r.erReise).findIndex((r) => r.timer === 3.5);
    expect(posisjonB).toBe(0);
    const posisjonsNokkel = radTilleggNokkel(d.dato, { erReise: false, radIndeks: posisjonB })!;
    bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), { [posisjonsNokkel]: MASKIN_3 });
    expect(db().select().from(sheetMachineLocal).all()[0]!.sheetTimerId).toBe(radMedTimer(4).id);
  });
});

describe("ORDRE Tillegg/Utlegg 3a/3b (GO 2026-11-13)", () => {
  /** B får en annen lønnsart enn ved første visning. */
  function medLonnsartPaaB(f: Dagsforslag, lonnsartId: string): Dagsforslag {
    return {
      ...f,
      datoer: f.datoer.map((d) => ({
        ...d,
        rader: d.rader.map((r) => (!r.erReise && r.radIndeks === 1 ? { ...r, lonnsartId } : r)),
      })),
    };
  }
  function seedOvertid() {
    db().insert(lonnsartLocal).values({
      id: "L-overtid", organizationId: ORG, type: "ordinaer", navn: "Overtid 50",
      aktiv: true, erStandardvalg: false, sistOppdatert: 1,
    }).run();
  }

  it("🔴 3a: lønnsart byttet på raden → maskinen blir på raden (B), suksess", () => {
    seedOvertid();
    const foer = toRader(VANLIG);
    const perRad = paaRad(foer, MASKIN_3, 1);
    const etter = medLonnsartPaaB(foer, "L-overtid");
    expect(tilleggUtenRad(etter, perRad)).toEqual([]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), perRad);
    expect(handling.type).toBe("suksess");
    const m = db().select().from(sheetMachineLocal).all();
    expect(m).toHaveLength(1);
    const b = radMedTimer(3.5);
    expect(m[0]!.sheetTimerId).toBe(b.id);
    expect(b.lonnsartId).toBe("L-overtid");
  });

  it("negativkontroll 3a: gammel nøkkel (dato|lønnsart|radIndeks) → tilleggUtenRad, ingenting skrevet", () => {
    seedOvertid();
    const foer = toRader(VANLIG);
    const d = foer.datoer.find((x) => x.erStartSegment)!;
    const gammelNokkel = `tillegg:${d.dato}|L-normal|1`;
    const etter = medLonnsartPaaB(foer, "L-overtid");
    const perRad: TilleggPerRad = { [gammelNokkel]: MASKIN_3 };
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), perRad);
    expect(handling).toEqual({ type: "tilleggUtenRad", nokler: [gammelNokkel] });
    expect(resultat).toBeNull();
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });
  });

  it("🔴 3b: eksisterende draft-sedel uten prosjekt (server-null lagres lokalt som tom streng) → maskinen skrives med radens prosjekt (ingen stille retur)", () => {
    db().insert(dagsseddelLocal).values({
      id: "uten-prosjekt", userId: BRUKER, organizationId: ORG, projectId: "", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, MASKIN_3));
    expect(handling.type).toBe("suksess");
    const m = db().select().from(sheetMachineLocal).all();
    expect(m).toHaveLength(1);
    expect(m[0]!.dagsseddelId).toBe("uten-prosjekt");
    expect(m[0]!.projectId).toBe("p1");
  });

  it("negativkontroll 3b: den gamle konteksten gir null for samme sedel (koden returnerte da uten å skrive)", () => {
    db().insert(dagsseddelLocal).values({
      id: "uten-prosjekt", userId: BRUKER, organizationId: ORG, projectId: "", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    expect(sedelKontekstLokalt(lokalDb(), "uten-prosjekt")).toBeNull();
  });
});

describe("ORDRE Tillegg/Utlegg i Bekreft dag (GO 2026-11-13)", () => {
  beforeEach(() => {
    holder.raw.run(
      "DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM sheet_utlegg_vedlegg_local;",
    );
  });
  const UTLEGG: NyttUtlegg = {
    id: "utl-1", projectId: "p2", expenseCategoryId: "kat-1", belop: 250, kommentar: "Parkering",
    ordningVedFoering: "utlegg", foertVed: 500,
    kvittering: { lokalSti: "file:///kv.jpg", filnavn: "kvittering-1.jpg", filstorrelse: 1234 },
  };
  const LINJER: LonnUtlegg = {
    tillegg: [{ lokalId: "lt-1", projectId: "p2", tilleggId: "t-smuss", antall: 1, kommentar: null }],
    utlegg: [UTLEGG],
  };
  const tell = () => ({
    tillegg: db().select().from(schema.sheetTilleggLocal).all().length,
    utlegg: db().select().from(schema.sheetUtleggLocal).all().length,
    vedlegg: db().select().from(schema.sheetUtleggVedleggLocal).all().length,
  });
  const INGEN = { tillegg: 0, utlegg: 0, vedlegg: 0 };

  it("🔴 skrives ved Bekreft på første åpne dato sin sedel med valgt prosjekt; kvitteringen køes", () => {
    const forslag = toRader(VANLIG);
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, LINJER);
    expect(handling.type).toBe("suksess");
    expect(resultat?.lonnUtleggSkrevet).toBe(true);
    const sedel = resultat!.forsteLagredeSheetId!;
    const l = db().select().from(schema.sheetTilleggLocal).all();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: "lt-1", dagsseddelId: sedel, projectId: "p2", tilleggId: "t-smuss", antall: 1 });
    const u = db().select().from(schema.sheetUtleggLocal).all();
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ id: "utl-1", dagsseddelId: sedel, projectId: "p2", belop: 250, foertVed: 500 });
    const v = db().select().from(schema.sheetUtleggVedleggLocal).all();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ sheetUtleggId: "utl-1", lokalSti: "file:///kv.jpg", serverUrl: null });
    expect(resultat!.utleggKo).toEqual([expect.objectContaining({ sheetUtleggId: "utl-1", vedleggId: v[0]!.id })]);
  });

  it("negativkontroll: uten linjer → ingenting skrevet, ingen kø", () => {
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(toRader(VANLIG)), skriveCtx(), {});
    expect(handling.type).toBe("suksess");
    expect(resultat?.lonnUtleggSkrevet).toBe(false);
    expect(resultat?.utleggKo).toEqual([]);
    expect(tell()).toEqual(INGEN);
  });

  it("🔴 alle datoer sendt → tilleggUtleggUtenDag, ingenting skrevet", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, LINJER);
    expect(handling).toEqual({ type: "tilleggUtleggUtenDag" });
    expect(resultat).toBeNull();
    expect(tell()).toEqual(INGEN);
    expect(db().select().from(arbeidsdagLocal).all()[0]!.status).toBe("paagaar");
  });

  it("negativkontroll: samme sendte dato uten linjer → blokkertSendt som før (ingen ny sperre)", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, { tillegg: [], utlegg: [] });
    expect(handling.type).toBe("blokkertSendt");
  });

  it("🔴 manglerBeskrivelse → ingenting skrevet", () => {
    const { handling } = bekreftDag(lokalDb(), toRader(VANLIG), skriveCtx(), {}, LINJER);
    expect(handling.type).toBe("manglerBeskrivelse");
    expect(tell()).toEqual(INGEN);
  });

  it("🔴 maskinBrudd → ingenting skrevet", () => {
    const forslag = toRader(VANLIG);
    const fire: BekreftDagTillegg = { maskiner: [{ ...MASKIN_3.maskiner[0]!, timer: 4 }], varer: [] };
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), paaRad(forslag, fire, 1), LINJER);
    expect(handling.type).toBe("maskinBrudd");
    expect(tell()).toEqual(INGEN);
  });

  it("🔴 tilleggUtenRad → ingenting skrevet", () => {
    const forslag = toRader(VANLIG);
    const perRad: TilleggPerRad = { [`tillegg:${DATO}|9`]: MASKIN_3 };
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), perRad, LINJER);
    expect(handling.type).toBe("tilleggUtenRad");
    expect(tell()).toEqual(INGEN);
  });

  it("🔴 standardprosjekt = prosjektet med flest arbeidstimer", () => {
    const f = toRader(VANLIG);
    const medP2 = (indeks: number): Dagsforslag => ({
      ...f,
      datoer: f.datoer.map((d) => ({
        ...d,
        rader: d.rader.map((r) => (!r.erReise && r.radIndeks === indeks ? { ...r, projectId: "p2" } : r)),
      })),
    });
    expect(prosjektMedFlestTimer(medP2(0))).toBe("p2"); // A = 4 t på p2, B = 3,5 t på p1
    expect(prosjektMedFlestTimer(medP2(1))).toBe("p1"); // negativkontroll: B (3,5 t) alene vinner ikke
  });

  it("🔴 prosjektkortet: skrivUtlegg gir samme rader som før (rad + vedlegg, image/jpeg, serverUrl null)", () => {
    db().insert(dagsseddelLocal).values({
      id: "kort", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    const ko = skrivUtlegg(lokalDb(), "kort", UTLEGG, () => "ved-1");
    expect(db().select().from(schema.sheetUtleggLocal).all()).toEqual([
      expect.objectContaining({
        id: "utl-1", dagsseddelId: "kort", projectId: "p2", expenseCategoryId: "kat-1", belop: 250,
        kommentar: "Parkering", ordningVedFoering: "utlegg", foertVed: 500, sistEndretLokalt: 500,
      }),
    ]);
    expect(db().select().from(schema.sheetUtleggVedleggLocal).all()).toEqual([
      expect.objectContaining({
        id: "ved-1", sheetUtleggId: "utl-1", lokalSti: "file:///kv.jpg", serverUrl: null,
        filnavn: "kvittering-1.jpg", mimeType: "image/jpeg", filstorrelse: 1234,
      }),
    ]);
    expect(ko).toMatchObject({ sheetUtleggId: "utl-1", objektId: "utl-1", vedleggId: "ved-1", gpsAktivert: true });
  });

  it("negativkontroll prosjektkortet: uten kvittering → ingen vedlegg, ingen kø", () => {
    const ko = skrivUtlegg(lokalDb(), "kort", { ...UTLEGG, kvittering: null }, () => "ved-1");
    expect(ko).toBeNull();
    expect(tell()).toEqual({ tillegg: 0, utlegg: 1, vedlegg: 0 });
  });
});

describe("ORDRE 34 pkt 1a/2 — maskin uten mengde, «Ført i dag»", () => {
  it("🔴 maskin fra Bekreft dag har aldri mengde/enhet (de føres i prosjektkortet)", () => {
    expect(nyTilleggMaskin({ lokalId: "m1", projectId: "p1", vehicleId: "v1", timer: 3 })).toEqual({
      lokalId: "m1",
      projectId: "p1",
      vehicleId: "v1",
      timer: 3,
      mengde: null,
      enhet: null,
    });
  });

  it("🔴 «Ført i dag» = lagrede linjer + linjene lagt til i denne dialogen, kun prosjektet", () => {
    const lagret = [{ navn: "Grus", antall: 2, enhet: "m3" }];
    const varer = [
      { lokalId: "a", projectId: "p1", vareId: "v1", vareNavn: "Sand", enhet: "tonn", antall: 4, byggeplassId: null },
      { lokalId: "b", projectId: "p2", vareId: "v2", vareNavn: "Kult", enhet: "m3", antall: 1, byggeplassId: null },
    ];
    expect(fortIDagLinjer(lagret, varer, "p1")).toEqual([
      { navn: "Grus", antall: 2, enhet: "m3" },
      { navn: "Sand", antall: 4, enhet: "tonn" },
    ]);
  });
});
