import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Utkast i Timer-lista (C3, Redesign 2026-11-13) — `utkastListe.ts` (ren
 * fletting + lesing mot EKTE SQLite via sql.js) og kildevakter for
 * `DagsseddelListe.tsx`. Plan § 7.
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as { run: (sql: string, params?: unknown[]) => void },
  shim: null as unknown,
  drizzle: null as unknown,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../services/lokalBilde", () => ({ slettLokaltBilde: async () => {} }));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  gpsUtkastNokkel,
  lagreUtkast,
  manuellUtkastNokkel,
  type UtkastData,
  type UtkastOversikt,
} from "./prosjektkortUtkast";
import { flettUtkastIListe, lesUtkastForListe } from "./utkastListe";

type Db = Parameters<typeof lesUtkastForListe>[0];
const db = () => holder.drizzle as Db;
let teller = 0;
const nyId = () => `id-${teller++}`;
const A = { userId: "uA", orgId: "o1" };

const sedel = (id: string, dato: string) => ({ id, dato });
const manuell = (dato: string): UtkastOversikt => ({ nokkel: manuellUtkastNokkel(dato), dato, arbeidsdagId: null });
const gps = (dag: string, dato: string): UtkastOversikt => ({ nokkel: gpsUtkastNokkel(dag), dato, arbeidsdagId: dag });

describe("flettUtkastIListe", () => {
  it("🔴 dato med sedel: sedelen merkes, ingen ekstra rad", () => {
    const ut = flettUtkastIListe([sedel("s1", "2026-11-12")], [manuell("2026-11-12")], new Set());
    expect(ut).toEqual([{ type: "sedel", rad: sedel("s1", "2026-11-12"), ikkeBekreftet: true }]);
  });

  it("negativkontroll: sedel uten utkast merkes ikke", () => {
    const ut = flettUtkastIListe([sedel("s1", "2026-11-12")], [manuell("2026-11-11")], new Set());
    expect(ut[0]).toEqual({ type: "sedel", rad: sedel("s1", "2026-11-12"), ikkeBekreftet: false });
  });

  it("🔴 dato uten sedel: egen utkast-rad til manuelt kort, sortert dato synkende", () => {
    const ut = flettUtkastIListe(
      [sedel("s3", "2026-11-13"), sedel("s1", "2026-11-11")],
      [manuell("2026-11-12")],
      new Set(),
    );
    expect(ut.map((r) => (r.type === "sedel" ? r.rad.id : `u:${r.dato}`))).toEqual(["s3", "u:2026-11-12", "s1"]);
    expect(ut[1]).toEqual({ type: "utkast", dato: "2026-11-12", maal: { opprinnelse: "manuell", dato: "2026-11-12" } });
  });

  it("🔴 GPS-utkast for pågående dag: trykk går til GPS-stien", () => {
    const ut = flettUtkastIListe([], [gps("d1", "2026-11-13")], new Set(["d1"]));
    expect(ut).toEqual([{ type: "utkast", dato: "2026-11-13", maal: { opprinnelse: "gps", arbeidsdagId: "d1" } }]);
  });

  it("🔴 GPS-utkast for dag som ikke pågår: manuelt kort på datoen", () => {
    const ut = flettUtkastIListe([], [gps("d1", "2026-11-13")], new Set());
    expect(ut[0]).toEqual({ type: "utkast", dato: "2026-11-13", maal: { opprinnelse: "manuell", dato: "2026-11-13" } });
  });

  it("🔴 manuelt + GPS samme dato uten sedel: én rad", () => {
    const ut = flettUtkastIListe([], [manuell("2026-11-13"), gps("d1", "2026-11-13")], new Set(["d1"]));
    expect(ut).toHaveLength(1);
    expect(ut[0]).toMatchObject({ maal: { opprinnelse: "gps", arbeidsdagId: "d1" } });
  });
});

