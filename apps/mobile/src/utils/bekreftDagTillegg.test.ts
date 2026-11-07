import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * L3-D (spec § 3.5 / § 8 nr. 15–21, ORDRE 31) — «Maskin og varer» i
 * `/timer/bekreft-dag`, mot EKTE SQLite (sql.js), samme harness som
 * `bekreftDag.test.ts`.
 *
 * Invarianten (G1/H26): maskin og varer holdes i skjermens minne og skrives
 * FØRST ved [Bekreft og lagre] — på start-segmentets sedel (vedtak C).
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
import { forberedBekreftDag, bekreftDag } from "./bekreftDag";
import {
  tilleggSynlighet,
  entydigByggeplass,
  maskinBruddForTillegg,
  vaktGrunnlag,
  tilleggTilstand,
  rensTillegg,
  nyTilleggMaskin,
  fortIDagLinjer,
  type BekreftDagTillegg,
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

describe("L3-D § 8 nr. 15 — maskin med antall", () => {
  it("🔴 maskin 3,0 → én rad uten sheetTimerId og uten fra/til, på start-sedelen", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), forslag, skriveCtx(), MASKIN_3);
    expect(handling.type).toBe("suksess");
    const rader = db().select().from(sheetMachineLocal).all();
    expect(rader).toHaveLength(1);
    const m = rader[0]!;
    expect(m.dagsseddelId).toBe(resultat!.startSheetId);
    expect(m.projectId).toBe("p1");
    expect(m.vehicleId).toBe("eq-1");
    expect(m.sheetTimerId).toBeNull();
    expect(m.fraTid).toBeNull();
    expect(m.tilTid).toBeNull();
    expect(m.externalCostObjectId).toBeNull();
    expect(m.timer).toBe(3);
  });
});

describe("L3-D § 8 nr. 16 — vare", () => {
  it("🔴 vare → pending-rad på start-sedelen; sending venter til sedelen er synket", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { resultat } = bekreftDag(lokalDb(), forslag, skriveCtx(), VARE);
    const rader = db().select().from(vareforbrukLocal).all();
    expect(rader).toHaveLength(1);
    const v = rader[0]!;
    expect(v.sheetId).toBe(resultat!.startSheetId);
    expect(v.projectId).toBe("p1");
    expect(v.byggeplassId).toBe("b1");
    expect(v.dato).toBe(DATO);
    expect(v.userId).toBe(BRUKER);
    expect(v.organizationId).toBe(ORG);
    expect(v.antall).toBe(12.5);
    expect(v.syncStatus).toBe("pending");
    const sedel = db().select().from(dagsseddelLocal).all()[0]!;
    expect(sedel.syncStatus).not.toBe("synced");
    expect(planleggVaresending(v, sedel, [{ projectId: "p1" }]).handling).toBe("vent");
  });
});

