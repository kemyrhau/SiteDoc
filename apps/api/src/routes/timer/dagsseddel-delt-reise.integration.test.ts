import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { lesMidnattDel } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O19 (vedtak-timer-web.md § Reisevinduet pkt 23–24): reise over midnatt deles ved 24:00 og
 * skrives på to sedler i én transaksjon (`tilfoyDeltReise`) — begge eller ingen. Mot EKTE
 * Postgres (lokal sandkasse). Data med faste id-er (prefiks 01e19190) ryddes i afterAll.
 */

const id = (n: string) => `01e19190-0000-4000-8000-0000000000${n}`;
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
  await prisma.user.create({ data: { id: USER, email: "o19-midnatt@sitedoc.test", name: "Arbeider O19", role: "user" } });
  await prisma.user.create({ data: { id: ANNEN, email: "o19-annen@sitedoc.test", name: "Annen O19", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "O19-firma" } });
  await prisma.organization.create({ data: { id: ORG2, name: "O19-annet-firma" } });
  for (const [u, o] of [[USER, ORG], [ANNEN, ORG], [USER, ORG2]] as const) {
    await prisma.organizationMember.create({ data: { userId: u, organizationId: o, status: "aktiv" } });
  }
  for (const o of [ORG, ORG2]) {
    await prisma.organizationModule.create({ data: { organizationId: o, moduleSlug: "timer", status: "aktiv" } });
  }
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", reiseLonnsartId: REISE } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O19-1", name: "O19 Boligfelt", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.byggeplass.create({ data: { id: B1, projectId: P1, name: "O19 B12" } });
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

const deltInput = (sheetId: string, over: Record<string, unknown> = {}) => ({
  sheetId,
  vei: "fram" as const,
  del1: { fraTid: "21:00", tilTid: "24:00" as const },
  del2: { fraTid: "00:00" as const, tilTid: "00:53" },
  projectId: P1,
  byggeplassId: B1,
  lonnsartId: REISE,
  aktivitetId: AKT,
  reiseKilde: "manuell" as const,
  reiseRetning: "retur" as const,
  reiseOppmotestedId: KONTOR,
  reiseKjoretidMin: 233,
  reiseAvstandM: 250000,
  reiseRegel: regel,
  ...over,
});

async function radTelling() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  return prismaTimer.sheetTimer.count({ where: { sheetId: { in: sedler.map((s) => s.id) } } });
}