describe("lesUtkastForListe (sql.js)", () => {
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
    holder.raw.run("DELETE FROM prosjektkort_utkast_local; DELETE FROM arbeidsdag_local;");
  });

  const data: UtkastData = { retting: { beskrivelse: { p1: "Graving" } }, tilleggPerRad: {}, lonnUtlegg: { tillegg: [], utlegg: [] } };
  function lagre(eier: typeof A, nokkel: string, dato: string, arbeidsdagId: string | null) {
    lagreUtkast(db(), { ...eier, nokkel, dato, arbeidsdagId, data, naa: "t", nyId });
  }
  function seedDag(id: string, status: string, userId = A.userId) {
    db().insert(schema.arbeidsdagLocal).values({
      id, userId, dato: "2026-11-13", startAt: "2026-11-13T07:00:00", status, sistEndretLokalt: 1,
    }).run();
  }
  const les = (eier = A) => lesUtkastForListe(db(), { ...eier, naa: "t", nyId });

  it("🔴 rydder GPS-utkast for avsluttet dag før lesing; pågående står", () => {
    seedDag("d1", "avsluttet");
    seedDag("d2", "paagaar");
    lagre(A, gpsUtkastNokkel("d1"), "2026-11-12", "d1");
    lagre(A, gpsUtkastNokkel("d2"), "2026-11-13", "d2");
    const { utkast, paagaarIder } = les();
    expect(utkast.map((u) => u.nokkel)).toEqual([gpsUtkastNokkel("d2")]);
    expect([...paagaarIder]).toEqual(["d2"]);
  });

  it("🔴 isolasjon: annen brukers utkast og pågående dag vises ikke", () => {
    const B = { userId: "uB", orgId: "o1" };
    seedDag("dB", "paagaar", "uB");
    lagre(B, manuellUtkastNokkel("2026-11-12"), "2026-11-12", null);
    const { utkast, paagaarIder } = les();
    expect(utkast).toEqual([]);
    expect(paagaarIder.size).toBe(0);
    // negativkontroll: B ser sitt eget
    expect(les(B).utkast).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Kildevakter for DagsseddelListe.tsx (med negativkontroll pr. regex)

function utenKommentarer(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const LISTE = utenKommentarer(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../components/DagsseddelListe.tsx"), "utf8"),
);
function vakt(re: RegExp, [fra, til]: [string, string]) {
  expect(LISTE).toMatch(re);
  expect(LISTE.includes(fra)).toBe(true);
  expect(LISTE.replace(fra, til)).not.toMatch(re);
}

describe("kildevakter DagsseddelListe", () => {
  it("🔴 L1: usendteKladder leser kun sedler (`rader`), ikke den flettede lista", () => {
    vakt(/const usendteKladder = useMemo\(\(\) => \{[^}]*return rader\.filter\(/, ["return rader.filter(", "return liste.filter("]);
  });

  it("🔴 L2: filene ryddingen frigjør slettes", () => {
    vakt(/for \(const sti of filer\) void slettLokaltBilde\(sti\);/, ["void slettLokaltBilde(sti)", "void sti"]);
  });

  it("🔴 L3: utkastene leses ved fokus og etter synk (samme `lesAlt`)", () => {
    vakt(/setUtkastInfo\(lesUtkastLokalt\(bruker\.id, valgtFirmaId\)\)/, ["setUtkastInfo(lesUtkastLokalt(", "void (("]);
    vakt(/useFocusEffect\(lesAlt\)/, ["useFocusEffect(lesAlt)", "useFocusEffect(() => {})"]);
    vakt(/useReLesVedSynk\(sistSynkronisert, lesAlt\)/, ["useReLesVedSynk(sistSynkronisert, lesAlt)", "useReLesVedSynk(sistSynkronisert, () => {})"]);
  });

  it("🔴 L4: lista rendrer den flettede lista med merket", () => {
    vakt(/data=\{liste\}/, ["data={liste}", "data={[]}"]);
    vakt(/\{ikkeBekreftet && <IkkeBekreftetMerke \/>\}/, ["{ikkeBekreftet && <IkkeBekreftetMerke />}", "{null}"]);
  });
});
