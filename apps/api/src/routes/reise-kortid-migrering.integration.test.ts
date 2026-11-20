import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaTimer } from "@sitedoc/db-timer";
import {
  effektivKortByggeplass,
  jobberFraArbeidsrader,
  utledKortId,
  velgReiseKort,
} from "@sitedoc/shared";

/**
 * w12 steg 1 — utfyllingen av kort-id på reiserader (web-timeforing-plan.md § 4.11 del E og
 * del H punkt 2) mot EKTE Postgres (lokal engangs-DB, aldri test/prod).
 *
 *  - Riktig kort pr. reiserad (lik underprosjekt, så lik byggeplass, så retning; uten retning
 *    med og uten klokkeslett; attestert reise; reise uten jobb; erstattet jobb teller ikke;
 *    en jobb på en annen sedel er aldri kandidat).
 *  - PARITET: samme sedler gjennom den delte regelen (`velgReiseKort`) gir samme kort som SQL.
 *  - Kjørt to ganger = samme svar. Ingen andre felt endres (heller ikke updated_at).
 *  - Gate-SQL 0–3 = 0 etterpå. Telle-SQL-en (til Kenneth) kjøres på seeden før utfyllingen.
 *  - «Stille tomhet er forbudt»: fixturen MÅ ha reiserader uten kort-id før kjøring, og
 *    ingen etter. En tom migreringsfil gir rød test.
 */

const ROT = join(__dirname, "..", "..", "..", "..", "packages");
const W12_SQL = readFileSync(
  join(ROT, "db-timer", "prisma", "migrations", "20261120120000_w12_reise_kortid", "migration.sql"),
  "utf8",
);

/** Setningene merket `-- SETNING n:` i migreringen, i rekkefølge. */
function setninger(sql: string): string[] {
  return sql
    .split(/^-- SETNING \d+:.*$/m)
    .slice(1)
    .map((del) =>
      del
        .slice(0, del.indexOf(";") + 1)
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.startsWith("WITH") || s.startsWith("UPDATE"));
}

const id = (n: string) => `aa1d0c00-0000-0000-0000-0000000000${n}`;
const ORG = id("01");
const P1 = id("11"); // B12 — to jobber uten underprosjekt, én på END
const P2 = id("12"); // ingen jobb
const STORGATA = id("21"); // P1, sedelens byggeplass
const ANNEN = id("22"); // P1
const USER = id("31");
const S1 = id("41");
const S2 = id("42"); // samme bruker, dagen etter — jobben der er aldri kandidat
const LONNSART = id("51");
const AKTIVITET = id("52");
const END = id("61");
const TILL = id("62");
const DATO1 = "2026-11-18";
const DATO2 = "2026-11-19";

const K = { j07: "kort-j07", j12: "kort-j12", j16: "kort-j16", j99: "kort-j99", s2: "kort-s2", fast: "kort-fast" };
const W = { a: id("71"), b: id("72"), c: id("73"), d: id("74"), e: id("75"), s2: id("76"), los: id("77") };
const R = {
  utStorgata: id("81"),
  returStorgata: id("82"),
  returEnd: id("83"),
  utTill: id("84"),
  returAnnen: id("85"),
  returKontor: id("86"),
  utenRetningTidlig: id("87"),
  utenRetningSent: id("88"),
  utenRetningUtenTid: id("89"),
  attestert: id("8a"),
  utenJobb: id("8b"),
  harKort: id("8c"),
};
const ALLE_SEDLER = [S1, S2];

