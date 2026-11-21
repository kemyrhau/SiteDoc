import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Plan § 8.22 L3a: `lagreJobbTid` — skjemaet lagrer jobbens Fra, Til og pause i én transaksjon,
 * serveren regner overtid (`regnJobbTid`). Firmaet har standard arbeidstid 07:00–15:00, pause 30
 * etter 4 t, dagsnorm 7,5 t. Mot EKTE Postgres (kastbar sandkasse, aldri test/prod).
 * Faste id-er (prefiks f3a3e5f1), ryddes før og etter.
 */

const id = (n: string) => `f3a3e5f1-0000-4000-8000-0000000000${n}`;
const USER = id("02");
const ANNEN = id("04");
const ORG = id("01"); // prosjektkort-modus
const ORG_DK = id("03"); // dagskort-modus
const P = id("11");
const P_DK = id("12");
const TL = id("41");
const OT50 = id("42");
const OT100 = id("43");
const AKT = id("44");
const REISE = id("45");
const TL_DK = id("46");
const AKT_DK = id("47");
const TILLEGG = id("48");
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

/** Sedel med én arbeidsrad (jobb) 07:00–15:00, pause 30, timelønn. */
async function sedelMedJobb(dato: string, o: { org?: string; p?: string; tl?: string; akt?: string } = {}) {
  const org = o.org ?? ORG;
  const projectId = o.p ?? P;
  const aktivitetId = o.akt ?? AKT;
  const sheet = await dag().opprett({ clientUuid: randomUUID(), aktivitetId, projectId, dato, organizationId: org });
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId: sheet.id } });
  const kortId = randomUUID();
  const rad = await prismaTimer.sheetTimer.create({
    data: {
      sheetId: sheet.id, lonnsartId: o.tl ?? TL, aktivitetId, projectId, kortId,
      fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving",
    },
  });
  return { sheetId: sheet.id, kortId, rad1: rad.id };
}

