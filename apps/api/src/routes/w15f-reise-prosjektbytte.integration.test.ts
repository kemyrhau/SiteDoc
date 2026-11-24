import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * w15f (web-timeforing-plan.md § 4.15 del F og H pkt. 20–23): prosjektet kan byttes på en
 * reise som finnes — mot EKTE Postgres (lokal engangs-DB, aldri test/prod).
 *
 * 20: pennen (`oppdaterTimerRad`) bytter prosjekt, byggeplass og underprosjekt på en reise;
 *     samme id, reisesporet urørt, kortet etter regelen.
 * 21: pennen avviser arbeidsrad, annet firma, prosjekt uten medlemskap, sted fra det gamle
 *     prosjektet, attestert reise, låst dagsseddel. I tillegg (LØSNING GODKJENT (a)): reise med
 *     koblet vare eller maskin.
 * 22: attesteringen (`rettRadFelt`) bytter prosjekt med rett på begge prosjektene; avvist uten
 *     rett på målprosjektet, med firmavalget av, på egen sedel med B15 «Nei», og i annet firma.
 * 23: F51 — `rettRadFelt` med bare nytt prosjekt lar ikke underprosjektet fra det gamle stå.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f6) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f6-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02");
const ARB = id("03"); // arbeideren
const ATT = id("04"); // attestant med rett på P1 og P2
const ATT1 = id("05"); // attestant med rett bare på P1
const P1 = id("11");
const P2 = id("12");
const P3 = id("13"); // ORG, arbeideren er ikke medlem
const PX = id("14"); // ORG2
const BP1 = id("21"); // i P1
const BP2 = id("22"); // i P2
const ECO1 = id("31"); // i P1
const ECO2 = id("32"); // i P2
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const MASKIN = id("51"); // døgn-maskin (krever ikke timerad)
const VARE = id("61");

const BRUKERE = [ARB, ATT, ATT1];

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
const dag = (userId = ARB) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 7, 1) + datoTeller++ * 86_400_000);

async function nySedel(opts: { userId?: string; status?: string } = {}) {
  const sid = randomUUID();
  const userId = opts.userId ?? ARB;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid, clientUuid: sid, organizationId: ORG, userId, registrertAvUserId: userId,
      aktivitetId: AKT, dato: nyDato(), status: opts.status ?? "draft",
    },
  });
  return sid;
}

const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const timerMellom = (fra: string, til: string) => (min(til) - min(fra)) / 60;

/** Arbeid lagt rått (status «pending»), kort-id regnes av første skriving. */
async function raArbeid(sheetId: string, f: { projectId: string; bp?: string | null; eco?: string | null; fra: string; til: string }) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: f.projectId, byggeplassId: f.bp ?? null, externalCostObjectId: f.eco ?? null,
      lonnsartId: ORD, aktivitetId: AKT, fraTid: f.fra, tilTid: f.til, timer: timerMellom(f.fra, f.til), kortId: randomUUID(),
    },
  });
  return r;
}

async function raReise(sheetId: string, f: { projectId?: string; bp?: string | null; eco?: string | null; status?: string } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      byggeplassId: f.bp ?? null,
      externalCostObjectId: f.eco ?? null,
      lonnsartId: REISE,
      aktivitetId: AKT,
      erReise: true,
      reiseRetning: "retur",
      reiseKilde: "manuell",
      reiseKjoretidMin: 35,
      reiseAvstandM: 41_000,
      fraTid: "15:00",
      tilTid: "15:35",
      timer: 0.58,
      attestertStatus: f.status ?? "pending",
    },
  });
  return r.id;
}

