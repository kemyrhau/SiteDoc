import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * ORDRE DEL 5 — glemt dag (Kenneth 2026-11-12), mot EKTE SQLite (sql.js) med
 * samme harness som `bekreftDag.test.ts`.
 *
 * Kenneths tilfelle: økten startet 9.11 kl. 21:07 og ble aldri avsluttet;
 * 9.11 er sendt (3,5 t). «Jeg glemte å avslutte» → Bekreft dag.
 *  a) ingen stille sperre; delvis lagret → egen melding og økten lukkes.
 *  c) anslått slutt må godkjennes eller rettes før lagring (kun Bekreft dag).
 *  d) anslått slutt kappes ved midnatt — aldri automatisk tid på neste dato;
 *     arbeiderens egen slutt etter midnatt gir et eget kort på neste dato.
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
import {
  forberedBekreftDag,
  bekreftDag,
  erAlleDatoerSendt,
  prosjekterMedArbeid,
  sendteDatoer,
  bekreftSperre,
  stegSluttIso,
  visSluttTid,
} from "./bekreftDag";
import type { Dagsforslag } from "./dagsforslag";
import { estimerGlemtSlutt, kappGlemtDagSlutt } from "./dagsegment";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** ORDRE 36a: beskrivelse er påkrevd ved Bekreft — testene her måler noe annet. */
function medBeskrivelse(f: Dagsforslag): Dagsforslag {
  return { ...f, beskrivelsePerKort: Object.fromEntries(prosjekterMedArbeid(f).map((p) => [p, "Graving"])) };
}

let teller = 0;
const {
  arbeidsdagLocal,
  dagsseddelLocal,
  sheetTimerLocal,
  prosjektLocal,
  aktivitetLocal,
  lonnsartLocal,
} = schema;
type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}
// sql.js-drizzle ≈ ExpoSQLite-drizzle for harnessen — cast som i lag2-testen.
function lokalDb(): Parameters<typeof bekreftDag>[0] {
  return holder.drizzle as Parameters<typeof bekreftDag>[0];
}

const ORG = "org1";
const BRUKER = "u1";
const DAG_ID = "dag1";
const DATO = "2026-11-09";
const NESTE = "2026-11-10";
const START = "2026-11-09T21:07:00";
/** Telefonens klokke da «Jeg glemte å avslutte» ble trykket (72t 08m). */
const NAA = "2026-11-12T21:15:00";
const MIDNATT = new Date("2026-11-10T00:00:00").toISOString();

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

function seedArbeidsdag() {
  db().insert(arbeidsdagLocal).values({
    id: DAG_ID, userId: BRUKER, dato: DATO, startAt: START, status: "paagaar",
    sistEndretLokalt: 1,
  }).run();
}

function kontekst(over: Partial<Parameters<typeof forberedBekreftDag>[1]> = {}) {
  return {
    userId: BRUKER,
    orgId: ORG,
    dag: { startAt: START, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: MIDNATT,
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
    sluttIso: MIDNATT,
    endLat: 59.9,
    endLng: 10.7,
  };
}

function tell() {
  return {
    sedler: db().select().from(dagsseddelLocal).all().length,
    rader: db().select().from(sheetTimerLocal).all().length,
    status: db().select().from(arbeidsdagLocal).where(eq(arbeidsdagLocal.id, DAG_ID)).all()[0]!
      .status,
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
      " DELETE FROM arbeidsdag_besok_local;" +
      " DELETE FROM prosjekt_local; DELETE FROM aktivitet_local; DELETE FROM lonnsart_local;",
  );
  seedKatalog();
  seedArbeidsdag();
});

function sendt911() {
  db().insert(dagsseddelLocal).values({
    id: "sendt-9-11", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
    dato: DATO, status: "sent", sistEndretLokalt: 1,
  }).run();
  db().insert(sheetTimerLocal).values({
    id: "rad-9-11", dagsseddelId: "sendt-9-11", aktivitetId: "a1", lonnsartId: "L-normal", timer: 3.5,
    fraTid: "07:00", tilTid: "10:30", sistEndretLokalt: 1,
  }).run();
}

function lokal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