async function ryddOpp() {
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.daily_sheets WHERE id IN ('${S1}','${S2}')`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.lonnsarter WHERE id = '${LONNSART}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.aktiviteter WHERE id = '${AKTIVITET}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.byggeplasser WHERE id IN ('${STORGATA}','${ANNEN}')`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.projects WHERE id IN ('${P1}','${P2}')`);
}

type Rad = {
  id: string;
  sheet: string;
  prosjekt: string;
  bp?: string | null;
  eco?: string | null;
  fra?: string | null;
  til?: string | null;
  reise?: boolean;
  retning?: string | null;
  status?: string;
  kort?: string | null;
  opprettet: string;
};

async function seed() {
  const x = (s: string) => prismaTimer.$executeRawUnsafe(s);
  const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v}'`);
  await x(`INSERT INTO public.projects (id, project_number, name, updated_at) VALUES
    ('${P1}', 'W12-1', 'B12', now()), ('${P2}', 'W12-2', '1050', now())`);
  await x(`INSERT INTO public.byggeplasser (id, project_id, name, updated_at) VALUES
    ('${STORGATA}', '${P1}', 'Storgata', now()), ('${ANNEN}', '${P1}', 'Annen', now())`);
  await x(`INSERT INTO timer.lonnsarter (id, organization_id, type, navn, updated_at) VALUES ('${LONNSART}', '${ORG}', 'ordinaer', 'Timelønn', now())`);
  await x(`INSERT INTO timer.aktiviteter (id, organization_id, navn, updated_at) VALUES ('${AKTIVITET}', '${ORG}', 'Grunnarbeid', now())`);
  await x(`INSERT INTO timer.daily_sheets (id, client_uuid, organization_id, user_id, registrert_av_user_id, dato, byggeplass_id, updated_at) VALUES
    ('${S1}', '${S1}', '${ORG}', '${USER}', '${USER}', '${DATO1}', '${STORGATA}', '2026-11-18T20:00:00Z'),
    ('${S2}', '${S2}', '${ORG}', '${USER}', '${USER}', '${DATO2}', NULL, '2026-11-19T20:00:00Z')`);
  const rader: Rad[] = [
    // Jobbene på S1, P1.
    { id: W.a, sheet: S1, prosjekt: P1, fra: "07:00", til: "09:00", kort: K.j07, opprettet: "2026-11-18T10:00:01Z" }, // arver STORGATA
    { id: W.b, sheet: S1, prosjekt: P1, fra: "09:00", til: "12:00", kort: K.j07, opprettet: "2026-11-18T10:00:02Z" },
    { id: W.c, sheet: S1, prosjekt: P1, eco: END, bp: STORGATA, fra: "12:00", til: "16:00", kort: K.j12, opprettet: "2026-11-18T10:00:03Z" },
    { id: W.d, sheet: S1, prosjekt: P1, bp: ANNEN, fra: "16:30", til: "17:30", kort: K.j16, opprettet: "2026-11-18T10:00:04Z" },
    // Erstattet jobb tidlig på dagen: ingen kandidat.
    { id: W.e, sheet: S1, prosjekt: P1, bp: STORGATA, fra: "05:00", til: "06:00", status: "erstattet", kort: K.j99, opprettet: "2026-11-18T10:00:00Z" },
    // Arbeidsrad uten kort-id: hører ikke til en jobb.
    { id: W.los, sheet: S1, prosjekt: P1, bp: STORGATA, fra: "04:00", til: "05:00", kort: null, opprettet: "2026-11-18T09:00:00Z" },
    // Jobb på en annen sedel, samme prosjekt og bruker.
    { id: W.s2, sheet: S2, prosjekt: P1, bp: STORGATA, fra: "06:00", til: "14:00", kort: K.s2, opprettet: "2026-11-19T10:00:00Z" },
    // Reisene (uten kort-id, unntatt `harKort`).
    { id: R.utStorgata, sheet: S1, prosjekt: P1, bp: STORGATA, reise: true, retning: "ut", fra: "06:30", til: "07:00", opprettet: "2026-11-18T11:00:01Z" },
    { id: R.returStorgata, sheet: S1, prosjekt: P1, bp: STORGATA, reise: true, retning: "retur", fra: "17:30", til: "18:00", opprettet: "2026-11-18T11:00:02Z" },
    { id: R.returEnd, sheet: S1, prosjekt: P1, bp: STORGATA, eco: END, reise: true, retning: "retur", fra: "16:00", til: "16:30", opprettet: "2026-11-18T11:00:03Z" },
    { id: R.utTill, sheet: S1, prosjekt: P1, bp: STORGATA, eco: TILL, reise: true, retning: "ut", opprettet: "2026-11-18T11:00:04Z" },
    { id: R.returAnnen, sheet: S1, prosjekt: P1, bp: ANNEN, reise: true, retning: "retur", opprettet: "2026-11-18T11:00:05Z" },
    { id: R.returKontor, sheet: S1, prosjekt: P1, bp: null, reise: true, retning: "retur", opprettet: "2026-11-18T11:00:06Z" },
    { id: R.utenRetningTidlig, sheet: S1, prosjekt: P1, bp: null, reise: true, fra: "06:00", til: "06:30", opprettet: "2026-11-18T11:00:07Z" },
    { id: R.utenRetningSent, sheet: S1, prosjekt: P1, bp: null, reise: true, fra: "18:00", til: "18:30", opprettet: "2026-11-18T11:00:08Z" },
    { id: R.utenRetningUtenTid, sheet: S1, prosjekt: P1, bp: null, reise: true, opprettet: "2026-11-18T11:00:09Z" },
    { id: R.attestert, sheet: S1, prosjekt: P1, bp: null, reise: true, retning: "retur", status: "attestert", opprettet: "2026-11-18T11:00:10Z" },
    { id: R.utenJobb, sheet: S1, prosjekt: P2, bp: null, eco: null, reise: true, retning: "ut", opprettet: "2026-11-18T11:00:11Z" },
    { id: R.harKort, sheet: S1, prosjekt: P1, bp: STORGATA, reise: true, retning: "ut", kort: K.fast, opprettet: "2026-11-18T11:00:12Z" },
  ];
  for (const r of rader) {
    await x(`INSERT INTO timer.sheet_timer (id, sheet_id, lonnsart_id, aktivitet_id, project_id, byggeplass_id,
        external_cost_object_id, fra_tid, til_tid, er_reise, reise_retning, attestert_status, kort_id, timer, created_at, updated_at)
      VALUES ('${r.id}', '${r.sheet}', '${LONNSART}', '${AKTIVITET}', '${r.prosjekt}', ${q(r.bp)}, ${q(r.eco)}, ${q(r.fra)},
        ${q(r.til)}, ${r.reise ?? false}, ${q(r.retning)}, '${r.status ?? "pending"}', ${q(r.kort)}, 1,
        '${r.opprettet}', '2026-11-18T12:00:00Z')`);
  }
}

