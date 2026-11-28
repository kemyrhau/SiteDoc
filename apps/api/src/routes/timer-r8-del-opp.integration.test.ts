import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { sikreKortId } from "../services/timer/kortId";

/**
 * Runde 8 timer. Kenneth 2026-11-27: «del opp en timerad, må ha mulighet å tillegne
 * underprosjekt på hver av valgene -> vi må samtidig dele opp tilhørende maskin, varer,
 * tillegg/utlegg. reise må tilordnes rett prosjekt/underprosjekt». Kenneth 2026-11-28
 * «Ja, begge»: (a) forholdsmessig forslag som arbeideren kan justere, tillegg/utlegg flyttes
 * hele; (b) reise ut følger delen som starter først, reise hjem delen som slutter sist.
 * Mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 *
 * All data lages her med faste id-er (prefiks 5a5e0008) og ryddes i afterAll.
 */

const id = (n: string) => `5a5e0008-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const USER2 = id("03");
const ADMIN = id("04");
const P1 = id("11");
const P2 = id("12");
const BYGGEPLASS_1 = id("21");
const ECO_1 = id("31");
const ECO_2 = id("32");
const ECO_P2 = id("33");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45");
const MASKIN = id("51");
const DOEGN = id("52");
const VARE = id("61");

const BRUKERE = [USER, USER2, ADMIN];

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
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [MASKIN, DOEGN] } } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO_1, ECO_2, ECO_P2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: BYGGEPLASS_1 } });
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
      { id: USER, email: "r8-del-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "r8-del-2@sitedoc.test", name: "Arbeider To", role: "user" },
      { id: ADMIN, email: "r8-del-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "R8 del-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: USER2, organizationId: ORG, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "varelager", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "R8-1", name: "R8 del P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "R8-2", name: "R8 del P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [USER, USER2].flatMap((u) => [
      { userId: u, projectId: P1, role: "member" },
      { userId: u, projectId: P2, role: "member" },
    ]),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].flatMap((p) => [
      { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: p, moduleSlug: "varelager", organizationId: ORG, status: "aktiv" },
    ]),
  });
  await prisma.byggeplass.create({ data: { id: BYGGEPLASS_1, projectId: P1, name: "R8 del B1" } });
  await prisma.externalCostObject.createMany({
    data: [
      { id: ECO_1, organizationId: ORG, projectId: P1, proAdmId: "R8-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: ECO_2, organizationId: ORG, projectId: P1, proAdmId: "R8-E2", kortNavn: "Vei", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: ECO_P2, organizationId: ORG, projectId: P2, proAdmId: "R8-E3", kortNavn: "B12", kilde: "manuell", opprettetAvUserId: ADMIN },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({
    data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" },
  });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", utleieEnhet: "time" },
      { id: DOEGN, organizationId: ORG, kategori: "anleggsmaskin", type: "hoppetusse", utleieEnhet: "doegn" },
    ],
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 10, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Utkast: r1 07–15 (8 t) i P1 på ECO_1. Koblet til r1: maskin 8 t, vare 10, ett tillegg og
 * ett utlegg. Reise ut 06:20–07:00 og hjem 15:00–15:40 i samme prosjekt.
 */
async function oppsett(opts: { maskinTimer?: number; vareUnderMaskin?: boolean } = {}) {
  const sid = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER,
      aktivitetId: AKT, dato: new Date(dato), status: "draft",
    },
  });
  const r1 = await prismaTimer.sheetTimer.create({
    data: {
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "15:00",
      timer: 8, attestertStatus: "pending", externalCostObjectId: ECO_1,
    },
  });
  const reise = (retning: "ut" | "retur", fra: string, til: string) =>
    prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, erReise: true,
        reiseRetning: retning, reiseKilde: "manuell", fraTid: fra, tilTid: til, timer: 0.67,
        externalCostObjectId: ECO_1,
      },
    });
  const ut = await reise("ut", "06:20", "07:00");
  const hjem = await reise("retur", "15:00", "15:40");
  await sikreKortId(prismaTimer, sid);
  const kort = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r1.id } })).kortId!;
  const m = await prismaTimer.sheetMachine.create({
    data: {
      sheetId: sid, sheetTimerId: r1.id, vehicleId: MASKIN, projectId: P1,
      externalCostObjectId: ECO_1, timer: opts.maskinTimer ?? 8, kortId: kort, attestertStatus: "pending",
    },
  });
  const tl = await prismaTimer.sheetTillegg.create({
    data: { sheetId: sid, sheetTimerId: r1.id, projectId: P1, tilleggId: TILLEGG, antall: 1, externalCostObjectId: ECO_1, kortId: kort },
  });
  const ul = await prismaTimer.sheetUtlegg.create({
    data: { sheetId: sid, sheetTimerId: r1.id, projectId: P1, expenseCategoryId: KATEGORI, belop: 120, ordningVedFoering: "utlegg", externalCostObjectId: ECO_1, kortId: kort },
  });
  const v = await prismaVarelager.vareforbruk.create({
    data: {
      dato: new Date(dato), projectId: P1, vareId: VARE, antall: 10, registrertAvUserId: USER,
      dagsseddelId: sid, sheetTimerId: r1.id, externalCostObjectId: ECO_1, kortId: kort,
      sheetMachineId: opts.vareUnderMaskin ? m.id : null,
    },
  });
  return { sid, dato, r1: r1.id, ut: ut.id, hjem: hjem.id, kort, m: m.id, tl: tl.id, ul: ul.id, v: v.id };
}

const del = (fra: string, til: string, timer: number, eco: string | null) => ({
  projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: fra, tilTid: til, timer, externalCostObjectId: eco,
});

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("Kenneth 2026-11-27: «del opp en timerad … vi må samtidig dele opp tilhørende maskin, varer, tillegg/utlegg» — måling", () => {
  it("dagens splitt uten fordeling: koblede rader står på del 1 med del 1s underprosjekt (arven)", async () => {
    // Maskin 2 t: med 8 t avvises splitten i dag (maskin over del 1s arbeid).
    const o = await oppsett({ maskinTimer: 2 });
    await dag().splittRadEier({
      radType: "timer",
      radId: o.r1,
      nyeRader: [del("07:00", "11:00", 4, ECO_2), del("11:00", "15:00", 4, ECO_1)],
    });
    const [m, tl, ul, v] = await Promise.all([
      prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: o.m } }),
      prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: o.tl } }),
      prismaTimer.sheetUtlegg.findUniqueOrThrow({ where: { id: o.ul } }),
      prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: o.v } }),
    ]);
    expect(m.sheetTimerId).toBe(o.r1);
    expect({
      maskin: m.externalCostObjectId,
      tillegg: tl.externalCostObjectId,
      utlegg: ul.externalCostObjectId,
      vare: v.externalCostObjectId,
    }).toEqual({ maskin: ECO_2, tillegg: ECO_2, utlegg: ECO_2, vare: ECO_2 });
  });
});

type O = Awaited<ReturnType<typeof oppsett>>;
const timerad = (tid: string) => prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: tid } });
const maskinerPaa = (sid: string) =>
  prismaTimer.sheetMachine.findMany({ where: { sheetId: sid }, orderBy: [{ timer: "desc" }, { createdAt: "asc" }] });
const varerPaa = (sid: string) =>
  prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: sid }, orderBy: [{ antall: "desc" }, { createdAt: "asc" }] });
/** Del 2 sin timerad: den nye raden på sedelen som ikke er original eller reise. */
async function del2Id(o: O) {
  const r = await prismaTimer.sheetTimer.findFirstOrThrow({ where: { sheetId: o.sid, erReise: false, id: { not: o.r1 } } });
  return r.id;
}
const splitt = (o: O, deler: ReturnType<typeof del>[], fordeling?: Record<string, unknown>) =>
  dag().splittRadEier({ radType: "timer", radId: o.r1, nyeRader: deler, ...(fordeling ? { fordeling } : {}) });

describe("Kenneth 2026-11-28 «Ja, begge» — arbeiderens «Del opp» med «Følger med»", () => {
  it("(a)+(b) forslaget: maskin 4+4 og vare 5+5 på hver sin del med delens underprosjekt; tillegg/utlegg hele på del 1; reise ut i del 1s kort, hjem i del 2s", async () => {
    const o = await oppsett();
    await splitt(o, [del("07:00", "11:00", 4, ECO_2), del("11:00", "15:00", 4, ECO_1)], {});
    const d2 = await del2Id(o);
    const [del1, del2] = [await timerad(o.r1), await timerad(d2)];
    expect(del1.kortId).not.toBe(del2.kortId);

    const maskiner = await maskinerPaa(o.sid);
    expect(maskiner.map((m) => [Number(m.timer), m.sheetTimerId, m.externalCostObjectId])).toEqual(
      expect.arrayContaining([
        [4, o.r1, ECO_2],
        [4, d2, ECO_1],
      ]),
    );
    expect(maskiner).toHaveLength(2);
    expect(maskiner.find((m) => m.sheetTimerId === o.r1)!.id).toBe(o.m);
    for (const m of maskiner) expect(m.kortId).toBe(m.sheetTimerId === o.r1 ? del1.kortId : del2.kortId);

    const varer = await varerPaa(o.sid);
    expect(varer.map((v) => [Number(v.antall), v.sheetTimerId, v.externalCostObjectId, v.kortId])).toEqual(
      expect.arrayContaining([
        [5, o.r1, ECO_2, del1.kortId],
        [5, d2, ECO_1, del2.kortId],
      ]),
    );

    const [tl, ul] = [
      await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: o.tl } }),
      await prismaTimer.sheetUtlegg.findUniqueOrThrow({ where: { id: o.ul } }),
    ];
    for (const r of [tl, ul]) {
      expect([r.sheetTimerId, r.externalCostObjectId, r.kortId]).toEqual([o.r1, ECO_2, del1.kortId]);
    }
    expect((await timerad(o.ut)).kortId).toBe(del1.kortId);
    expect((await timerad(o.ut)).externalCostObjectId).toBe(ECO_2);
    expect((await timerad(o.hjem)).kortId).toBe(del2.kortId);
    expect((await timerad(o.hjem)).externalCostObjectId).toBe(ECO_1);
  });

  it("arbeideren justerer: maskin 6+2, vare 10+0 og tillegget til del 2 → lagres som valgt", async () => {
    const o = await oppsett();
    // Del 1 har 6 t arbeid, så maskinen kan ha 6 t der (maskin ≤ arbeid pr. del).
    await splitt(o, [del("07:00", "13:00", 6, ECO_2), del("13:00", "15:00", 2, ECO_1)], {
      maskiner: [{ id: o.m, timer: [6, 2] }],
      varer: [{ id: o.v, antall: [10, 0] }],
      tillegg: [{ id: o.tl, del: 1 }],
    });
    const d2 = await del2Id(o);
    expect((await maskinerPaa(o.sid)).map((m) => [Number(m.timer), m.sheetTimerId])).toEqual([
      [6, o.r1],
      [2, d2],
    ]);
    const varer = await varerPaa(o.sid);
    expect(varer.map((v) => [Number(v.antall), v.sheetTimerId, v.externalCostObjectId])).toEqual([[10, o.r1, ECO_2]]);
    const tl = await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: o.tl } });
    expect([tl.sheetTimerId, tl.externalCostObjectId]).toEqual([d2, ECO_1]);
  });

  it("feil sum (maskin 6+3) avvises med melding, og ingenting er endret", async () => {
    const o = await oppsett();
    await expect(
      splitt(o, [del("07:00", "11:00", 4, ECO_2), del("11:00", "15:00", 4, ECO_1)], { maskiner: [{ id: o.m, timer: [6, 3] }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("må til sammen bli 8 t") });
    expect(Number((await timerad(o.r1)).timer)).toBe(8);
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: o.sid, erReise: false } })).toBe(1);
    expect((await maskinerPaa(o.sid)).map((m) => Number(m.timer))).toEqual([8]);
  });

  it("del i annet prosjekt: maskin dit avvises; tillegg og hjemreise dit følger prosjektet", async () => {
    const o = await oppsett({ maskinTimer: 4 });
    const deler = [del("07:00", "11:00", 4, ECO_1), { ...del("11:00", "15:00", 4, ECO_P2), projectId: P2 }];
    await expect(splitt(o, deler, { maskiner: [{ id: o.m, timer: [2, 2] }] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("annet prosjekt"),
    });
    await splitt(o, deler, { tillegg: [{ id: o.tl, del: 1 }] });
    const d2 = await del2Id(o);
    const tl = await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: o.tl } });
    expect([tl.sheetTimerId, tl.projectId, tl.externalCostObjectId]).toEqual([d2, P2, ECO_P2]);
    const hjem = await timerad(o.hjem);
    expect([hjem.projectId, hjem.externalCostObjectId, hjem.kortId]).toEqual([P2, ECO_P2, (await timerad(d2)).kortId]);
    // Maskin og vare står i P1 på del 1 (forslaget gir 0 til del 2).
    expect((await maskinerPaa(o.sid)).map((m) => [m.sheetTimerId, m.projectId])).toEqual([[o.r1, P1]]);
  });

  it("vare under maskinen følger maskinraden på sin del", async () => {
    const o = await oppsett({ vareUnderMaskin: true });
    await splitt(o, [del("07:00", "11:00", 4, ECO_2), del("11:00", "15:00", 4, ECO_1)], {});
    const maskiner = await maskinerPaa(o.sid);
    for (const v of await varerPaa(o.sid)) {
      expect(v.sheetMachineId).toBe(maskiner.find((m) => m.sheetTimerId === v.sheetTimerId)!.id);
    }
  });

  it("eldre klient uten fordeling: alt på del 1, reisene står", async () => {
    const o = await oppsett({ maskinTimer: 2 });
    const foer = await timerad(o.hjem);
    await splitt(o, [del("07:00", "11:00", 4, ECO_2), del("11:00", "15:00", 4, ECO_1)]);
    const etter = await timerad(o.hjem);
    expect([etter.kortId, etter.externalCostObjectId]).toEqual([foer.kortId, foer.externalCostObjectId]);
    expect((await maskinerPaa(o.sid)).map((m) => m.sheetTimerId)).toEqual([o.r1]);
    expect((await varerPaa(o.sid)).map((v) => Number(v.antall))).toEqual([10]);
  });
});
