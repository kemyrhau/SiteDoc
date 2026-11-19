import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * Ordre d2c-1 (prosjektkort-kortid-spec.md § 12.6, «Sperren ved føring») — kobling
 * og sperre når arbeideren fører på PC, mot EKTE Postgres (lokal sandkasse).
 *
 * - maskin.tilfoy / maskin.oppdater tar sheetTimerId og avviser maskin som krever
 *   timerad uten gyldig kobling (R24, H15 A).
 * - fjernTimerRad krever bekreftelse (slettMaskiner) når maskiner som krever timerad
 *   står på raden; uten den avvises kallet og maskinene navngis.
 * - oppdaterTimerRad avviser reise / 0 timer når raden bærer en slik maskin.
 * - Vakt: syncBatch er uendret.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f2) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f2-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const USER2 = id("03");
const P1 = id("11");
const P2 = id("12");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const M_TIME = id("51");
const M_DOEGN = id("52");
const M_UKJENT = id("53");
const VARE = id("61");

const BRUKERE = [USER, USER2];

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
  // Ny dato pr. sedel; nær «i dag» (ingen aldersgrense er satt uansett).
  const d = new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function nySedel(opts: { userId?: string } = {}) {
  const sid = randomUUID();
  const userId = opts.userId ?? USER;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId,
      registrertAvUserId: userId,
      aktivitetId: AKT,
      dato: new Date(nyDato()),
      status: "draft",
    },
  });
  return sid;
}

async function timerRad(
  sheetId: string,
  f: { fra?: string; til?: string; timer?: number; projectId?: string; kortId?: string; lonnsartId?: string; erReise?: boolean } = {},
) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      lonnsartId: f.lonnsartId ?? ORD,
      aktivitetId: AKT,
      fraTid: f.fra ?? "07:00",
      tilTid: f.til ?? "11:00",
      timer: f.timer ?? 4,
      erReise: f.erReise ?? false,
      kortId: f.kortId ?? "kort-1",
      attestertStatus: "pending",
    },
  });
  return r.id;
}

async function maskinRad(
  sheetId: string,
  f: { vehicleId?: string; sheetTimerId?: string | null; kortId?: string | null; timer?: number } = {},
) {
  const r = await prismaTimer.sheetMachine.create({
    data: {
      sheetId,
      projectId: P1,
      vehicleId: f.vehicleId ?? M_TIME,
      timer: f.timer ?? 1,
      sheetTimerId: f.sheetTimerId ?? null,
      kortId: f.kortId === undefined ? "kort-1" : f.kortId,
      attestertStatus: "pending",
    },
  });
  return r.id;
}

async function vareRad(sheetId: string, sheetTimerId: string) {
  const r = await prismaVarelager.vareforbruk.create({
    data: {
      dato: new Date("2026-10-01"),
      projectId: P1,
      vareId: VARE,
      antall: 2,
      registrertAvUserId: USER,
      dagsseddelId: sheetId,
      sheetTimerId,
      kortId: "kort-1",
    },
  });
  return r.id;
}