/** Kjør en spørring mot bare denne testens sedler: samme tekst, `timer.sheet_timer` avgrenset. */
const avgrens = (sql: string) =>
  sql.replace(
    /timer\.sheet_timer\b(?!_)/g,
    `(select * from timer.sheet_timer where sheet_id in ('${ALLE_SEDLER.join("','")}'))`,
  );

async function kortPr(): Promise<Record<string, string | null>> {
  const rader = await prismaTimer.$queryRawUnsafe<{ id: string; kort_id: string | null }[]>(
    `SELECT id, kort_id FROM timer.sheet_timer WHERE sheet_id IN ('${ALLE_SEDLER.join("','")}')`,
  );
  return Object.fromEntries(rader.map((r) => [r.id, r.kort_id]));
}

/** Hele raden uten kort_id — for «ingen andre felt endres». */
async function radeneUtenKort(): Promise<Record<string, unknown>> {
  const rader = await prismaTimer.$queryRawUnsafe<{ id: string; j: unknown }[]>(
    `SELECT id, (to_jsonb(t) - 'kort_id') AS j FROM timer.sheet_timer t WHERE sheet_id IN ('${ALLE_SEDLER.join("','")}')`,
  );
  return Object.fromEntries(rader.map((r) => [r.id, r.j]));
}

