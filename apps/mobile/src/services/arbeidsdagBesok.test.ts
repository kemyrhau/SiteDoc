import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * L4-A (spec `timer-gps-lag3-4-spec.md` § 2, § 8 nr. 12–13) — byggeplassbesøk
 * gjennom dagen mot EKTE SQLite (sql.js), samme harness som `bekreftDag.test.ts`.
 * Slutt dag-delen (avreise ved bekreftelse) står i `utils/bekreftDag.test.ts`.
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
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  avsluttBesok,
  hentBesok,
  kjorS1,
  lagS1Vakt,
  maalStille,
  opprettArbeidsdagMedBesok,
  registrerBesok,
  s1Prosessvakt,
  velgS2Besok,
  ryddGamleArbeidsdager,
  s1Forslag,
  S1_DEMPING_MS,
  S1_MAALEINTERVALL_MS,
} from "./arbeidsdagBesok";

const { arbeidsdagLocal, arbeidsdagBesokLocal } = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
// sql.js-drizzle ≈ ExpoSQLite-drizzle for harnessen — cast som i bekreftDag-testen.
function lokalDb(): Parameters<typeof registrerBesok>[0] {
  return holder.drizzle as Parameters<typeof registrerBesok>[0];
}

const DAG = "dag1";
const A = { id: "bp-a", navn: "Kaia", projectId: "p1" };
const B = { id: "bp-b", navn: "Skolen", projectId: "p2" };

function seedDag(id: string, startAt: string, status: string) {
  db().insert(arbeidsdagLocal).values({
    id, userId: "u1", dato: startAt.slice(0, 10), startAt, status, sistEndretLokalt: 1,
  }).run();
}

function lagShim(raw: typeof holder.raw) {
  return {
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
}

let SQL: { Database: new () => typeof holder.raw };

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = lagShim(raw);
  kjorMigreringer();
  holder.drizzle = drizzle(raw as never, { schema });
});

beforeEach(() => {
  holder.raw.run("DELETE FROM arbeidsdag_besok_local; DELETE FROM arbeidsdag_local;");
  seedDag(DAG, "2026-11-12T07:00:00.000Z", "paagaar");
});

function tabeller(raw: typeof holder.raw): string[] {
  const stmt = raw.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index')");
  const navn: string[] = [];
  while (stmt.step()) navn.push(String(stmt.getAsObject().name));
  stmt.free();
  return navn;
}

describe("L4-A — migrering", () => {
  it("🔴 tom DB: tabell + indeks opprettes, og migreringen kan kjøres på nytt", () => {
    const raw = new SQL.Database();
    holder.shim = lagShim(raw);
    try {
      kjorMigreringer();
      kjorMigreringer(); // idempotent
      const navn = tabeller(raw);
      expect(navn).toContain("arbeidsdag_besok_local");
      expect(navn).toContain("idx_arbeidsdag_besok_local_dag");
    } finally {
      holder.shim = lagShim(holder.raw);
    }
  });

  it("🔴 eksisterende DB: gamle arbeidsdager står, og besøk kan skrives etterpå", () => {
    // Harness-DB-en har alt kjørt migreringen; kjør den igjen over eksisterende data.
    kjorMigreringer();
    expect(db().select().from(arbeidsdagLocal).all().map((d) => d.id)).toEqual([DAG]);
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "2026-11-12T07:00:00.000Z",
      kilde: "start_dag", naaIso: "2026-11-12T07:00:00.000Z",
    });
    expect(hentBesok(lokalDb(), DAG)).toHaveLength(1);
  });
});

describe("L4-A2 — skjema og migrering fra før L4-A", () => {
  it("🔴 K12: besøkstabellen har ingen posisjonskolonner", () => {
    const stmt = holder.raw.prepare("PRAGMA table_info(arbeidsdag_besok_local)");
    const kolonner: string[] = [];
    while (stmt.step()) kolonner.push(String(stmt.getAsObject().name));
    stmt.free();
    expect(kolonner).toContain("byggeplass_id"); // tabellen finnes og leses
    for (const k of kolonner) {
      expect(k, k).not.toMatch(/lat|lng|lon|pos|koord|coord/i);
    }
  });

  it("🔴 DB fra før L4-A (uten tabellen): migrering oppretter den, arbeidsdagen står", () => {
    holder.raw.run("DROP TABLE arbeidsdag_besok_local");
    expect(tabeller(holder.raw)).not.toContain("arbeidsdag_besok_local");
    kjorMigreringer();
    expect(tabeller(holder.raw)).toContain("arbeidsdag_besok_local");
    expect(db().select().from(arbeidsdagLocal).all().map((d) => d.id)).toEqual([DAG]);
    expect(velgS2Besok(lokalDb(), { id: "b1", arbeidsdagId: DAG, sted: A, naaIso: "T08" })).toBe(true);
    expect(hentBesok(lokalDb(), DAG)).toHaveLength(1);
  });
});

