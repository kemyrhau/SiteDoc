import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { lonnsartRouter } from "./timer/lonnsart";
import { seedLonnsartNivaa1, seedLonnsartNivaa2 } from "../services/seed";
import { importerKatalog } from "../services/katalog/importerKatalog";

/**
 * Kort-id-spec § 11.10 (B10 — fravær med tak mot dagsnormen), ordre b3 — TF13, TF16 (server),
 * TF17 og TF18 gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse
 * `sitedoc_kortid_b3`, aldri test/prod). Data med faste id-er (prefiks b10a7a00), ryddes i afterAll.
 *
 * TF13 Kolonnen: NOT NULL DEFAULT true; backfill-setningen (lest ordrett fra migreringen) gir
 *      false for ubetalte arter og F10-artene; seed nivå 1 og 2; opprett/oppdater/import uten felt → true.
 * TF16 Ukegrunnlaget: fravær fyller bare dagens norm i ukesummen, er aldri arbeid eller overtid.
 * TF17 Skriveveiene: fravær med tak over taket avvises med tallene; arbeid og fravær uten tak
 *      avvises aldri; senking godtas; syncBatch lagrer og returnerer bruddet; firma-isolasjon.
 * TF18 F9 = A: attester og attesterRader avvises for dato i brudd og går gjennom etter retting;
 *      returner virker; attestert snapshot er uendret.
 */

const ROT = join(__dirname, "..", "..", "..", "..", "packages");
const TIMER_SQL = readFileSync(
  join(ROT, "db-timer", "prisma", "migrations", "20261116120000_kortid_fravaer_normtak", "migration.sql"),
  "utf8",
);
/** Setningen under `-- B10-BACKFILL:` i migreringen. */
function b10Backfill(): string {
  const del = TIMER_SQL.split(/^-- B10-BACKFILL:.*$/m)[1];
  if (!del) throw new Error("B10-BACKFILL-markøren mangler i migreringen");
  return del.slice(0, del.indexOf(";")).trim();
}

