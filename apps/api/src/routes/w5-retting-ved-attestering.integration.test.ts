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
 *   Maskin, varer, tillegg, utlegg og reise blir i A (§ 8.22, Kenneth 2026-11-21).
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
const VARE = id("61");

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
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
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
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
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

  /** Alt delingen kan skrive: timerrader, maskinen og historikken. Lik før og etter = ingenting skrevet. */
  const tilstand = async (j: Awaited<ReturnType<typeof nyJobb>>) => ({
    timer: (await prismaTimer.sheetTimer.findMany({ where: { sheetId: j.sheetId }, orderBy: { fraTid: "asc" } })).map((r) => [
      r.id, r.fraTid, r.tilTid, Number(r.timer), r.pauseMin, r.kortId, r.externalCostObjectId, r.attestertStatus,
    ]),
    maskin: await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } }),
    historikk: await prismaTimer.sheetRadHistorikk.count({ where: { sheetId: j.sheetId } }),
  });

  it("maskin og vare koblet til en rad som går til B, blir i A og kobles til en rad i A (§ 8.22)", async () => {
    const j = await nyJobb();
    // Maskin 12:00–14:00 og en vare, begge koblet til raden 11–15 som går helt til B ved kl. 11:00.
    // Maskinen går også over et klokkeslett — det avvises ikke lenger (maskinen deles ikke).
    await prismaTimer.sheetMachine.update({
      where: { id: j.maskin },
      data: { sheetTimerId: j.r2, fraTid: "12:00", tilTid: "14:00", timer: 2 },
    });
    const v = await prismaVarelager.vareforbruk.create({
      data: {
        dato: new Date("2026-09-01"), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: ARB,
        dagsseddelId: j.sheetId, sheetTimerId: j.r2, kortId: j.kortId,
      },
    });
    const forh = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "11:00", externalCostObjectIdB: ECO_1, forhandsvis: true });
    expect(forh.forhandsvisning).toMatchObject({ timerA: 4, timerB: 4, maskinPaaA: 1 });
    // O15: maskinen (2 t) får plass i A (4 t arbeid) — forslaget er A 2 · B 0.
    expect(forh.forhandsvisning?.maskiner).toEqual([{ id: j.maskin, navn: expect.any(String), timer: 2, timerA: 2, timerB: 0 }]);
    const svar = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "11:00", externalCostObjectIdB: ECO_1 });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: j.r2 } })).kortId).toBe(svar.kortIdB);
    const maskin = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } });
    expect([maskin.kortId, maskin.sheetTimerId, maskin.externalCostObjectId]).toEqual([j.kortId, j.r1, null]);
    const vare = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } });
    expect([vare.kortId, vare.sheetTimerId, vare.externalCostObjectId]).toEqual([j.kortId, j.r1, null]);
  });

  it("maskin over klokkeslettet på en rad som deles, blir i A; ingen avvisning", async () => {
    const j = await nyJobb();
    // Kontrollørens eksempel fra gate 98: rad 07–11, maskin 09:00–10:00, delt kl. 09:30.
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: "09:00", tilTid: "10:00", timer: 1 } });
    await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "09:30", externalCostObjectIdB: ECO_1 });
    const maskin = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } });
    expect([maskin.kortId, maskin.sheetTimerId]).toEqual([j.kortId, j.r1]);
  });

  it("O15 (s2.ja): maskintimer A + B sendt som alt i A, over del A → avvist med komma, ingenting skrives", async () => {
    const j = await nyJobb();
    // Maskin uten klokkeslett med 3,5 t på første rad; delt kl. 10:00 gir del A 3 t.
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: null, tilTid: null, timer: 3.5 } });
    const for_ = await tilstand(j);
    const feil = await dag(ATT)
      .delJobb({
        sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1,
        maskinDeling: [{ id: j.maskin, timerA: 3.5, timerB: 0 }],
      })
      .then(() => null, (e: unknown) => e);
    expect((feil as Error).message).toMatch(/Jobb A: maskin 3,5 t, arbeid 3 t/);
    expect((feil as Error).message).not.toMatch(/\d\.\d t/);
    expect(await tilstand(j)).toEqual(for_);
  });

  it("O15 (s2.ja, bilde 20): uten deling brukes forslaget — A 3 · B 0,5, B får egen maskinrad i nytt kort", async () => {
    const j = await nyJobb();
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: null, tilTid: null, timer: 3.5 } });
    const forh = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1, forhandsvis: true });
    expect(forh.forhandsvisning?.maskiner).toEqual([{ id: j.maskin, navn: expect.any(String), timer: 3.5, timerA: 3, timerB: 0.5 }]);
    const svar = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1 });
    const maskiner = await prismaTimer.sheetMachine.findMany({ where: { sheetId: j.sheetId }, orderBy: { timer: "desc" } });
    expect(maskiner.map((m) => [Number(m.timer), m.kortId, m.externalCostObjectId])).toEqual([
      [3, j.kortId, null],
      [0.5, svar.kortIdB, ECO_1],
    ]);
    const b = maskiner[1]!;
    expect(b.parentRadId).toBe(j.maskin);
    expect(b.vehicleId).toBe(MASKIN);
    const bRad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: b.sheetTimerId! } });
    expect(bRad.kortId).toBe(svar.kortIdB);
    expect(await prismaTimer.sheetRadHistorikk.count({ where: { originalRadId: j.maskin } })).toBe(1);
  });

  it("O15: attestantens deling (A 2 · B 1,5) skrives som sendt", async () => {
    const j = await nyJobb();
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: null, tilTid: null, timer: 3.5 } });
    await dag(ATT).delJobb({
      sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1,
      maskinDeling: [{ id: j.maskin, timerA: 2, timerB: 1.5 }],
    });
    const timer = (await prismaTimer.sheetMachine.findMany({ where: { sheetId: j.sheetId } })).map((m) => Number(m.timer)).sort();
    expect(timer).toEqual([1.5, 2]);
  });

  it("O15: A 0 flytter hele maskinen til B, ingen 0-rad", async () => {
    const j = await nyJobb();
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: null, tilTid: null, timer: 2 } });
    const svar = await dag(ATT).delJobb({
      sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1,
      maskinDeling: [{ id: j.maskin, timerA: 0, timerB: 2 }],
    });
    const maskiner = await prismaTimer.sheetMachine.findMany({ where: { sheetId: j.sheetId } });
    expect(maskiner.map((m) => [m.id, Number(m.timer), m.kortId, m.externalCostObjectId])).toEqual([[j.maskin, 2, svar.kortIdB, ECO_1]]);
  });

  it("O15 (beslutning a): A + B ulik maskinens timer avvises, ingenting skrives", async () => {
    const j = await nyJobb();
    const for_ = await tilstand(j);
    await expect(
      dag(ATT).delJobb({
        sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1,
        maskinDeling: [{ id: j.maskin, timerA: 1, timerB: 0.5 }],
      }),
    ).rejects.toThrow(/må til sammen bli 2 t/);
    expect(await tilstand(j)).toEqual(for_);
  });

  it("O15 (s3.nei, vakttest): vare, tillegg og reise blir i A når maskinen deles", async () => {
    const j = await nyJobb();
    await prismaTimer.sheetMachine.update({ where: { id: j.maskin }, data: { fraTid: null, tilTid: null, timer: 3.5 } });
    const v = await prismaVarelager.vareforbruk.create({
      data: {
        dato: new Date("2026-09-01"), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: ARB,
        dagsseddelId: j.sheetId, sheetTimerId: j.r2, kortId: j.kortId,
      },
    });
    const reise = await prismaTimer.sheetTimer.create({
      data: { sheetId: j.sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "15:00", tilTid: "15:30", timer: 0.5, kortId: j.kortId, erReise: true, reiseRetning: "retur" },
    });
    const svar = await dag(ATT).delJobb({ sheetId: j.sheetId, kortId: j.kortId, kl: "10:00", externalCostObjectIdB: ECO_1 });
    expect(svar.kortIdB).not.toBe(j.kortId);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } })).kortId).toBe(j.kortId);
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise.id } })).kortId).toBe(j.kortId);
    // Bare maskinens B-del står i B; maskinraden selv blir i A.
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: j.maskin } })).kortId).toBe(j.kortId);
  });

  it("omkoblet maskin (gate 123 vilkår 3): maskin på en rad som går helt til B, sendt som alt i A → avvist av maskinvakten, ingenting skrevet", async () => {
    const j = await nyJobb();
    // Maskin 5 t uten klokkeslett på raden 11–15. Delt kl. 11:00 går raden helt til B. Sendes alt
    // i A (4 t arbeid), avvises delingen. O15: forslaget ville gitt A 4 · B 1.
    await prismaTimer.sheetMachine.update({
      where: { id: j.maskin },
      data: { sheetTimerId: j.r2, fraTid: null, tilTid: null, timer: 5 },
    });
    const for_ = await tilstand(j);
    const feil = await dag(ATT)
      .delJobb({
        sheetId: j.sheetId, kortId: j.kortId, kl: "11:00", externalCostObjectIdB: ECO_1,
        maskinDeling: [{ id: j.maskin, timerA: 5, timerB: 0 }],
      })
      .then(() => null, (e: unknown) => e);
    expect(feil).toBeInstanceOf(Error);
    expect((feil as Error).message).toMatch(/maskin 5 t, arbeid 4 t/);
    expect(await tilstand(j)).toEqual(for_);
  });

  it("rader uten kort-id er ingen jobb — ukjent kort avvises", async () => {
    const j = await nyJobb();
    await expect(
      dag(ATT).delJobb({ sheetId: j.sheetId, kortId: randomUUID(), kl: "10:00", externalCostObjectIdB: null }),
    ).rejects.toThrow();
  });
});
