import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Plan § 8.22 L3b: `flyttJobbEco` — arbeideren velger underprosjekt for HELE jobben i hodet på
 * jobbskjemaet. Timer (ikke reise), maskin, tillegg, utlegg og vare flyttes; kort-id beholdes;
 * annen jobb er urørt. Mot EKTE Postgres (kastbar sandkasse, aldri test/prod).
 * Faste id-er (prefiks f3b3e5f1), ryddes før og etter.
 */

const id = (n: string) => `f3b3e5f1-0000-4000-8000-0000000000${n}`;
const USER = id("02");
const ANNEN = id("04");
const ORG = id("01"); // prosjektkort-modus
const ORG_DK = id("03"); // dagskort-modus
const P = id("11");
const P_DK = id("12");
const ECO = id("21"); // åpent
const ECO_LUKKET = id("22"); // stengt for timer
const ECO_DK = id("23");
const TL = id("41");
const AKT = id("44");
const REISE = id("45");
const TL_DK = id("46");
const AKT_DK = id("47");
const TILLEGG = id("48");
const KATEGORI = id("49");
const MASKIN = id("51");
const VARE = id("52");

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
const dag = (u = USER) => dagsseddelRouter.createCaller(ctx(u));

/**
 * Sedel med to jobber i samme prosjekt: jobb A (07:00–15:00 + overtid 15:00–15:30, maskin,
 * tillegg, utlegg, vare og en reise på samme kort) og jobb B (16:00–17:00).
 */
async function sedelMedToJobber(dato: string, o: { org?: string; p?: string; tl?: string; akt?: string } = {}) {
  const org = o.org ?? ORG;
  const projectId = o.p ?? P;
  const aktivitetId = o.akt ?? AKT;
  const lonnsartId = o.tl ?? TL;
  const sheet = await dag().opprett({ clientUuid: randomUUID(), aktivitetId, projectId, dato, organizationId: org });
  const sheetId = sheet.id;
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId } });
  const kortA = randomUUID();
  const kortB = randomUUID();
  const felles = { sheetId, aktivitetId, projectId, lonnsartId };
  await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortA, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving" },
  });
  await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortA, fraTid: "15:00", tilTid: "15:30", pauseMin: 0, timer: 0.5, beskrivelse: "Graving" },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortA, fraTid: "06:30", tilTid: "07:00", pauseMin: 0, timer: 0.5, erReise: true },
  });
  await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortB, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, timer: 1, beskrivelse: "Rydding" },
  });
  if (org === ORG) {
    await prismaTimer.sheetMachine.create({ data: { sheetId, projectId, vehicleId: MASKIN, timer: 2, kortId: kortA } });
    await prismaTimer.sheetTillegg.create({ data: { sheetId, projectId, tilleggId: TILLEGG, antall: 1, kortId: kortA } });
    await prismaTimer.sheetUtlegg.create({
      data: { sheetId, projectId, expenseCategoryId: KATEGORI, belop: 100, ordningVedFoering: "utlegg", kortId: kortA },
    });
    await prismaVarelager.vareforbruk.create({
      data: { dato: new Date(dato), projectId, vareId: VARE, antall: 1, registrertAvUserId: USER, dagsseddelId: sheetId, kortId: kortA },
    });
  }
  return { sheetId, kortA, kortB, reiseId: reise.id };
}

