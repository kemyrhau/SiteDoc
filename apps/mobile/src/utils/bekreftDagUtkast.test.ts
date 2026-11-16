import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Utkast for prosjektkort (plan 2026-11-13 § 10, T6/T7/T9/T11) — «Bekreft dag»
 * og «Avslutt uten timer» mot EKTE SQLite (sql.js), samme harness som
 * `bekreftDag.test.ts`.
 *
 * Invarianten: utkastet forsvinner KUN når en sedel faktisk ble skrevet (eller
 * dagen avsluttes uten timer). Hver stopp beholder utkastet uendret. Bekreft
 * sletter aldri kvitteringsfilene — køen eier dem etter Bekreft.
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
  slettLokaltBilde: vi.fn(async (_sti: string) => undefined),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${teller++}` }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../services/lokalBilde", () => ({ slettLokaltBilde: holder.slettLokaltBilde }));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { forberedBekreftDag, bekreftDag, avsluttDagUtenSedel, prosjekterMedArbeid } from "./bekreftDag";
import { radTilleggNokkel, type BekreftDagTillegg, type TilleggPerRad } from "./bekreftDagTillegg";
import type { LonnUtlegg } from "./dagsforslagAnvend";
import type { Dagsforslag } from "./dagsforslag";
import type { NyttUtlegg } from "../services/tilleggUtleggSkriv";
import { finnUtkast, gpsUtkastNokkel, lagreUtkast, type UtkastData } from "./prosjektkortUtkast";

let teller = 0;
const { arbeidsdagLocal, dagsseddelLocal, prosjektLocal, aktivitetLocal, lonnsartLocal } = schema;
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
const NOKKEL = gpsUtkastNokkel(DAG_ID);
const EIER = { userId: BRUKER, orgId: ORG };

function medBeskrivelse(f: Dagsforslag): Dagsforslag {
  return { ...f, beskrivelsePerKort: Object.fromEntries(prosjekterMedArbeid(f).map((p) => [p, "Graving"])) };
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
    utkastNokkel: NOKKEL,
  };
}

const UTLEGG: NyttUtlegg = {
  id: "utl-1", projectId: "p1", expenseCategoryId: "kat-1", belop: 250, kommentar: "Parkering",
  ordningVedFoering: "utlegg", foertVed: 500,
  kvittering: { lokalSti: "file:///kv-1.jpg", filnavn: "kvittering-1.jpg", filstorrelse: 1234 },
};
const LINJER: LonnUtlegg = { tillegg: [], utlegg: [UTLEGG] };

function utkastData(over: Partial<UtkastData> = {}): UtkastData {
  return {
    retting: { beskrivelse: { p1: "Graving" } },
    tilleggPerRad: {},
    lonnUtlegg: LINJER,
    ...over,
  };
}

function lagreDagUtkast(arbeidsdagId = DAG_ID, data = utkastData()) {
  const res = lagreUtkast(lokalDb(), {
    ...EIER,
    nokkel: gpsUtkastNokkel(arbeidsdagId),
    dato: DATO,
    arbeidsdagId,
    data,
    naa: "2026-07-01T14:00:00.000Z",
    nyId: () => `utk-${teller++}`,
  });
  expect(res).toBe("lagret");
}

const utkast = (nokkel = NOKKEL) => finnUtkast(lokalDb(), { ...EIER, nokkel });
const sendSedel = () =>
  db().insert(dagsseddelLocal).values({
    id: "sendt1", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
    dato: DATO, status: "sent", sistEndretLokalt: 1,
  }).run();

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
  holder.slettLokaltBilde.mockClear();
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM arbeidsdag_local;" +
      " DELETE FROM arbeidsdag_besok_local; DELETE FROM prosjektkort_utkast_local;" +
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local;" +
      " DELETE FROM sheet_machine_local; DELETE FROM vareforbruk_local;" +
      " DELETE FROM sheet_tillegg_local; DELETE FROM sheet_utlegg_local; DELETE FROM sheet_utlegg_vedlegg_local;",
  );
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
  db().insert(arbeidsdagLocal).values([
    { id: DAG_ID, userId: BRUKER, dato: DATO, startAt: START, status: "paagaar", sistEndretLokalt: 1 },
    { id: "dag2", userId: BRUKER, dato: "2026-07-02", startAt: "2026-07-02T07:00:00", status: "paagaar", sistEndretLokalt: 1 },
  ]).run();
});

describe("T6 — Bekreft som skriver rydder utkastet, men aldri filene", () => {
  it("🔴 sedel skrevet → 0 utkastrader; slettLokaltBilde ikke kalt", () => {
    lagreDagUtkast();
    expect(utkast()).not.toBeNull();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, LINJER);
    expect(handling.type).toBe("suksess");
    expect(resultat?.forsteLagredeSheetId).not.toBeNull();
    expect(utkast()).toBeNull();
    expect(holder.slettLokaltBilde).not.toHaveBeenCalled();
  });

  it("negativkontroll: uten utkastNokkel i ctx står utkastet", () => {
    lagreDagUtkast();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { utkastNokkel: _u, ...uten } = skriveCtx();
    bekreftDag(lokalDb(), medBeskrivelse(forslag), uten, {}, LINJER);
    expect(utkast()).not.toBeNull();
  });
});

describe("T7 — hver stopp beholder utkastet uendret", () => {
  const forStopp = () => {
    lagreDagUtkast();
    return JSON.stringify(utkast()!.data);
  };
  const urort = (foer: string) => {
    const u = utkast();
    expect(u).not.toBeNull();
    expect(JSON.stringify(u!.data)).toBe(foer);
  };

  it("🔴 manglerBeskrivelse", () => {
    const foer = forStopp();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), forslag, skriveCtx());
    expect(handling.type).toBe("manglerBeskrivelse");
    urort(foer);
  });

  it("🔴 tilleggUtleggUtenDag (alle datoer sendt før forslaget)", () => {
    sendSedel();
    const foer = forStopp();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, LINJER);
    expect(handling.type).toBe("tilleggUtleggUtenDag");
    urort(foer);
  });

  it("🔴 tilleggUtleggUtenDag (sendt-race mellom forslag og Bekreft)", () => {
    const foer = forStopp();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    sendSedel();
    const { handling, resultat } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {}, LINJER);
    expect(handling.type).toBe("tilleggUtleggUtenDag");
    expect(resultat?.forsteLagredeSheetId ?? null).toBeNull();
    urort(foer);
  });

  it("🔴 blokkertSendt (alle datoer sendt, uten linjer)", () => {
    sendSedel();
    const foer = forStopp();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx());
    expect(handling.type).toBe("blokkertSendt");
    urort(foer);
  });

  it("🔴 tilleggUtenRad (raden forsvant)", () => {
    const foer = forStopp();
    const { forslag: forRad } = forberedBekreftDag(lokalDb(), kontekst());
    const d = forRad.datoer.find((x) => x.erStartSegment)!;
    const rad = d.rader.find((r) => !r.erReise)!;
    const perRad: TilleggPerRad = {
      [radTilleggNokkel(d.dato, rad)!]: {
        maskiner: [{ lokalId: "m1", projectId: "p1", vehicleId: "eq-1", timer: 1, mengde: null, enhet: null }],
        varer: [],
      },
    };
    const { forslag: etter } = forberedBekreftDag(lokalDb(), kontekst(), {
      perDato: { [DATO]: { fjernArbeid: true } },
    });
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(etter), skriveCtx(), perRad);
    expect(handling.type).toBe("tilleggUtenRad");
    urort(foer);
  });

  it("🔴 maskinBrudd (maskin over radens timer)", () => {
    const foer = forStopp();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst());
    const d = forslag.datoer.find((x) => x.erStartSegment)!;
    const rad = d.rader.find((r) => !r.erReise)!;
    const for24: BekreftDagTillegg = {
      maskiner: [{ lokalId: "m1", projectId: "p1", vehicleId: "eq-1", timer: 24, mengde: null, enhet: null }],
      varer: [],
    };
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx(), {
      [radTilleggNokkel(d.dato, rad)!]: for24,
    });
    expect(handling.type).toBe("maskinBrudd");
    urort(foer);
  });
});

describe("T9 — Avslutt uten timer sletter dagens utkast i samme transaksjon", () => {
  it("🔴 utkastet for dagen borte, stiene returnert; annen dags utkast står", () => {
    lagreDagUtkast(DAG_ID);
    lagreDagUtkast("dag2", utkastData({ lonnUtlegg: { tillegg: [], utlegg: [] } }));
    const stier = avsluttDagUtenSedel(lokalDb(), {
      arbeidsdagId: DAG_ID,
      sluttIso: SLUTT,
      endLat: null,
      endLng: null,
      naa: () => 1000,
      nyId: () => `b-${teller++}`,
      utkast: { ...EIER, nokkel: NOKKEL },
    });
    expect(stier).toEqual(["file:///kv-1.jpg"]);
    expect(utkast()).toBeNull();
    // Negativkontroll: annen arbeidsdag sitt utkast står.
    expect(utkast(gpsUtkastNokkel("dag2"))).not.toBeNull();
    expect(db().select().from(arbeidsdagLocal).all().find((a) => a.id === DAG_ID)!.status).toBe("avsluttet");
    // Filene slettes av kalleren, ikke her.
    expect(holder.slettLokaltBilde).not.toHaveBeenCalled();
  });

  it("negativkontroll: uten utkast-param står utkastet", () => {
    lagreDagUtkast(DAG_ID);
    const stier = avsluttDagUtenSedel(lokalDb(), {
      arbeidsdagId: DAG_ID, sluttIso: SLUTT, endLat: null, endLng: null, naa: () => 1000, nyId: () => "b",
    });
    expect(stier).toEqual([]);
    expect(utkast()).not.toBeNull();
  });
});

describe("T11 — gjenoppretting legger rettingen oppå NYTT forslag", () => {
  it("🔴 rettet felt (prosjekt) følger utkastet; urørt felt (slutt) følger nytt forslag", () => {
    // Utkastet lagres mens slutt var 15:00; arbeideren rettet kun prosjektet.
    lagreDagUtkast(DAG_ID, utkastData({ retting: { prosjektId: "p2" }, lonnUtlegg: { tillegg: [], utlegg: [] } }));
    const lest = utkast()!.data.retting;
    // Åpnes igjen senere: slutt-GPS er nå 16:00.
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst({ sluttIso: "2026-07-01T16:00:00" }), lest);
    const rader = forslag.datoer.flatMap((d) => d.rader).filter((r) => !r.erReise);
    expect(rader.length).toBeGreaterThan(0);
    expect(rader.every((r) => r.projectId === "p2")).toBe(true);
    const sist = [...rader].sort((a, b) => (a.tilTid ?? "").localeCompare(b.tilTid ?? "")).at(-1)!;
    expect(sist.tilTid).toBe("16:00");
  });

  it("negativkontroll: et utkast som bar hele forslaget (perDato 15:00) låser slutt — derfor delta", () => {
    lagreDagUtkast(DAG_ID, utkastData({
      retting: { prosjektId: "p2", perDato: { [DATO]: { arbeidTil: "15:00" } } },
      lonnUtlegg: { tillegg: [], utlegg: [] },
    }));
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst({ sluttIso: "2026-07-01T16:00:00" }),
      utkast()!.data.retting,
    );
    const rader = forslag.datoer.flatMap((d) => d.rader).filter((r) => !r.erReise);
    const sist = [...rader].sort((a, b) => (a.tilTid ?? "").localeCompare(b.tilTid ?? "")).at(-1)!;
    expect(sist.tilTid).toBe("15:00");
  });
});

/** Kildevakter V1–V6 — mobil har ingen renderer (samme mønster som glemtDag.test.ts). */
function utenKommentarer(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SKJERM = utenKommentarer(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/timer/bekreft-dag.tsx"), "utf8"),
);

/** Kroppene til alle `useEffect(`-kall (parentes-matching). */
function effektKropper(kilde: string): string[] {
  const ut: string[] = [];
  let i = kilde.indexOf("useEffect(");
  while (i >= 0) {
    let dybde = 0;
    let j = i + "useEffect".length;
    for (; j < kilde.length; j++) {
      if (kilde[j] === "(") dybde++;
      else if (kilde[j] === ")" && --dybde === 0) break;
    }
    ut.push(kilde.slice(i, j + 1));
    i = kilde.indexOf("useEffect(", j);
  }
  return ut;
}

/** Vakten + negativkontroll: regexen treffer kilden, men IKKE den muterte kopien. */
function vakt(re: RegExp, mutasjon: [string | RegExp, string]) {
  expect(SKJERM).toMatch(re);
  const mutert = SKJERM.replace(mutasjon[0], mutasjon[1]);
  expect(mutert).not.toBe(SKJERM);
  expect(mutert).not.toMatch(re);
}

describe("Utkast — kildevakter i bekreft-dag.tsx (V1–V6)", () => {
  it("🔴 V1: beforeRemove-lytter flusher utkastet", () => {
    vakt(/navigation\.addListener\("beforeRemove", \(\) => skrivUtkastNaa\(\)\)/, [
      'navigation.addListener("beforeRemove", () => skrivUtkastNaa())',
      'navigation.addListener("beforeRemove", () => undefined)',
    ]);
  });

  it("🔴 V2: AppState (ikke aktiv) flusher utkastet", () => {
    vakt(/AppState\.addEventListener\("change", \(tilstand\) => \{\s*if \(tilstand !== "active"\) skrivUtkastNaa\(\);/, [
      'if (tilstand !== "active") skrivUtkastNaa();',
      'if (tilstand !== "active") void 0;',
    ]);
  });

  it("🔴 V3: «Ikke nå»/pil flusher FØR router.back", () => {
    const re = /const ikkeNaa = useCallback\(\(\) => \{\s*skrivUtkastNaa\(\);\s*router\.back\(\);/;
    vakt(re, [/(const ikkeNaa = useCallback\(\(\) => \{\s*)skrivUtkastNaa\(\);(\s*)router\.back\(\);/, "$1router.back();$2skrivUtkastNaa();"]);
    // Pila i toppen bruker samme handler.
    expect(SKJERM).toMatch(/<Pressable onPress=\{ikkeNaa\}/);
  });

  it("🔴 V4: unmount sletter bare kvitteringer utkastet IKKE eier", () => {
    const re =
      /try \{\s*skrivUtkastNaa\(\);[\s\S]*?eide = finnUtkast\([\s\S]*?\} catch \{\s*eide = \[\];\s*flushFeilet = true;\s*\}\s*for \(const sti of pendingKvitteringer\.current\) \{\s*if \(!eide\.includes\(sti\)\) void slettLokaltBilde\(sti\);/;
    vakt(re, ["if (!eide.includes(sti)) void slettLokaltBilde(sti);", "void slettLokaltBilde(sti);"]);
    // Ubetinget sletting (som før utkastet) finnes ikke.
    expect(SKJERM).not.toMatch(/for \(const sti of pendingKvitteringer\.current\) void slettLokaltBilde/);
  });

  it("🔴 V5: debounce nulles og utkastet flushes FØR bekreftDag", () => {
    vakt(
      /if \(utkastTimerRef\.current\) clearTimeout\(utkastTimerRef\.current\);\s*utkastTimerRef\.current = null;\s*skrivUtkastNaa\(\);\s*const \{ handling, resultat \} = bekreftDag\(/,
      [/if \(utkastTimerRef\.current\) clearTimeout\(utkastTimerRef\.current\);(\s*utkastTimerRef\.current = null;\s*skrivUtkastNaa\(\);\s*const \{ handling, resultat \} = bekreftDag\()/, "$1"],
    );
    expect(SKJERM).toContain("utkastNokkel: utkastNokkel ?? undefined,");
  });

  it("🔴 V6: ingen effekt kaller endret( — åpning alene gir ingen rad", () => {
    const kropper = effektKropper(SKJERM);
    // Negativkontroll: uttrekket finner gjenopprettings-effekten ...
    expect(kropper.some((k) => k.includes("setUtkastLastet(true)"))).toBe(true);
    // ... og ser en plantet endret( i en effekt.
    const plantet = effektKropper(SKJERM.replace("setUtkastLastet(true);", "setUtkastLastet(true); endret();"));
    expect(plantet.some((k) => k.includes("endret("))).toBe(true);
    expect(kropper.filter((k) => k.includes("endret("))).toEqual([]);
  });
});