describe("DEL 5 d — anslått slutt kappes ved midnatt", () => {
  it("🔴 Kenneths tilfelle: start 9.11 21:07, standard slutt 15:00 → 9.11 24:00, ingenting på 10.11", () => {
    const r = estimerGlemtSlutt(START, "15:00", 7.5);
    expect(lokal(r.sluttIso)).toBe("2026-11-10T00:00");
    expect(r.kappetVedMidnatt).toBe(true);
  });

  it("dagtid: standard slutt etter start brukes urørt", () => {
    const r = estimerGlemtSlutt("2026-11-09T07:00:00", "15:00", 7.5);
    expect(lokal(r.sluttIso)).toBe("2026-11-09T15:00");
    expect(r.kappetVedMidnatt).toBe(false);
  });

  it("🔴 kappGlemtDagSlutt: 72 t-spenn fra 21:07 kappes ved midnatt, ikke start + norm (04:37 neste dag)", () => {
    const r = kappGlemtDagSlutt(START, new Date(NAA).toISOString(), {
      deteksjonsTimer: 16,
      kappLengdeTimer: 7.5,
    });
    expect(r.kappet).toBe(true);
    expect(lokal(r.sluttIso)).toBe("2026-11-10T00:00");
  });

  it("🔴 GPS-slutt for glemt dag (72 t) gir aldri en rad på 10.11", () => {
    const { forslag } = forberedBekreftDag(
      lokalDb(),
      kontekst({ sluttIso: new Date(NAA).toISOString(), sisteSegmentKilde: "system" }),
    );
    expect(forslag.kappet).toBe(true);
    expect(forslag.datoer.map((d) => d.dato)).toEqual([DATO]);
  });
});

describe("DEL 5 a — Kenneths tilfelle: 9.11 sendt", () => {
  it("🔴 estimert slutt 24:00 → kun 9.11 (sendt) vises før lagring; Bekreft skriver ingenting og økten står åpen", () => {
    sendt911();
    const { sluttIso } = estimerGlemtSlutt(START, "15:00", 7.5);
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst({ sluttIso, sisteSegmentKilde: "system" }));
    expect(sendteDatoer(forslag)).toEqual([DATO]);
    expect(erAlleDatoerSendt(forslag)).toBe(true);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), skriveCtx());
    expect(handling.type).toBe("blokkertSendt");
    expect(tell()).toEqual({ sedler: 1, rader: 1, status: "paagaar" });
  });

  it("🔴 arbeideren retter slutt til 10.11 02:00 → 10.11 lagres, 9.11 meldes ikke lagret, økten LUKKES", () => {
    sendt911();
    const sluttIso = new Date("2026-11-10T02:00:00").toISOString();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst({ sluttIso, sisteSegmentKilde: "bruker" }));
    expect(sendteDatoer(forslag)).toEqual([DATO]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), { ...skriveCtx(), sluttIso });
    expect(handling.type).toBe("delvisSendt");
    if (handling.type !== "delvisSendt") return;
    expect(handling.lagret).toEqual([NESTE]);
    expect(handling.blokkert).toEqual([DATO]);
    const nySedel = db().select().from(dagsseddelLocal).where(eq(dagsseddelLocal.dato, NESTE)).all();
    expect(nySedel).toHaveLength(1);
    expect(handling.sheetId).toBe(nySedel[0]!.id);
    // Den sendte sedelen er urørt (én rad, 3,5 t).
    const rader911 = db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, "sendt-9-11")).all();
    expect(rader911.map((r) => r.timer)).toEqual([3.5]);
    expect(tell().status).toBe("avsluttet");
  });
});

describe("DEL 5 d-tillegg — slutt etter midnatt gir eget kort på neste dato", () => {
  it("🔴 to datoer → to sedler, hver med egne rader; slått aldri sammen", () => {
    const sluttIso = new Date("2026-11-10T02:00:00").toISOString();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst({ sluttIso, sisteSegmentKilde: "bruker" }));
    expect(forslag.datoer.map((d) => d.dato)).toEqual([DATO, NESTE]);
    const { handling } = bekreftDag(lokalDb(), medBeskrivelse(forslag), { ...skriveCtx(), sluttIso });
    expect(handling.type).toBe("suksess");
    const sedler = db().select().from(dagsseddelLocal).all();
    expect(sedler.map((s) => s.dato).sort()).toEqual([DATO, NESTE]);
    for (const s of sedler) {
      expect(db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, s.id)).all().length).toBeGreaterThan(0);
    }
  });

  it("🔴 eksisterende rad på 10.11 røres ikke — økten etter midnatt blir en NY rad", () => {
    db().insert(dagsseddelLocal).values({
      id: "kladd-10-11", userId: BRUKER, organizationId: ORG, projectId: "p1", aktivitetId: "a1",
      dato: NESTE, status: "draft", sistEndretLokalt: 1,
    }).run();
    db().insert(sheetTimerLocal).values({
      id: "rad-10-11", dagsseddelId: "kladd-10-11", aktivitetId: "a1", lonnsartId: "L-normal", timer: 2,
      fraTid: "08:00", tilTid: "10:00", beskrivelse: "Egen tekst", sistEndretLokalt: 1,
    }).run();
    const sluttIso = new Date("2026-11-10T02:00:00").toISOString();
    const { forslag } = forberedBekreftDag(lokalDb(), kontekst({ sluttIso, sisteSegmentKilde: "bruker" }));
    bekreftDag(lokalDb(), medBeskrivelse(forslag), { ...skriveCtx(), sluttIso });
    const rader = db().select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, "kladd-10-11")).all();
    const gammel = rader.find((r) => r.id === "rad-10-11")!;
    expect([gammel.timer, gammel.fraTid, gammel.tilTid, gammel.beskrivelse]).toEqual([2, "08:00", "10:00", "Egen tekst"]);
    expect(rader.length).toBeGreaterThan(1);
  });
});