describe("L3-D § 8 nr. 17 — uten maskin/vare er Bekreft som før", () => {
  it("tillegg utelatt og tomt tillegg gir samme rader og 0 maskin/vare", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    bekreftDag(lokalDb(), forslag, skriveCtx());
    const utenRader = db().select().from(sheetTimerLocal).all().map((r) => ({ ...r, id: "", dagsseddelId: "" }));
    expect(tellTillegg()).toEqual({ maskin: 0, varer: 0 });

    holder.raw.run("DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM arbeidsdag_local;");
    seedArbeidsdag();
    const { forslag: f2 } = forberedBekreftDag(lokalDb(), kontekst());
    bekreftDag(lokalDb(), f2, skriveCtx(), { maskiner: [], varer: [] });
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

describe("L3-D § 8 nr. 20 — byggeplass på varen", () => {
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

  it("to segmenter på samme prosjekt → én maskinrad på start-sedelen", () => {
    holder.raw.run("DELETE FROM arbeidsdag_local;");
    seedArbeidsdag("2026-07-01T20:00:00");
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst({
        dag: { startAt: "2026-07-01T20:00:00", startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
        sluttIso: "2026-07-02T04:00:00",
      }),
    );
    expect(forslag.datoer).toHaveLength(2);
    const { resultat } = bekreftDag(lokalDb(), forslag, { ...skriveCtx(), sluttIso: "2026-07-02T04:00:00" }, MASKIN_3);
    const maskin = db().select().from(sheetMachineLocal).all();
    expect(maskin).toHaveLength(1);
    expect(maskin[0]!.dagsseddelId).toBe(resultat!.startSheetId);
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
    const { handling, resultat } = bekreftDag(lokalDb(), forslag, skriveCtx(), ni);
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
  it("sendt start-sedel → ingen maskin/varer, samme utfall som før", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), forslag, skriveCtx(), {
      maskiner: MASKIN_3.maskiner,
      varer: VARE.varer,
    });
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

/** 20:00 → 04:00 neste dag, arbeidet på startdatoen fjernet: startdatoen har 0 rader. */
function forslagUtenStartRader() {
  holder.raw.run("DELETE FROM arbeidsdag_local;");
  seedArbeidsdag("2026-07-01T20:00:00");
  const ctx = kontekst({
    dag: { startAt: "2026-07-01T20:00:00", startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: "2026-07-02T04:00:00",
  });
  return forberedBekreftDag(lokalDb(), ctx, { perDato: { [DATO]: { fjernArbeid: true } } }).forslag;
}

describe("Dom (57) m2 — vare krever timer-rad på startdatoen", () => {
  it("🔴 vanlig dag → varer tillatt", () => {
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const g = vaktGrunnlag(lokalDb(), BRUKER, forslag);
    expect(tilleggTilstand(forslag, g, "p1")).toEqual({ startSendt: false, varerTillatt: true });
  });

  it("🔴 0 rader på startdatoen → varer ikke tillatt, maskinknappen berøres ikke", () => {
    const forslag = forslagUtenStartRader();
    expect(forslag.datoer.find((d) => d.erStartSegment)!.rader).toHaveLength(0);
    const g = vaktGrunnlag(lokalDb(), BRUKER, forslag);
    expect(tilleggTilstand(forslag, g, "p1")).toEqual({ startSendt: false, varerTillatt: false });
  });

  it("🔴 eksisterende timer-rad på start-sedelen for prosjektet → tillatt", () => {
    db().insert(dagsseddelLocal).values({
      id: "eks", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "draft", pauseMin: 0, sistEndretLokalt: 1,
    }).run();
    db().insert(sheetTimerLocal).values({
      id: "t-eks", dagsseddelId: "eks", projectId: null, aktivitetId: "a1", lonnsartId: "L-normal", timer: 2,
      sistEndretLokalt: 1,
    }).run();
    const forslag = forslagUtenStartRader();
    const g = vaktGrunnlag(lokalDb(), BRUKER, forslag);
    expect(tilleggTilstand(forslag, g, "p1").varerTillatt).toBe(true);
  });

  it("🔴 fjerning: varer tas ut når vilkåret faller, og Bekreft skriver da ingen vare", () => {
    const forslag = forslagUtenStartRader();
    const tilstand = tilleggTilstand(forslag, vaktGrunnlag(lokalDb(), BRUKER, forslag), "p1");
    const renset = rensTillegg({ maskiner: MASKIN_3.maskiner, varer: VARE.varer }, tilstand);
    expect(renset).toEqual({ maskiner: MASKIN_3.maskiner, varer: [] });
    bekreftDag(lokalDb(), forslag, { ...skriveCtx(), sluttIso: "2026-07-02T04:00:00" }, {
      maskiner: [],
      varer: renset.varer,
    });
    expect(tellTillegg().varer).toBe(0);
  });

  it("uendret tillegg gir samme objekt (ingen render-løkke i effekten)", () => {
    const tl = { maskiner: MASKIN_3.maskiner, varer: VARE.varer };
    expect(rensTillegg(tl, { startSendt: false, varerTillatt: true })).toBe(tl);
  });
});

describe("Dom (57) m3 — start-sedel sendt, senere datoer åpne", () => {
  it("🔴 startSendt → ingen tillegg, og rensTillegg tømmer alt", () => {
    db().insert(dagsseddelLocal).values({
      id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: DATO, status: "sent", sistEndretLokalt: 1,
    }).run();
    holder.raw.run("DELETE FROM arbeidsdag_local;");
    seedArbeidsdag("2026-07-01T20:00:00");
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst({
        dag: { startAt: "2026-07-01T20:00:00", startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
        sluttIso: "2026-07-02T04:00:00",
      }),
    );
    expect(forslag.datoer.some((d) => !d.blokkert)).toBe(true);
    const tilstand = tilleggTilstand(forslag, vaktGrunnlag(lokalDb(), BRUKER, forslag), "p1");
    expect(tilstand).toEqual({ startSendt: true, varerTillatt: false });
    expect(rensTillegg({ maskiner: MASKIN_3.maskiner, varer: VARE.varer }, tilstand)).toEqual({
      maskiner: [],
      varer: [],
    });
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
