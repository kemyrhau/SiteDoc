import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Utkast for prosjektkort (Redesign, 2026-11-13) — `prosjektkortUtkast.ts` mot
 * EKTE SQLite (sql.js). Plan § 10: T2–T5, T8, T10, T12 + rydding av GPS-utkast
 * på avsluttet dag (Kenneth-beslutning 3).
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as { run: (sql: string, params?: unknown[]) => void },
  shim: null as unknown,
  drizzle: null as unknown,
  slettet: [] as string[],
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../services/lokalBilde", () => ({
  slettLokaltBilde: async (sti: string) => {
    holder.slettet.push(sti);
  },
}));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  erTomtUtkast,
  finnUtkast,
  forkastUtkast,
  gpsUtkastNokkel,
  kvitteringerI,
  lagreUtkast,
  listUtkast,
  manuellUtkastNokkel,
  ryddAvsluttedeGpsUtkast,
  slettUtkastRad,
  utkastDatoer,
  type UtkastData,
} from "./prosjektkortUtkast";

type Db = Parameters<typeof finnUtkast>[0];
const db = () => holder.drizzle as Db;

let teller = 0;
const nyId = () => `id-${teller++}`;
const A = { userId: "uA", orgId: "o1" };
const B = { userId: "uB", orgId: "o1" };
const A2 = { userId: "uA", orgId: "o2" };
const DATO = "2026-11-13";

function tomt(): UtkastData {
  return { retting: {}, tilleggPerRad: {}, lonnUtlegg: { tillegg: [], utlegg: [] } };
}
function medBeskrivelse(tekst = "Graving"): UtkastData {
  return { ...tomt(), retting: { beskrivelse: { p1: tekst } } };
}
function utlegg(id: string, sti: string | null) {
  return {
    id,
    projectId: "p1",
    expenseCategoryId: "k1",
    belop: 100,
    kommentar: null,
    ordningVedFoering: "refusjon" as never,
    foertVed: 1,
    kvittering: sti ? { lokalSti: sti, filnavn: "k.jpg" } : null,
  };
}
function lagre(eier: typeof A, nokkel: string, data: UtkastData, fraNokkel?: string) {
  return lagreUtkast(db(), {
    ...eier,
    nokkel,
    dato: nokkel.startsWith("dato:") ? nokkel.slice(5) : DATO,
    arbeidsdagId: nokkel.startsWith("dag:") ? nokkel.slice(4) : null,
    data,
    naa: `t${teller}`,
    nyId,
    fraNokkel,
  });
}
function antallRader(): number {
  return db().select().from(schema.prosjektkortUtkastLocal).all().length;
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
    getAllSync: () => [],
    runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
  };
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  teller = 0;
  holder.slettet = [];
  holder.raw.run("DELETE FROM prosjektkort_utkast_local; DELETE FROM arbeidsdag_local;");
});

const NOKKEL = manuellUtkastNokkel(DATO);

describe("T2 — upsert", () => {
  it("🔴 to lagringer på samme (bruker, firma, nøkkel) gir 1 rad, siste data vinner", () => {
    lagre(A, NOKKEL, medBeskrivelse("første"));
    lagre(A, NOKKEL, medBeskrivelse("andre"));
    expect(antallRader()).toBe(1);
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })!.data.retting.beskrivelse).toEqual({ p1: "andre" });
  });
});

describe("T3/T4 — isolasjon", () => {
  it("🔴 T3 bruker B ser ikke A sitt utkast; negativkontroll: A ser det", () => {
    lagre(A, NOKKEL, medBeskrivelse());
    expect(finnUtkast(db(), { ...B, nokkel: NOKKEL })).toBeNull();
    expect(utkastDatoer(db(), B).size).toBe(0);
    expect(listUtkast(db(), B)).toEqual([]);
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })).not.toBeNull();
    expect([...utkastDatoer(db(), A)]).toEqual([DATO]);
  });

  it("🔴 T4 samme bruker i annet firma ser ikke utkastet; negativkontroll: rett firma ser det", () => {
    lagre(A, NOKKEL, medBeskrivelse());
    expect(finnUtkast(db(), { ...A2, nokkel: NOKKEL })).toBeNull();
    expect(utkastDatoer(db(), A2).size).toBe(0);
    expect(utkastDatoer(db(), A).size).toBe(1);
  });

  it("forkast/slett hos B rører ikke A sin rad", () => {
    lagre(A, NOKKEL, medBeskrivelse());
    slettUtkastRad(db(), { ...B, nokkel: NOKKEL });
    expect(antallRader()).toBe(1);
  });

  it("utkastDatoer filtrerer på fra/til (inkl.)", () => {
    lagre(A, manuellUtkastNokkel("2026-11-10"), medBeskrivelse());
    lagre(A, manuellUtkastNokkel("2026-11-12"), medBeskrivelse());
    lagre(A, manuellUtkastNokkel("2026-11-14"), medBeskrivelse());
    expect([...utkastDatoer(db(), { ...A, fra: "2026-11-11", til: "2026-11-12" })]).toEqual(["2026-11-12"]);
  });
});

