import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O20 (vedtak-timer-web.md § Reisevinduet pkt 26): «Flytt jobbens start/slutt» — `tilfoyTimerRad`
 * med `flyttRad` flytter kanten av jobben i samme kort og lagrer reisen i én transaksjon.
 * Mot EKTE Postgres (lokal sandkasse). Data med faste id-er (prefiks 01e20200) ryddes i afterAll.
 */

const id = (n: string) => `01e20200-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("03");
const USER = id("02");
const ANNEN = id("04");
const P1 = id("11");
const B1 = id("21");
const KONTOR = id("31");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");

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

async function ryddSedler() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: [USER, ANNEN] } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
}

async function ryddOpp() {
  await ryddSedler();
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: [USER, ANNEN] } } });
  await prisma.oppmotested.deleteMany({ where: { id: KONTOR } });
  await prisma.byggeplass.deleteMany({ where: { id: B1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER, ANNEN] } } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "o20-flytt@sitedoc.test", name: "Arbeider O20", role: "user" } });
  await prisma.user.create({ data: { id: ANNEN, email: "o20-annen@sitedoc.test", name: "Annen O20", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "O20-firma" } });
  await prisma.organization.create({ data: { id: ORG2, name: "O20-annet-firma" } });
  for (const [u, o] of [[USER, ORG], [ANNEN, ORG], [USER, ORG2]] as const) {
    await prisma.organizationMember.create({ data: { userId: u, organizationId: o, status: "aktiv" } });
  }
  for (const o of [ORG, ORG2]) {
    await prisma.organizationModule.create({ data: { organizationId: o, moduleSlug: "timer", status: "aktiv" } });
  }
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", reiseLonnsartId: REISE } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O20-1", name: "O20 Instinniforbotn", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.byggeplass.create({ data: { id: B1, projectId: P1, name: "O20 B1" } });
  await prisma.oppmotested.create({ data: { id: KONTOR, organizationId: ORG, navn: "Kontor Narvik", lat: 68.43, lng: 17.43 } });
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.lonnsart.create({
    data: { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", erStandardvalg: false, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
}

async function lagSedel(dato: string, opts: { status?: string; org?: string; userId?: string } = {}) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: opts.org ?? ORG,
      userId: opts.userId ?? USER,
      registrertAvUserId: opts.userId ?? USER,
      aktivitetId: AKT,
      dato: new Date(dato),
      status: opts.status ?? "draft",
    },
  });
  return sid;
}

const regel = { enhet: "minutter", terskelMin: 30, terskelM: null, underType: "arbeidstid", overType: "reisetid", kategori: "reisetid", grensepunktTreff: false };

/** Jobben 07:00–17:30 med 30 min pause = 10,0 t (én arbeidsrad), og kort-id-en den fikk. */
async function lagJobb(sid: string, fraTid = "07:00", tilTid = "17:30", timer = 10, pauseMin = 30) {
  const r = await dag().tilfoyTimerRad({
    sheetId: sid, projectId: P1, byggeplassId: B1, lonnsartId: ORD, aktivitetId: AKT,
    timer, fraTid, tilTid, pauseMin,
  });
  const lagret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r.id } });
  return { id: r.id, kortId: lagret.kortId as string };
}

const reise = (sid: string, kortId: string, over: Record<string, unknown> = {}) => ({
  sheetId: sid,
  projectId: P1,
  byggeplassId: B1,
  lonnsartId: REISE,
  aktivitetId: AKT,
  timer: 50 / 60,
  fraTid: "07:00",
  tilTid: "07:50",
  pauseMin: 0,
  kortId,
  reiseIKort: true,
  reiseKilde: "manuell" as const,
  reiseRetning: "ut" as const,
  reiseOppmotestedId: KONTOR,
  reiseKjoretidMin: 50,
  reiseAvstandM: 45000,
  reiseRegel: regel,
  ...over,
});

async function rader(sid: string) {
  return prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
}

describe("O20 — tilfoyTimerRad med flyttRad", () => {
  beforeAll(async () => {
    await ryddOpp();
    await seed();
  });
  afterAll(async () => {
    await ryddOpp();
  });
  beforeEach(async () => {
    await ryddSedler();
  });

  it("negativkontroll: Til-reise 07:00–07:50 uten flyttRad avvises som i dag (overlapp)", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await expect(dag().tilfoyTimerRad(reise(sid, jobb.kortId))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await rader(sid)).toHaveLength(1);
  });

  it("Til-reise 07:00–07:50: jobben blir 07:50–17:30 (9,17 t, pausen står) og reisen lagres i kortet", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    const ny = await dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } }));
    const [r, j] = await rader(sid);
    expect(r).toMatchObject({ id: ny.id, fraTid: "07:00", tilTid: "07:50", erReise: true, kortId: jobb.kortId });
    expect(j).toMatchObject({ id: jobb.id, fraTid: "07:50", tilTid: "17:30", pauseMin: 30 });
    expect(Number(j!.timer)).toBeCloseTo(9.17, 2);
  });

  it("Fra-reise 17:00–17:40: jobbens slutt flyttes til 17:00", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await dag().tilfoyTimerRad(
      reise(sid, jobb.kortId, { fraTid: "17:00", tilTid: "17:40", timer: 40 / 60, reiseRetning: "retur", flyttRad: { radId: jobb.id, nyTil: "17:00" } }),
    );
    const j = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } });
    expect(j).toMatchObject({ fraTid: "07:00", tilTid: "17:00" });
    expect(Number(j.timer)).toBeCloseTo(9.5, 2);
    expect(await rader(sid)).toHaveLength(2);
  });

  it("avviser flytting som ikke er en kant: reise midt i jobben, feil tid og feil kant", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { fraTid: "10:00", tilTid: "10:30", timer: 0.5, flyttRad: { radId: jobb.id, nyFra: "10:30" } })),
    ).rejects.toThrow(/jobbens start eller slutt/);
    await expect(dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "08:00" } }))).rejects.toThrow(
      /jobbens start eller slutt/,
    );
    await expect(dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyTil: "07:50" } }))).rejects.toThrow(
      /jobbens start eller slutt/,
    );
    const j = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } });
    expect(j).toMatchObject({ fraTid: "07:00", tilTid: "17:30" });
    expect(await rader(sid)).toHaveLength(1);
  });

  it("avviser flytting som gir 0 minutter", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid, "07:00", "07:50", 50 / 60, 0);
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await rader(sid)).toHaveLength(1);
  });

  it("avviser flytting uten reiseIKort, og uten nøyaktig én av nyFra/nyTil (Zod)", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { reiseIKort: undefined, flyttRad: { radId: jobb.id, nyFra: "07:50" } })),
    ).rejects.toThrow(/reise ført i jobbens kort/);
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50", nyTil: "17:00" } })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await rader(sid)).toHaveLength(1);
  });

  it("transaksjonen ruller tilbake når reisen avvises (maskin over jobbens arbeid etter flyttingen)", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    // Maskin 10 t på jobben: etter flyttingen (9,17 t) er maskinen over arbeidet → w9 avviser i transaksjonen.
    await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, sheetTimerId: jobb.id, vehicleId: randomUUID(), projectId: P1, byggeplassId: B1, timer: 10, kortId: jobb.kortId },
    });
    await expect(dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } }))).rejects.toThrow();
    const j = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } });
    expect(j).toMatchObject({ fraTid: "07:00", tilTid: "17:30" });
    expect(Number(j.timer)).toBe(10);
    expect(await rader(sid)).toHaveLength(1);
  });

  it("regresjon: overlapp med et annet kort sperrer fortsatt, jobben står", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    // Jobben starter 07:10; en annen jobb (eget kort) 06:00–07:10 som reisen også overlapper.
    await prismaTimer.sheetTimer.update({ where: { id: jobb.id }, data: { fraTid: "07:10", timer: 10 - 10 / 60 } });
    await prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 1 + 10 / 60, fraTid: "06:00", tilTid: "07:10",
        erReise: false, kortId: randomUUID(),
      },
    });
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } })).fraTid).toBe("07:10");
  });

  it("en annen brukers sedel → FORBIDDEN, ingenting flyttet", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await expect(
      dag(ANNEN).tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } })).fraTid).toBe("07:00");
  });

  it("sendt sedel → PRECONDITION_FAILED, ingenting flyttet", async () => {
    const sid = await lagSedel("2026-11-24");
    const jobb = await lagJobb(sid);
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "sent" } });
    await expect(
      dag().tilfoyTimerRad(reise(sid, jobb.kortId, { flyttRad: { radId: jobb.id, nyFra: "07:50" } })),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb.id } })).fraTid).toBe("07:00");
  });
});