const arbeid = async (sheetId: string) =>
  (await prismaTimer.sheetTimer.findMany({ where: { sheetId, erReise: false }, orderBy: { fraTid: "asc" } })).map((r) => ({
    id: r.id, kortId: r.kortId, lonnsartId: r.lonnsartId, fraTid: r.fraTid, tilTid: r.tilTid,
    pauseMin: r.pauseMin, timer: Number(r.timer), beskrivelse: r.beskrivelse,
  }));

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
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, OT50, OT100, REISE, TL_DK] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT_DK] } } });
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
  await prisma.user.create({ data: { id: USER, email: "l3a-jobb@sitedoc.test", name: "Arbeider L3a", role: "user" } });
  await prisma.user.create({ data: { id: ANNEN, email: "l3a-annen@sitedoc.test", name: "Annen L3a", role: "user" } });
  const firmaer = [
    { org: ORG, p: P, modus: "prosjektkort", nr: "L3A-PK" },
    { org: ORG_DK, p: P_DK, modus: "dagskort", nr: "L3A-DK" },
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
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      { id: OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %", aktiv: true, rekkefolge: 2, overtidsnivaa: 50 },
      { id: OT100, organizationId: ORG, type: "ordinaer", navn: "Overtid 100 %", aktiv: true, rekkefolge: 3, overtidsnivaa: 100 },
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

describe("§ 8.22 L3a — lagreJobbTid", () => {
  it("A: 07:00–15:00 / 30 → én rad 7,5 t; B: Til 15:30 → to rader, samme jobb, linje 1 beholder id", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-02");
    await dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }] });
    expect(await arbeid(sheetId)).toEqual([
      { id: rad1, kortId, lonnsartId: TL, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving" },
    ]);

    const svar = await dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }] });
    const etter = await arbeid(sheetId);
    expect(etter).toHaveLength(2);
    expect(etter[0]).toEqual({ id: rad1, kortId, lonnsartId: TL, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving" });
    expect(etter[1]).toMatchObject({ kortId, lonnsartId: OT50, fraTid: "15:00", tilTid: "15:30", pauseMin: 0, timer: 0.5, beskrivelse: "Graving" });
    expect(svar).toMatchObject({ rad1Id: rad1, rad2Id: etter[1]?.id, timer: 8, overtidsnivaa: 50 });
  });

  it("tilbake til 15:00 → én rad; maskin og vare på linje 2 følger linje 1", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-03");
    const { rad2Id } = await dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }] });
    if (!rad2Id) throw new Error("linje 2 mangler");
    const m = await prismaTimer.sheetMachine.create({
      data: { sheetId, projectId: P, vehicleId: MASKIN, timer: 0.5, sheetTimerId: rad2Id, kortId },
    });
    const v = await prismaVarelager.vareforbruk.create({
      data: { dato: new Date("2026-11-03"), projectId: P, vareId: VARE, antall: 1, registrertAvUserId: USER, dagsseddelId: sheetId, sheetTimerId: rad2Id },
    });

    await dag().lagreJobbTid({
      sheetId, kortId, fraTid: "07:00", tilTid: "15:00", pauseMin: 30,
      linjer: [{ radId: rad1, lonnsartId: TL }, { radId: rad2Id, lonnsartId: OT50 }],
    });
    expect((await arbeid(sheetId)).map((r) => r.id)).toEqual([rad1]);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m.id } })).sheetTimerId).toBe(rad1);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } })).sheetTimerId).toBe(rad1);
  });

  it("byttet lønnsart på linje 2 beholdes; valgt overtidsart på linje 1 gir ingen ny linje", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-04");
    const { rad2Id } = await dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }] });
    if (!rad2Id) throw new Error("linje 2 mangler");
    await dag().lagreJobbTid({
      sheetId, kortId, fraTid: "07:00", tilTid: "16:00", pauseMin: 30,
      linjer: [{ radId: rad1, lonnsartId: TL }, { radId: rad2Id, lonnsartId: OT100 }],
    });
    expect((await arbeid(sheetId))[1]).toMatchObject({ id: rad2Id, lonnsartId: OT100, fraTid: "15:00", tilTid: "16:00", timer: 1 });

    const ny = await sedelMedJobb("2026-11-05");
    await dag().lagreJobbTid({
      sheetId: ny.sheetId, kortId: ny.kortId, fraTid: "07:00", tilTid: "16:00", pauseMin: 30,
      linjer: [{ radId: ny.rad1, lonnsartId: OT50 }],
    });
    expect(await arbeid(ny.sheetId)).toEqual([
      expect.objectContaining({ id: ny.rad1, lonnsartId: OT50, fraTid: "07:00", tilTid: "16:00", timer: 8.5 }),
    ]);
  });

  it("gate 129 V1: tiden flyttes helt over normen → linje 1 får overtidsarten; bytte på uendret tid beholdes", async () => {
    const { sheetId } = await sedelMedJobb("2026-11-13");
    // Andre jobb 16:00–17:00 på timelønn (dagens første jobb fyller normen 7,5 t).
    const kortId = randomUUID();
    const r = await prismaTimer.sheetTimer.create({
      data: { sheetId, lonnsartId: TL, aktivitetId: AKT, projectId: P, kortId, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, timer: 1 },
    });
    const svar = await dag().lagreJobbTid({ sheetId, kortId, fraTid: "16:00", tilTid: "18:00", pauseMin: 0, linjer: [{ radId: r.id, lonnsartId: TL }] });
    expect(svar).toMatchObject({ helOvertid: true, linje1LonnsartId: OT50, rad2Id: null });
    expect((await arbeid(sheetId)).filter((x) => x.kortId === kortId)).toEqual([
      expect.objectContaining({ id: r.id, lonnsartId: OT50, fraTid: "16:00", tilTid: "18:00", timer: 2 }),
    ]);

    // Arbeideren bytter selv tilbake til timelønn uten å røre tiden → beholdes.
    await dag().lagreJobbTid({ sheetId, kortId, fraTid: "16:00", tilTid: "18:00", pauseMin: 0, linjer: [{ radId: r.id, lonnsartId: TL }] });
    expect((await arbeid(sheetId)).find((x) => x.id === r.id)).toMatchObject({ lonnsartId: TL, timer: 2 });
  });

  it("reise, tillegg og vare på dagen røres ikke", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-06");
    const reise = await prismaTimer.sheetTimer.create({
      data: { sheetId, lonnsartId: REISE, aktivitetId: AKT, projectId: P, kortId, erReise: true, fraTid: "06:00", tilTid: "07:00", timer: 1 },
    });
    const tl = await prismaTimer.sheetTillegg.create({ data: { sheetId, projectId: P, tilleggId: TILLEGG, antall: 1, kortId } });
    const v = await prismaVarelager.vareforbruk.create({
      data: { dato: new Date("2026-11-06"), projectId: P, vareId: VARE, antall: 2, registrertAvUserId: USER, dagsseddelId: sheetId, sheetTimerId: rad1, kortId },
    });
    const foer = {
      reise: await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise.id } }),
      tl: await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: tl.id } }),
      v: await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } }),
    };
    await dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }] });
    expect(await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise.id } })).toEqual(foer.reise);
    expect(await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: tl.id } })).toEqual(foer.tl);
    expect(await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } })).toEqual(foer.v);
  });

  it("tilgang: annen brukers sedel, sendt dag, dagskort-firma og lønnsart fra annet firma avvises", async () => {
    const a = await sedelMedJobb("2026-11-09");
    const inn = { sheetId: a.sheetId, kortId: a.kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: a.rad1, lonnsartId: TL }] };
    await expect(dag(ANNEN).lagreJobbTid(inn)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dag().lagreJobbTid({ ...inn, linjer: [{ radId: a.rad1, lonnsartId: TL_DK }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(dag().lagreJobbTid({ ...inn, linjer: [{ radId: a.rad1, lonnsartId: REISE }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await prismaTimer.dailySheet.update({ where: { id: a.sheetId }, data: { status: "sent" } });
    await expect(dag().lagreJobbTid(inn)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await arbeid(a.sheetId)).toHaveLength(1);

    const dk = await sedelMedJobb("2026-11-10", { org: ORG_DK, p: P_DK, tl: TL_DK, akt: AKT_DK });
    await expect(
      dag().lagreJobbTid({ ...inn, sheetId: dk.sheetId, kortId: dk.kortId, linjer: [{ radId: dk.rad1, lonnsartId: TL_DK }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await arbeid(dk.sheetId)).toEqual([expect.objectContaining({ tilTid: "15:00", timer: 7.5 })]);
  });

  it("klienten har et annet bilde av jobben → BAD_REQUEST, ingenting endres", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-11");
    await expect(
      dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "15:30", pauseMin: 30, linjer: [{ radId: rad1, lonnsartId: TL }, { radId: randomUUID(), lonnsartId: OT50 }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await arbeid(sheetId)).toHaveLength(1);
  });

  it("brudd sent i transaksjonen (maskin over jobbens arbeid) ruller alt tilbake", async () => {
    const { sheetId, kortId, rad1 } = await sedelMedJobb("2026-11-12");
    await prismaTimer.sheetMachine.create({ data: { sheetId, projectId: P, vehicleId: MASKIN, timer: 7, sheetTimerId: rad1, kortId } });
    const foer = await arbeid(sheetId);
    await expect(
      dag().lagreJobbTid({ sheetId, kortId, fraTid: "07:00", tilTid: "11:00", pauseMin: 0, linjer: [{ radId: rad1, lonnsartId: TL }] }),
    ).rejects.toBeTruthy();
    expect(await arbeid(sheetId)).toEqual(foer);
  });
});
