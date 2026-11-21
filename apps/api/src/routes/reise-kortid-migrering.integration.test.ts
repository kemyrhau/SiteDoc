import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaTimer } from "@sitedoc/db-timer";
import {
  effektivKortByggeplass,
  egetReiseKort,
  jobberFraArbeidsrader,
  OVERFORING_KORT_BYGGEPLASS,
  utledKortId,
  utledReiseKortId,
  velgReiseKort,
} from "@sitedoc/shared";

/**
 * w12 steg 1 — utfyllingen av kort-id på reiserader (web-timeforing-plan.md § 4.11 del E og
 * del H punkt 2) mot EKTE Postgres (lokal engangs-DB, aldri test/prod).
 *
 *  - Riktig kort pr. reiserad (lik underprosjekt, så lik byggeplass, så retning; uten retning
 *    med og uten klokkeslett; attestert reise; reise uten jobb; erstattet jobb teller ikke;
 *    en jobb på en annen sedel er aldri kandidat).
 *  - PARITET (flyttet i w15c, plan § 4.15 del F punkt 2 og del H 3): samme sedler gjennom de to
 *    migreringene etter hverandre (w12, så w15c) gir samme kort som den delte regelen
 *    (`velgReiseKort` + `egetReiseKort`, slik `sikreKortId` kjører dem).
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
const W15C_SQL = readFileSync(
  join(ROT, "db-timer", "prisma", "migrations", "20261121120000_w15c_reise_kort", "migration.sql"),
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
// w15c: to sedler til (bilde 8, kontorreiser, kollisjon; tilfelle b i løsningen).
const S3 = id("43");
const S4 = id("44");
const P3 = id("13"); // prosjektet sedel S4 sin byggeplass hører til
const SOMMER = id("23"); // P1, sedelens byggeplass på S3 («sommerfeldtsgt 65»)
const NARVIK = id("24"); // P1, ingen jobb der
const P3BP = id("25"); // P3
const TILL2 = id("63");
const DATO3 = "2026-11-20";
const DATO4 = "2026-11-21";
const K3 = { sommer: "kort-s3-sommer", end: "kort-s3-end", s4: "kort-s4" };
const W3 = { a: id("91"), b: id("92"), c: id("93"), s4: id("94") };
const R3 = {
  narvik: id("a1"),
  narvikAttestert: id("a2"),
  riktig: id("a3"),
  tilEnd: id("a4"),
  kontorEtter: id("a5"),
  kontorFoer: id("a6"),
  kontorRetur: id("a7"),
  ecoUtenJobb: id("a8"),
  kollisjon: id("a9"),
  sedelAnnetProsjekt: id("aa"),
  utenKortAttestert: id("ab"),
};
const KOLLISJON_KORT = utledKortId({ userId: USER, dato: DATO3, nokkel: { projectId: P1, byggeplassId: SOMMER, ecoId: TILL2 } });
const ALLE_SEDLER = [S1, S2, S3, S4];

async function ryddOpp() {
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.daily_sheets WHERE id IN ('${ALLE_SEDLER.join("','")}')`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.lonnsarter WHERE id = '${LONNSART}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.aktiviteter WHERE id = '${AKTIVITET}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.byggeplasser WHERE id IN ('${STORGATA}','${ANNEN}','${SOMMER}','${NARVIK}','${P3BP}')`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.projects WHERE id IN ('${P1}','${P2}','${P3}')`);
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
  kilde?: string | null;
  opprettet: string;
};

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v}'`);
async function settInn(rader: Rad[]) {
  for (const r of rader) {
    await prismaTimer.$executeRawUnsafe(`INSERT INTO timer.sheet_timer (id, sheet_id, lonnsart_id, aktivitet_id, project_id, byggeplass_id,
        external_cost_object_id, fra_tid, til_tid, er_reise, reise_retning, reise_kilde, attestert_status, kort_id, timer, created_at, updated_at)
      VALUES ('${r.id}', '${r.sheet}', '${LONNSART}', '${AKTIVITET}', '${r.prosjekt}', ${q(r.bp)}, ${q(r.eco)}, ${q(r.fra)},
        ${q(r.til)}, ${r.reise ?? false}, ${q(r.retning)}, ${q(r.kilde)}, '${r.status ?? "pending"}', ${q(r.kort)}, 1,
        '${r.opprettet}', '2026-11-18T12:00:00Z')`);
  }
}

async function seed() {
  const x = (s: string) => prismaTimer.$executeRawUnsafe(s);
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
  await settInn(rader);
}

/**
 * w15c: S3 og S4 slik w12 og `sikreKortId` (før w15c) har lagt dem — reisene står i jobber etter
 * gammel regel. Legges inn etter w12-delen, så w12-tellingene står.
 */