describe("T5 — tom delta = ingen rad", () => {
  it("🔴 erTomtUtkast: tomt → true; én beskrivelse → false; kun mellomrom → true", () => {
    expect(erTomtUtkast(tomt())).toBe(true);
    expect(erTomtUtkast(medBeskrivelse())).toBe(false);
    expect(erTomtUtkast(medBeskrivelse("   "))).toBe(true);
  });

  it("hvert rettbart felt teller som innhold", () => {
    const tilfeller: UtkastData[] = [
      { ...tomt(), retting: { prosjektId: "p1" } },
      { ...tomt(), retting: { aktivitetId: "a1" } },
      { ...tomt(), retting: { byggeplassId: null } },
      { ...tomt(), retting: { perDato: { [DATO]: { pauseMin: 30 } } } },
      { ...tomt(), retting: { beskrivelsePerRad: { r: "x" } } },
      { ...tomt(), tilleggPerRad: { k: { maskiner: [{} as never], varer: [] } } },
      { ...tomt(), lonnUtlegg: { tillegg: [{} as never], utlegg: [] } },
      { ...tomt(), lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", null)] } },
      { ...tomt(), valgtByggeplassId: "b1" },
      { ...tomt(), rettetSluttIso: "2026-11-13T15:00:00" },
      { ...tomt(), sluttGodkjent: true },
      { ...tomt(), ecoId: "e1" },
      {
        ...tomt(),
        retting: {
          manuellReise: [
            { projectId: "p1", byggeplassId: null, lonnsartId: "l", aktivitetId: "a1", timer: 1, fraTid: null, tilTid: null },
          ],
        },
      },
    ];
    for (const t of tilfeller) expect(erTomtUtkast(t)).toBe(false);
  });

  it("angret alt: tomme perDato-objekter og tomme linjelister → true", () => {
    expect(
      erTomtUtkast({
        ...tomt(),
        retting: { perDato: { [DATO]: {} }, beskrivelse: { p1: "" }, manuellReise: [] },
        tilleggPerRad: { k: { maskiner: [], varer: [] } },
      }),
    ).toBe(true);
  });

  it("🔴 lagring av tomt utkast sletter raden (ingen rad skrives)", () => {
    expect(lagre(A, NOKKEL, tomt())).toBe("slettet");
    expect(antallRader()).toBe(0);
    lagre(A, NOKKEL, medBeskrivelse());
    expect(antallRader()).toBe(1);
    expect(lagre(A, NOKKEL, medBeskrivelse(""))).toBe("slettet");
    expect(antallRader()).toBe(0);
  });
});

describe("T8 — forkast rydder bilder", () => {
  it("🔴 rad borte + slettLokaltBilde kalt for hver kvittering", async () => {
    lagre(A, NOKKEL, {
      ...tomt(),
      lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", "/b/1.jpg"), utlegg("u2", "/b/2.jpg"), utlegg("u3", null)] },
    });
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })!.kvitteringer).toEqual(["/b/1.jpg", "/b/2.jpg"]);
    await forkastUtkast(db(), { ...A, nokkel: NOKKEL });
    expect(antallRader()).toBe(0);
    expect(holder.slettet).toEqual(["/b/1.jpg", "/b/2.jpg"]);
  });

  it("slettUtkastRad (bekreft/avslutt) sletter IKKE filer", () => {
    lagre(A, NOKKEL, { ...tomt(), lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", "/b/1.jpg")] } });
    expect(slettUtkastRad(db(), { ...A, nokkel: NOKKEL })).toEqual(["/b/1.jpg"]);
    expect(antallRader()).toBe(0);
    expect(holder.slettet).toEqual([]);
  });

  it("kvitteringerI henter stiene fra utleggene", () => {
    expect(
      kvitteringerI({ ...tomt(), lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", "/x"), utlegg("u2", null)] } }),
    ).toEqual(["/x"]);
  });
});

describe("T10 — datobytte flytter utkastet", () => {
  it("🔴 flytt: gammel nøkkel borte, ny har dataene (1 rad)", () => {
    lagre(A, NOKKEL, medBeskrivelse("flyttes"));
    const ny = manuellUtkastNokkel("2026-11-12");
    expect(lagre(A, ny, medBeskrivelse("flyttes"), NOKKEL)).toBe("lagret");
    expect(antallRader()).toBe(1);
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })).toBeNull();
    expect(finnUtkast(db(), { ...A, nokkel: ny })!.dato).toBe("2026-11-12");
  });

  it("🔴 måldato opptatt → «opptatt», ingenting overskrives eller slettes", () => {
    const ny = manuellUtkastNokkel("2026-11-12");
    lagre(A, ny, medBeskrivelse("eksisterende"));
    lagre(A, NOKKEL, medBeskrivelse("min"));
    expect(lagre(A, ny, medBeskrivelse("min"), NOKKEL)).toBe("opptatt");
    expect(finnUtkast(db(), { ...A, nokkel: ny })!.data.retting.beskrivelse).toEqual({ p1: "eksisterende" });
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })!.data.retting.beskrivelse).toEqual({ p1: "min" });
  });

  it("måldato opptatt hos ANNEN bruker blokkerer ikke", () => {
    const ny = manuellUtkastNokkel("2026-11-12");
    lagre(B, ny, medBeskrivelse());
    lagre(A, NOKKEL, medBeskrivelse());
    expect(lagre(A, ny, medBeskrivelse(), NOKKEL)).toBe("lagret");
  });
});

