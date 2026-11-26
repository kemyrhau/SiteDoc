import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O25 REISE-KUN-FRA-REISEVINDU (Kenneth 2026-11-26): «reise må registreres som reise, uavhengig
 * av hva firmaet velger som lønnsart». Firmaet her har reise-lønnsart = standard-lønnsart =
 * Timelønn (som SITEDOC MYRHAUG i prod). En rad er reise bare når den lagres fra reisevinduet
 * (eksplisitt flagg eller reisespor); lønnsarten avgjør aldri.
 *
 * Mot ekte Postgres (lokal sandkasse). Faste id-er med prefiks 0250e5f0, ryddes i afterAll.
 */

const id = (n: string) => `0250e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("03");
const P1 = id("11");
const TL = id("41"); // Timelønn: standardvalg OG firmaets reise-lønnsart
const AKT = id("43");
const BRUKERE = [USER, ADMIN];

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

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

async function nySedel(status = "draft") {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      aktivitetId: AKT,
      dato: new Date(nyDato()),
      status,
    },
  });
  return sid;
}

async function arbeidsrad(sheetId: string, kortId: string | null = null) {
  return prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: P1, lonnsartId: TL, aktivitetId: AKT,
      fraTid: "07:00", tilTid: "11:00", timer: 4, kortId, beskrivelse: "Graving",
    },
  });
}

const raderPaa = (sheetId: string) =>
  prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { createdAt: "asc" } });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: TL } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "o25-arbeider@sitedoc.test", name: "Arbeider O25", role: "user" },
      { id: ADMIN, email: "o25-admin@sitedoc.test", name: "Admin O25", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "O25-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O25-1", name: "O25 P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.create({
    data: { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  // Firmaoppsettet fra prod: reise-lønnsart = standard-lønnsart = Timelønn.
  await prisma.organizationSetting.create({
    data: {
      organizationId: ORG,
      reiseLonnsartId: TL,
      tillattRedigerVedAttestering: true,
      timerRegistreringsmodus: "prosjektkort",
    },
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O25 — reise bare fra reisevinduet, aldri fra lønnsarten (reise-art = standard = Timelønn)", () => {
  it("(1) «+ Registrer timer»: dagens første rad er arbeid", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    await dag().opprett({
      clientUuid,
      aktivitetId: AKT,
      projectId: P1,
      dato,
      organizationId: ORG,
      startAt: `${dato}T05:00:00.000Z`,
      endAt: `${dato}T09:00:00.000Z`,
    });
    const r = await raderPaa(clientUuid);
    expect(r).toHaveLength(1);
    expect(r[0]!.lonnsartId).toBe(TL);
    expect(r[0]!.erReise).toBe(false);
  });

  it("(2) «+ Timer» med Timelønn: arbeid", async () => {
    const sid = await nySedel();
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: TL, aktivitetId: AKT,
      timer: 2, fraTid: "12:00", tilTid: "14:00", pauseMin: 0,
    });
    const r = await raderPaa(sid);
    expect(r).toHaveLength(1);
    expect(r[0]!.erReise).toBe(false);
  });

  it("(3) reise fra reisevinduet med Timelønn: reise (eksplisitt flagg + spor)", async () => {
    const sid = await nySedel();
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: TL, aktivitetId: AKT,
      timer: 1, fraTid: "06:00", tilTid: "07:00", pauseMin: 0,
      erReise: true, reiseKilde: "manuell", reiseRetning: "ut",
    });
    const r = await raderPaa(sid);
    expect(r).toHaveLength(1);
    expect(r[0]!.erReise).toBe(true);
    expect(r[0]!.reiseKilde).toBe("manuell");
  });

  it("(3b) «Føres som reisetid» i reisevinduet på en Timelønn-rad: reise", async () => {
    const sid = await nySedel();
    const rad = await arbeidsrad(sid);
    await dag().oppdaterTimerRad({ id: rad.id, fraTid: "07:00", tilTid: "11:00", erReise: true });
    const etter = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: rad.id } });
    expect(etter.erReise).toBe(true);
    // … og «Føres som arbeidstid» tilbake.
    await dag().oppdaterTimerRad({ id: rad.id, fraTid: "07:00", tilTid: "11:00", erReise: false });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: rad.id } })).erReise).toBe(false);
  });

  it("(3c) bytte av lønnsart uten flagg beholder radens flagg", async () => {
    const sid = await nySedel();
    const rad = await prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: P1, lonnsartId: TL, aktivitetId: AKT,
        fraTid: "06:00", tilTid: "07:00", timer: 1, erReise: true, reiseKilde: "manuell",
      },
    });
    await dag().oppdaterTimerRad({ id: rad.id, fraTid: "06:00", tilTid: "07:00", lonnsartId: TL });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: rad.id } })).erReise).toBe(true);
  });

  it("(4) jobb med Timelønn godtas (lagreJobbTid)", async () => {
    const sid = await nySedel();
    const kortId = randomUUID();
    const rad = await arbeidsrad(sid, kortId);
    await dag().lagreJobbTid({
      sheetId: sid, kortId, fraTid: "07:00", tilTid: "10:00", pauseMin: 0,
      linjer: [{ radId: rad.id, lonnsartId: TL }],
    });
    const etter = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: rad.id } });
    expect(etter.tilTid).toBe("10:00");
    expect(etter.erReise).toBe(false);
  });

  it("(6) rediger i attestering av en arbeidsrad med Timelønn beholder erReise: false", async () => {
    const sid = await nySedel("sent");
    const rad = await arbeidsrad(sid);
    await dag(ADMIN).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: rad.id, projectId: P1, lonnsartId: TL, aktivitetId: AKT, fraTid: "07:00", tilTid: "10:00", timer: 3, pauseMin: 0 },
          { originalId: null, projectId: P1, lonnsartId: TL, aktivitetId: AKT, fraTid: "12:00", tilTid: "13:00", timer: 1, pauseMin: 0 },
        ],
        tillegg: [],
        maskin: [],
      },
    });
    const r = (await raderPaa(sid)).filter((x) => x.attestertStatus === "pending");
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.erReise)).toEqual([false, false]);
  });

  it("(6b) rediger i attestering av en reise beholder reisen", async () => {
    const sid = await nySedel("sent");
    const reise = await prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: P1, lonnsartId: TL, aktivitetId: AKT,
        fraTid: "06:00", tilTid: "07:00", timer: 1, erReise: true, reiseKilde: "manuell",
      },
    });
    await dag(ADMIN).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: reise.id, projectId: P1, lonnsartId: TL, aktivitetId: AKT, fraTid: "06:00", tilTid: "07:30", timer: 1.5, pauseMin: 0 },
        ],
        tillegg: [],
        maskin: [],
      },
    });
    const r = (await raderPaa(sid)).filter((x) => x.attestertStatus === "pending");
    expect(r).toHaveLength(1);
    expect(r[0]!.erReise).toBe(true);
  });
});
