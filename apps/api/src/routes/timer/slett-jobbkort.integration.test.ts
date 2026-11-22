import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Retur O8 tillegg 2 (b) (plan § 8.22, Kenneth 2026-11-22): «Slett jobben» sletter ETT feilført
 * jobbkort i sin helhet — dagen og de andre kortene står. Mot EKTE Postgres (lokal sandkasse),
 * gjennom prosedyrene (`createCaller`).
 *
 *  1. To kort på et utkast → slett kort A → A sine timer, reise, maskin (kort_id og sheetTimerId),
 *     vare (kort_id og sheet_timer_id), tillegg m/ vedlegg og utlegg m/ kvittering er borte;
 *     kort B og dagen står. `slettKortOversikt` gir antallene.
 *  2. Attestert rad eller vare med attestert_snapshot i kortet → avvist, alt står.
 *  3. Sendt dag avvises; returnert dag uten attestert rad tillates (som fjernTimerRad).
 *  4. Erstattet rad (revisjonsspor) står.
 *  5. Ukjent kort → NOT_FOUND.
 *
 * Negativkontroll: uten `slettKort` (develop) finnes ikke prosedyren — alle røde.
 */

const id = (n: string) => `5e1e7800-0000-4000-8000-0000000000${n}`;
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


async function lagSedel(dato: string, status = "draft") {
  return prismaTimer.dailySheet.create({
    data: {
      clientUuid: randomUUID(), organizationId: ORG, userId: USER, registrertAvUserId: USER,
      dato: new Date(`${dato}T00:00:00Z`), status,
    },
  });
}

/** Et fullt jobbkort: alt arbeideren kan føre i én jobb. */
async function lagKort(sheetId: string, dato: string, kortId: string) {
  const timerRad = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 4, kortId },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, timer: 1, erReise: true, reiseRetning: "ut", kortId },
  });
  // Maskin knyttet via timeraden (uten kort_id) og én med kort_id.
  const maskinVia = await prismaTimer.sheetMachine.create({
    data: { sheetId, vehicleId: MASKIN, projectId: P1, timer: 2, sheetTimerId: timerRad.id },
  });
  const maskinKort = await prismaTimer.sheetMachine.create({
    data: { sheetId, vehicleId: MASKIN, projectId: P1, timer: 1, kortId },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({
    data: { sheetId, tilleggId: TILLEGG, projectId: P1, antall: 1, kortId },
  });
  await prismaTimer.sheetTilleggVedlegg.create({
    data: { sheetTilleggId: tillegg.id, fileUrl: `/uploads/s1k-${kortId}-v.jpg`, fileName: "v.jpg", mimeType: "image/jpeg", fileSize: 10 },
  });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId: P1, expenseCategoryId: KAT, belop: 50, ordningVedFoering: "utlegg", kortId },
  });
  await prismaTimer.sheetUtleggVedlegg.create({
    data: { sheetUtleggId: utlegg.id, fileUrl: `/uploads/s1k-${kortId}-k.jpg`, fileName: "k.jpg", mimeType: "image/jpeg", fileSize: 10 },
  });
  const dt = new Date(`${dato}T00:00:00Z`);
  const vareVia = await prismaVarelager.vareforbruk.create({
    data: { dato: dt, projectId: P1, vareId: VARE, antall: 4, registrertAvUserId: USER, dagsseddelId: sheetId, sheetTimerId: timerRad.id },
  });
  const vareKort = await prismaVarelager.vareforbruk.create({
    data: { dato: dt, projectId: P1, vareId: VARE, antall: 2, registrertAvUserId: USER, dagsseddelId: sheetId, kortId },
  });
  return { timerRad, reise, maskinVia, maskinKort, tillegg, utlegg, vareVia, vareKort };
}

/** Rader i kortet, pr. tabell — via kort_id ELLER kortets timerader. */
async function raderIKort(sheetId: string, k: Awaited<ReturnType<typeof lagKort>>) {
  return {
    timer: await prismaTimer.sheetTimer.count({ where: { id: { in: [k.timerRad.id, k.reise.id] } } }),
    maskin: await prismaTimer.sheetMachine.count({ where: { id: { in: [k.maskinVia.id, k.maskinKort.id] } } }),
    tillegg: await prismaTimer.sheetTillegg.count({ where: { id: k.tillegg.id } }),
    tilleggVedlegg: await prismaTimer.sheetTilleggVedlegg.count({ where: { sheetTilleggId: k.tillegg.id } }),
    utlegg: await prismaTimer.sheetUtlegg.count({ where: { id: k.utlegg.id } }),
    utleggVedlegg: await prismaTimer.sheetUtleggVedlegg.count({ where: { sheetUtleggId: k.utlegg.id } }),
    varer: await prismaVarelager.vareforbruk.count({ where: { id: { in: [k.vareVia.id, k.vareKort.id] } } }),
    sedel: await prismaTimer.dailySheet.count({ where: { id: sheetId } }),
  };
}

const HELT = { timer: 2, maskin: 2, tillegg: 1, tilleggVedlegg: 1, utlegg: 1, utleggVedlegg: 1, varer: 2, sedel: 1 };
const INNHOLD = { timer: 1, reise: 1, maskin: 2, varer: 2, tillegg: 1, utlegg: 1 };