// ── Oppsett / rydding ───────────────────────────────────────────────────────
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({
    where: { userId: { in: BRUKERE } },
    select: { id: true },
  });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of [
      "sheet_timer_forslag",
      "sheet_rad_historikk",
      "sheet_machines",
      "sheet_tillegg",
      "sheet_utlegg",
      "sheet_timer",
    ]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [M_TIME, M_DOEGN, M_UKJENT] } } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: [P1, P2] } } });
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
      { id: USER, email: "kortid-d2c1-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "kortid-d2c1-2@sitedoc.test", name: "Arbeider To", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "D2c1-firma" } });
  await prisma.organizationMember.createMany({
    data: BRUKERE.map((u) => ({ userId: u, organizationId: ORG, status: "aktiv" })),
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "varelager", "maskin"].map((m) => ({ organizationId: ORG, moduleSlug: m, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, reiseLonnsartId: REISE } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "D2C1-1", name: "D2c1 P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "D2C1-2", name: "D2c1 P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectOrganization.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, organizationId: ORG, rolle: "hovedeier" })),
  });
  await prisma.projectMember.createMany({
    data: BRUKERE.flatMap((u) => [P1, P2].map((p) => ({ userId: u, projectId: p, role: "member" }))),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].flatMap((p) => [
      { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: p, moduleSlug: "varelager", organizationId: ORG, status: "aktiv" },
    ]),
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: M_TIME, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", merke: "Volvo", modell: "EC220E", utleieEnhet: "time" },
      { id: M_DOEGN, organizationId: ORG, kategori: "anleggsmaskin", type: "hoppetusse", internNavn: "Hoppetusse", utleieEnhet: "doegn" },
      { id: M_UKJENT, organizationId: ORG, kategori: "anleggsmaskin", type: "dumper", internNavn: "Dumper" },
    ],
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const tilfoy = (sheetId: string, f: { vehicleId?: string; sheetTimerId?: string | null; kortId?: string; projectId?: string } = {}) =>
  dag().maskin.tilfoy({
    sheetId,
    projectId: f.projectId ?? P1,
    vehicleId: f.vehicleId ?? M_TIME,
    timer: 1,
    ...(f.sheetTimerId !== undefined ? { sheetTimerId: f.sheetTimerId } : {}),
    ...(f.kortId !== undefined ? { kortId: f.kortId } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

// ════════════════════════════════════════════════════════════════════════════
//  maskin.tilfoy
// ════════════════════════════════════════════════════════════════════════════
describe("maskin.tilfoy — kobling ved føring", () => {
  // w9-tillegget: uten oppgitt timerad kobler serveren maskinen til jobbens timerad.
  it("time-maskin uten timerad kobles til jobbens timerad", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const svar = await tilfoy(sid);
    expect(svar.sheetTimerId).toBe(t);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: svar.id } })).sheetTimerId).toBe(t);
  });

  it("maskin uten satt enhet krever timerad (H15 A) — kobles også", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const svar = await tilfoy(sid, { vehicleId: M_UKJENT });
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: svar.id } })).sheetTimerId).toBe(t);
  });

  it("time-maskin på jobb uten arbeid avvises og navngir maskinen; ingenting lagres", async () => {
    const sid = await nySedel();
    await timerRad(sid, { fra: "06:00", til: "07:00", timer: 1, lonnsartId: REISE, erReise: true });
    const feil = await tilfoy(sid).catch((e: unknown) => e);
    expect(String((feil as Error).message)).toMatch(/Volvo EC220E/);
    expect((feil as { cause?: { feilNokkel?: string } }).cause?.feilNokkel).toBe("timer.maskin.utenArbeidAvvist");
    expect(await prismaTimer.sheetMachine.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("time-maskin med gyldig timerad lagres med radens id og kort", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid, { kortId: "kort-a" });
    const svar = await tilfoy(sid, { sheetTimerId: t });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: svar.id } });
    expect(lagret.sheetTimerId).toBe(t);
    expect(lagret.kortId).toBe("kort-a");
  });

  it("døgn-maskin uten timerad lagres", async () => {
    const sid = await nySedel();
    await timerRad(sid);
    const svar = await tilfoy(sid, { vehicleId: M_DOEGN });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: svar.id } });
    expect(lagret.sheetTimerId).toBeNull();
  });

  it("timerad på en annen sedel avvises", async () => {
    const sid = await nySedel();
    await timerRad(sid);
    const annen = await nySedel();
    const fremmed = await timerRad(annen);
    await expect(tilfoy(sid, { sheetTimerId: fremmed })).rejects.toThrow(/timerad/i);
  });

  it("reiserad avvises som kobling", async () => {
    const sid = await nySedel();
    await timerRad(sid, { fra: "07:00", til: "11:00" });
    const reise = await timerRad(sid, { fra: "06:00", til: "07:00", timer: 1, lonnsartId: REISE, erReise: true });
    await expect(tilfoy(sid, { sheetTimerId: reise })).rejects.toThrow(/Volvo EC220E/);
  });

  it("timerad i et annet prosjekt avvises", async () => {
    const sid = await nySedel();
    await timerRad(sid);
    const iP2 = await timerRad(sid, { projectId: P2, fra: "12:00", til: "15:00", timer: 3, kortId: "kort-p2" });
    await expect(tilfoy(sid, { sheetTimerId: iP2 })).rejects.toThrow(/Volvo EC220E/);
  });

  it("oppgitt kort-id som ikke er timeradens, avvises", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid, { kortId: "kort-a" });
    await timerRad(sid, { fra: "12:00", til: "15:00", timer: 3, kortId: "kort-b" });
    await expect(tilfoy(sid, { sheetTimerId: t, kortId: randomUUID() })).rejects.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  maskin.oppdater
// ════════════════════════════════════════════════════════════════════════════
describe("maskin.oppdater — kobling ved endring", () => {
  // w9-tillegget: en endret time-maskin uten gyldig kobling kobles til jobbens timerad.
  it("eldre ukoblet time-maskin: endring kobler den til jobbens timerad", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid);
    const svar = await dag().maskin.oppdater({ id: m, mengde: 3 });
    expect(svar.sheetTimerId).toBe(t);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBe(t);
  });

  it("å fjerne koblingen på en time-maskin gir ny kobling i samme jobb", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid, { sheetTimerId: t });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dag().maskin.oppdater({ id: m, sheetTimerId: null } as any);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBe(t);
  });

  it("bytte fra døgn- til time-maskin uten timerad kobles til jobbens timerad", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid, { vehicleId: M_DOEGN });
    await dag().maskin.oppdater({ id: m, vehicleId: M_TIME });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } });
    expect(lagret.vehicleId).toBe(M_TIME);
    expect(lagret.sheetTimerId).toBe(t);
  });

  it("bytte fra døgn- til time-maskin på jobb uten arbeid avvises; døgn-maskinen står", async () => {
    const sid = await nySedel();
    await timerRad(sid, { fra: "06:00", til: "07:00", timer: 1, lonnsartId: REISE, erReise: true, kortId: "kort-1" });
    const m = await maskinRad(sid, { vehicleId: M_DOEGN });
    await expect(dag().maskin.oppdater({ id: m, vehicleId: M_TIME })).rejects.toThrow(/Volvo EC220E/);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).vehicleId).toBe(M_DOEGN);
  });

  it("koblet time-maskin kan endres uten å sende koblingen på nytt", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid, { sheetTimerId: t });
    await dag().maskin.oppdater({ id: m, mengde: 5 });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } });
    expect(lagret.sheetTimerId).toBe(t);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  fjernTimerRad