describe("GPS-utkast på avsluttet dag (Kenneth-beslutning 3)", () => {
  function seedDag(id: string, status: string) {
    db().insert(schema.arbeidsdagLocal).values({
      id, userId: A.userId, dato: DATO, startAt: `${DATO}T07:00:00`, status, sistEndretLokalt: 1,
    }).run();
  }
  const rydd = () => ryddAvsluttedeGpsUtkast(db(), { ...A, naa: "t", nyId });

  it("pågående dag: utkastet står urørt", () => {
    seedDag("d1", "paagaar");
    lagre(A, gpsUtkastNokkel("d1"), medBeskrivelse());
    expect(rydd()).toEqual([]);
    expect(finnUtkast(db(), { ...A, nokkel: gpsUtkastNokkel("d1") })).not.toBeNull();
  });

  it("🔴 avsluttet dag uten linjer: raden slettes", () => {
    seedDag("d1", "avsluttet");
    lagre(A, gpsUtkastNokkel("d1"), medBeskrivelse());
    rydd();
    expect(antallRader()).toBe(0);
  });

  it("🔴 avsluttet dag MED utlegg: flyttes til manuelt kort på datoen uten GPS-tider", () => {
    seedDag("d1", "avsluttet");
    lagre(A, gpsUtkastNokkel("d1"), {
      ...medBeskrivelse(),
      retting: { beskrivelse: { p1: "x" }, perDato: { [DATO]: { arbeidFra: "07:00" } } },
      lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", "/k.jpg")] },
      rettetSluttIso: `${DATO}T15:00:00`,
      sluttGodkjent: true,
    });
    expect(rydd()).toEqual([]);
    const m = finnUtkast(db(), { ...A, nokkel: NOKKEL })!;
    expect(m.arbeidsdagId).toBeNull();
    expect(m.data.retting.perDato).toBeUndefined();
    expect(m.data.retting.beskrivelse).toEqual({ p1: "x" });
    expect(m.data.rettetSluttIso).toBeUndefined();
    expect(m.kvitteringer).toEqual(["/k.jpg"]);
    expect(finnUtkast(db(), { ...A, nokkel: gpsUtkastNokkel("d1") })).toBeNull();
  });

  it("forkastet/manglende dag behandles som avsluttet; manuelt utkast på datoen blokkerer flytting", () => {
    lagre(A, NOKKEL, medBeskrivelse("manuelt"));
    lagre(A, gpsUtkastNokkel("borte"), { ...tomt(), lonnUtlegg: { tillegg: [], utlegg: [utlegg("u1", null)] } });
    rydd();
    expect(finnUtkast(db(), { ...A, nokkel: gpsUtkastNokkel("borte") })).not.toBeNull();
    expect(finnUtkast(db(), { ...A, nokkel: NOKKEL })!.data.retting.beskrivelse).toEqual({ p1: "manuelt" });
  });
});

describe("T12 — utkast synkes aldri", () => {
  const syncFiler = [
    "../services/timerSync.ts",
    "../services/vareforbrukSync.ts",
    "../providers/TimerSyncProvider.tsx",
  ];
  const nevner = (kilde: string) => /prosjektkort_?utkast|prosjektkortUtkast/i.test(kilde);

  it("🔴 ingen sync-fil nevner utkast-tabellen eller -modulen", () => {
    for (const f of syncFiler) {
      const kilde = fs.readFileSync(path.join(__dirname, f), "utf8");
      expect(kilde.length).toBeGreaterThan(100);
      expect(nevner(kilde), f).toBe(false);
    }
  });

  it("negativkontroll: vakten slår ut på en plantet referanse", () => {
    const kopi = fs.readFileSync(path.join(__dirname, syncFiler[0]!), "utf8");
    expect(nevner(kopi + "\nimport { finnUtkast } from '../utils/prosjektkortUtkast';")).toBe(true);
    expect(nevner(kopi + "\nselect * from prosjektkort_utkast_local")).toBe(true);
  });
});