describe("DEL 5 a/c — sperrene i Bekreft dag", () => {
  const ok = {
    harDb: true, harBeregnet: true, harBruker: true, manuell: false,
    harArbeidsdagId: true, manglerProsjekt: false, sluttIkkeGodkjent: false,
  };
  it("alt på plass → ingen sperre", () => {
    expect(bekreftSperre(ok)).toBeNull();
  });
  it.each([
    [{ harDb: false }, "ikkeKlar"],
    [{ harBruker: false }, "ikkeInnlogget"],
    [{ harArbeidsdagId: false }, "dagLukket"],
    [{ harBeregnet: false }, "dagLukket"],
    [{ manglerProsjekt: true }, "manglerProsjekt"],
    [{ sluttIkkeGodkjent: true }, "sluttIkkeGodkjent"],
  ] as const)("🔴 %o → sperre «%s» (aldri stille)", (over, aarsak) => {
    expect(bekreftSperre({ ...ok, ...over })).toBe(aarsak);
  });
  it("manuell føring trenger ingen arbeidsdag", () => {
    expect(bekreftSperre({ ...ok, manuell: true, harArbeidsdagId: false })).toBeNull();
  });
});

describe("DEL 5 c — retting og visning av sluttiden", () => {
  it("stegknappene kan flytte slutten forbi midnatt (arbeiderens valg)", () => {
    expect(lokal(stegSluttIso(MIDNATT, START, 60))).toBe("2026-11-10T01:00");
  });
  it("aldri før start + 15 min", () => {
    expect(lokal(stegSluttIso(new Date("2026-11-09T21:30:00").toISOString(), START, -60))).toBe("2026-11-09T21:22");
  });
  it("🔴 kappet slutt vises som 24:00, ikke 00:00", () => {
    expect(visSluttTid(START, MIDNATT)).toEqual({ tid: "24:00", dato: null });
  });
  it("slutt på neste dato bærer datoen", () => {
    expect(visSluttTid(START, new Date("2026-11-10T02:00:00").toISOString())).toEqual({ tid: "02:00", dato: NESTE });
  });
});