describe("L4-A § 2.2 — Start dag og Slutt dag", () => {
  it("🔴 besøk 1: rekkefølge 1, kilde start_dag, bekreftet, avreise null", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "2026-11-12T07:00:00.000Z",
      kilde: "start_dag", naaIso: "2026-11-12T07:00:00.000Z",
    });
    const [b] = hentBesok(lokalDb(), DAG);
    expect(b).toMatchObject({
      rekkefolge: 1, byggeplassId: "bp-a", prosjektId: "p1", kilde: "start_dag",
      bekreftet: 1, avreiseAt: null,
    });
  });

  it("🔴 K13: Start dag skriver arbeidsdagen OG besøk 1 (start_dag) på startstedet", () => {
    opprettArbeidsdagMedBesok(lokalDb(), {
      id: "dag2", besokId: "b-start", userId: "u1", dato: "2026-11-12",
      naaIso: "2026-11-12T06:30:00.000Z", naaMs: 5, lat: 69.6, lng: 18.9,
      oppmotested: { id: "om1", navn: "Lager" }, bygg: B,
    });
    const dag = db().select().from(arbeidsdagLocal).all().find((d) => d.id === "dag2");
    expect(dag).toMatchObject({
      status: "paagaar", startAt: "2026-11-12T06:30:00.000Z", byggeplassId: "bp-b",
      oppmotestedId: "om1",
    });
    expect(hentBesok(lokalDb(), "dag2")).toEqual([
      expect.objectContaining({
        id: "b-start", rekkefolge: 1, kilde: "start_dag", byggeplassId: "bp-b",
        prosjektId: "p2", ankomstAt: "2026-11-12T06:30:00.000Z", avreiseAt: null,
      }),
    ]);
  });

  it("🔴 K13: Start dag utenfor kjent byggeplass → besøk 1 med byggeplass null", () => {
    opprettArbeidsdagMedBesok(lokalDb(), {
      id: "dag3", besokId: "b-ute", userId: "u1", dato: "2026-11-12",
      naaIso: "T06", naaMs: 5, lat: null, lng: null, oppmotested: null, bygg: null,
    });
    expect(hentBesok(lokalDb(), "dag3")).toEqual([
      expect.objectContaining({ rekkefolge: 1, kilde: "start_dag", byggeplassId: null }),
    ]);
  });

  it("🔴 K13: startDag bruker opprettArbeidsdagMedBesok (ingen egen insert)", () => {
    const kilde = fs.readFileSync(path.join(__dirname, "../hooks/useArbeidsdag.ts"), "utf8");
    expect(kilde).toMatch(/opprettArbeidsdagMedBesok\(db, \{/);
    expect(kilde).not.toContain(".insert(arbeidsdagLocal)");
  });

  it("🔴 nytt besøk lukker forrige: avreise = ny ankomst", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    registrerBesok(lokalDb(), {
      id: "b2", arbeidsdagId: DAG, sted: B, ankomstAt: "T10", kilde: "gps_forslag", naaIso: "T10",
    });
    const [b1, b2] = hentBesok(lokalDb(), DAG);
    expect(b1!.avreiseAt).toBe("T10");
    expect(b2).toMatchObject({ rekkefolge: 2, avreiseAt: null, kilde: "gps_forslag" });
  });

  it("🔴 Slutt dag på samme byggeplass: kun avreise, ingen nytt besøk", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    avsluttBesok(lokalDb(), {
      nyId: () => "slutt", arbeidsdagId: DAG, sluttIso: "T15", sluttSted: A, naaIso: "T15",
    });
    const besok = hentBesok(lokalDb(), DAG);
    expect(besok).toHaveLength(1);
    expect(besok[0]!.avreiseAt).toBe("T15");
  });

  it("🔴 Slutt dag uten GPS-treff: kun avreise", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    avsluttBesok(lokalDb(), {
      nyId: () => "slutt", arbeidsdagId: DAG, sluttIso: "T15", sluttSted: null, naaIso: "T15",
    });
    expect(hentBesok(lokalDb(), DAG)).toHaveLength(1);
  });

  it("🔴 Slutt dag på en ANNEN byggeplass: slutt_dag-besøk med ankomst = avreise = slutt", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    avsluttBesok(lokalDb(), {
      nyId: () => "slutt", arbeidsdagId: DAG, sluttIso: "T15", sluttSted: B, naaIso: "T15",
    });
    const [b1, b2] = hentBesok(lokalDb(), DAG);
    expect(b1!.avreiseAt).toBe("T15");
    expect(b2).toMatchObject({
      id: "slutt", rekkefolge: 2, byggeplassId: "bp-b", kilde: "slutt_dag",
      ankomstAt: "T15", avreiseAt: "T15", bekreftet: 1,
    });
  });
});