async function ryddOpp() {
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
  await prismaTimer.sheetTilleggVedlegg.deleteMany({ where: { fileUrl: { startsWith: "/uploads/s1k-" } } });
  await prismaTimer.sheetUtleggVedlegg.deleteMany({ where: { fileUrl: { startsWith: "/uploads/s1k-" } } });
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
  await prisma.user.create({ data: { id: USER, email: "s1k-slett@sitedoc.test", name: "Arbeider S1", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "S1K-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "S1K-1", name: "S1K P1", primaryOrganizationId: ORG } });
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

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("Retur O8 (b) «Slett jobben» — ett kort, dagen står", () => {
  it("utkast med to kort: oversikten teller kort A, slett A → A er borte, B og dagen står", async () => {
    const sheet = await lagSedel("2026-11-12");
    const a = await lagKort(sheet.id, "2026-11-12", "kA");
    const b = await lagKort(sheet.id, "2026-11-12", "kB");

    const oversikt = await dag().slettKortOversikt({ id: sheet.id, kortId: "kA" });
    expect(oversikt).toEqual({ innhold: INNHOLD, kanSlettes: true, grunn: null });

    const svar = await dag().slettKort({ id: sheet.id, kortId: "kA" });
    expect(svar).toEqual({ id: sheet.id, kortId: "kA", slettet: INNHOLD });

    expect(await raderIKort(sheet.id, a)).toEqual({
      timer: 0, maskin: 0, tillegg: 0, tilleggVedlegg: 0, utlegg: 0, utleggVedlegg: 0, varer: 0, sedel: 1,
    });
    expect(await raderIKort(sheet.id, b)).toEqual(HELT);
  });

  it("attestert timerad i kortet → avvist med «be leder gjenåpne», alt står", async () => {
    const sheet = await lagSedel("2026-11-13", "returned");
    const a = await lagKort(sheet.id, "2026-11-13", "kA");
    await prismaTimer.sheetTimer.update({ where: { id: a.timerRad.id }, data: { attestertStatus: "attestert" } });

    await expect(dag().slettKort({ id: sheet.id, kortId: "kA" })).rejects.toThrow(/Be leder gjenåpne/);
    const oversikt = await dag().slettKortOversikt({ id: sheet.id, kortId: "kA" });
    expect(oversikt.kanSlettes).toBe(false);
    expect(oversikt.grunn).toMatch(/Be leder gjenåpne/);
    expect(await raderIKort(sheet.id, a)).toEqual(HELT);
  });

  it("vare med attestert_snapshot i kortet → avvist, alt står", async () => {
    const sheet = await lagSedel("2026-11-14");
    const a = await lagKort(sheet.id, "2026-11-14", "kA");
    await prismaVarelager.$executeRaw`UPDATE "varelager"."vareforbruk" SET "attestert_snapshot" = '{}'::jsonb WHERE "id" = ${a.vareKort.id}`;

    await expect(dag().slettKort({ id: sheet.id, kortId: "kA" })).rejects.toThrow(/Be leder gjenåpne/);
    expect(await raderIKort(sheet.id, a)).toEqual(HELT);
  });

  it("sendt dag avvises og står urørt", async () => {
    const sheet = await lagSedel("2026-11-15", "sent");
    const a = await lagKort(sheet.id, "2026-11-15", "kA");
    await expect(dag().slettKort({ id: sheet.id, kortId: "kA" })).rejects.toThrow(/låst/);
    expect(await raderIKort(sheet.id, a)).toEqual(HELT);
  });

  it("returnert dag uten attestert rad: kortet kan slettes (som fjernTimerRad)", async () => {
    const sheet = await lagSedel("2026-11-16", "returned");
    const a = await lagKort(sheet.id, "2026-11-16", "kA");
    await dag().slettKort({ id: sheet.id, kortId: "kA" });
    expect((await raderIKort(sheet.id, a)).timer).toBe(0);
    expect(await prismaTimer.dailySheet.count({ where: { id: sheet.id } })).toBe(1);
  });

  it("erstattet rad i kortet (revisjonsspor) står og teller ikke", async () => {
    const sheet = await lagSedel("2026-11-17");
    await lagKort(sheet.id, "2026-11-17", "kA");
    const gammel = await prismaTimer.sheetTimer.create({
      data: { sheetId: sheet.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 3, kortId: "kA", attestertStatus: "erstattet" },
    });
    expect((await dag().slettKortOversikt({ id: sheet.id, kortId: "kA" })).innhold.timer).toBe(1);
    await dag().slettKort({ id: sheet.id, kortId: "kA" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: gammel.id } })).not.toBeNull();
  });

  it("ukjent kort → «Jobben finnes ikke»", async () => {
    const sheet = await lagSedel("2026-11-18");
    await lagKort(sheet.id, "2026-11-18", "kA");
    await expect(dag().slettKort({ id: sheet.id, kortId: "kZ" })).rejects.toThrow(/Jobben finnes ikke/);
  });
});