/** Kildevakter — mobil har ingen renderer (samme mønster som dagskort-isolert-vakt). */
function les(rel: string): string {
  return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), rel), "utf8");
}
function utenKommentarer(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SKJERM = utenKommentarer(les("../../app/timer/bekreft-dag.tsx"));
const KORT = utenKommentarer(les("../components/StartSluttDagKort.tsx"));

describe("DEL 5 — kildevakter i Bekreft dag", () => {
  it("🔴 a: den stille sperren er borte — sperrene går via bekreftSperre + Alert", () => {
    expect(SKJERM).not.toMatch(/\|\|\s*lagrer\)\s*return;/);
    expect(SKJERM).toMatch(/bekreftSperre\(\{[\s\S]*?sluttIkkeGodkjent,?[\s\S]*?\}\)/);
    expect(SKJERM).toMatch(/Alert\.alert\(\s*t\("timer\.bekreftDag\.sperre\.tittel"\)/);
  });
  it("🔴 a: knappen er ikke stum — kun deaktivert mens den lagrer", () => {
    expect(SKJERM).not.toContain("deaktivert={!kanBekrefte}");
    expect(SKJERM).toContain("deaktivert={lagrer}");
  });
  it("🔴 a: delvis lagret har egen melding", () => {
    expect(SKJERM).toMatch(/case "delvisSendt":[\s\S]*?timer\.delvisSendt\.melding/);
  });
  it("🔴 a: sendte datoer vises før lagring", () => {
    expect(SKJERM).toContain("timer.bekreftDag.datoSendt");
    expect(SKJERM).toContain("sendteDatoer(forslag)");
  });
  it("🔴 c: anslått slutt har godkjenning, og rettet slutt regnes som arbeiderens", () => {
    expect(SKJERM).toContain("setSluttGodkjent(true)");
    expect(SKJERM).toMatch(/sisteSegmentKilde:\s*rettetSluttIso \? "bruker" : sisteSegmentKilde/);
    expect(SKJERM).toMatch(/sluttIkkeGodkjent\s*=\s*sluttPanel && !sluttGodkjent && rettetSluttIso == null/);
  });
  it("🔴 d-tillegg: skjermen sier at det blir ett kort pr. dato", () => {
    expect(SKJERM).toContain("timer.bekreftDag.kortPrDato");
  });
  it("🔴 d: «Jeg glemte å avslutte» bruker det midnatt-kappede estimatet", () => {
    expect(KORT).toMatch(/estimerGlemtSlutt\(aktivDag\.startAt/);
  });
  it("b (NEI): «Jeg jobber fortsatt» er fortsatt der", () => {
    expect(KORT).toContain("jobberFortsatt");
  });
});

describe("ORDRE Tillegg/Utlegg i Bekreft dag — kildevakter i skjermen", () => {
  it("🔴 tilleggUtleggUtenDag gir Alert og return (ingen stille stopp)", () => {
    expect(SKJERM).toMatch(
      /handling\.type === "tilleggUtleggUtenDag"\)\s*\{[\s\S]*?Alert\.alert\([\s\S]*?utenDagTittel[\s\S]*?return;/,
    );
  });
  it("🔴 kvitteringene køes først etter skrevet Bekreft, og filene slippes før køing", () => {
    expect(SKJERM).toMatch(
      /resultat\?\.lonnUtleggSkrevet\)\s*\{\s*pendingKvitteringer\.current = \[\];[\s\S]*?leggIKo\(ko\)/,
    );
  });
  it("🔴 ulagrede kvitteringer ryddes når skjermen forlates (utkast-eide unntatt)", () => {
    expect(SKJERM).toMatch(
      /for \(const sti of pendingKvitteringer\.current\) \{\s*if \(!eide\.includes\(sti\)\) void slettLokaltBilde\(sti\);?\s*\}/,
    );
  });
  it("negativkontroll: seksjonen skjules når alle datoer er sendt", () => {
    expect(SKJERM).toMatch(/!alleSendt && !ikkeAnsatt && !tomt && lonnUtleggProsjekt \? \(\s*<BekreftDagLonnUtlegg/);
  });
});

describe("RETUR Tillegg/Utlegg (Kontrollør M9, M11) — kildevakter", () => {
  const UTLEGG_SEKSJON = utenKommentarer(les("../components/timer-detalj/UtleggSeksjon.tsx"));
  const LONN_UTLEGG = utenKommentarer(les("../components/timer-detalj/BekreftDagLonnUtlegg.tsx"));

  it("🔴 M11: onOpprett-grenen leverer utlegget til kalleren og returnerer FØR skrivingen", () => {
    expect(UTLEGG_SEKSJON).toMatch(
      /if \(onOpprett\) \{\s*onOpprett\(nytt\);\s*return;\s*\}\s*const ko = skrivUtlegg\(db, sheetId, nytt/,
    );
  });
  it("🔴 M11: Bekreft dag-modalen bruker onOpprett (ingen skriving med sheetId=\"\")", () => {
    expect(LONN_UTLEGG).toMatch(/<UtleggRadModal[\s\S]*?sheetId=""[\s\S]*?onOpprett=\{\(u\) => \{/);
  });
  it("negativkontroll M11: prosjektkortets vei (uten onOpprett) skriver fortsatt med sedelens id", () => {
    expect(UTLEGG_SEKSJON).toMatch(/const ko = skrivUtlegg\(db, sheetId, nytt, randomUUID\);\s*if \(ko\) await leggIKo\(ko\);/);
  });
  // RETUR avvik 10 (2026-11-13): med `onFjernKvittering` overtar skjermen
  // slettingen (etter skrevet utkast); uten callback er atferden som før.
  it("🔴 M9: fjern utlegg-linje sletter den ulagrede kvitteringsfila før linja fjernes (uten callback)", () => {
    expect(LONN_UTLEGG).toMatch(
      /onFjern=\{\(\) => \{\s*const sti = u\.kvittering\?\.lokalSti;\s*if \(sti\) \{\s*if \(onFjernKvittering\) onFjernKvittering\(sti\);\s*else void slettLokaltBilde\(sti\);\s*\}\s*onEndre\(\(f\) => \(\{ \.\.\.f, utlegg: f\.utlegg\.filter/,
    );
  });
  it("negativkontroll M9: fjern tillegg-linje har ingen fil å slette", () => {
    expect(LONN_UTLEGG).toMatch(/onFjern=\{\(\) => onEndre\(\(f\) => \(\{ \.\.\.f, tillegg: f\.tillegg\.filter/);
    expect(LONN_UTLEGG.match(/slettLokaltBilde\(/g)).toHaveLength(1);
  });
});
