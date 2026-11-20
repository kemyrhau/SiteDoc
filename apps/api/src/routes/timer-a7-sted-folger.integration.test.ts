import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * w3a (web-timeforing-plan § 4.13 A7, S4 C, S5 A) — stedet følger jobben, gjennom prosedyrene
 * (`createCaller`) mot EKTE Postgres (lokal engangs-DB, aldri test/prod).
 *
 * 1. `oppdaterTimerRad`: bytte av underprosjekt eller byggeplass tar med koblet maskin og vare
 *    i samme prosjekt. Ukoblet maskin, maskin i annet prosjekt og attestert maskin/vare står.
 * 2. `maskin.tilfoy` med kort-id (føring fra jobben) lagres med timeradens sted.
 * 3. `maskin.tilfoy` uten kort-id (dagskort-modus) lagrer vinduets sted uendret (S4 C).
 *
 * All data lages her med faste id-er (prefiks a7a7e5f0) og ryddes i afterAll.
 */

const id = (n: string) => `a7a7e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("04");
const P1 = id("11");
const P2 = id("12");
const BP_1 = id("21");
const BP_2 = id("22");
const ECO_1 = id("31");
const ECO_2 = id("32");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const MASKIN = id("51");
const VARE = id("61");

const BRUKERE = [USER, ADMIN];

function ctx(userId: string, varelager: unknown = prismaVarelager, logError: (...a: unknown[]) => void = () => {}) {
  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager: varelager,
    userId,
    actualUserId: userId,
    imperseringAktiv: false,
    sessionToken: null,
    tokenKilde: null,
    ipAddress: null,
    userAgent: null,
    req: { log: { info: () => {}, warn: () => {}, error: logError } },
    nyttSessionTokenForRespons: { value: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

async function nySedel() {
  const sid = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      aktivitetId: AKT,
      dato: new Date(dato),
      status: "draft",
      pauseMin: 0,
    },
  });
  return { sid, dato };
}

type Sted = { byggeplassId?: string | null; externalCostObjectId?: string | null };

async function timerRad(sheetId: string, kortId: string, sted: Sted = {}, projectId = P1) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId,
      lonnsartId: ORD,
      aktivitetId: AKT,
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 8,
      kortId,
      byggeplassId: sted.byggeplassId ?? null,
      externalCostObjectId: sted.externalCostObjectId ?? null,
    },
  });
  return r.id;
}

async function maskinRad(
  sheetId: string,
  f: Sted & { kortId: string | null; sheetTimerId?: string | null; projectId?: string; attestertStatus?: string },
) {
  const r = await prismaTimer.sheetMachine.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      vehicleId: MASKIN,
      timer: 2,
      kortId: f.kortId,
      sheetTimerId: f.sheetTimerId ?? null,
      byggeplassId: f.byggeplassId ?? null,
      externalCostObjectId: f.externalCostObjectId ?? null,
      attestertStatus: f.attestertStatus ?? "pending",
    },
  });
  return r.id;
}

async function vareRad(
  sheetId: string,
  dato: string,
  f: Sted & { kortId: string | null; sheetTimerId: string | null; attestert?: boolean },
) {
  const r = await prismaVarelager.vareforbruk.create({
    data: {
      dato: new Date(dato),
      projectId: P1,
      vareId: VARE,
      antall: 5,
      registrertAvUserId: USER,
      dagsseddelId: sheetId,
      sheetTimerId: f.sheetTimerId,
      kortId: f.kortId,
      byggeplassId: f.byggeplassId ?? null,
      externalCostObjectId: f.externalCostObjectId ?? null,
      ...(f.attestert ? { attestertSnapshot: { attestertVed: "2026-09-01T00:00:00.000Z" } } : {}),
    },
  });
  return r.id;
}

const maskinSted = (mid: string) =>
  prismaTimer.sheetMachine.findUniqueOrThrow({
    where: { id: mid },
    select: { byggeplassId: true, externalCostObjectId: true },
  });
const vareSted = (vid: string) =>
  prismaVarelager.vareforbruk.findUniqueOrThrow({
    where: { id: vid },
    select: { byggeplassId: true, externalCostObjectId: true },
  });

// ── Oppsett / rydding ───────────────────────────────────────────────────────
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
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO_1, ECO_2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: { in: [BP_1, BP_2] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "w3a-a7-1@sitedoc.test", name: "Ola Sjåfør", role: "user" },
      { id: ADMIN, email: "w3a-a7-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "w3a-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "varelager", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, reiseLonnsartId: REISE } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "A7-1", name: "w3a P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "A7-2", name: "w3a P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [P1, P2].map((p) => ({ userId: USER, projectId: p, role: "member" })),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.byggeplass.createMany({
    data: [
      { id: BP_1, projectId: P1, name: "A7 Tomt nord" },
      { id: BP_2, projectId: P1, name: "A7 Tomt sør" },
    ],
  });
  await prisma.externalCostObject.createMany({
    data: [
      { id: ECO_1, organizationId: ORG, projectId: P1, proAdmId: "A7-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: ECO_2, organizationId: ORG, projectId: P1, proAdmId: "A7-E2", kortNavn: "Vei", kilde: "manuell", opprettetAvUserId: ADMIN },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Transport" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "kjoretoy", type: "lastebil" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "m3" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
describe("A7 — oppdaterTimerRad: koblet maskin og vare følger byttet", () => {
  it("(1) bytte underprosjekt → koblet maskin og vare får nytt underprosjekt", async () => {
    const { sid, dato } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { externalCostObjectId: ECO_1 });
    const m = await maskinRad(sid, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1 });
    const v = await vareRad(sid, dato, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1 });

    await dag().oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "15:00", timer: 8, externalCostObjectId: ECO_2 });

    expect(await maskinSted(m)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_2 });
    expect(await vareSted(v)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_2 });
    // Kortet følger også (K6): maskin og vare står i timeradens kort.
    const t = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: tid }, select: { kortId: true } });
    const mk = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m }, select: { kortId: true } });
    const vk = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v }, select: { kortId: true } });
    expect(mk.kortId).toBe(t.kortId);
    expect(vk.kortId).toBe(t.kortId);
  });

  it("(2) bytte byggeplass → koblet maskin og vare får ny byggeplass", async () => {
    const { sid, dato } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { byggeplassId: BP_1 });
    const m = await maskinRad(sid, { kortId: k, sheetTimerId: tid, byggeplassId: BP_1 });
    const v = await vareRad(sid, dato, { kortId: k, sheetTimerId: tid, byggeplassId: BP_1 });

    await dag().oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "15:00", timer: 8, byggeplassId: BP_2 });

    expect(await maskinSted(m)).toEqual({ byggeplassId: BP_2, externalCostObjectId: null });
    expect(await vareSted(v)).toEqual({ byggeplassId: BP_2, externalCostObjectId: null });
  });

  it("(3) ukoblet maskin og maskin i annet prosjekt står", async () => {
    const { sid } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { externalCostObjectId: ECO_1 });
    const koblet = await maskinRad(sid, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1 });
    const ukoblet = await maskinRad(sid, { kortId: k, externalCostObjectId: ECO_1 });
    const annet = await maskinRad(sid, { kortId: randomUUID(), sheetTimerId: tid, projectId: P2 });

    await dag().oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "15:00", timer: 8, externalCostObjectId: ECO_2 });

    expect(await maskinSted(koblet)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_2 });
    expect(await maskinSted(ukoblet)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_1 });
    expect(await maskinSted(annet)).toEqual({ byggeplassId: null, externalCostObjectId: null });
  });

  it("(4) attestert maskin og attestert vare står (S5 A)", async () => {
    const { sid, dato } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { externalCostObjectId: ECO_1 });
    const m = await maskinRad(sid, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1, attestertStatus: "attestert" });
    const v = await vareRad(sid, dato, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1, attestert: true });

    await dag().oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "15:00", timer: 8, externalCostObjectId: ECO_2 });

    expect(await maskinSted(m)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_1 });
    expect(await vareSted(v)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_1 });
  });
});

describe("A7 — varesynken: feil meldes, og et nytt lagre retter varen (gate 107, vilkår 1)", () => {
  it("(7) varekallet feiler → timerad og maskin lagret, vareIkkeFlyttet + logg; nytt lagre med samme verdi flytter varen", async () => {
    const { sid, dato } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { externalCostObjectId: ECO_1 });
    const m = await maskinRad(sid, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1 });
    const v = await vareRad(sid, dato, { kortId: k, sheetTimerId: tid, externalCostObjectId: ECO_1 });

    // Varelager nede: bare råkallet kaster, resten av klienten er ekte.
    const nede = new Proxy(prismaVarelager, {
      get(mål, navn, mottaker) {
        if (navn === "$executeRawUnsafe") {
          return () => Promise.reject(new Error("varelager nede"));
        }
        return Reflect.get(mål, navn, mottaker);
      },
    });
    const logError = vi.fn();
    const svar1 = await dagsseddelRouter
      .createCaller(ctx(USER, nede, logError))
      .oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "15:00", timer: 8, externalCostObjectId: ECO_2 });

    expect(svar1.vareIkkeFlyttet).toBe(true);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]?.[0]).toMatchObject({ sheetTimerId: tid, sheetId: sid });
    const t = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: tid }, select: { externalCostObjectId: true } });
    expect(t.externalCostObjectId).toBe(ECO_2);
    expect(await maskinSted(m)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_2 });
    expect(await vareSted(v)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_1 });

    // Nytt lagre med samme verdi (stedet er alt byttet på raden) → varen rettes.
    const svar2 = await dag().oppdaterTimerRad({
      id: tid,
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 8,
      externalCostObjectId: ECO_2,
    });
    expect(svar2.vareIkkeFlyttet).toBe(false);
    expect(await vareSted(v)).toEqual({ byggeplassId: null, externalCostObjectId: ECO_2 });
  });
});

describe("A7 — maskin.tilfoy: stedet", () => {
  it("(5) med kort-id fra jobben → lagres med timeradens sted, ikke vinduets", async () => {
    const { sid } = await nySedel();
    const k = randomUUID();
    await timerRad(sid, k, { byggeplassId: BP_1, externalCostObjectId: ECO_1 });

    const ny = await dag().maskin.tilfoy({
      sheetId: sid,
      projectId: P1,
      vehicleId: MASKIN,
      timer: 2,
      kortId: k,
      byggeplassId: BP_2,
      externalCostObjectId: ECO_2,
    });

    expect(await maskinSted(ny.id)).toEqual({ byggeplassId: BP_1, externalCostObjectId: ECO_1 });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: ny.id }, select: { kortId: true } });
    expect(lagret.kortId).toBe(k);
  });

  it("(6) uten kort-id (dagskort-modus) → vinduets sted lagres uendret (S4 C)", async () => {
    const { sid } = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, k, { byggeplassId: BP_1, externalCostObjectId: ECO_1 });

    const ny = await dag().maskin.tilfoy({
      sheetId: sid,
      projectId: P1,
      vehicleId: MASKIN,
      timer: 2,
      sheetTimerId: tid,
      byggeplassId: BP_2,
      externalCostObjectId: ECO_2,
    });

    expect(await maskinSted(ny.id)).toEqual({ byggeplassId: BP_2, externalCostObjectId: ECO_2 });
  });
});
