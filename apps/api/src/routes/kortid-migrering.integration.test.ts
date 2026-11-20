import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaTimer } from "@sitedoc/db-timer";
import { utledKortId } from "@sitedoc/shared";

/**
 * Kort-id, ordre b — T3 og T4 (prosjektkort-kortid-spec.md § 9) mot EKTE Postgres
 * (lokal sandkasse `sitedoc_kortid_b`, aldri test/prod).
 *
 * T3: `utledKortId` (ren JS-md5 i packages/shared) gir samme id som SQL-uttrykket i
 *     migreringen for faste vektorer, også med æøå.
 * T4: backfill-setningene, lest ordrett fra migreringsfilene, gir: samme nøkkel på samme
 *     sedel → samme id; ulik nøkkel → ulik id; reise NULL; koblet maskin/vare = radens id;
 *     vare uten sedel NULL; effektiv byggeplass arves bare innen sedelens prosjekt; kjørt to
 *     ganger = samme resultat. Testen nuller kort_id på egne rader først, så den måler
 *     backfillen og ikke skrivevei-koden.
 */

const ROT = join(__dirname, "..", "..", "..", "..", "packages");
const TIMER_SQL = readFileSync(
  join(ROT, "db-timer", "prisma", "migrations", "20261116120000_kortid_fravaer_normtak", "migration.sql"),
  "utf8",
);
const VARE_SQL = readFileSync(
  join(ROT, "db-varelager", "prisma", "migrations", "20261116120100_kortid_vareforbruk", "migration.sql"),
  "utf8",
);

/** Setningene merket `-- BACKFILL n:` i migreringen, i rekkefølge. */
function backfillSetninger(sql: string): string[] {
  return sql
    .split(/^-- BACKFILL \d+:.*$/m)
    .slice(1)
    .map((del) => del.slice(0, del.indexOf(";") + 1).trim())
    .filter((s) => s.startsWith("UPDATE"));
}

const id = (n: string) => `aa1d0b00-0000-0000-0000-0000000000${n}`;
const ORG = id("01");
const PROSJEKT_1 = id("11");
const PROSJEKT_2 = id("12");
const BYGGEPLASS_1 = id("21"); // hører til PROSJEKT_1
const USER = id("31");
const SEDEL = id("41");
const LONNSART = id("51");
const AKTIVITET = id("52");
const TILLEGG = id("53");
const KATEGORI = id("54");
const VARE = id("55");
const ECO = id("61");
const DATO = "2026-11-16";

const RAD = { p1a: id("71"), p1b: id("72"), p2: id("73"), reise: id("74"), p1eco: id("75") };
const MASKIN = { koblet: id("81"), ukoblet: id("82") };
const FORSLAG = { arbeid: id("91"), reise: id("92") };
const VAREL = { koblet: id("a1"), medSedel: id("a2"), utenSedel: id("a3") };