async function seedW15c() {
  const x = (s: string) => prismaTimer.$executeRawUnsafe(s);
  await x(`INSERT INTO public.projects (id, project_number, name, updated_at) VALUES ('${P3}', 'W15C-3', 'P3', now())`);
  await x(`INSERT INTO public.byggeplasser (id, project_id, name, updated_at) VALUES
    ('${SOMMER}', '${P1}', 'sommerfeldtsgt 65', now()), ('${NARVIK}', '${P1}', 'Narvik', now()), ('${P3BP}', '${P3}', 'P3-plass', now())`);
  await x(`INSERT INTO timer.daily_sheets (id, client_uuid, organization_id, user_id, registrert_av_user_id, dato, byggeplass_id, updated_at) VALUES
    ('${S3}', '${S3}', '${ORG}', '${USER}', '${USER}', '${DATO3}', '${SOMMER}', '2026-11-20T20:00:00Z'),
    ('${S4}', '${S4}', '${ORG}', '${USER}', '${USER}', '${DATO4}', '${P3BP}', '2026-11-21T20:00:00Z')`);
  const t = (n: number) => `2026-11-20T10:00:${String(n).padStart(2, "0")}Z`;
  await settInn([
    // Jobbene på S3: «sommerfeldtsgt 65 · uten» 07–12 (arver sedelens byggeplass), END 13–14, og en
    // jobb som har byttet underprosjekt og beholdt id-en (flyttHeleJobben, F25-kollisjonen).
    { id: W3.a, sheet: S3, prosjekt: P1, fra: "07:00", til: "12:00", kort: K3.sommer, opprettet: t(1) },
    { id: W3.b, sheet: S3, prosjekt: P1, bp: SOMMER, eco: END, fra: "13:00", til: "14:00", kort: K3.end, opprettet: t(2) },
    { id: W3.c, sheet: S3, prosjekt: P1, bp: SOMMER, eco: END, fra: "15:00", til: "16:00", kort: KOLLISJON_KORT, opprettet: t(3) },
    // Bilde 8: reisen 12–15 til Narvik, uten retning, står i jobben (flyttes) — og en attestert (står).
    { id: R3.narvik, sheet: S3, prosjekt: P1, bp: NARVIK, reise: true, fra: "12:00", til: "15:00", kort: K3.sommer, opprettet: t(10) },
    { id: R3.narvikAttestert, sheet: S3, prosjekt: P1, bp: NARVIK, reise: true, fra: "16:00", til: "17:00", status: "attestert", kort: K3.sommer, opprettet: t(11) },
    // Står riktig: røres ikke.
    { id: R3.riktig, sheet: S3, prosjekt: P1, reise: true, retning: "ut", fra: "06:30", til: "07:00", kort: K3.sommer, opprettet: t(12) },
    // Skal til en annen jobb på samme byggeplass (END), status returnert flyttes.
    { id: R3.tilEnd, sheet: S3, prosjekt: P1, bp: SOMMER, eco: END, reise: true, retning: "ut", fra: "12:45", til: "13:00", status: "returnert", kort: K3.sommer, opprettet: t(13) },
    // Kontorreiser (uten byggeplass): etter arbeid → eget; før → første; retur → siste «Uten».
    { id: R3.kontorEtter, sheet: S3, prosjekt: P1, reise: true, retning: "ut", kilde: "overforing", fra: "12:00", til: "13:00", kort: K3.sommer, opprettet: t(14) },
    { id: R3.kontorFoer, sheet: S3, prosjekt: P1, reise: true, retning: "ut", kilde: "overforing", fra: "05:00", til: "06:00", kort: null, opprettet: t(15) },
    { id: R3.kontorRetur, sheet: S3, prosjekt: P1, reise: true, retning: "retur", kilde: "overforing", fra: "17:00", til: "18:00", kort: K3.sommer, opprettet: t(16) },
    // Underprosjekt ingen jobb har → eget kort; og kollisjonen: utledet id = en jobbs → reise-id.
    { id: R3.ecoUtenJobb, sheet: S3, prosjekt: P1, bp: SOMMER, eco: TILL, reise: true, retning: "ut", kort: K3.sommer, opprettet: t(17) },
    { id: R3.kollisjon, sheet: S3, prosjekt: P1, bp: SOMMER, eco: TILL2, reise: true, retning: "retur", kort: K3.end, opprettet: t(18) },
    // Attestert reise uten kort-id (w12 har ikke kjørt på den): regelen gir den kort.
    { id: R3.utenKortAttestert, sheet: S3, prosjekt: P1, bp: NARVIK, reise: true, retning: "retur", status: "attestert", kort: null, opprettet: t(19) },
    // Tilfelle (b): sedelens byggeplass hører til P3; reisen på P1 uten egen byggeplass har effektiv «uten».
    { id: W3.s4, sheet: S4, prosjekt: P1, bp: STORGATA, fra: "07:00", til: "15:00", kort: K3.s4, opprettet: t(20) },
    { id: R3.sedelAnnetProsjekt, sheet: S4, prosjekt: P1, reise: true, retning: "ut", fra: "06:00", til: "07:00", kort: K3.s4, opprettet: t(21) },
  ]);
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

/**
 * Den delte regelen på radene slik de står i databasen nå — som `sikreKortId` kjører den:
 * attestert eller erstattet reise med kort-id står; ellers `velgReiseKort` (effektiv byggeplass,
 * kontorreise), så `egetReiseKort`.
 */
async function kortEtterDeltRegel(): Promise<Record<string, string | null>> {
  const sedler = await prismaTimer.$queryRawUnsafe<
    { id: string; user_id: string; dato: string; bp: string | null; bp_prosjekt: string | null }[]
  >(`SELECT ds.id, ds.user_id, to_char(ds.dato, 'YYYY-MM-DD') AS dato, ds.byggeplass_id AS bp, b.project_id AS bp_prosjekt
       FROM timer.daily_sheets ds LEFT JOIN public.byggeplasser b ON b.id = ds.byggeplass_id
      WHERE ds.id IN ('${ALLE_SEDLER.join("','")}')`);
  const rader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: { in: ALLE_SEDLER } } });
  const ut: Record<string, string | null> = {};
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
    for (const r of paaSedel.filter((x) => x.erReise)) {
      if (r.kortId && (r.attestertStatus === "attestert" || r.attestertStatus === "erstattet")) {
        ut[r.id] = r.kortId;
        continue;
      }
      const nokkel = {
        projectId: r.projectId,
        byggeplassId: effektivKortByggeplass(r.projectId, r.byggeplassId, sedelBp),
        ecoId: r.externalCostObjectId,
      };
      const overforing = r.reiseKilde === "overforing";
      ut[r.id] =
        velgReiseKort(
          { projectId: r.projectId, ecoId: r.externalCostObjectId, byggeplassId: nokkel.byggeplassId, retning: r.reiseRetning, fraTid: r.fraTid, overforing },
          jobber,
        ) ?? egetReiseKort({ userId: s.user_id, dato: s.dato, nokkel, overforing, jobbKortIder: jobber.map((j) => j.kortId) });
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

describe("w15c utfylling — reisens kort etter den nye regelen (§ 4.15 del E, del F 2, del H 3)", () => {
  let foer: Record<string, unknown>;
  let etterW12: Record<string, string | null>;
  const kort = (byggeplassId: string | null, ecoId: string | null, dato = DATO3) =>
    utledKortId({ userId: USER, dato, nokkel: { projectId: P1, byggeplassId, ecoId } });
  const reiseKort = (byggeplassId: string | null, ecoId: string | null) =>
    utledReiseKortId({ userId: USER, dato: DATO3, nokkel: { projectId: P1, byggeplassId, ecoId } });

  it("stille tomhet: etter w12 står reiser i feil kort, og en tom utfylling lar dem stå", async () => {
    await seedW15c();
    await kjorUtfylling(W12_SQL); // sedlene slik de står etter w12 i test og prod
    foer = await radeneUtenKort();
    const regel = await kortEtterDeltRegel();
    const naa = await kortPr();
    etterW12 = naa;
    const feil = Object.keys(regel).filter((id) => regel[id] !== naa[id]);
    expect(feil.length).toBeGreaterThanOrEqual(7);
    await kjorUtfylling("");
    expect(await kortPr()).toEqual(naa);
  });

  it("riktig kort pr. reiserad", async () => {
    await kjorUtfylling(W15C_SQL);
    const k = await kortPr();
    expect(k[R3.narvik]).toBe(kort(NARVIK, null)); // bilde 8: ingen jobb i Narvik → eget kort
    expect(k[R3.narvikAttestert]).toBe(K3.sommer); // attestert flyttes aldri
    expect(k[R3.riktig]).toBe(K3.sommer); // stod riktig
    expect(k[R3.tilEnd]).toBe(K3.end); // underprosjektet er krav: første END-jobb
    expect(k[R3.kontorEtter]).toBe(reiseKort(OVERFORING_KORT_BYGGEPLASS, null)); // del E 6
    expect(k[R3.kontorFoer]).toBe(K3.sommer); // før arbeid: jobben man kjører til
    expect(k[R3.kontorRetur]).toBe(K3.sommer); // retur: siste «Uten»
    expect(k[R3.ecoUtenJobb]).toBe(kort(SOMMER, TILL)); // B48 A: valgt underprosjekt uten jobb → eget
    expect(k[R3.kollisjon]).toBe(reiseKort(SOMMER, TILL2)); // id-en er en jobbs (F25) → reisens egen
    expect(k[R3.kollisjon]).not.toBe(KOLLISJON_KORT);
    // Attestert uten kort-id fikk kort av w12; deretter står den (vakten i `sikreKortId`).
    expect(etterW12[R3.utenKortAttestert]).not.toBeNull();
    expect(k[R3.utenKortAttestert]).toBe(etterW12[R3.utenKortAttestert]);
    expect(k[R3.sedelAnnetProsjekt]).toBe(kort(null, null, DATO4)); // tilfelle (b): «uten byggeplass» er egen verdi
    // Jobbene røres ikke.
    expect([k[W3.a], k[W3.b], k[W3.c], k[W3.s4]]).toEqual([K3.sommer, K3.end, KOLLISJON_KORT, K3.s4]);
  });

  it("PARITET: w12 og w15c etter hverandre gir samme kort som den delte regelen", async () => {
    const regel = await kortEtterDeltRegel();
    const k = await kortPr();
    expect(Object.keys(regel).length).toBe(12 + 11); // S1/S2: 12 reiserader, S3/S4: 11
    for (const id of Object.keys(regel)) expect({ id, kort: k[id] }).toEqual({ id, kort: regel[id] });
  });

  it("ingen andre felt endres — heller ikke updated_at", async () => {
    expect(await radeneUtenKort()).toEqual(foer);
  });

  it("kjørt to ganger gir samme svar", async () => {
    const etter1 = await kortPr();
    await kjorUtfylling(W15C_SQL);
    expect(await kortPr()).toEqual(etter1);
    expect(await radeneUtenKort()).toEqual(foer);
  });
});
