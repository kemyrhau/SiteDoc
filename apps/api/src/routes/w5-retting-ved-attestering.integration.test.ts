import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * Web-timeføring w5 — gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse,
 * aldri test/prod).
 *
 * B10: attesteringsrett erstatter kravet om firma-admin for retting når «rediger ved attestering»
 *      er på. Attestanten (prosjektmedlem med kanAttestere, aktiv ansatt, ikke firma-admin) kan
 *      rette med innstillingen på og avvises med den av. Annet firma og annet prosjekt avvises.
 * Hele jobben: `flyttTimerRadEco` med `helJobb` gir alle radene på kortet nytt underprosjekt.
 * Del opp: `delJobb` forhåndsviser uten å skrive, og deler jobben ved klokkeslettet i to kort.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f5) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f5-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02");
const ARB = id("03"); // arbeideren
const ATT = id("04"); // attestant i ORG på P1 (ikke firma-admin)
const ATT2 = id("05"); // attestant på P1, men ansatt i ORG2
const P1 = id("11");
const P2 = id("12"); // ATT er medlem uten attesteringsrett
const ECO_1 = id("31");
const ORD = id("41");
const AKT = id("43");
const MASKIN = id("51");

const BRUKERE = [ARB, ATT, ATT2];

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
const dag = (userId: string) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000);

/** Innsendt sedel med én jobb (kort): 07:00–11:00 og 11:00–15:00, maskin 07:00–09:00 på første rad. */
async function nyJobb(projectId = P1) {
  const sheetId = randomUUID();
  const kortId = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sheetId, clientUuid: sheetId, organizationId: ORG, userId: ARB, registrertAvUserId: ARB,
      aktivitetId: AKT, dato: nyDato(), status: "sent",
    },
  });
  const rad = (fraTid: string, tilTid: string) =>
    prismaTimer.sheetTimer.create({
      data: { sheetId, projectId, lonnsartId: ORD, aktivitetId: AKT, fraTid, tilTid, timer: 4, kortId },
    });
  const r1 = await rad("07:00", "11:00");
  const r2 = await rad("11:00", "15:00");
  const m = await prismaTimer.sheetMachine.create({
    data: { sheetId, sheetTimerId: r1.id, vehicleId: MASKIN, projectId, fraTid: "07:00", tilTid: "09:00", timer: 2, kortId },
  });
  return { sheetId, kortId, r1: r1.id, r2: r2.id, maskin: m.id };
}

async function settRedigering(paa: boolean) {
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { tillattRedigerVedAttestering: paa } });
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: ORD } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "w5-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: ATT, email: "w5-attestant@sitedoc.test", name: "Attestant", role: "user" },
      { id: ATT2, email: "w5-attestant-annet@sitedoc.test", name: "Attestant annet firma", role: "user" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "w5-firma" }, { id: ORG2, name: "w5-annet-firma" }] });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: ATT, organizationId: ORG, status: "aktiv" }, // ingen firma_admin
      { userId: ATT2, organizationId: ORG2, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, tillattRedigerVedAttestering: true } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "W5-1", name: "w5 P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "W5-2", name: "w5 P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P1, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: ATT, projectId: P1, role: "member", kanAttestere: true },
      { userId: ATT, projectId: P2, role: "member" },
      { userId: ATT2, projectId: P1, role: "member", kanAttestere: true },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.externalCostObject.create({
    data: { id: ECO_1, organizationId: ORG, projectId: P1, proAdmId: "W5-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ATT },
  });
  await prismaTimer.lonnsart.create({ data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaMaskin.equipment.create({ data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);
beforeEach(() => settRedigering(true));

const timerFor = async (radId: string) =>
  Number((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radId } })).timer);

describe("B10 — attesteringsrett erstatter firma-admin for retting", () => {
  it("attestant uten firma-admin retter når «rediger ved attestering» er på", async () => {
    const j = await nyJobb();
    await dag(ATT).rettRadFelt({ radType: "timer", radId: j.r1, felter: { tilTid: "10:30", timer: 3.5 } });
    expect(await timerFor(j.r1)).toBe(3.5);
  });

  it("samme attestant avvises når innstillingen er av — ingenting skrevet", async () => {
    const j = await nyJobb();
    await settRedigering(false);
    await expect(dag(ATT).rettRadFelt({ radType: "timer", radId: j.r1, felter: { tilTid: "10:30", timer: 3.5 } })).rejects.toThrow();
    expect(await timerFor(j.r1)).toBe(4);
  });

  it("rad på et prosjekt der brukeren ikke har attesteringsrett, avvises", async () => {
    const j = await nyJobb(P2);
    await expect(dag(ATT).rettRadFelt({ radType: "timer", radId: j.r1, felter: { tilTid: "10:30", timer: 3.5 } })).rejects.toThrow(/FORBIDDEN|attester/i);
    expect(await timerFor(j.r1)).toBe(4);
  });

  it("attestant i et annet firma avvises, selv med kanAttestere på prosjektet", async () => {
    const j = await nyJobb();
    await expect(dag(ATT2).rettRadFelt({ radType: "timer", radId: j.r1, felter: { tilTid: "10:30", timer: 3.5 } })).rejects.toThrow(/firmaet/);
    expect(await timerFor(j.r1)).toBe(4);
  });

  it("arbeideren selv (ingen attesteringsrett) avvises", async () => {
    const j = await nyJobb();
    await expect(dag(ARB).rettRadFelt({ radType: "timer", radId: j.r1, felter: { tilTid: "10:30", timer: 3.5 } })).rejects.toThrow();
    expect(await timerFor(j.r1)).toBe(4);
  });
});

describe("w5 — underprosjekt for hele jobben", () => {
  it("helJobb: alle timerrader og maskinen på kortet får underprosjektet; kortet beholdes", async () => {
    const j = await nyJobb();
    await dag(ATT).flyttTimerRadEco({ timerRadId: j.r1, radType: "timer", externalCostObjectId: ECO_1, helJobb: true });
    const timer = await prismaTimer.sheetTimer.findMany({ where: { sheetId: j.sheetId } });
    const maskin = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } });
    expect(timer.map((r) => r.externalCostObjectId)).toEqual([ECO_1, ECO_1]);
    expect(timer.every((r) => r.kortId === j.kortId)).toBe(true);
    expect(maskin.externalCostObjectId).toBe(ECO_1);
  });

  it("uten helJobb flyttes bare raden (som før)", async () => {
    const j = await nyJobb();
    await dag(ATT).flyttTimerRadEco({ timerRadId: j.r1, radType: "timer", externalCostObjectId: ECO_1 });
    const r2 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: j.r2 } });
    expect(r2.externalCostObjectId).toBeNull();
  });

  it("attestant i annet firma kan ikke flytte jobben", async () => {
    const j = await nyJobb();
    await expect(
      dag(ATT2).flyttTimerRadEco({ timerRadId: j.r1, radType: "timer", externalCostObjectId: ECO_1, helJobb: true }),
    ).rejects.toThrow(/firmaet/);
  });
});

