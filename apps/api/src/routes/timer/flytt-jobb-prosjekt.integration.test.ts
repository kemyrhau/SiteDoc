import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O8 D (plan § 8.22, Kenneth 2026-11-22): `flyttJobb` — prosjekt og byggeplass endres på et lagret
 * jobbkort. Mot EKTE Postgres (kastbar sandkasse, aldri test/prod): timer, maskin, tillegg,
 * utlegg og vare flyttes med ny felles kort-id; reisen står på gammelt prosjekt og får kort etter
 * egne felt (`sikreKortId`); annen jobb er urørt. Faste id-er (prefiks d8a5f1c2), ryddes før og etter.
 */

const id = (n: string) => `d8a5f1c2-0000-4000-8000-0000000000${n}`;
const USER = id("02");
const ORG = id("01");
const ORG_ANNET = id("03");
const P1 = id("11");
const P2 = id("12"); // varelager på
const P3 = id("13"); // varelager av
const P_ANNET = id("14"); // annet firma
const BP2 = id("31");
const ECO = id("21");
const TL = id("41");
const AKT = id("44");
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
const dag = () => dagsseddelRouter.createCaller(ctx(USER));

/**
 * Jobb A på P1/ECO (07:00–15:00, maskin, tillegg, utlegg, vare og utreise 06:30 på samme kort).
 * Med `medJobbB` også jobb B på P1 uten underprosjekt (16:00–17:00).
 */
async function sedel(dato: string, o: { medJobbB?: boolean; utenVare?: boolean } = {}) {
  const sheet = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato, organizationId: ORG });
  const sheetId = sheet.id;
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId } });
  const kortA = randomUUID();
  const kortB = randomUUID();
  const felles = { sheetId, aktivitetId: AKT, projectId: P1, lonnsartId: TL };
  await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortA, externalCostObjectId: ECO, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5 },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: { ...felles, kortId: kortA, fraTid: "06:30", tilTid: "07:00", pauseMin: 0, timer: 0.5, erReise: true, reiseRetning: "ut" },
  });
  if (o.medJobbB) {
    await prismaTimer.sheetTimer.create({
      data: { ...felles, kortId: kortB, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, timer: 1 },
    });
  }
  const sted = { sheetId, projectId: P1, externalCostObjectId: ECO, kortId: kortA };
  await prismaTimer.sheetMachine.create({ data: { ...sted, vehicleId: MASKIN, timer: 2 } });
  await prismaTimer.sheetTillegg.create({ data: { ...sted, tilleggId: TILLEGG, antall: 1 } });
  await prismaTimer.sheetUtlegg.create({
    data: { ...sted, expenseCategoryId: KATEGORI, belop: 100, ordningVedFoering: "utlegg" },
  });
  if (!o.utenVare) {
    await prismaVarelager.vareforbruk.create({
      data: { dato: new Date(dato), projectId: P1, externalCostObjectId: ECO, vareId: VARE, antall: 1, registrertAvUserId: USER, dagsseddelId: sheetId, kortId: kortA },
    });
  }
  return { sheetId, kortA, kortB, reiseId: reise.id };
}