describe("O19 — tilfoyDeltReise", () => {
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

  it("fram: del 1 på 23.11 (21:00–24:00), del 2 på en ny sedel 24.11 (00:00–00:53), samme delId", async () => {
    const sid = await lagSedel("2026-11-23");
    const r = await dag().tilfoyDeltReise(deltInput(sid));
    const nabo = await prismaTimer.dailySheet.findUnique({ where: { userId_dato: { userId: USER, dato: new Date("2026-11-24") } } });
    expect(nabo).toMatchObject({ organizationId: ORG, status: "draft", aktivitetId: AKT });
    expect(r.naboSheetId).toBe(nabo!.id);
    const d1 = await prismaTimer.sheetTimer.findFirstOrThrow({ where: { sheetId: sid } });
    const d2 = await prismaTimer.sheetTimer.findFirstOrThrow({ where: { sheetId: nabo!.id } });
    expect(d1).toMatchObject({ fraTid: "21:00", tilTid: "24:00", erReise: true, reiseKilde: "manuell", pauseMin: 0 });
    expect(Number(d1.timer)).toBeCloseTo(3, 4);
    expect(d2).toMatchObject({ fraTid: "00:00", tilTid: "00:53", erReise: true });
    expect(Number(d2.timer)).toBeCloseTo(53 / 60, 2);
    const m1 = lesMidnattDel(d1.reiseRegel);
    const m2 = lesMidnattDel(d2.reiseRegel);
    expect(m1).toEqual({ delId: r.delId, del: 1 });
    expect(m2).toEqual({ delId: r.delId, del: 2 });
    // Delen på nabodagen har eget kort (kortet «med bare reisen»).
    expect(d2.kortId).toBeTruthy();
  });

  it("bak (pkt 24): del 1 på eksisterende sedel 22.11 (19:00–24:00), del 2 på 23.11 (00:00–07:00)", async () => {
    const sid = await lagSedel("2026-11-23");
    const forrige = await lagSedel("2026-11-22");
    await dag().tilfoyDeltReise(
      deltInput(sid, { vei: "bak", del1: { fraTid: "19:00", tilTid: "24:00" }, del2: { fraTid: "00:00", tilTid: "07:00" }, reiseRetning: "ut" }),
    );
    expect(await prismaTimer.sheetTimer.findFirst({ where: { sheetId: forrige } })).toMatchObject({ fraTid: "19:00", tilTid: "24:00" });
    expect(await prismaTimer.sheetTimer.findFirst({ where: { sheetId: sid } })).toMatchObject({ fraTid: "00:00", tilTid: "07:00" });
  });

  it("nabosedel sendt → ingenting lagres på noen sedel (telles før/etter)", async () => {
    const sid = await lagSedel("2026-11-23");
    await lagSedel("2026-11-24", { status: "sent" });
    const foer = await radTelling();
    await expect(dag().tilfoyDeltReise(deltInput(sid))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await radTelling()).toBe(foer);
  });

  it("nabosedel attestert → egen tekst, ingenting lagres", async () => {
    const sid = await lagSedel("2026-11-23");
    await lagSedel("2026-11-24", { status: "accepted" });
    await expect(dag().tilfoyDeltReise(deltInput(sid))).rejects.toThrow(/attestert/);
    expect(await radTelling()).toBe(0);
  });

  it("overlapp på nabodagen → ingenting skrevet, heller ikke del 1 (transaksjon)", async () => {
    const sid = await lagSedel("2026-11-23");
    const nabo = await lagSedel("2026-11-24");
    await dag().tilfoyTimerRad({
      sheetId: nabo, projectId: P1, byggeplassId: B1, lonnsartId: ORD, aktivitetId: AKT,
      timer: 1, fraTid: "00:30", tilTid: "01:30", pauseMin: 0,
    });
    await expect(dag().tilfoyDeltReise(deltInput(sid))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(0);
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: nabo } })).toBe(1);
  });

  it("en annen brukers sedel-id → FORBIDDEN, ingen nabosedel laget", async () => {
    const sid = await lagSedel("2026-11-23");
    await expect(dag(ANNEN).tilfoyDeltReise(deltInput(sid))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prismaTimer.dailySheet.count({ where: { userId: { in: [USER, ANNEN] } } })).toBe(1);
  });

  it("firma-isolasjon: sedelen dagen etter i et annet firma brukes ikke", async () => {
    const sid = await lagSedel("2026-11-23");
    const fremmed = await lagSedel("2026-11-24", { org: ORG2 });
    await expect(dag().tilfoyDeltReise(deltInput(sid))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: { in: [sid, fremmed] } } })).toBe(0);
  });

  it("finnReiseDel og fjernDeltReise: partneren finnes, «Slett begge» sletter begge", async () => {
    const sid = await lagSedel("2026-11-23");
    const r = await dag().tilfoyDeltReise(deltInput(sid));
    const partner = await dag().finnReiseDel({ radId: r.rad.id });
    expect(partner).toMatchObject({ id: r.naboRad.id, dato: "2026-11-24", fraTid: "00:00", tilTid: "00:53", del: 2 });
    await dag().fjernDeltReise({ id: r.rad.id });
    expect(await radTelling()).toBe(0);
  });

  it("fjernDeltReise: partnerens sedel sendt → ingenting slettes", async () => {
    const sid = await lagSedel("2026-11-23");
    const r = await dag().tilfoyDeltReise(deltInput(sid));
    await prismaTimer.dailySheet.update({ where: { id: r.naboSheetId }, data: { status: "sent" } });
    await expect(dag().fjernDeltReise({ id: r.rad.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await radTelling()).toBe(2);
  });

  it("negativkontroll: vanlig reise som slutter 24:00 har ingen partner", async () => {
    const sid = await lagSedel("2026-11-23");
    const rad = await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, byggeplassId: B1, lonnsartId: REISE, aktivitetId: AKT,
      timer: 1, fraTid: "23:00", tilTid: "24:00", pauseMin: 0,
    });
    expect(await dag().finnReiseDel({ radId: rad.id })).toBeNull();
  });
});