async function reiserUtenKort(): Promise<number> {
  const [r] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM timer.sheet_timer WHERE er_reise = true AND kort_id IS NULL AND sheet_id IN ('${ALLE_SEDLER.join("','")}')`,
  );
  return Number(r!.n);
}

async function kjorUtfylling(sql = W12_SQL) {
  for (const s of setninger(sql)) await prismaTimer.$executeRawUnsafe(s);
}

/** Den delte regelen på de samme radene (lest fra databasen før utfyllingen). */
async function kortEtterDeltRegel(): Promise<Record<string, string>> {
  const sedler = await prismaTimer.$queryRawUnsafe<
    { id: string; user_id: string; dato: string; bp: string | null; bp_prosjekt: string | null }[]
  >(`SELECT ds.id, ds.user_id, to_char(ds.dato, 'YYYY-MM-DD') AS dato, ds.byggeplass_id AS bp, b.project_id AS bp_prosjekt
       FROM timer.daily_sheets ds LEFT JOIN public.byggeplasser b ON b.id = ds.byggeplass_id
      WHERE ds.id IN ('${ALLE_SEDLER.join("','")}')`);
  const rader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: { in: ALLE_SEDLER } } });
  const ut: Record<string, string> = {};
  for (const s of sedler) {
    const sedelBp = s.bp && s.bp_prosjekt ? { id: s.bp, projectId: s.bp_prosjekt } : null;
    const paaSedel = rader.filter((r) => r.sheetId === s.id);
    const jobber = jobberFraArbeidsrader(
      paaSedel
        .filter((r) => !r.erReise)
        .map((r) => ({
          kortId: r.kortId,
          projectId: r.projectId,
          ecoId: r.externalCostObjectId,
          byggeplassId: effektivKortByggeplass(r.projectId, r.byggeplassId, sedelBp),
          fraTid: r.fraTid,
          opprettet: r.createdAt.getTime(),
          attestertStatus: r.attestertStatus,
        })),
    );
    for (const r of paaSedel.filter((x) => x.erReise && !x.kortId)) {
      ut[r.id] =
        velgReiseKort(
          {
            projectId: r.projectId,
            ecoId: r.externalCostObjectId,
            byggeplassId: r.byggeplassId,
            retning: r.reiseRetning,
            fraTid: r.fraTid,
          },
          jobber,
        ) ??
        utledKortId({
          userId: s.user_id,
          dato: s.dato,
          nokkel: {
            projectId: r.projectId,
            byggeplassId: effektivKortByggeplass(r.projectId, r.byggeplassId, sedelBp),
            ecoId: r.externalCostObjectId,
          },
        });
    }
  }
  return ut;
}

// Telle-SQL-en som går til Kenneth (§ 4.11 del E, utvidet i løsningen 2026-11-20). Bare lesing.
const TELLE_SQL = `with sedel as (
  select ds.id, ds.byggeplass_id, b.project_id as bp_prosjekt
    from timer.daily_sheets ds left join public.byggeplasser b on b.id = ds.byggeplass_id
), reise as (
  select id, sheet_id, project_id, byggeplass_id as bp, external_cost_object_id as eco,
         reise_retning, fra_tid, attestert_status
    from timer.sheet_timer where er_reise = true and kort_id is null
), jobb as (
  select distinct t.sheet_id, t.project_id, t.external_cost_object_id as eco,
         coalesce(t.byggeplass_id, case when s.bp_prosjekt = t.project_id then s.byggeplass_id end) as bp
    from timer.sheet_timer t join sedel s on s.id = t.sheet_id
   where t.er_reise = false and t.kort_id is not null and t.attestert_status is distinct from 'erstattet'
)
select count(*) as reiserader,
  count(*) filter (where r.eco is not null) as med_underprosjekt,
  count(*) filter (where r.bp is null) as uten_byggeplass,
  count(*) filter (where exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id and j.eco is not distinct from r.eco)) as jobb_samme_underprosjekt,
  count(*) filter (where exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id) and not exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id and j.eco is not distinct from r.eco)) as jobb_annet_underprosjekt,
  count(*) filter (where exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id and j.bp = r.bp)) as jobb_samme_byggeplass,
  count(*) filter (where not exists (select 1 from jobb j where j.sheet_id = r.sheet_id
     and j.project_id = r.project_id)) as ingen_jobb,
  count(*) filter (where r.reise_retning is null) as uten_retning,
  count(*) filter (where r.reise_retning is null and r.fra_tid is null) as uten_retning_og_tid,
  count(*) filter (where r.attestert_status in ('attestert', 'erstattet')) as attestert_eller_erstattet