/** Prosjekt, byggeplass, underprosjekt og kort-id for alle rader på sedelen. */
async function alle(sheetId: string) {
  const sel = { id: true, projectId: true, byggeplassId: true, externalCostObjectId: true, kortId: true } as const;
  const [timer, maskin, tillegg, utlegg, vare] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where: { sheetId }, select: { ...sel, erReise: true, fraTid: true } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId }, select: sel }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId }, select: sel }),
    prismaTimer.sheetUtlegg.findMany({ where: { sheetId }, select: sel }),
    prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: sheetId }, select: sel }),
  ]);
  return { timer, maskin, tillegg, utlegg, vare };
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
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
  await prismaTimer.lonnsart.deleteMany({ where: { id: TL } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.byggeplass.deleteMany({ where: { id: BP2 } });
  const prosjekter = [P1, P2, P3, P_ANNET];
  await prisma.projectModule.deleteMany({ where: { projectId: { in: prosjekter } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: prosjekter } } });
  await prisma.project.deleteMany({ where: { id: { in: prosjekter } } });
  for (const org of [ORG, ORG_ANNET]) {
    await prisma.organizationSetting.deleteMany({ where: { organizationId: org } });
    await prisma.organizationModule.deleteMany({ where: { organizationId: org } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org } });
  }
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG_ANNET] } } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "o8d-jobb@sitedoc.test", name: "Arbeider O8D", role: "user" } });
  for (const [org, nr] of [[ORG, "O8D"], [ORG_ANNET, "O8D-X"]] as const) {
    await prisma.organization.create({ data: { id: org, name: `${nr}-firma` } });
    await prisma.organizationMember.create({ data: { userId: USER, organizationId: org, status: "aktiv" } });
    for (const slug of ["timer", "varelager"]) {
      await prisma.organizationModule.create({ data: { organizationId: org, moduleSlug: slug, status: "aktiv" } });
    }
    await prisma.organizationSetting.create({ data: { organizationId: org, timerRegistreringsmodus: "prosjektkort" } });
  }
  const prosjekter = [
    { p: P1, org: ORG, nr: "O8D-1", vare: true },
    { p: P2, org: ORG, nr: "O8D-2", vare: true },
    { p: P3, org: ORG, nr: "O8D-3", vare: false },
    { p: P_ANNET, org: ORG_ANNET, nr: "O8D-X", vare: true },
  ];
  for (const f of prosjekter) {
    await prisma.project.create({ data: { id: f.p, projectNumber: f.nr, name: `${f.nr} prosjekt`, primaryOrganizationId: f.org } });
    await prisma.projectMember.create({ data: { userId: USER, projectId: f.p, role: "member" } });
    await prisma.projectModule.create({ data: { projectId: f.p, moduleSlug: "timer", organizationId: f.org, status: "aktiv" } });
    if (f.vare) {
      await prisma.projectModule.create({ data: { projectId: f.p, moduleSlug: "varelager", organizationId: f.org, status: "aktiv" } });
    }
  }
  await prisma.byggeplass.create({ data: { id: BP2, projectId: P2, name: "Byggeplass O8D-2" } });
  await prisma.externalCostObject.create({
    data: { id: ECO, organizationId: ORG, projectId: P1, proAdmId: "O8D-12", kortNavn: "Grøft O8D", kilde: "manuell", opprettetAvUserId: USER, timerregistreringApen: true },
  });
  await prismaTimer.lonnsart.create({
    data: { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
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

describe("O8 D — flyttJobb", () => {
  it("jobben flyttes til P2/BP2 med ny kort-id; intet unntatt reisen står igjen på P1; reisen havner i jobb B", async () => {
    const { sheetId, kortA, kortB, reiseId } = await sedel("2026-11-02", { medJobbB: true });
    const svar = await dag().flyttJobb({ sheetId, kortId: kortA, projectId: P2, byggeplassId: BP2 });
    expect(svar.kortId).not.toBe(kortA);
    const etter = await alle(sheetId);
    const jobb = [
      ...etter.timer.filter((r) => !r.erReise && r.kortId !== kortB),
      ...etter.maskin,
      ...etter.tillegg,
      ...etter.utlegg,
      ...etter.vare,
    ];
    expect(jobb).toHaveLength(5);
    for (const r of jobb) {
      expect({ id: r.id, p: r.projectId, bp: r.byggeplassId, eco: r.externalCostObjectId, k: r.kortId }).toEqual({
        id: r.id, p: P2, bp: BP2, eco: null, k: svar.kortId,
      });
    }
    // Intet igjen på P1 unntatt reisen og jobb B.
    const paaP1 = [...etter.timer, ...etter.maskin, ...etter.tillegg, ...etter.utlegg, ...etter.vare]
      .filter((r) => r.projectId === P1)
      .map((r) => r.id);
    const jobbB = etter.timer.find((r) => r.kortId === kortB && !r.erReise)!;
    expect(paaP1.sort()).toEqual([reiseId, jobbB.id].sort());
    // Reisen er ikke flyttet; den står i jobb B (samme prosjekt, byggeplass og «Uten»).
    const reise = etter.timer.find((r) => r.id === reiseId)!;
    expect({ p: reise.projectId, bp: reise.byggeplassId, eco: reise.externalCostObjectId }).toEqual({
      p: P1, bp: null, eco: null,
    });
    expect(reise.kortId).toBe(kortB);
  });

  it("uten annen jobb på P1 får reisen eget kort, ikke den flyttede jobbens", async () => {
    const { sheetId, kortA, reiseId } = await sedel("2026-11-03");
    const svar = await dag().flyttJobb({ sheetId, kortId: kortA, projectId: P2, byggeplassId: null });
    const reise = (await alle(sheetId)).timer.find((r) => r.id === reiseId)!;
    expect(reise.projectId).toBe(P1);
    expect(reise.kortId).not.toBeNull();
    expect(reise.kortId).not.toBe(svar.kortId);
    expect(reise.kortId).not.toBe(kortA);
  });

  it("sendt dag avvises — ingenting endres", async () => {
    const { sheetId, kortA } = await sedel("2026-11-04");
    await prismaTimer.dailySheet.update({ where: { id: sheetId }, data: { status: "sent" } });
    const foer = await alle(sheetId);
    await expect(dag().flyttJobb({ sheetId, kortId: kortA, projectId: P2, byggeplassId: BP2 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await alle(sheetId)).toEqual(foer);
  });

  it("attestert linje avvises — ingenting endres", async () => {
    const { sheetId, kortA } = await sedel("2026-11-05");
    await prismaTimer.sheetTillegg.updateMany({ where: { sheetId }, data: { attestertStatus: "attestert" } });
    const foer = await alle(sheetId);
    await expect(dag().flyttJobb({ sheetId, kortId: kortA, projectId: P2, byggeplassId: BP2 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await alle(sheetId)).toEqual(foer);
  });

  it("prosjekt i annet firma avvises — ingenting endres", async () => {
    const { sheetId, kortA } = await sedel("2026-11-06");
    const foer = await alle(sheetId);
    await expect(dag().flyttJobb({ sheetId, kortId: kortA, projectId: P_ANNET, byggeplassId: null })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await alle(sheetId)).toEqual(foer);
  });

  it("varer og prosjekt uten varelager avvises; uten varer går flyttingen", async () => {
    const { sheetId, kortA } = await sedel("2026-11-07");
    const foer = await alle(sheetId);
    await expect(dag().flyttJobb({ sheetId, kortId: kortA, projectId: P3, byggeplassId: null })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Prosjektet har ikke varelager. Fjern varene først.",
    });
    expect(await alle(sheetId)).toEqual(foer);

    const uten = await sedel("2026-11-08", { utenVare: true });
    await dag().flyttJobb({ sheetId: uten.sheetId, kortId: uten.kortA, projectId: P3, byggeplassId: null });
    const etter = await alle(uten.sheetId);
    expect(etter.timer.filter((r) => !r.erReise).map((r) => r.projectId)).toEqual([P3]);
  });

  it("utlegg med annen ordning på nytt prosjekt avvises med Kenneths tekst", async () => {
    const { sheetId, kortA } = await sedel("2026-11-09");
    await prismaTimer.prosjektOrdningOverstyring.create({ data: { prosjektId: P2, expenseCategoryId: KATEGORI, ordning: "fakturert" } });
    try {
      const foer = await alle(sheetId);
      await expect(dag().flyttJobb({ sheetId, kortId: kortA, projectId: P2, byggeplassId: BP2 })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Utlegget føres annerledes på dette prosjektet. Fjern det først.",
      });
      expect(await alle(sheetId)).toEqual(foer);
    } finally {
      await prismaTimer.prosjektOrdningOverstyring.deleteMany({ where: { prosjektId: P2 } });
    }
  });
});