const rad = (rid: string) => prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: rid } });

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
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO1, ECO2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: { in: [BP1, BP2] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2, P3, PX] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2, P3, PX] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2, P3, PX] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "w15f-arbeider@sitedoc.test", name: "Ola", role: "user" },
      { id: ATT, email: "w15f-attestant@sitedoc.test", name: "Attestant", role: "user" },
      { id: ATT1, email: "w15f-attestant-p1@sitedoc.test", name: "Attestant P1", role: "user" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "w15f-firma" }, { id: ORG2, name: "w15f-annet" }] });
  await prisma.organizationMember.createMany({
    data: [ARB, ATT, ATT1].map((u) => ({ userId: u, organizationId: ORG, status: "aktiv" })),
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((m) => ({ organizationId: ORG, moduleSlug: m, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true, tillattSelvAttestering: false },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "W15F-1", name: "w15f P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "W15F-2", name: "w15f P2", primaryOrganizationId: ORG },
      { id: P3, projectNumber: "W15F-3", name: "w15f P3", primaryOrganizationId: ORG },
      { id: PX, projectNumber: "W15F-X", name: "w15f annet firma", primaryOrganizationId: ORG2 },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P1, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: ARB, projectId: PX, role: "member" },
      { userId: ATT, projectId: P1, role: "member", kanAttestere: true },
      { userId: ATT, projectId: P2, role: "member", kanAttestere: true },
      { userId: ATT, projectId: PX, role: "member", kanAttestere: true },
      { userId: ATT1, projectId: P1, role: "member", kanAttestere: true },
      { userId: ATT1, projectId: P2, role: "member" },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2, P3].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.byggeplass.createMany({
    data: [
      { id: BP1, projectId: P1, name: "w15f B1" },
      { id: BP2, projectId: P2, name: "w15f B2" },
    ],
  });
  await prisma.externalCostObject.createMany({
    data: [
      { id: ECO1, organizationId: ORG, projectId: P1, proAdmId: "W15F-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ATT },
      { id: ECO2, organizationId: ORG, projectId: P2, proAdmId: "W15F-E2", kortNavn: "Mur", kilde: "manuell", opprettetAvUserId: ATT },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "brakke", merke: "Brakke", modell: "B12", utleieEnhet: "doegn" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);
beforeEach(() => settRedigering(true));

const tid = { fraTid: "15:00", tilTid: "15:35" };

// ════════════════════════════════════════════════════════════════════════════
//  20 — pennen bytter prosjekt på en reise
// ════════════════════════════════════════════════════════════════════════════
describe("w15f pkt. 20 — oppdaterTimerRad bytter prosjekt på en reise", () => {
  it("reisen får prosjekt, byggeplass og underprosjekt; samme id; reisesporet urørt; står i jobben på det nye stedet", async () => {
    const sid = await nySedel();
    await raArbeid(sid, { projectId: P1, fra: "07:00", til: "11:00" });
    const jobbP2 = await raArbeid(sid, { projectId: P2, bp: BP2, eco: ECO2, fra: "11:00", til: "14:30" });
    const reise = await raReise(sid);
    await dag().oppdaterTimerRad({ id: reise, ...tid });
    const foer = await rad(reise);

    await dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: BP2, externalCostObjectId: ECO2 });
    const etter = await rad(reise);
    expect(etter.id).toBe(reise);
    expect(etter.projectId).toBe(P2);
    expect(etter.byggeplassId).toBe(BP2);
    expect(etter.externalCostObjectId).toBe(ECO2);
    expect(etter.erReise).toBe(true);
    expect(etter.reiseRetning).toBe(foer.reiseRetning);
    expect(etter.reiseKilde).toBe(foer.reiseKilde);
    expect(etter.reiseKjoretidMin).toBe(foer.reiseKjoretidMin);
    expect(etter.reiseAvstandM).toBe(foer.reiseAvstandM);
    expect(etter.reiseOppmotestedId).toBe(foer.reiseOppmotestedId);
    expect(etter.fraTid).toBe("15:00");
    expect(etter.tilTid).toBe("15:35");
    expect(etter.kortId).toBe((await rad(jobbP2.id)).kortId);
  });

  it("uten jobb på det nye stedet får reisen eget kort", async () => {
    const sid = await nySedel();
    const jobb = await raArbeid(sid, { projectId: P1, fra: "07:00", til: "11:00" });
    const reise = await raReise(sid);
    await dag().oppdaterTimerRad({ id: reise, ...tid });
    expect((await rad(reise)).kortId).toBe((await rad(jobb.id)).kortId);

    await dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: null });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P2);
    expect(etter.kortId).not.toBeNull();
    expect(etter.kortId).not.toBe((await rad(jobb.id)).kortId);
  });

  it("samme prosjekt sendt på nytt er ingen endring (pennen sender alltid feltet)", async () => {
    const sid = await nySedel();
    await raArbeid(sid, { projectId: P1, bp: BP1, fra: "07:00", til: "11:00" });
    const reise = await raReise(sid, { bp: BP1 });
    await dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P1 });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P1);
    expect(etter.byggeplassId).toBe(BP1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  21 — pennen avviser
// ════════════════════════════════════════════════════════════════════════════
describe("w15f pkt. 21 — oppdaterTimerRad avviser prosjektbyttet", () => {
  it("prosjekt på en arbeidsrad", async () => {
    const sid = await nySedel();
    const jobb = await raArbeid(sid, { projectId: P1, fra: "07:00", til: "11:00" });
    await expect(
      dag().oppdaterTimerRad({ id: jobb.id, fraTid: "07:00", tilTid: "11:00", projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await rad(jobb.id)).projectId).toBe(P1);
  });

  it("reise som blir arbeid i samme kall, kan ikke bytte prosjekt (raden må være reise etter skrivingen)", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid);
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, lonnsartId: ORD, projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P1);
    expect(etter.erReise).toBe(true);
  });

  it("prosjekt i et annet firma (isolasjon)", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid);
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: PX, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("prosjekt arbeideren ikke er medlem av", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid);
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P3, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("byggeplass som hører til det gamle prosjektet", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid, { bp: BP1 });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: BP1, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Utelatt byggeplass betyr «urørt» — den gamle hører ikke til P2, og tømmes ikke stille.
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P1);
    expect(etter.byggeplassId).toBe(BP1);
  });

  it("underprosjekt som hører til det gamle prosjektet", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid, { eco: ECO1 });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: ECO1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await rad(reise)).externalCostObjectId).toBe(ECO1);
  });

  it("attestert reise", async () => {
    const sid = await nySedel({ status: "returned" });
    const reise = await raReise(sid, { status: "attestert" });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("låst dagsseddel", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid);
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("reise med koblet vare: avvist med varens navn, ingenting endret", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid);
    await prismaVarelager.vareforbruk.create({
      data: { dato: nyDato(), projectId: P1, vareId: VARE, antall: 2, registrertAvUserId: ARB, dagsseddelId: sid, sheetTimerId: reise },
    });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Pukk 6-32") });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("reise med koblet maskin: avvist med maskinens navn, ingenting endret", async () => {
    const sid = await nySedel();
    const reise = await raReise(sid);
    await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, sheetTimerId: reise, vehicleId: MASKIN, projectId: P1, timer: 1 },
    });
    await expect(
      dag().oppdaterTimerRad({ id: reise, ...tid, projectId: P2, byggeplassId: null, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Brakke B12") });
    expect((await rad(reise)).projectId).toBe(P1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  22 — attesteringen bytter prosjekt på en reise
// ════════════════════════════════════════════════════════════════════════════
describe("w15f pkt. 22 — rettRadFelt bytter prosjekt på en reise", () => {
  it("attestant med rett på begge prosjektene: lagret, historikkpost, kort etter regelen", async () => {
    const sid = await nySedel({ status: "sent" });
    await raArbeid(sid, { projectId: P1, fra: "07:00", til: "11:00" });
    const jobbP2 = await raArbeid(sid, { projectId: P2, bp: BP2, fra: "11:00", til: "14:30" });
    const reise = await raReise(sid);
    await dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, byggeplassId: BP2, externalCostObjectId: null } });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P2);
    expect(etter.byggeplassId).toBe(BP2);
    expect(etter.kortId).toBe((await rad(jobbP2.id)).kortId);
    const historikk = await prismaTimer.sheetRadHistorikk.count({ where: { sheetId: sid } });
    expect(historikk).toBeGreaterThan(0);
  });

  it("uten rett på målprosjektet: avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid);
    await expect(
      dag(ATT1).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: null } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("firmavalget av: avvist", async () => {
    await settRedigering(false);
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid);
    await expect(
      dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: null } }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("egen dagsseddel når firmaet sier Nei (B15): avvist", async () => {
    const sid = await nySedel({ status: "sent", userId: ATT });
    const reise = await raReise(sid);
    await expect(
      dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: null } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("prosjekt i et annet firma: avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid);
    await expect(
      dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: PX, byggeplassId: null, externalCostObjectId: null } }),
    ).rejects.toThrow();
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("reise med koblet vare: avvist med varens navn", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid);
    await prismaVarelager.vareforbruk.create({
      data: { dato: nyDato(), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: ARB, dagsseddelId: sid, sheetTimerId: reise },
    });
    await expect(
      dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: null } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Pukk 6-32") });
    expect((await rad(reise)).projectId).toBe(P1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  23 — F51: underprosjektet følger prosjektet
// ════════════════════════════════════════════════════════════════════════════
describe("w15f pkt. 23 — rettRadFelt holder underprosjektet mot prosjektet (F51)", () => {
  it("bare nytt prosjekt: underprosjektet fra det gamle prosjektet står ikke igjen", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid, { eco: ECO1 });
    await dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2 } });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P2);
    expect(etter.externalCostObjectId).toBeNull();
  });

  it("nytt prosjekt med underprosjekt fra det gamle prosjektet: avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid, { eco: ECO1 });
    await expect(
      dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, externalCostObjectId: ECO1 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await rad(reise)).projectId).toBe(P1);
  });

  it("nytt prosjekt med underprosjekt i det nye prosjektet: lagret", async () => {
    const sid = await nySedel({ status: "sent" });
    const reise = await raReise(sid, { eco: ECO1 });
    await dag(ATT).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2, externalCostObjectId: ECO2 } });
    const etter = await rad(reise);
    expect(etter.projectId).toBe(P2);
    expect(etter.externalCostObjectId).toBe(ECO2);
  });
});
