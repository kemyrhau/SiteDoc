import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * S1 (plan `docs/claude/web-timeforing-plan.md` § 8.22, Kenneth 2026-11-21): «Slett dagsseddel»
 * sletter alt som er ført på sedelen, og bare et utkast kan slettes. Mot EKTE Postgres
 * (lokal sandkasse, aldri test/prod), gjennom prosedyrene (`createCaller`).
 *
 *  1. Utkast med timer, reise, maskin, vare, tillegg m/ vedlegg og utlegg m/ kvittering → slett →
 *     ingen rad med sedelens id i noen tabell, i begge skjemaene (unntatt radhistorikken, som står
 *     med vilje). `slettOversikt` gir antallene før slettingen.
 *  2. Ny dag på samme dato har ingen varer fra den gamle.
 *  3. Returnert dag avvises og står urørt — både uten og med attestert rad.
 *  4. En vare uten sedel (prosjektets Vareforbruk-side) samme dato står.
 *  5. Feil halvveis (vare-steget, og siste steg) lar hele dagen stå.
 *
 * Negativkontroll: med `slett` fra develop (`dailySheet.delete` alene, returnert tillatt) blir
 * 1, 2, 3 (uten attestert rad og med) og 5 røde.
 */

const id = (n: string) => `5e1e7700-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KAT = id("45");
const VARE = id("46");
const MASKIN = id("47");

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
const dag = () => dagsseddelRouter.createCaller(ctx(USER));

/** Et fullt utkast: alt arbeideren kan føre på én dag. */
async function lagFullDag(dato: string) {
  const sheet = await prismaTimer.dailySheet.create({
    data: {
      clientUuid: randomUUID(),
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      dato: new Date(`${dato}T00:00:00Z`),
      status: "draft",
    },
  });
  const timerRad = await prismaTimer.sheetTimer.create({
    data: { sheetId: sheet.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 7.5 },
  });
  await prismaTimer.sheetTimer.create({
    data: { sheetId: sheet.id, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, timer: 1, erReise: true, reiseRetning: "ut" },
  });
  await prismaTimer.sheetMachine.create({
    data: { sheetId: sheet.id, vehicleId: MASKIN, projectId: P1, timer: 3, sheetTimerId: timerRad.id },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({
    data: { sheetId: sheet.id, tilleggId: TILLEGG, projectId: P1, antall: 1 },
  });
  await prismaTimer.sheetTilleggVedlegg.create({
    data: { sheetTilleggId: tillegg.id, fileUrl: "/uploads/s1-vedlegg.jpg", fileName: "v.jpg", mimeType: "image/jpeg", fileSize: 10 },
  });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: { sheetId: sheet.id, projectId: P1, expenseCategoryId: KAT, belop: 50, ordningVedFoering: "utlegg" },
  });
  await prismaTimer.sheetUtleggVedlegg.create({
    data: { sheetUtleggId: utlegg.id, fileUrl: "/uploads/s1-kvittering.jpg", fileName: "k.jpg", mimeType: "image/jpeg", fileSize: 10 },
  });
  await prismaVarelager.vareforbruk.create({
    data: {
      dato: new Date(`${dato}T00:00:00Z`), projectId: P1, vareId: VARE, antall: 4,
      registrertAvUserId: USER, dagsseddelId: sheet.id, sheetTimerId: timerRad.id,
    },
  });
  return { sheet, timerRad, tillegg, utlegg };
}

/** Rader som bærer sedelens id, pr. tabell, i begge skjemaene. */
async function raderMedSedel(sheetId: string) {
  const timer = await prismaTimer.$queryRaw<Array<{ tabell: string; n: number }>>`
    SELECT 'daily_sheets' AS tabell, count(*)::int AS n FROM "timer"."daily_sheets" WHERE "id" = ${sheetId}
    UNION ALL SELECT 'sheet_timer', count(*)::int FROM "timer"."sheet_timer" WHERE "sheet_id" = ${sheetId}
    UNION ALL SELECT 'sheet_timer_forslag', count(*)::int FROM "timer"."sheet_timer_forslag" WHERE "sheet_id" = ${sheetId}
    UNION ALL SELECT 'sheet_machines', count(*)::int FROM "timer"."sheet_machines" WHERE "sheet_id" = ${sheetId}
    UNION ALL SELECT 'sheet_tillegg', count(*)::int FROM "timer"."sheet_tillegg" WHERE "sheet_id" = ${sheetId}
    UNION ALL SELECT 'sheet_utlegg', count(*)::int FROM "timer"."sheet_utlegg" WHERE "sheet_id" = ${sheetId}
    UNION ALL SELECT 'vareforbruk', count(*)::int FROM "varelager"."vareforbruk" WHERE "dagsseddel_id" = ${sheetId}`;
  return Object.fromEntries(timer.map((r) => [r.tabell, r.n]));
}

async function vedleggFor(tilleggId: string, utleggId: string) {
  return {
    tillegg: await prismaTimer.sheetTilleggVedlegg.count({ where: { sheetTilleggId: tilleggId } }),
    utlegg: await prismaTimer.sheetUtleggVedlegg.count({ where: { sheetUtleggId: utleggId } }),
  };
}

async function ryddOpp() {
  await prismaTimer.$executeRawUnsafe(`DROP TRIGGER IF EXISTS s1_feil ON "varelager"."vareforbruk"`);
  await prismaTimer.$executeRawUnsafe(`DROP TRIGGER IF EXISTS s1_feil ON "timer"."daily_sheets"`);
  await prismaTimer.$executeRawUnsafe(`DROP FUNCTION IF EXISTS s1_feil()`);
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: USER } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    const tl = await prismaTimer.sheetTillegg.findMany({ where: { sheetId: { in: sids } }, select: { id: true } });
    const ut = await prismaTimer.sheetUtlegg.findMany({ where: { sheetId: { in: sids } }, select: { id: true } });
    await prismaTimer.sheetTilleggVedlegg.deleteMany({ where: { sheetTilleggId: { in: tl.map((r) => r.id) } } });
    await prismaTimer.sheetUtleggVedlegg.deleteMany({ where: { sheetUtleggId: { in: ut.map((r) => r.id) } } });
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.sheetTilleggVedlegg.deleteMany({ where: { fileUrl: { startsWith: "/uploads/s1-" } } });
  await prismaTimer.sheetUtleggVedlegg.deleteMany({ where: { fileUrl: { startsWith: "/uploads/s1-" } } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KAT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "s1-slett@sitedoc.test", name: "Arbeider S1", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "S1-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "S1-1", name: "S1 P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.create({ data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", aktiv: true } });
  await prismaTimer.lonnsart.create({ data: { id: REISE, organizationId: ORG, type: "reise", navn: "Reise", aktiv: true } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Diett", type: "antall" } });
  await prismaTimer.expenseCategory.create({ data: { id: KAT, organizationId: ORG, navn: "Parkering" } });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("S1 «Slett dagsseddel» sletter alt — bare utkast", () => {
  it("utkast: oversikten teller alt, og etter sletting finnes ingen rad med sedelens id", async () => {
    const { sheet, tillegg, utlegg } = await lagFullDag("2026-11-02");

    const oversikt = await dag().slettOversikt({ id: sheet.id });
    expect(oversikt).toEqual({
      innhold: { timer: 1, reise: 1, maskin: 1, varer: 1, tillegg: 1, utlegg: 1 },
      kanSlettes: true,
      grunn: null,
    });

    const svar = await dag().slett({ id: sheet.id });
    expect(svar.slettet).toEqual(oversikt.innhold);

    expect(await raderMedSedel(sheet.id)).toEqual({
      daily_sheets: 0, sheet_timer: 0, sheet_timer_forslag: 0, sheet_machines: 0,
      sheet_tillegg: 0, sheet_utlegg: 0, vareforbruk: 0,
    });
    expect(await vedleggFor(tillegg.id, utlegg.id)).toEqual({ tillegg: 0, utlegg: 0 });
  });

  it("ny dag på samme dato har ingen varer fra den gamle", async () => {
    const { sheet } = await lagFullDag("2026-11-03");
    await dag().slett({ id: sheet.id });

    const ny = await prismaTimer.dailySheet.create({
      data: { clientUuid: randomUUID(), organizationId: ORG, userId: USER, registrertAvUserId: USER, dato: new Date("2026-11-03T00:00:00Z") },
    });
    // Dagssiden leser varer etter bruker + dato (vareforbruk.ts) — der lå restene før S1.
    const varerSammeDag = await prismaVarelager.vareforbruk.count({
      where: { registrertAvUserId: USER, dato: new Date("2026-11-03T00:00:00Z") },
    });
    expect(varerSammeDag).toBe(0);
    expect((await dag().slettOversikt({ id: ny.id })).innhold.varer).toBe(0);
  });

  it("returnert dag uten attestert rad avvises og står urørt", async () => {
    const { sheet, tillegg, utlegg } = await lagFullDag("2026-11-04");
    await prismaTimer.dailySheet.update({ where: { id: sheet.id }, data: { status: "returned" } });
    const foer = await raderMedSedel(sheet.id);

    await expect(dag().slett({ id: sheet.id })).rejects.toThrow(/returnert dag kan ikke slettes/);
    const oversikt = await dag().slettOversikt({ id: sheet.id });
    expect(oversikt.kanSlettes).toBe(false);
    expect(oversikt.grunn).toMatch(/returnert dag kan ikke slettes/);

    expect(await raderMedSedel(sheet.id)).toEqual(foer);
    expect(await vedleggFor(tillegg.id, utlegg.id)).toEqual({ tillegg: 1, utlegg: 1 });
  });

  it("returnert dag der leder har attestert én rad avvises og står urørt", async () => {
    const { sheet, timerRad, tillegg, utlegg } = await lagFullDag("2026-11-05");
    // Slik oppstår den (Fabel, inbox-orkestrator.md:40281): én rad attestert, en annen returnert
    // → dagen «returned», sedelens attestertVed står tom.
    await prismaTimer.sheetTimer.update({ where: { id: timerRad.id }, data: { attestertStatus: "attestert", attestertVed: new Date() } });
    await prismaTimer.dailySheet.update({ where: { id: sheet.id }, data: { status: "returned", attestertVed: null } });
    const foer = await raderMedSedel(sheet.id);

    await expect(dag().slett({ id: sheet.id })).rejects.toThrow(/returnert dag kan ikke slettes/);
    expect(await raderMedSedel(sheet.id)).toEqual(foer);
    expect(await vedleggFor(tillegg.id, utlegg.id)).toEqual({ tillegg: 1, utlegg: 1 });
    const rad = await prismaTimer.sheetTimer.findUnique({ where: { id: timerRad.id } });
    expect(rad?.attestertStatus).toBe("attestert");
  });

  it("forsvar: et utkast med attestert rad avvises med «be leder gjenåpne»", async () => {
    const { sheet, timerRad } = await lagFullDag("2026-11-06");
    await prismaTimer.sheetTimer.update({ where: { id: timerRad.id }, data: { attestertStatus: "attestert" } });
    await expect(dag().slett({ id: sheet.id })).rejects.toThrow(/Be leder gjenåpne/);
    expect((await raderMedSedel(sheet.id)).daily_sheets).toBe(1);
  });

  it("sendt dag avvises som før", async () => {
    const { sheet } = await lagFullDag("2026-11-07");
    await prismaTimer.dailySheet.update({ where: { id: sheet.id }, data: { status: "sent" } });
    await expect(dag().slett({ id: sheet.id })).rejects.toThrow(/Bare utkast kan slettes/);
    expect((await raderMedSedel(sheet.id)).vareforbruk).toBe(1);
  });

  it("en vare ført uten sedel (Vareforbruk-siden) samme dato står", async () => {
    const { sheet } = await lagFullDag("2026-11-09");
    const utenSedel = await prismaVarelager.vareforbruk.create({
      data: { dato: new Date("2026-11-09T00:00:00Z"), projectId: P1, vareId: VARE, antall: 2, registrertAvUserId: USER },
    });
    await dag().slett({ id: sheet.id });
    expect(await prismaVarelager.vareforbruk.findUnique({ where: { id: utenSedel.id } })).not.toBeNull();
  });

  it.each([
    ["vare-steget", `"varelager"."vareforbruk"`],
    ["siste steg (sedelen)", `"timer"."daily_sheets"`],
  ])("feil halvveis (%s) lar hele dagen stå", async (_navn, tabell) => {
    const { sheet, tillegg, utlegg } = await lagFullDag("2026-11-10");
    const foer = await raderMedSedel(sheet.id);
    await prismaTimer.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION s1_feil() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 's1 testfeil'; END $$ LANGUAGE plpgsql`,
    );
    await prismaTimer.$executeRawUnsafe(`CREATE TRIGGER s1_feil BEFORE DELETE ON ${tabell} FOR EACH ROW EXECUTE FUNCTION s1_feil()`);
    try {
      await expect(dag().slett({ id: sheet.id })).rejects.toThrow(/s1 testfeil/);
    } finally {
      await prismaTimer.$executeRawUnsafe(`DROP TRIGGER IF EXISTS s1_feil ON ${tabell}`);
    }
    expect(await raderMedSedel(sheet.id)).toEqual(foer);
    // Vedleggene slettes FØR varene og sedelen — de står fordi transaksjonen rulles tilbake.
    expect(await vedleggFor(tillegg.id, utlegg.id)).toEqual({ tillegg: 1, utlegg: 1 });
    await dag().slett({ id: sheet.id }); // rydd for neste rad i each (samme dato)
  });
});