describe("L4-A § 2.3 — S1-vakt", () => {
  it("🔴 to aktiveringer innen 10 min → én måling; etter 10 min → ny måling", () => {
    const vakt = lagS1Vakt();
    const t0 = 1_000_000;
    expect(vakt.skalMaale(t0)).toBe(true);
    expect(vakt.skalMaale(t0 + 60_000)).toBe(false);
    expect(vakt.skalMaale(t0 + S1_MAALEINTERVALL_MS - 1)).toBe(false);
    expect(vakt.skalMaale(t0 + S1_MAALEINTERVALL_MS)).toBe(true);
  });

  it("🔴 [Nei] demper samme byggeplass i 30 min, ikke andre", () => {
    const vakt = lagS1Vakt();
    const t0 = 1_000_000;
    expect(s1Forslag(B, { byggeplassId: "bp-a" }, vakt, t0)).toEqual(B);
    vakt.demp("bp-b", t0);
    expect(s1Forslag(B, { byggeplassId: "bp-a" }, vakt, t0 + S1_DEMPING_MS - 1)).toBeNull();
    expect(s1Forslag({ ...A, id: "bp-c" }, { byggeplassId: "bp-a" }, vakt, t0 + 1)).not.toBeNull();
    expect(s1Forslag(B, { byggeplassId: "bp-a" }, vakt, t0 + S1_DEMPING_MS)).toEqual(B);
  });

  it("🔴 ingen banner når treffet er siste besøk, eller ved ingen treff", () => {
    const vakt = lagS1Vakt();
    expect(s1Forslag(A, { byggeplassId: "bp-a" }, vakt, 1)).toBeNull();
    expect(s1Forslag(null, { byggeplassId: "bp-a" }, vakt, 1)).toBeNull();
  });

  it("🔴 [Nei] skriver ingenting (kortet kaller ikke registrerBesok i Nei-grenen)", () => {
    const kort = fs.readFileSync(path.join(__dirname, "../components/StartSluttDagKort.tsx"), "utf8");
    const nei = kort.indexOf("s1Prosessvakt.demp(");
    expect(nei).toBeGreaterThan(-1);
    const gren = kort.slice(kort.lastIndexOf("onPress={() => {", nei), kort.indexOf("}}", nei));
    expect(gren).not.toContain("registrer");
  });
});

function falskLocation(status: string) {
  const kall = { request: 0, posisjon: 0 };
  const loc = {
    getForegroundPermissionsAsync: async () => ({ status }),
    requestForegroundPermissionsAsync: async () => {
      kall.request++;
      return { status: "granted" };
    },
    getCurrentPositionAsync: async () => {
      kall.posisjon++;
      return { coords: { latitude: 69.6, longitude: 18.9 } };
    },
    Accuracy: { Balanced: 3 },
  };
  return { loc, kall };
}