/** Underprosjekt og kort-id pr. rad-type for ett kort (tall før/etter). */
async function tilstand(sheetId: string, kortId: string) {
  const [timer, reise, maskin, tillegg, utlegg, vare] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where: { sheetId, kortId, erReise: false } }),
    prismaTimer.sheetTimer.findMany({ where: { sheetId, erReise: true } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId, kortId } }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId, kortId } }),
    prismaTimer.sheetUtlegg.findMany({ where: { sheetId, kortId } }),
    prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: sheetId, kortId } }),
  ]);
  const eco = (l: { externalCostObjectId: string | null }[]) => l.map((r) => r.externalCostObjectId);
  return {
    timer: eco(timer),
    reise: eco(reise),
    maskin: eco(maskin),
    tillegg: eco(tillegg),
    utlegg: eco(utlegg),
    vare: eco(vare),
  };
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: [USER, ANNEN] } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, REISE, TL_DK] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT_DK] } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO, ECO_LUKKET, ECO_DK] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: [USER, ANNEN] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P, P_DK] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P, P_DK] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P, P_DK] } } });
  for (const org of [ORG, ORG_DK]) {
    await prisma.organizationSetting.deleteMany({ where: { organizationId: org } });
    await prisma.organizationModule.deleteMany({ where: { organizationId: org } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org } });
  }
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG_DK] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER, ANNEN] } } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "l3b-jobb@sitedoc.test", name: "Arbeider L3b", role: "user" } });
  await prisma.user.create({ data: { id: ANNEN, email: "l3b-annen@sitedoc.test", name: "Annen L3b", role: "user" } });
  const firmaer = [
    { org: ORG, p: P, modus: "prosjektkort", nr: "L3B-PK" },
    { org: ORG_DK, p: P_DK, modus: "dagskort", nr: "L3B-DK" },
  ];
  for (const f of firmaer) {
    await prisma.organization.create({ data: { id: f.org, name: `${f.nr}-firma` } });
    for (const u of [USER, ANNEN]) {
      await prisma.organizationMember.create({ data: { userId: u, organizationId: f.org, status: "aktiv" } });
    }
    await prisma.organizationModule.create({ data: { organizationId: f.org, moduleSlug: "timer", status: "aktiv" } });
    await prisma.organizationSetting.create({ data: { organizationId: f.org, timerRegistreringsmodus: f.modus } });
    await prisma.project.create({ data: { id: f.p, projectNumber: f.nr, name: `${f.nr} prosjekt`, primaryOrganizationId: f.org } });
    for (const u of [USER, ANNEN]) {
      await prisma.projectMember.create({ data: { userId: u, projectId: f.p, role: "member" } });
    }
    await prisma.projectModule.create({ data: { projectId: f.p, moduleSlug: "timer", organizationId: f.org, status: "aktiv" } });
  }
  const eco = (eid: string, org: string, p: string, nr: string, apen = true) =>
    prisma.externalCostObject.create({
      data: { id: eid, organizationId: org, projectId: p, proAdmId: nr, kortNavn: `Grøft ${nr}`, kilde: "manuell", opprettetAvUserId: USER, timerregistreringApen: apen },
    });
  await eco(ECO, ORG, P, "L3B-12");
  await eco(ECO_LUKKET, ORG, P, "L3B-13", false);
  await eco(ECO_DK, ORG_DK, P_DK, "L3B-14");
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reise", aktiv: true, rekkefolge: 4 },
      { id: TL_DK, organizationId: ORG_DK, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
    ],
  });
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { reiseLonnsartId: REISE } });
  await prismaTimer.aktivitet.createMany({
    data: [
      { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" },
      { id: AKT_DK, organizationId: ORG_DK, navn: "Anleggsarbeid" },
    ],
  });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", internNavn: "Graver", utleieEnhet: "time" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const uten = { timer: [null, null], reise: [null], maskin: [null], tillegg: [null], utlegg: [null], vare: [null] };

describe("§ 8.22 L3b — flyttJobbEco", () => {
  it("hele jobben flyttes (timer, maskin, tillegg, utlegg, vare), kort-id beholdes, reise og annen jobb urørt; Uten flytter tilbake", async () => {
    const { sheetId, kortA, kortB } = await sedelMedToJobber("2026-11-09");
    // Negativkontroll: før flyttingen har ingen rad underprosjekt.
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
    const bFoer = await tilstand(sheetId, kortB);

    const svar = await dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO });
    expect(svar).toEqual({ kortId: kortA, antall: 6 });
    expect(await tilstand(sheetId, kortA)).toEqual({
      timer: [ECO, ECO],
      reise: [null],
      maskin: [ECO],
      tillegg: [ECO],
      utlegg: [ECO],
      vare: [ECO],
    });
    // Annen jobb: samme kort-id og fortsatt uten underprosjekt.
    expect(await tilstand(sheetId, kortB)).toEqual(bFoer);
    expect(bFoer.timer).toEqual([null]);

    // «Uten» flytter hele jobben tilbake.
    await dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: null });
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
  });

  it("lukket underprosjekt avvises — ingenting endres", async () => {
    const { sheetId, kortA } = await sedelMedToJobber("2026-11-10");
    await expect(dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO_LUKKET })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
  });

  it("underprosjekt i annet firma avvises", async () => {
    const { sheetId, kortA } = await sedelMedToJobber("2026-11-11");
    await expect(dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO_DK })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
  });

  it("annen brukers sedel → FORBIDDEN; ukjent kort → BAD_REQUEST", async () => {
    const { sheetId, kortA } = await sedelMedToJobber("2026-11-12");
    await expect(dag(ANNEN).flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(dag().flyttJobbEco({ sheetId, kortId: randomUUID(), externalCostObjectId: ECO })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
  });

  it("sendt dag avvises", async () => {
    const { sheetId, kortA } = await sedelMedToJobber("2026-11-13");
    await prismaTimer.dailySheet.update({ where: { id: sheetId }, data: { status: "sent" } });
    await expect(dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await tilstand(sheetId, kortA)).toEqual(uten);
  });

  it("vakt: dagskort-firma → BAD_REQUEST, ingenting endres", async () => {
    const { sheetId, kortA } = await sedelMedToJobber("2026-11-16", { org: ORG_DK, p: P_DK, tl: TL_DK, akt: AKT_DK });
    await expect(dag().flyttJobbEco({ sheetId, kortId: kortA, externalCostObjectId: ECO_DK })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const etter = await tilstand(sheetId, kortA);
    expect(etter.timer).toEqual([null, null]);
  });
});