async function ryddOpp() {
  await prismaTimer.$executeRawUnsafe(`DELETE FROM varelager.vareforbruk WHERE id IN ('${Object.values(VAREL).join("','")}')`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM varelager.varer WHERE id = '${VARE}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.daily_sheets WHERE id = '${SEDEL}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.lonnsarter WHERE id = '${LONNSART}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.aktiviteter WHERE id = '${AKTIVITET}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.tillegg WHERE id = '${TILLEGG}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM timer.expense_categories WHERE id = '${KATEGORI}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.byggeplasser WHERE id = '${BYGGEPLASS_1}'`);
  await prismaTimer.$executeRawUnsafe(`DELETE FROM public.projects WHERE id IN ('${PROSJEKT_1}','${PROSJEKT_2}')`);
}

async function seed() {
  const x = (s: string) => prismaTimer.$executeRawUnsafe(s);
  await x(`INSERT INTO public.projects (id, project_number, name, updated_at) VALUES
    ('${PROSJEKT_1}', 'KID-1', 'P1', now()), ('${PROSJEKT_2}', 'KID-2', 'P2', now())`);
  await x(`INSERT INTO public.byggeplasser (id, project_id, name, updated_at) VALUES ('${BYGGEPLASS_1}', '${PROSJEKT_1}', 'B1', now())`);
  await x(`INSERT INTO timer.lonnsarter (id, organization_id, type, navn, updated_at) VALUES ('${LONNSART}', '${ORG}', 'ordinaer', 'Timelønn', now())`);
  await x(`INSERT INTO timer.aktiviteter (id, organization_id, navn, updated_at) VALUES ('${AKTIVITET}', '${ORG}', 'Grunnarbeid', now())`);
  await x(`INSERT INTO timer.tillegg (id, organization_id, navn, type, updated_at) VALUES ('${TILLEGG}', '${ORG}', 'Smuss', 'avhuking', now())`);
  await x(`INSERT INTO timer.expense_categories (id, organization_id, navn, updated_at) VALUES ('${KATEGORI}', '${ORG}', 'Parkering', now())`);
  await x(`INSERT INTO varelager.varer (id, organization_id, navn, enhet, updated_at) VALUES ('${VARE}', '${ORG}', 'Pukk', 'tonn', now())`);
  await x(`INSERT INTO timer.daily_sheets (id, client_uuid, organization_id, user_id, registrert_av_user_id, dato, byggeplass_id, updated_at)
    VALUES ('${SEDEL}', '${SEDEL}', '${ORG}', '${USER}', '${USER}', '${DATO}', '${BYGGEPLASS_1}', now())`);
  const timer = (rid: string, prosjekt: string, eco: string | null, reise: boolean) =>
    x(`INSERT INTO timer.sheet_timer (id, sheet_id, lonnsart_id, aktivitet_id, project_id, external_cost_object_id, er_reise, timer, updated_at)
       VALUES ('${rid}', '${SEDEL}', '${LONNSART}', '${AKTIVITET}', '${prosjekt}', ${eco ? `'${eco}'` : "NULL"}, ${reise}, 2, now())`);
  await timer(RAD.p1a, PROSJEKT_1, null, false);
  await timer(RAD.p1b, PROSJEKT_1, null, false);
  await timer(RAD.p2, PROSJEKT_2, null, false);
  await timer(RAD.reise, PROSJEKT_1, null, true);
  await timer(RAD.p1eco, PROSJEKT_1, ECO, false);
  await x(`INSERT INTO timer.sheet_machines (id, sheet_id, sheet_timer_id, vehicle_id, project_id, timer, updated_at) VALUES
    ('${MASKIN.koblet}', '${SEDEL}', '${RAD.p2}', '${id("e1")}', '${PROSJEKT_2}', 1, now()),
    ('${MASKIN.ukoblet}', '${SEDEL}', NULL, '${id("e2")}', '${PROSJEKT_1}', 1, now())`);
  await x(`INSERT INTO timer.sheet_tillegg (id, sheet_id, tillegg_id, antall, project_id, updated_at) VALUES ('${id("b1")}', '${SEDEL}', '${TILLEGG}', 1, '${PROSJEKT_1}', now())`);
  await x(`INSERT INTO timer.sheet_utlegg (id, sheet_id, project_id, expense_category_id, ordning_ved_foering, belop, updated_at)
    VALUES ('${id("b2")}', '${SEDEL}', '${PROSJEKT_2}', '${KATEGORI}', 'utlegg', 100, now())`);
  await x(`INSERT INTO timer.sheet_timer_forslag (id, sheet_id, project_id, lonnsart_id, aktivitet_id, timer, er_reise) VALUES
    ('${FORSLAG.arbeid}', '${SEDEL}', '${PROSJEKT_1}', '${LONNSART}', '${AKTIVITET}', 2, false),
    ('${FORSLAG.reise}', '${SEDEL}', '${PROSJEKT_1}', '${LONNSART}', '${AKTIVITET}', 1, true)`);
  await x(`INSERT INTO varelager.vareforbruk (id, dato, project_id, vare_id, antall, registrert_av_user_id, dagsseddel_id, sheet_timer_id, updated_at) VALUES
    ('${VAREL.koblet}', '${DATO}', '${PROSJEKT_1}', '${VARE}', 1, '${USER}', '${SEDEL}', '${RAD.p1eco}', now()),
    ('${VAREL.medSedel}', '${DATO}', '${PROSJEKT_2}', '${VARE}', 1, '${USER}', '${SEDEL}', NULL, now()),
    ('${VAREL.utenSedel}', '${DATO}', '${PROSJEKT_1}', '${VARE}', 1, '${USER}', NULL, NULL, now())`);
}

async function nullstillOgKjorBackfill() {
  for (const t of ["sheet_timer", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer_forslag"])
    await prismaTimer.$executeRawUnsafe(`UPDATE timer.${t} SET kort_id = NULL WHERE sheet_id = '${SEDEL}'`);
  await prismaTimer.$executeRawUnsafe(
    `UPDATE varelager.vareforbruk SET kort_id = NULL WHERE id IN ('${Object.values(VAREL).join("','")}')`,
  );
  for (const s of [...backfillSetninger(TIMER_SQL), ...backfillSetninger(VARE_SQL)]) await prismaTimer.$executeRawUnsafe(s);
}

async function kortIder(): Promise<Record<string, string | null>> {
  const rader = await prismaTimer.$queryRawUnsafe<{ id: string; kort_id: string | null }[]>(`
    SELECT id, kort_id FROM timer.sheet_timer WHERE sheet_id = '${SEDEL}'
    UNION ALL SELECT id, kort_id FROM timer.sheet_machines WHERE sheet_id = '${SEDEL}'
    UNION ALL SELECT id, kort_id FROM timer.sheet_tillegg WHERE sheet_id = '${SEDEL}'
    UNION ALL SELECT id, kort_id FROM timer.sheet_utlegg WHERE sheet_id = '${SEDEL}'
    UNION ALL SELECT id, kort_id FROM timer.sheet_timer_forslag WHERE sheet_id = '${SEDEL}'
    UNION ALL SELECT id, kort_id FROM varelager.vareforbruk WHERE id IN ('${Object.values(VAREL).join("','")}')`);
  return Object.fromEntries(rader.map((r) => [r.id, r.kort_id]));
}

const forventet = (prosjekt: string, bp: string | null, eco: string | null) =>
  utledKortId({ userId: USER, dato: DATO, nokkel: { projectId: prosjekt, byggeplassId: bp, ecoId: eco } });

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("T3 — utledKortId = SQL-uttrykket", () => {
  it("faste vektorer, også æøå og «ingen»", async () => {
    const vektorer = [
      { userId: "u1", dato: "2026-11-16", nokkel: { projectId: "p1", byggeplassId: null, ecoId: null } },
      { userId: USER, dato: "2025-01-02", nokkel: { projectId: PROSJEKT_1, byggeplassId: BYGGEPLASS_1, ecoId: ECO } },
      { userId: "ø-bruker", dato: "2026-12-31", nokkel: { projectId: "grøft æøå", byggeplassId: null, ecoId: "skifer" } },
      { userId: "u1", dato: "2026-11-16", nokkel: { projectId: null, byggeplassId: null, ecoId: null } },
    ];
    for (const v of vektorer) {
      const k = v.nokkel;
      const [rad] = await prismaTimer.$queryRaw<{ id: string }[]>`
        SELECT md5('kort|' || ${v.userId} || '|' || to_char(${v.dato}::date, 'YYYY-MM-DD') || '|' || coalesce(${k.projectId}::text, 'ingen')
          || '|' || coalesce(${k.byggeplassId}::text, 'ingen') || '|' || coalesce(${k.ecoId}::text, 'ingen'))::uuid::text AS id`;
      expect(utledKortId(v)).toBe(rad!.id);
    }
  });
});

describe("T4 — backfill (setningene fra migreringsfilene)", () => {
  it("migreringene har backfill-setningene (6 timer + 2 vare)", () => {
    expect(backfillSetninger(TIMER_SQL)).toHaveLength(6);
    expect(backfillSetninger(VARE_SQL)).toHaveLength(2);
  });

  it("riktig id pr. rad, og idempotent", async () => {
    await nullstillOgKjorBackfill();
    const a = await kortIder();
    const p1 = forventet(PROSJEKT_1, BYGGEPLASS_1, null); // arver sedelens byggeplass (hører til P1)
    const p2 = forventet(PROSJEKT_2, null, null); // sedelens byggeplass hører ikke til P2
    const p1eco = forventet(PROSJEKT_1, BYGGEPLASS_1, ECO);

    expect(a[RAD.p1a]).toBe(p1);
    expect(a[RAD.p1b]).toBe(p1); // samme nøkkel, samme sedel → samme kort
    expect(a[RAD.p2]).toBe(p2);
    expect(a[RAD.p1eco]).toBe(p1eco);
    expect(new Set([p1, p2, p1eco]).size).toBe(3);
    // Den gamle utfyllingen lar reise stå uten kort-id. w12 fyller den i egen migrering
    // (`reise-kortid-migrering.integration.test.ts`); denne testen gjelder bare 20261116120000.
    expect(a[RAD.reise]).toBeNull();

    expect(a[MASKIN.koblet]).toBe(a[RAD.p2]); // K6
    expect(a[MASKIN.ukoblet]).toBe(p1);
    expect(a[id("b1")]).toBe(p1); // tillegg
    expect(a[id("b2")]).toBe(p2); // utlegg
    expect(a[FORSLAG.arbeid]).toBe(p1);
    expect(a[FORSLAG.reise]).toBeNull();
    expect(a[VAREL.koblet]).toBe(a[RAD.p1eco]); // K6
    expect(a[VAREL.medSedel]).toBe(p2);
    expect(a[VAREL.utenSedel]).toBeNull();

    // Kjørt en gang til uten nullstilling: ingenting endres.
    for (const s of [...backfillSetninger(TIMER_SQL), ...backfillSetninger(VARE_SQL)]) await prismaTimer.$executeRawUnsafe(s);
    expect(await kortIder()).toEqual(a);
  });

  it("backfillen skriver ikke updated_at", async () => {
    const [før] = await prismaTimer.$queryRawUnsafe<{ u: Date }[]>(`SELECT updated_at u FROM timer.sheet_timer WHERE id = '${RAD.p1a}'`);
    await nullstillOgKjorBackfill();
    const [etter] = await prismaTimer.$queryRawUnsafe<{ u: Date }[]>(`SELECT updated_at u FROM timer.sheet_timer WHERE id = '${RAD.p1a}'`);
    expect(etter!.u.getTime()).toBe(før!.u.getTime());
  });

  it("gate-SQL § 3.4 gir 0 på testens sedel", async () => {
    const [g1] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) n FROM timer.sheet_timer WHERE sheet_id = '${SEDEL}' AND er_reise = false AND kort_id IS NULL`,
    );
    const [g3] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) n FROM timer.sheet_machines m JOIN timer.sheet_timer t ON t.id = m.sheet_timer_id
        WHERE m.sheet_id = '${SEDEL}' AND m.kort_id IS DISTINCT FROM t.kort_id`,
    );
    // Gate-SQL 2 med `coalesce(project_id,'ingen')` (§ 11.2): kort som spenner flere sedler,
    // prosjekter eller underprosjekt — avgrenset til kort som finnes på testens sedel.
    const [g2] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) n FROM (SELECT kort_id FROM timer.sheet_timer
         WHERE kort_id IN (SELECT kort_id FROM timer.sheet_timer WHERE sheet_id = '${SEDEL}')
         GROUP BY kort_id HAVING count(DISTINCT sheet_id) > 1
            OR count(DISTINCT coalesce(project_id,'ingen')) > 1
            OR count(DISTINCT coalesce(external_cost_object_id,'')) > 1) x`,
    );
    const [antall] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) n FROM timer.sheet_timer WHERE sheet_id = '${SEDEL}' AND kort_id IS NOT NULL`,
    );
    // Negativkontroll: gate-SQL på en tom sedel er ingen måling.
    expect(Number(antall!.n)).toBeGreaterThan(0);
    expect(Number(g1!.n)).toBe(0);
    expect(Number(g2!.n)).toBe(0);
    expect(Number(g3!.n)).toBe(0);
  });
});