describe("L4-A2 — S1-måling (K1, K14, montering)", () => {
  it("🔴 K1: tillatelse mangler → null, spør aldri, måler ikke", async () => {
    const { loc, kall } = falskLocation("denied");
    expect(await maalStille(loc)).toBeNull();
    expect(kall).toEqual({ request: 0, posisjon: 0 });
  });

  it("🔴 K1: tillatelse gitt → posisjon, fortsatt uten å spørre", async () => {
    const { loc, kall } = falskLocation("granted");
    expect(await maalStille(loc)).toEqual({ lat: 69.6, lng: 18.9 });
    expect(kall).toEqual({ request: 0, posisjon: 1 });
  });

  it("🔴 K1: S1-stien i kortet og tjenesten spør aldri om tillatelse", () => {
    for (const rel of ["../components/StartSluttDagKort.tsx", "./arbeidsdagBesok.ts"]) {
      const kilde = fs.readFileSync(path.join(__dirname, rel), "utf8");
      expect(kilde, rel).not.toContain("requestForegroundPermissionsAsync");
    }
  });

  it("🔴 K14: kortet bruker prosessvakten, aldri en egen vakt pr. montering", () => {
    const kort = fs.readFileSync(path.join(__dirname, "../components/StartSluttDagKort.tsx"), "utf8");
    expect(kort).not.toMatch(/lagS1Vakt\s*\(/);
    expect(kort).toMatch(/vakt: s1Prosessvakt/);
    expect(kort).toMatch(/s1Prosessvakt\.demp\(/);
  });

  it("🔴 K14: prosessvakten er én instans på tvers av importer (modulnivå)", async () => {
    const igjen = await import("./arbeidsdagBesok");
    expect(igjen.s1Prosessvakt).toBe(s1Prosessvakt);
    // Tilstand lever i instansen: demping satt én gang gjelder neste montering.
    const t0 = 1_000_000_000;
    igjen.s1Prosessvakt.demp("bp-k14", t0);
    expect(s1Prosessvakt.erDempet("bp-k14", t0 + 1)).toBe(true);
  });

  function s1Deler(vakt: ReturnType<typeof lagS1Vakt>, naa: { ms: number }) {
    const maal = vi.fn(async () => ({ lat: 1, lng: 2 }));
    return {
      maal,
      p: {
        vakt, orgId: "org1", naaMs: () => naa.ms, maal,
        identifiser: () => B,
        siste: () => ({ byggeplassId: "bp-a" }),
      },
    };
  }

  it("🔴 montering: første måling gir forslag; ny montering innen 10 min måler ikke", async () => {
    const naa = { ms: 1_000_000 };
    const { maal, p } = s1Deler(lagS1Vakt(), naa);
    expect(await kjorS1(p)).toEqual(B);
    naa.ms += S1_MAALEINTERVALL_MS - 1;
    expect(await kjorS1(p)).toBeUndefined();
    expect(maal).toHaveBeenCalledTimes(1);
    naa.ms += 1;
    expect(await kjorS1(p)).toEqual(B);
    expect(maal).toHaveBeenCalledTimes(2);
  });

  it("🔴 montering: [Nei] demper samme byggeplass i 30 min også ved neste måling", async () => {
    const naa = { ms: 1_000_000 };
    const vakt = lagS1Vakt();
    const { p } = s1Deler(vakt, naa);
    vakt.demp("bp-b", naa.ms);
    expect(await kjorS1(p)).toBeNull();
    naa.ms += S1_DEMPING_MS;
    expect(await kjorS1(p)).toEqual(B);
  });

  it("🔴 montering: GPS uten svar → ikke målt (banneret røres ikke)", async () => {
    const naa = { ms: 1_000_000 };
    const { p } = s1Deler(lagS1Vakt(), naa);
    expect(await kjorS1({ ...p, maal: async () => null })).toBeUndefined();
  });

  it("🔴 montering: kortet måler straks ved montering, ikke bare ved AppState→active", () => {
    const kort = fs.readFileSync(path.join(__dirname, "../components/StartSluttDagKort.tsx"), "utf8");
    const eff = kort.slice(kort.indexOf("const maal = () =>"), kort.indexOf("sub.remove();"));
    const kall = eff.indexOf("\n    maal();");
    const lytter = eff.indexOf("AppState.addEventListener");
    expect(kall).toBeGreaterThan(-1);
    expect(kall).toBeLessThan(lytter);
    expect(eff.slice(lytter)).toMatch(/tilstand === "active"\) maal\(\)/);
    expect(eff).toMatch(/maal: \(\) => maalStille\(Location\)/);
  });
});

describe("L4-A2 — S2 (K9)", () => {
  it("🔴 K9: samme byggeplass som siste besøk → ingen ny rad", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    expect(velgS2Besok(lokalDb(), { id: "b2", arbeidsdagId: DAG, sted: A, naaIso: "T09" })).toBe(false);
    expect(hentBesok(lokalDb(), DAG)).toHaveLength(1);
    expect(hentBesok(lokalDb(), DAG)[0].avreiseAt).toBeNull();
  });

  it("🔴 K9: annen byggeplass → manuell-besøk, forrige lukkes", () => {
    registrerBesok(lokalDb(), {
      id: "b1", arbeidsdagId: DAG, sted: A, ankomstAt: "T07", kilde: "start_dag", naaIso: "T07",
    });
    expect(velgS2Besok(lokalDb(), { id: "b2", arbeidsdagId: DAG, sted: B, naaIso: "T09" })).toBe(true);
    const [b1, b2] = hentBesok(lokalDb(), DAG);
    expect(b1.avreiseAt).toBe("T09");
    expect(b2).toMatchObject({ rekkefolge: 2, kilde: "manuell", byggeplassId: "bp-b" });
  });

  it("🔴 K9: kortets S2-valg går via velgS2Besok", () => {
    const kort = fs.readFileSync(path.join(__dirname, "../components/StartSluttDagKort.tsx"), "utf8");
    const s2 = kort.slice(kort.indexOf("const velgS2 = useCallback("), kort.indexOf("[aktivDag],", kort.indexOf("const velgS2")));
    expect(s2).toMatch(/velgS2Besok\(db, \{/);
    expect(s2).not.toMatch(/registrer\(/);
  });
});

describe("L4-A § 2.2 — rydding", () => {
  it("🔴 avsluttet/forkastet > 14 d slettes med besøk; nyere og pågående står", () => {
    const naa = Date.parse("2026-11-30T12:00:00.000Z");
    seedDag("gammel-avsl", "2026-11-10T07:00:00.000Z", "avsluttet");
    seedDag("gammel-fork", "2026-11-01T07:00:00.000Z", "forkastet");
    seedDag("gammel-paag", "2026-11-01T07:00:00.000Z", "paagaar");
    seedDag("ny-avsl", "2026-11-20T07:00:00.000Z", "avsluttet");
    for (const d of ["gammel-avsl", "ny-avsl"]) {
      registrerBesok(lokalDb(), {
        id: `b-${d}`, arbeidsdagId: d, sted: A, ankomstAt: "T", kilde: "start_dag", naaIso: "T",
      });
    }
    expect(ryddGamleArbeidsdager(lokalDb(), naa)).toBe(2);
    const igjen = db().select().from(arbeidsdagLocal).all().map((d) => d.id).sort();
    expect(igjen).toEqual([DAG, "gammel-paag", "ny-avsl"].sort());
    const besok = db().select().from(arbeidsdagBesokLocal).all().map((b) => b.arbeidsdagId);
    expect(besok).toEqual(["ny-avsl"]);
  });
});

describe("L4-A § 2.5 — PSI er aldri kilde for besøk", () => {
  it("🔴 PSI-koden importerer ikke besøkstjenesten og rører ikke tabellen", () => {
    const rot = path.join(__dirname, "../..");
    for (const rel of ["app/psi/[psiId].tsx", "app/_layout.tsx", "app/(tabs)/hjem.tsx"]) {
      const kilde = fs.readFileSync(path.join(rot, rel), "utf8");
      expect(kilde, rel).not.toMatch(/arbeidsdagBesok|arbeidsdag_besok_local|registrerBesok/);
    }
    // Ingen PSI-fil i hele appen skriver besøk.
    const psiDir = path.join(rot, "app/psi");
    for (const f of fs.readdirSync(psiDir)) {
      const kilde = fs.readFileSync(path.join(psiDir, f), "utf8");
      expect(kilde, f).not.toMatch(/arbeidsdagBesok|registrerBesok/);
    }
  });

  it("🔴 kun Start dag, S1, S2 og Slutt dag skriver besøk", () => {
    const rot = path.join(__dirname, "../..");
    const skrivere: string[] = [];
    const gaa = (dir: string) => {
      for (const navn of fs.readdirSync(dir)) {
        const sti = path.join(dir, navn);
        if (fs.statSync(sti).isDirectory()) {
          if (navn !== "node_modules") gaa(sti);
        } else if (/\.tsx?$/.test(navn) && !/\.test\.tsx?$/.test(navn)) {
          if (/\b(registrerBesok|avsluttBesok)\(/.test(fs.readFileSync(sti, "utf8"))) {
            skrivere.push(path.relative(rot, sti));
          }
        }
      }
    };
    gaa(path.join(rot, "app"));
    gaa(path.join(rot, "src"));
    expect(skrivere.sort()).toEqual([
      "src/components/StartSluttDagKort.tsx",
      "src/services/arbeidsdagBesok.ts",
      "src/utils/bekreftDag.ts",
    ]);
  });
});