from reise r;`;

// Gate-SQL (§ 4.11 del E 1–3, og 0 fra løsningen 2026-11-20). Alle skal gi 0 etter utfyllingen.
const GATE_SQL = [
  `select count(*) from timer.sheet_timer r
 where r.er_reise = true and r.kort_id is null
   and exists (select 1 from timer.sheet_timer j where j.sheet_id = r.sheet_id and j.project_id = r.project_id
                and j.er_reise = false and j.kort_id is not null and j.attestert_status is distinct from 'erstattet');`,
  `select count(*) from timer.sheet_timer where kort_id is null and er_reise = true;`,
  `select count(*) from timer.sheet_timer r join timer.sheet_timer t
    on t.sheet_id = r.sheet_id and t.kort_id = r.kort_id and t.er_reise = false
 where r.er_reise = true and t.project_id is distinct from r.project_id;`,
  `select count(*) from timer.sheet_timer r
 where r.er_reise = true
   and exists (select 1 from timer.sheet_timer t
                where t.sheet_id = r.sheet_id and t.kort_id = r.kort_id and t.er_reise = false
                  and t.attestert_status is distinct from 'erstattet'
                  and t.external_cost_object_id is distinct from r.external_cost_object_id)
   and exists (select 1 from timer.sheet_timer j
                where j.sheet_id = r.sheet_id and j.project_id = r.project_id and j.er_reise = false
                  and j.attestert_status is distinct from 'erstattet'
                  and j.external_cost_object_id is not distinct from r.external_cost_object_id);`,
];

const tall = (v: unknown) => Number(v as bigint);

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("w12 utfylling — kort-id på reise (§ 4.11 del E, H.2)", () => {
  let foer: Record<string, unknown>;
  let deltRegel: Record<string, string>;

  it("telle-SQL-en kjører og teller seeden riktig (bare lesing)", async () => {
    const [t] = await prismaTimer.$queryRawUnsafe<Record<string, unknown>[]>(avgrens(TELLE_SQL));
    expect(Object.fromEntries(Object.entries(t!).map(([k, v]) => [k, tall(v)]))).toEqual({
      reiserader: 11,
      med_underprosjekt: 2,
      uten_byggeplass: 6,
      jobb_samme_underprosjekt: 9,
      jobb_annet_underprosjekt: 1,
      jobb_samme_byggeplass: 5,
      ingen_jobb: 1,
      uten_retning: 3,
      uten_retning_og_tid: 1,
      attestert_eller_erstattet: 1,
    });
  });

  it("stille tomhet: fixturen har reiserader uten kort-id før kjøring", async () => {
    foer = await radeneUtenKort();
    deltRegel = await kortEtterDeltRegel();
    expect(await reiserUtenKort()).toBe(11);
    // Negativkontroll i testen selv: en tom utfylling lar dem stå.
    await kjorUtfylling("");
    expect(await reiserUtenKort()).toBe(11);
  });

  it("riktig kort pr. reiserad", async () => {
    await kjorUtfylling();
    const k = await kortPr();
    expect(await reiserUtenKort()).toBe(0);
    expect(k[R.utStorgata]).toBe(K.j07); // lik underprosjekt (Uten) og byggeplass (arvet): J07
    expect(k[R.returStorgata]).toBe(K.j07); // byggeplass-steget slår retningen: J16 står på Annen
    expect(k[R.returEnd]).toBe(K.j12); // lik underprosjekt
    expect(k[R.utTill]).toBe(K.j07); // ingen jobb på TILL → alle; Storgata → J07, J12; første
    expect(k[R.returAnnen]).toBe(K.j16); // byggeplass Annen
    expect(k[R.returKontor]).toBe(K.j16); // uten byggeplass hopper over steget; siste uten underprosjekt
    expect(k[R.utenRetningTidlig]).toBe(K.j07); // før første arbeid
    expect(k[R.utenRetningSent]).toBe(K.j16); // etter → siste
    expect(k[R.utenRetningUtenTid]).toBe(K.j07); // verken retning eller tid → første
    expect(k[R.attestert]).toBe(K.j16); // attestert reise får også kort
    expect(k[R.utenJobb]).toBe(
      utledKortId({ userId: USER, dato: DATO1, nokkel: { projectId: P2, byggeplassId: null, ecoId: null } }),
    );
    expect(k[R.harKort]).toBe(K.fast); // rader med kort-id røres ikke
    // Aldri jobben på den andre sedelen, aldri den erstattede.
    expect(Object.values(k).filter((v) => v === K.s2)).toEqual([K.s2]);
    expect(Object.values(k).filter((v) => v === K.j99)).toEqual([K.j99]);
  });

  it("PARITET: den delte regelen gir samme kort som SQL for hver reiserad", async () => {
    const k = await kortPr();
    expect(Object.keys(deltRegel).length).toBe(11);
    for (const [radId, kort] of Object.entries(deltRegel)) expect({ radId, kort: k[radId] }).toEqual({ radId, kort });
  });

  it("ingen andre felt endres — heller ikke updated_at, underprosjekt, byggeplass eller prosjekt", async () => {
    expect(await radeneUtenKort()).toEqual(foer);
  });

  it("kjørt to ganger gir samme svar", async () => {
    const etter1 = await kortPr();
    await kjorUtfylling();
    expect(await kortPr()).toEqual(etter1);
    expect(await radeneUtenKort()).toEqual(foer);
  });

  it("gate-SQL 0–3 gir 0", async () => {
    for (const sql of GATE_SQL) {
      const [r] = await prismaTimer.$queryRawUnsafe<{ count: bigint }[]>(avgrens(sql));
      expect({ sql: sql.slice(0, 60), n: tall(r!.count) }).toEqual({ sql: sql.slice(0, 60), n: 0 });
    }
  });
});
