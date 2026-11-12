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
  lagS1Vakt,
  registrerBesok,
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

  it("🔴 kildevakt: startDag skriver besøk 1 med kilde start_dag etter at dagen er satt inn", () => {
    const kilde = fs.readFileSync(path.join(__dirname, "../hooks/useArbeidsdag.ts"), "utf8");
    const innsatt = kilde.indexOf(".insert(arbeidsdagLocal)");
    const besok = kilde.indexOf("registrerBesok(db, {", innsatt);
    expect(innsatt).toBeGreaterThan(-1);
    expect(besok).toBeGreaterThan(innsatt);
    expect(kilde.slice(besok, besok + 400)).toMatch(/arbeidsdagId: id,[\s\S]*kilde: "start_dag"/);
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
    const nei = kort.indexOf("s1Vakt.demp(");
    expect(nei).toBeGreaterThan(-1);
    const gren = kort.slice(kort.lastIndexOf("onPress={() => {", nei), kort.indexOf("}}", nei));
    expect(gren).not.toContain("registrer");
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
      "src/hooks/useArbeidsdag.ts",
      "src/services/arbeidsdagBesok.ts",
      "src/utils/bekreftDag.ts",
    ]);
  });
});