const id = (n: string) => `b10a7a00-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02"); // dagsnorm 10 — firma-isolasjon
const ORG_SEED = id("03");
const USER = id("04");
const USER_B = id("05"); // arbeider i ORG2
const USER_C = id("06"); // TF16 — egen uke
const FADMIN = id("07");
const ADMIN = id("08"); // sitedoc_admin (redigerSedelRader)
const LEDER = id("09");
const BRUKERE = [USER, USER_B, USER_C, FADMIN, ADMIN, LEDER];
const P1 = id("11");
const ORD = id("41");
const EGEN = id("42"); // Egenmelding — tak
const FERIE = id("43"); // Ferie m/lønn — uten tak
const PRIVAT = id("44"); // Privat ærend — uten tak
const AKT = id("45");
const ORD2 = id("46");
const EGEN2 = id("47");
const AKT2 = id("48");
const ARTER = [ORD, EGEN, FERIE, PRIVAT, ORD2, EGEN2];

function ctx(userId: string) {
  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager,
    userId,
    actualUserId: userId,
    imperseringAktiv: false,
    sessionToken: null,
    tokenKilde: null,
    ipAddress: null,
    userAgent: null,
    req: { log: { info: () => {}, warn: () => {}, error: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));
const lonnsart = (userId: string) => lonnsartRouter.createCaller(ctx(userId));

let datoTeller = 0;
/** Unik dato pr. sedel (oktober 2026, utenfor TF16-uka). */
function nyDato(): string {
  return new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

async function nySedel(opts: { userId?: string; org?: string; status?: string; dato?: string } = {}) {
  const sid = randomUUID();
  const userId = opts.userId ?? USER;
  const org = opts.org ?? ORG;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: org,
      userId,
      registrertAvUserId: userId,
      aktivitetId: org === ORG2 ? AKT2 : AKT,
      dato: new Date(opts.dato ?? nyDato()),
      status: opts.status ?? "draft",
    },
  });
  return sid;
}
/** Rå arbeidsrad på P1. */
async function arbeid(sheetId: string, timer = 2, f: { org?: string } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: P1,
      lonnsartId: f.org === ORG2 ? ORD2 : ORD,
      aktivitetId: f.org === ORG2 ? AKT2 : AKT,
      fraTid: "07:00",
      tilTid: `${String(7 + Math.ceil(timer)).padStart(2, "0")}:00`,
      timer,
    },
  });
  return r.id;
}
/** Rå fraværsrad uten prosjekt. */
async function fravaer(sheetId: string, timer: number, lonnsartId = EGEN, akt = AKT) {
  const r = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: null, utenProsjekt: true, lonnsartId, aktivitetId: akt, timer },
  });
  return r.id;
}
const aktiveRader = (sid: string) =>
  prismaTimer.sheetTimer.findMany({
    where: { sheetId: sid, attestertStatus: { not: "erstattet" } },
    select: { id: true, lonnsartId: true, timer: true, attestertStatus: true, attestertSnapshot: true },
  });
const status = async (sid: string) => (await prismaTimer.dailySheet.findUnique({ where: { id: sid } }))!.status;

// ── Oppsett / rydding ───────────────────────────────────────────────────────
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { organizationId: { in: [ORG, ORG2, ORG_SEED] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { organizationId: { in: [ORG, ORG2, ORG_SEED] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: P1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2, ORG_SEED] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2, ORG_SEED] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2, ORG_SEED] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2, ORG_SEED] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "normtak-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: USER_B, email: "normtak-arbeider-b@sitedoc.test", name: "Arbeider B", role: "user" },
      { id: USER_C, email: "normtak-arbeider-c@sitedoc.test", name: "Arbeider C", role: "user" },
      { id: FADMIN, email: "normtak-fadmin@sitedoc.test", name: "Lønn", role: "user" },
      { id: ADMIN, email: "normtak-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
      { id: LEDER, email: "normtak-leder@sitedoc.test", name: "Leder", role: "user" },
    ],
  });
  await prisma.organization.createMany({
    data: [
      { id: ORG, name: "Normtak-firma" },
      { id: ORG2, name: "Normtak-firma 2" },
      { id: ORG_SEED, name: "Normtak-seed" },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: USER_C, organizationId: ORG, status: "aktiv" },
      { userId: LEDER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: FADMIN, organizationId: ORG_SEED, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: USER_B, organizationId: ORG2, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [ORG, ORG2, ORG_SEED].map((o) => ({ organizationId: o, moduleSlug: "timer", status: "aktiv" })),
  });
  await prisma.organizationSetting.createMany({
    data: [
      { organizationId: ORG, dagsnorm: 7.5, tillattRedigerVedAttestering: true },
      { organizationId: ORG2, dagsnorm: 10 },
      { organizationId: ORG_SEED },
    ],
  });
  await prisma.project.create({
    data: { id: P1, projectNumber: "NTAK-1", name: "Normtak P1", primaryOrganizationId: ORG },
  });
  await prisma.projectOrganization.createMany({
    data: [
      { projectId: P1, organizationId: ORG },
      { projectId: P1, organizationId: ORG2, rolle: "underentreprenor" },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: USER, projectId: P1, role: "member" },
      { userId: USER_B, projectId: P1, role: "member" },
      { userId: USER_C, projectId: P1, role: "member" },
      { userId: LEDER, projectId: P1, role: "admin" },
    ],
  });
  await prisma.projectModule.create({
    data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: EGEN, organizationId: ORG, type: "fravaer", navn: "Egenmelding", aktiv: true },
      { id: FERIE, organizationId: ORG, type: "fravaer", navn: "Ferie m/lønn", fravaerNormtak: false, aktiv: true },
      { id: PRIVAT, organizationId: ORG, type: "fravaer", navn: "Privat ærend", fravaerNormtak: false, aktiv: true },
      { id: ORD2, organizationId: ORG2, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: EGEN2, organizationId: ORG2, type: "fravaer", navn: "Egenmelding", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.createMany({
    data: [
      { id: AKT, organizationId: ORG, navn: "Grunnarbeid" },
      { id: AKT2, organizationId: ORG2, navn: "Grunnarbeid" },
    ],
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
describe("TF13 — kolonnen, backfill, seed og skrivere", () => {
  it("fravaer_normtak er NOT NULL DEFAULT true (ingen art uten verdi)", async () => {
    const [kol] = await prismaTimer.$queryRawUnsafe<{ is_nullable: string; column_default: string }[]>(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'timer' AND table_name = 'lonnsarter' AND column_name = 'fravaer_normtak'`,
    );
    expect(kol).toEqual({ is_nullable: "NO", column_default: "true" });
  });

  it("backfill: ubetalte arter og F10-artene → false, øvrige fravær → true", async () => {
    const navn: [string, boolean][] = [
      ["Egenmelding inntil 3 dager", true],
      ["Sykemelding fra dag 17", true],
      ["Barns sykdom", true],
      ["Permittering m/lønn", true],
      ["Velferdspermisjon", true],
      ["Ferie m/lønn", false],
      ["Ferie u/lønn", false],
      ["Permittering u/lønn", false],
      ["Permisjon uten lønn", false],
      ["Ubetalt permisjon", false],
      ["Privat ærend", false],
      ["Bevegelig helligdag", false],
    ];
    const ider = navn.map((_, i) => id(`9${i.toString(16)}`));
    await prismaTimer.lonnsart.createMany({
      data: navn.map(([n], i) => ({ id: ider[i]!, organizationId: ORG_SEED, type: "fravaer", navn: n })),
    });
    // Alle starter som kolonnens standard (true) — backfillen er det eneste som setter false.
    expect(await prismaTimer.lonnsart.count({ where: { id: { in: ider }, fravaerNormtak: false } })).toBe(0);
    const avgrenset = `${b10Backfill()} AND "id" IN (${ider.map((x) => `'${x}'`).join(",")})`;
    await prismaTimer.$executeRawUnsafe(avgrenset);
    await prismaTimer.$executeRawUnsafe(avgrenset); // idempotent
    const etter = await prismaTimer.lonnsart.findMany({ where: { id: { in: ider } }, select: { navn: true, fravaerNormtak: true } });
    expect(Object.fromEntries(etter.map((r) => [r.navn, r.fravaerNormtak]))).toEqual(Object.fromEntries(navn));
    await prismaTimer.lonnsart.deleteMany({ where: { id: { in: ider } } });
  });

  it("backfill rører aldri en art som ikke er fravær", async () => {
    const x = id("b0");
    await prismaTimer.lonnsart.create({ data: { id: x, organizationId: ORG_SEED, type: "ordinaer", navn: "Timelønn ubetalt privat" } });
    await prismaTimer.$executeRawUnsafe(`${b10Backfill()} AND "id" = '${x}'`);
    expect((await prismaTimer.lonnsart.findUnique({ where: { id: x } }))!.fravaerNormtak).toBe(true);
    await prismaTimer.lonnsart.delete({ where: { id: x } });
  });

  it("seed nivå 1 og 2 gir verdiene i § 11.10.2", async () => {
    await seedLonnsartNivaa1(ORG_SEED);
    await seedLonnsartNivaa2(ORG_SEED);
    const fravaer = await prismaTimer.lonnsart.findMany({
      where: { organizationId: ORG_SEED, type: "fravaer" },
      select: { navn: true, fravaerNormtak: true },
    });
    const verdi = Object.fromEntries(fravaer.map((r) => [r.navn, r.fravaerNormtak]));
    expect(verdi).toMatchObject({
      "Egenmelding inntil 3 dager": true,
      "Sykemelding fra dag 17": true,
      "Barns sykdom": true,
      "Permittering m/lønn": true,
      Velferdspermisjon: true,
      "Ferie m/lønn": false,
      "Ferie u/lønn": false,
      "Permittering u/lønn": false,
      "Bevegelig helligdag": false,
    });
    // Ingen fravær-art fra seed står uten verdi (kolonnen er NOT NULL — her: alle er sjekket).
    expect(fravaer.length).toBeGreaterThanOrEqual(10);
    await prismaTimer.lonnsart.deleteMany({ where: { organizationId: ORG_SEED } });
  });

  it("opprett og oppdater: uten feltet → true; false lagres og leses tilbake", async () => {
    const a = await lonnsart(FADMIN).opprett({ organizationId: ORG_SEED, type: "fravaer", navn: "Velferd test" });
    expect(a.fravaerNormtak).toBe(true);
    const b = await lonnsart(FADMIN).opprett({
      organizationId: ORG_SEED, type: "fravaer", navn: "Privat test", fravaerNormtak: false,
    });
    expect(b.fravaerNormtak).toBe(false);
    await lonnsart(FADMIN).oppdater({ id: a.id, organizationId: ORG_SEED, fravaerNormtak: false });
    expect((await prismaTimer.lonnsart.findUnique({ where: { id: a.id } }))!.fravaerNormtak).toBe(false);
    await lonnsart(FADMIN).oppdater({ id: a.id, organizationId: ORG_SEED, navn: "Velferd test 2" });
    expect((await prismaTimer.lonnsart.findUnique({ where: { id: a.id } }))!.fravaerNormtak).toBe(false);
    await prismaTimer.lonnsart.deleteMany({ where: { organizationId: ORG_SEED } });
  });

  it("katalogimport: uten feltet → true; med false → false", async () => {
    await importerKatalog(
      ORG_SEED,
      {
        lonnsarter: [
          { kode: "N1", navn: "Sykemelding import", type: "fravaer" },
          { kode: "N2", navn: "Fri import", type: "fravaer", fravaerNormtak: false },
        ],
        aktiviteter: [],
        tillegg: [],
      },
      { dryRun: false, deaktiverUmatchede: { lonnsarter: false, aktiviteter: false, tillegg: false } },
    );
    const rader = await prismaTimer.lonnsart.findMany({ where: { organizationId: ORG_SEED }, select: { kode: true, fravaerNormtak: true } });
    expect(Object.fromEntries(rader.map((r) => [r.kode, r.fravaerNormtak]))).toEqual({ N1: true, N2: false });
    await prismaTimer.lonnsart.deleteMany({ where: { organizationId: ORG_SEED } });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF17 — interaktive skriveveier og syncBatch", () => {
  it("tilfoyTimerRad: egenmelding over taket avvises med tallene, ingenting skrevet", async () => {
    const sid = await nySedel();
    await arbeid(sid, 2);
    await expect(
      dag().tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 7.5 }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Egenmelding kan høyst være 5,5 t denne dagen — 2,0 t arbeid er ført",
    });
    expect(await aktiveRader(sid)).toHaveLength(1);
    // Nøyaktig resten godtas.
    await dag().tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 5.5 });
    expect(await aktiveRader(sid)).toHaveLength(2);
  });

  it("blanding (F10): privat ærend 2 + arbeid 2 → egenmelding høyst 3,5", async () => {
    const sid = await nySedel();
    await arbeid(sid, 2);
    await fravaer(sid, 2, PRIVAT);
    await expect(
      dag().tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 4 }),
    ).rejects.toMatchObject({
      message: "Egenmelding kan høyst være 3,5 t denne dagen — 2,0 t arbeid og 2,0 t annet fravær er ført",
    });
  });

  it("arbeid som setter dagen i brudd avvises aldri (N4); bruddet vises", async () => {
    const sid = await nySedel();
    await fravaer(sid, 7.5);
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2,
    });
    expect(await aktiveRader(sid)).toHaveLength(2);
  });

  it("fravær uten tak avvises aldri, heller ikke over normen", async () => {
    const sid = await nySedel();
    await arbeid(sid, 2);
    await dag().tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: FERIE, aktivitetId: AKT, timer: 7.5 });
    expect(await aktiveRader(sid)).toHaveLength(2);
  });

  it("oppdaterTimerRad: senking på dag i brudd godtas, økning avvises", async () => {
    const sid = await nySedel();
    await arbeid(sid, 2);
    const f = await fravaer(sid, 7.5); // i brudd (eldre klient / rad fra før)
    await dag().oppdaterTimerRad({ id: f, timer: 6 }); // senker, fortsatt i brudd → godtas
    await expect(dag().oppdaterTimerRad({ id: f, timer: 7 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await dag().oppdaterTimerRad({ id: f, timer: 5.5 });
    expect(Number((await prismaTimer.sheetTimer.findUnique({ where: { id: f } }))!.timer)).toBe(5.5);
  });

  it("oppdaterTimerRad: bytte fra art uten tak til art med tak klemmes av taket", async () => {
    const sid = await nySedel();
    await arbeid(sid, 2);
    const f = await fravaer(sid, 7.5, FERIE);
    await expect(dag().oppdaterTimerRad({ id: f, lonnsartId: EGEN })).rejects.toMatchObject({
      message: "Egenmelding kan høyst være 5,5 t denne dagen — 2,0 t arbeid er ført",
    });
  });

  it("redigerSedelRader: økning over taket avvises, senking på dag i brudd godtas", async () => {
    const sid = await nySedel({ status: "sent" });
    const a = await arbeid(sid, 2);
    const f = await fravaer(sid, 5.5);
    const sett = (timer: number, ider: { a: string; f: string }) => ({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: ider.a, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2, pauseMin: 0 },
          { originalId: ider.f, projectId: null, utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer, pauseMin: 0 },
        ],
        tillegg: [],
        maskin: [],
      },
    });
    await expect(dag(ADMIN).redigerSedelRader(sett(7.5, { a, f }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await aktiveRader(sid)).map((r) => Number(r.timer)).sort()).toEqual([2, 5.5]);

    // Dag i brudd fra før (eldre klient): attestanten retter ned → godtas.
    const sid2 = await nySedel({ status: "sent" });
    const a2 = await arbeid(sid2, 2);
    const f2 = await fravaer(sid2, 7.5);
    await dag(ADMIN).redigerSedelRader({ ...sett(6, { a: a2, f: f2 }), sheetId: sid2 });
    expect((await aktiveRader(sid2)).map((r) => Number(r.timer)).sort()).toEqual([2, 6]);
  });

  it("syncBatch lagrer alltid og returnerer bruddet (F9 = A)", async () => {
    const cu = randomUUID();
    const dato = nyDato();
    const svar = await dag().syncBatch({
      sedler: [
        {
          clientUuid: cu, projectId: P1, aktivitetId: AKT, dato, status: "draft", pauseMin: 0,
          timer: [
            { id: randomUUID(), projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 2, fraTid: "07:00", tilTid: "09:00", pauseMin: 0 },
            { id: randomUUID(), utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 7.5, fraTid: null, tilTid: null, pauseMin: 0, beskrivelse: "Syk" },
          ],
          tillegg: [], maskiner: [], utlegg: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    const r = svar.resultater[0]!;
    expect(r.resultat).toBe("ok");
    expect(r.fravaerNormtakBrudd).toEqual({
      artNavn: "Egenmelding", fravaerMedTak: 7.5, arbeid: 2, fravaerUtenTak: 0, dagsnorm: 7.5, tak: 5.5,
    });
    const sedel = await prismaTimer.dailySheet.findUnique({ where: { clientUuid: cu } });
    expect(await aktiveRader(sedel!.id)).toHaveLength(2);
  });

  it("syncBatch uten brudd har ikke feltet", async () => {
    const svar = await dag().syncBatch({
      sedler: [
        {
          clientUuid: randomUUID(), projectId: null, aktivitetId: AKT, dato: nyDato(), status: "draft", pauseMin: 0,
          timer: [
            { id: randomUUID(), utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 7.5, fraTid: null, tilTid: null, pauseMin: 0, beskrivelse: "Syk" },
          ],
          tillegg: [], maskiner: [], utlegg: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    expect(svar.resultater[0]!.resultat).toBe("ok");
    expect(svar.resultater[0]!.fravaerNormtakBrudd).toBeUndefined();
  });

  it("firma-isolasjon: normen leses fra sedelens firma (ORG2 har 10 t)", async () => {
    const sid = await nySedel({ userId: USER_B, org: ORG2 });
    await arbeid(sid, 2, { org: ORG2 });
    // 2 + 7,5 = 9,5 ≤ 10 i ORG2 — ville vært brudd med ORG sin norm (7,5).
    await dag(USER_B).tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: EGEN2, aktivitetId: AKT2, timer: 7.5 });
    await expect(
      dag(USER_B).tilfoyTimerRad({ sheetId: sid, utenProsjekt: true, lonnsartId: EGEN2, aktivitetId: AKT2, timer: 1 }),
    ).rejects.toMatchObject({ message: "Egenmelding kan høyst være 0,5 t denne dagen — 2,0 t arbeid og 7,5 t annet fravær er ført" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF18 — attesteringssperren (F9 = A)", () => {
  it("attester og attesterRader avvises for dato i brudd; returner virker", async () => {
    const sid = await nySedel({ status: "sent" });
    const a = await arbeid(sid, 2);
    await fravaer(sid, 7.5);
    const sperre = /Egenmelding 7,5 t \+ arbeid 2,0 t = 9,5 t — over dagsnormen 7,5 t/;
    await expect(dag(FADMIN).attester({ id: sid })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(sperre) });
    // Også når bare arbeidsraden velges — hele datoen er sperret.
    await expect(dag(FADMIN).attesterRader({ radIder: { timerIder: [a] } })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect((await aktiveRader(sid)).every((r) => r.attestertStatus === "pending")).toBe(true);
    await dag(FADMIN).returner({ id: sid, kommentar: "Egenmeldingen er over taket" });
    expect(await status(sid)).not.toBe("sent");
  });

  it("går gjennom etter retting (redigerSedelRader senker fraværet)", async () => {
    const sid = await nySedel({ status: "sent" });
    const a = await arbeid(sid, 2);
    const f = await fravaer(sid, 7.5);
    await dag(ADMIN).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: a, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2, pauseMin: 0 },
          { originalId: f, projectId: null, utenProsjekt: true, lonnsartId: EGEN, aktivitetId: AKT, timer: 5.5, pauseMin: 0 },
        ],
        tillegg: [],
        maskin: [],
      },
    });
    await dag(FADMIN).attester({ id: sid });
    expect(await status(sid)).toBe("accepted");
  });

  it("attestert snapshot er uendret når dagen senere kommer i brudd", async () => {
    const sid = await nySedel({ status: "sent" });
    const f = await fravaer(sid, 5.5);
    await dag(FADMIN).attesterRader({ radIder: { timerIder: [f] } });
    const foer = (await aktiveRader(sid)).find((r) => r.id === f)!;
    expect(foer.attestertStatus).toBe("attestert");
    const a = await arbeid(sid, 4); // 4 + 5,5 > 7,5
    await expect(dag(FADMIN).attesterRader({ radIder: { timerIder: [a] } })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    const etter = (await aktiveRader(sid)).find((r) => r.id === f)!;
    expect(etter).toEqual(foer);
  });

  it("attester sperrer når fraværet alt er attestert og arbeid senere gir brudd (N5)", async () => {
    // RETUR (30) A1: bare arbeidsrader er pending, men datoen er i brudd.
    const sid = await nySedel({ status: "sent" });
    await arbeid(sid, 1);
    const f = await fravaer(sid, 5.5);
    await dag(FADMIN).attesterRader({ radIder: { timerIder: [f] } });
    expect(await status(sid)).toBe("sent");
    await arbeid(sid, 4); // 1 + 4 + 5,5 = 10,5 > 7,5
    await expect(dag(FADMIN).attester({ id: sid })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/Egenmelding 5,5 t \+ arbeid 5,0 t = 10,5 t — over dagsnormen 7,5 t/),
    });
    expect(await status(sid)).toBe("sent");
  });

  it("leserne viser bruddet; dag uten brudd har null", async () => {
    const sid = await nySedel({ status: "sent" });
    await arbeid(sid, 2);
    await fravaer(sid, 7.5);
    const ok = await nySedel({ status: "sent" });
    await arbeid(ok, 2);
    await fravaer(ok, 5.5);
    const forventet = { artNavn: "Egenmelding", fravaerMedTak: 7.5, arbeid: 2, fravaerUtenTak: 0, dagsnorm: 7.5, tak: 5.5 };

    const firma = await dag(FADMIN).hentTilAttesteringFirma({ organizationId: ORG });
    const finn = (x: string) => firma.find((s) => s.id === x) as { fravaerNormtakBrudd?: unknown } | undefined;
    expect(finn(sid)?.fravaerNormtakBrudd).toEqual(forventet);
    expect(finn(ok)?.fravaerNormtakBrudd).toBeNull();

    // w10b (plan § 4.10 del D): prosjektlederens firmaliste (omfang P1) viser samme brudd.
    const prosjekt = await dag(LEDER).hentTilAttesteringFirma({ organizationId: ORG });
    const p = prosjekt.find((s) => s.id === sid) as { fravaerNormtakBrudd?: unknown } | undefined;
    expect(p?.fravaerNormtakBrudd).toEqual(forventet);

    expect((await dag(FADMIN).hentForAttestering({ id: sid })).fravaerNormtakBrudd).toEqual(forventet);
    expect((await dag(FADMIN).hentForAttestering({ id: ok })).fravaerNormtakBrudd).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF16 — ukegrunnlaget på serveren (F-F1)", () => {
  it("fravær fyller bare dagens norm i ukesummen; aldri arbeid eller overtid", async () => {
    // Uke 50 (mandag 2026-12-07): 4 dager à 7,5 t arbeid + én dag med 2 t arbeid og 7,5 t egenmelding.
    const dager = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11"];
    let siste = "";
    for (const [i, d] of dager.entries()) {
      const sid = await nySedel({ userId: USER_C, status: "sent", dato: d });
      if (i < 4) await arbeid(sid, 7.5);
      else {
        await arbeid(sid, 2);
        await fravaer(sid, 7.5);
      }
      siste = sid;
    }
    const g = (await dag(FADMIN).hentForAttestering({ id: siste })).ukeOvertidsgrunnlag!;
    expect(g).toMatchObject({ arbeidstimer: 32, fravaerTimer: 7.5, ukeTimer: 37.5, beregnetOvertid: 0 });
  });
});