// ════════════════════════════════════════════════════════════════════════════
describe("fjernTimerRad — bekreftelse når maskiner står på raden", () => {
  it("uten bekreftelse: avvises, navngir maskinen, ingenting slettes", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid, { sheetTimerId: t });
    await expect(dag().fjernTimerRad({ id: t })).rejects.toThrow(/Volvo EC220E/);
    expect(await prismaTimer.sheetTimer.count({ where: { id: t } })).toBe(1);
    expect(await prismaTimer.sheetMachine.count({ where: { id: m } })).toBe(1);
  });

  it("med bekreftelse: raden og time-maskinen slettes; døgn-maskin og vare blir stående uten kobling", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const mTime = await maskinRad(sid, { sheetTimerId: t });
    const mDoegn = await maskinRad(sid, { vehicleId: M_DOEGN, sheetTimerId: t });
    const v = await vareRad(sid, t);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dag().fjernTimerRad({ id: t, slettMaskiner: true } as any);
    expect(await prismaTimer.sheetTimer.count({ where: { id: t } })).toBe(0);
    expect(await prismaTimer.sheetMachine.count({ where: { id: mTime } })).toBe(0);
    const doegn = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: mDoegn } });
    expect(doegn.sheetTimerId).toBeNull();
    const vare = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v } });
    expect(vare.sheetTimerId).toBeNull();
  });

  it("bare døgn-maskin på raden: slettes uten bekreftelse, maskinen står uten kobling", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const mDoegn = await maskinRad(sid, { vehicleId: M_DOEGN, sheetTimerId: t });
    await dag().fjernTimerRad({ id: t });
    expect(await prismaTimer.sheetTimer.count({ where: { id: t } })).toBe(0);
    const doegn = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: mDoegn } });
    expect(doegn.sheetTimerId).toBeNull();
  });

  it("rad uten maskiner slettes som før", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    await dag().fjernTimerRad({ id: t });
    expect(await prismaTimer.sheetTimer.count({ where: { id: t } })).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  oppdaterTimerRad
// ════════════════════════════════════════════════════════════════════════════
describe("oppdaterTimerRad — rad med maskin kan ikke bli reise eller 0 timer", () => {
  it("bytte til reise-lønnsart avvises og navngir maskinen (selv når taket holder)", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    await timerRad(sid, { fra: "12:00", til: "16:00", timer: 4 });
    await maskinRad(sid, { sheetTimerId: t });
    await expect(dag().oppdaterTimerRad({ id: t, lonnsartId: REISE, fraTid: "07:00", tilTid: "11:00" })).rejects.toThrow(/Volvo EC220E/);
    const r = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t } });
    expect(r.erReise).toBe(false);
  });

  it("0 timer avvises og navngir maskinen", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    await timerRad(sid, { fra: "12:00", til: "16:00", timer: 4 });
    await maskinRad(sid, { sheetTimerId: t });
    await expect(dag().oppdaterTimerRad({ id: t, timer: 0, fraTid: "07:00", tilTid: "11:00" })).rejects.toThrow(/Volvo EC220E/);
  });

  it("rad med bare døgn-maskin kan bli reise", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    await timerRad(sid, { fra: "12:00", til: "16:00", timer: 4 });
    await maskinRad(sid, { vehicleId: M_DOEGN, sheetTimerId: t });
    await dag().oppdaterTimerRad({ id: t, lonnsartId: REISE, fraTid: "07:00", tilTid: "11:00" });
    const r = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t } });
    expect(r.erReise).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Vakt — syncBatch er uendret
// ════════════════════════════════════════════════════════════════════════════
describe("Vakt — syncBatch er uendret av sperren ved føring", () => {
  it("eldre app: time-maskin uten sheetTimerId lagres", async () => {
    const clientUuid = randomUUID();
    const svar = await dag(USER2).syncBatch({
      sedler: [
        {
          clientUuid,
          projectId: P1,
          aktivitetId: AKT,
          dato: nyDato(),
          status: "draft",
          pauseMin: 0,
          timer: [{ id: randomUUID(), projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 4, fraTid: "07:00", tilTid: "11:00", pauseMin: 0 }],
          tillegg: [],
          maskiner: [{ id: randomUUID(), projectId: P1, vehicleId: M_TIME, timer: 2 }],
          utlegg: [],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
    });
    expect(svar.resultater[0]!.resultat).toBe("ok");
    const m = await prismaTimer.sheetMachine.findMany({ where: { sheetId: clientUuid } });
    expect(m).toHaveLength(1);
    expect(m[0]!.sheetTimerId).toBeNull();
  });
});