describe("w5 — «Del opp» ved klokkeslett", () => {
  it("forhåndsvisning regner timene og skriver ingenting", async () => {
    const j = await nyJobb();
    const svar = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: null, forhandsvis: true });
    expect(svar).toMatchObject({ forhandsvisning: { timerA: 3, timerB: 5 } });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: j.sheetId } })).toBe(2);
  });

  it("deler jobben: del A beholder kortet og maskinen, del B er et eget kort", async () => {
    const j = await nyJobb();
    await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1 });
    const rader = await prismaTimer.sheetTimer.findMany({
      where: { sheetId: j.sheetId, attestertStatus: { not: "erstattet" } },
      orderBy: { fraTid: "asc" },
    });
    const a = rader.filter((r) => r.kortId === j.kortId);
    const b = rader.filter((r) => r.kortId !== j.kortId);
    expect(a.map((r) => [r.fraTid, r.tilTid])).toEqual([["07:00", "10:00"]]);
    expect(b.map((r) => [r.fraTid, r.tilTid])).toEqual([["10:00", "11:00"], ["11:00", "15:00"]]);
    expect(new Set(b.map((r) => r.kortId)).size).toBe(1);
    expect(b.every((r) => r.externalCostObjectId === ECO_1)).toBe(true);
    const sum = rader.reduce((s, r) => s + Number(r.timer), 0);
    expect(sum).toBe(8);
    const maskin = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } });
    expect(maskin.kortId).toBe(j.kortId);
  });

  it("avvises når «rediger ved attestering» er av", async () => {
    const j = await nyJobb();
    await settRedigering(false);
    await expect(
      dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: null }),
    ).rejects.toThrow();
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: j.sheetId } })).toBe(2);
  });

  it("avvises for attestant i annet firma", async () => {
    const j = await nyJobb();
    await expect(
      dag(ATT2).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: null }),
    ).rejects.toThrow(/firmaet/);
  });

  it("klokkeslett utenfor jobben avvises", async () => {
    const j = await nyJobb();
    await expect(
      dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "16:00", externalCostObjectIdB: null }),
    ).rejects.toThrow(/mellom jobbens start og slutt/);
  });

  it("rader uten kort-id er ingen jobb — ukjent kort avvises", async () => {
    const j = await nyJobb();
    await expect(
      dag(ATT).delJobb({ sheetId: j.sheetId, kortId: randomUUID(), kl: "10:00", externalCostObjectIdB: null }),
    ).rejects.toThrow();
  });
});
