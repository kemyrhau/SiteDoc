import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";
import { vareforbrukRouter } from "../vareforbruk";
import {
  hentKorrigeringer,
  hentKorrigertAvPrDag,
  hentRettedeFelter,
  type SedelForKorrigering,
} from "../../services/timer/kortLeser";

/**
 * SL1 (plan § 4.18 del D; Kenneth 2026-11-23 «s1 nei», «s2 ja», «B76: ja · B77: nei · B78: ja»)
 * — sporet tettes, mot EKTE Postgres (lokal sandkasse), gjennom prosedyrene (`createCaller`).
 *
 *  1  Hver slettevei på en returnert dag gir nøyaktig én post med `hendelse: "slettet"` og hele
 *     raden i `snapshot`: timelinje, «Slett jobben», maskin, tillegg, utlegg, delt reise, linje 2
 *     ved ny lagring av jobbens tid, vare — og to veier målt utenfor spec-lista: reisen som
 *     slettes ved «Flytt jobb», og valgte slettinger i forsoningen.
 *  2  Appens sletting gjennom `syncBatch` på en returnert dag gir samme post; samme batch to
 *     ganger gir fortsatt én post pr. rad.
 *  3  Utlegg og vare: `rad_type` `utlegg`/`vare` og innholdet i linja (varens navn og enhet med).
 *  4  Attestantens sletting i «Rediger sedel» får markøren; en retting står uten.
 *  5  Utkast som aldri er sendt: ingen post.
 *  6  `hentRettedeFelter`, `hentKorrigeringer` og `hentKorrigertAvPrDag` er uendret av de nye postene.
 *  7  En bruker i et annet firma kan ikke utløse posten (lesing kommer med SL2 — ingen leser finnes).
 *
 * Negativkontroll: på develop `e47bc71a` (før SL1) er 1 (unntatt timelinje og «Slett jobben»
 * for timer/maskin/tillegg, som R1 alt sporet), 2, 3 og 4 røde. 5, 6 og 7 er kontroller.
 */

const id = (n: string) => `5110c0de-0000-4000-8000-0000000000${n}`;
const ARB = id("02");
const ATT = id("03");
const FREMMED = id("04");
const ORG = id("01");
const ORG2 = id("05");
const P = id("11");
const P2 = id("12");
const TL = id("41");
const OT50 = id("42");
const REISE = id("45");
const AKT = id("44");
const TILLEGG = id("48");
const KATEGORI = id("49");
const MASKIN = id("51");
const VARE = id("61");
const BRUKERE = [ARB, ATT, FREMMED];

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
const vare = (userId = ARB) => vareforbrukRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Arbeiderens dag med én jobb (kort K): arbeid 07:00–15:00/30 (linje 1) og 15:00–15:30 (linje 2,
 * overtid), reise ført som reisetid i kortet, maskin, tillegg, utlegg og vare.
 */
async function nyDag(status: "draft" | "returned" | "sent", o: { dato?: Date; utenLinje2?: boolean } = {}) {
  const dato = o.dato ?? nyDato();
  const sheetId = randomUUID();
  const kortId = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sheetId, clientUuid: sheetId, organizationId: ORG, userId: ARB, registrertAvUserId: ARB,
      aktivitetId: AKT, dato, status,
    },
  });
  const felles = { sheetId, aktivitetId: AKT, projectId: P, kortId };
  const rad1 = await prismaTimer.sheetTimer.create({
    data: { ...felles, lonnsartId: TL, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving" },
  });
  const rad2 = o.utenLinje2
    ? null
    : await prismaTimer.sheetTimer.create({
        data: { ...felles, lonnsartId: OT50, fraTid: "15:00", tilTid: "15:30", pauseMin: 0, timer: 0.5 },
      });
  const reise = await prismaTimer.sheetTimer.create({
    data: { ...felles, lonnsartId: REISE, fraTid: "06:00", tilTid: "07:00", pauseMin: 0, timer: 1, erReise: true, reiseRetning: "ut" },
  });
  const maskin = await prismaTimer.sheetMachine.create({
    data: { sheetId, vehicleId: MASKIN, projectId: P, timer: 2, fraTid: "07:00", tilTid: "09:00", sheetTimerId: rad1.id, kortId },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({
    data: { sheetId, tilleggId: TILLEGG, projectId: P, antall: 1, kommentar: "Smussarbeid", kortId },
  });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: {
      sheetId, projectId: P, expenseCategoryId: KATEGORI, belop: 80, kommentar: "Parkering Narvik",
      ordningVedFoering: "utlegg", kortId,
    },
  });
  const v = await prismaVarelager.vareforbruk.create({
    data: {
      dato, projectId: P, vareId: VARE, antall: 3.5, registrertAvUserId: ARB, kommentar: "Grøft",
      dagsseddelId: sheetId, sheetTimerId: rad1.id, kortId,
    },
  });
  return {
    sheetId, kortId, dato, rad1: rad1.id, rad2: rad2?.id ?? null, reise: reise.id,
    maskin: maskin.id, tillegg: tillegg.id, utlegg: utlegg.id, vare: v.id,
  };
}

const historikk = (sheetId: string) =>
  prismaTimer.sheetRadHistorikk.findMany({ where: { sheetId }, orderBy: [{ radType: "asc" }, { originalRadId: "asc" }] });
const slettePoster = async (sheetId: string) =>
  (await historikk(sheetId)).filter((p) => (p.snapshot as Record<string, unknown>).hendelse === "slettet");

/** Nøyaktig én post: radtypen, raden og arbeideren, markøren `slettet`. */
async function forventEnSlettePost(sheetId: string, radType: string, radId: string, av = ARB) {
  const h = await historikk(sheetId);
  expect(h.map((p) => [p.radType, p.originalRadId, p.erstattetAvUserId])).toEqual([[radType, radId, av]]);
  const snap = h[0]!.snapshot as Record<string, unknown>;
  expect(snap).toMatchObject({ id: radId, hendelse: "slettet" });
  return snap;
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, OT50, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P, P2] } } });
  for (const org of [ORG, ORG2]) {
    await prisma.organizationSetting.deleteMany({ where: { organizationId: org } });
    await prisma.organizationModule.deleteMany({ where: { organizationId: org } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org } });
  }
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "sl1-arbeider@sitedoc.test", name: "Arbeider SL1", role: "user" },
      { id: ATT, email: "sl1-attestant@sitedoc.test", name: "Attestant SL1", role: "user" },
      { id: FREMMED, email: "sl1-fremmed@sitedoc.test", name: "Fremmed SL1", role: "user" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "SL1-firma" }, { id: ORG2, name: "SL1-annet-firma" }] });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: ATT, organizationId: ORG, status: "aktiv" },
      { userId: FREMMED, organizationId: ORG2, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((moduleSlug) => ({ organizationId: ORG, moduleSlug, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", tillattRedigerVedAttestering: true },
  });
  for (const [p, nr] of [[P, "SL1-1"], [P2, "SL1-2"]] as const) {
    await prisma.project.create({ data: { id: p, projectNumber: nr, name: `SL1 ${nr}`, primaryOrganizationId: ORG } });
    await prisma.projectModule.createMany({
      data: ["timer", "varelager"].map((moduleSlug) => ({ projectId: p, moduleSlug, organizationId: ORG, status: "aktiv" })),
    });
  }
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: ATT, projectId: P, role: "member", kanAttestere: true },
      { userId: FREMMED, projectId: P, role: "member" },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      { id: OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %", aktiv: true, rekkefolge: 2, overtidsnivaa: 50 },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reise", aktiv: true, rekkefolge: 4 },
    ],
  });
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { reiseLonnsartId: REISE } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" } });
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

// ---------------------------------------------------------------------------
//  Test 1 og 3 — hver slettevei på returnert dag gir én post
// ---------------------------------------------------------------------------

describe("SL1 test 1 — hver slettevei på en returnert dag gir én post med hele raden", () => {
  it("timelinje (fjernTimerRad) — R1, står", async () => {
    const d = await nyDag("returned", { utenLinje2: true });
    await prismaTimer.sheetMachine.update({ where: { id: d.maskin }, data: { sheetTimerId: null } });
    await prismaTimer.sheetTimer.update({ where: { id: d.reise }, data: { kortId: randomUUID() } });
    const ekstra = await prismaTimer.sheetTimer.create({
      data: { sheetId: d.sheetId, aktivitetId: AKT, projectId: P, kortId: d.kortId, lonnsartId: TL, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, timer: 1 },
    });
    await dag().fjernTimerRad({ id: ekstra.id });
    const snap = await forventEnSlettePost(d.sheetId, "timer", ekstra.id);
    expect(snap).toMatchObject({ fraTid: "16:00", tilTid: "17:00" });
  });

  it("maskin (maskin.fjern)", async () => {
    const d = await nyDag("returned");
    await dag().maskin.fjern({ id: d.maskin });
    const snap = await forventEnSlettePost(d.sheetId, "maskin", d.maskin);
    expect(snap).toMatchObject({ vehicleId: MASKIN, fraTid: "07:00", tilTid: "09:00", timer: "2" });
    expect(await prismaTimer.sheetMachine.findUnique({ where: { id: d.maskin } })).toBeNull();
  });

  it("tillegg (fjernTilleggRad)", async () => {
    const d = await nyDag("returned");
    await dag().fjernTilleggRad({ id: d.tillegg });
    const snap = await forventEnSlettePost(d.sheetId, "tillegg", d.tillegg);
    expect(snap).toMatchObject({ tilleggId: TILLEGG, antall: "1", kommentar: "Smussarbeid" });
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: d.tillegg } })).toBeNull();
  });

  it("utlegg (fjernUtleggRad) — radtype utlegg med innholdet (test 3)", async () => {
    const d = await nyDag("returned");
    await dag().fjernUtleggRad({ id: d.utlegg });
    const snap = await forventEnSlettePost(d.sheetId, "utlegg", d.utlegg);
    expect(snap).toMatchObject({ expenseCategoryId: KATEGORI, belop: "80", kommentar: "Parkering Narvik", ordningVedFoering: "utlegg", kortId: d.kortId });
    expect(await prismaTimer.sheetUtlegg.findUnique({ where: { id: d.utlegg } })).toBeNull();
  });

  it("vare (vareforbruk.slett) — radtype vare med innholdet, navn og enhet (test 3)", async () => {
    const d = await nyDag("returned");
    await vare().slett({ id: d.vare });
    const snap = await forventEnSlettePost(d.sheetId, "vare", d.vare);
    expect(snap).toMatchObject({
      vareId: VARE, varenavn: "Pukk 6-32", enhet: "tonn", antall: "3.5", kommentar: "Grøft",
      projectId: P, sheetTimerId: d.rad1, kortId: d.kortId, sheetId: d.sheetId,
    });
    expect(await prismaVarelager.vareforbruk.findUnique({ where: { id: d.vare } })).toBeNull();
    // activity_log-posten står (bevares).
    expect(await prisma.activity.count({ where: { targetId: d.vare, action: "vare.slettet" } })).toBe(1);
  });

  it("linje 2 ved ny lagring av jobbens tid (lagreJobbTid)", async () => {
    const d = await nyDag("returned");
    await prismaTimer.sheetTimer.update({ where: { id: d.reise }, data: { kortId: randomUUID() } });
    await dag().lagreJobbTid({
      sheetId: d.sheetId, kortId: d.kortId, fraTid: "07:00", tilTid: "15:00", pauseMin: 30,
      linjer: [{ radId: d.rad1, lonnsartId: TL }, { radId: d.rad2!, lonnsartId: OT50 }],
    });
    const snap = await forventEnSlettePost(d.sheetId, "timer", d.rad2!);
    expect(snap).toMatchObject({ lonnsartId: OT50, fraTid: "15:00", tilTid: "15:30" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad2! } })).toBeNull();
  });

  it("delt reise (fjernDeltReise): én post på hver returnert sedel", async () => {
    const d1 = nyDato();
    const d2 = new Date(d1.getTime() + 86_400_000);
    datoTeller++;
    const sedel = async (dato: Date) => {
      const sid = randomUUID();
      await prismaTimer.dailySheet.create({
        data: { id: sid, clientUuid: sid, organizationId: ORG, userId: ARB, registrertAvUserId: ARB, aktivitetId: AKT, dato, status: "returned" },
      });
      return sid;
    };
    const s1 = await sedel(d1);
    const s2 = await sedel(d2);
    const delId = randomUUID();
    const reiseRad = (sheetId: string, del: 1 | 2, fraTid: string, tilTid: string) =>
      prismaTimer.sheetTimer.create({
        data: {
          sheetId, aktivitetId: AKT, projectId: P, lonnsartId: REISE, fraTid, tilTid, pauseMin: 0, timer: 1,
          erReise: true, reiseRetning: "retur", kortId: randomUUID(), reiseRegel: { midnatt: { delId, del } },
        },
      });
    const a = await reiseRad(s1, 1, "23:00", "24:00");
    const b = await reiseRad(s2, 2, "00:00", "00:53");
    await dag().fjernDeltReise({ id: a.id });
    await forventEnSlettePost(s1, "timer", a.id);
    await forventEnSlettePost(s2, "timer", b.id);
  });

  it("delt reise: partnerens sedel er et utkast → bare den returnerte delen spores", async () => {
    const d1 = nyDato();
    const d2 = new Date(d1.getTime() + 86_400_000);
    datoTeller++;
    const sedel = async (dato: Date, status: string) => {
      const sid = randomUUID();
      await prismaTimer.dailySheet.create({
        data: { id: sid, clientUuid: sid, organizationId: ORG, userId: ARB, registrertAvUserId: ARB, aktivitetId: AKT, dato, status },
      });
      return sid;
    };
    const s1 = await sedel(d1, "returned");
    const s2 = await sedel(d2, "draft");
    const delId = randomUUID();
    const reiseRad = (sheetId: string, del: 1 | 2, fraTid: string, tilTid: string) =>
      prismaTimer.sheetTimer.create({
        data: {
          sheetId, aktivitetId: AKT, projectId: P, lonnsartId: REISE, fraTid, tilTid, pauseMin: 0, timer: 1,
          erReise: true, reiseRetning: "retur", kortId: randomUUID(), reiseRegel: { midnatt: { delId, del } },
        },
      });
    const a = await reiseRad(s1, 1, "23:00", "24:00");
    await reiseRad(s2, 2, "00:00", "00:53");
    await dag().fjernDeltReise({ id: a.id });
    await forventEnSlettePost(s1, "timer", a.id);
    expect(await historikk(s2)).toHaveLength(0);
  });

  it("«Slett jobben» (slettKort): også utlegg og vare med innholdet (test 3)", async () => {
    const d = await nyDag("returned");
    await dag().slettKort({ id: d.sheetId, kortId: d.kortId });
    const h = await historikk(d.sheetId);
    expect(h.every((p) => (p.snapshot as Record<string, unknown>).hendelse === "slettet")).toBe(true);
    expect(h.map((p) => p.originalRadId).sort()).toEqual(
      [d.rad1, d.rad2!, d.reise, d.maskin, d.tillegg, d.utlegg, d.vare].sort(),
    );
    const utlegg = h.find((p) => p.radType === "utlegg")!.snapshot;
    expect(utlegg).toMatchObject({ belop: "80", kommentar: "Parkering Narvik" });
    const v = h.find((p) => p.radType === "vare")!.snapshot;
    expect(v).toMatchObject({ varenavn: "Pukk 6-32", enhet: "tonn", antall: "3.5", sheetId: d.sheetId });
    // activity_log-posten står (bevares).
    expect(await prisma.activity.count({ where: { targetId: d.sheetId, action: "slett_kort" } })).toBe(1);
  });

  it("utenfor spec-lista: reisen som slettes ved «Flytt jobb» (flyttJobb, reise: slett)", async () => {
    const d = await nyDag("returned");
    // Jobben uten maskin/tillegg/utlegg/vare, så flyttingen bare rører timer og reise.
    await prismaTimer.sheetMachine.delete({ where: { id: d.maskin } });
    await prismaTimer.sheetTillegg.delete({ where: { id: d.tillegg } });
    await prismaTimer.sheetUtlegg.delete({ where: { id: d.utlegg } });
    await prismaVarelager.vareforbruk.delete({ where: { id: d.vare } });
    await dag().flyttJobb({ sheetId: d.sheetId, kortId: d.kortId, projectId: P2, byggeplassId: null, reise: { valg: "slett" } });
    await forventEnSlettePost(d.sheetId, "timer", d.reise);
  });

  it("utenfor spec-lista: valgt sletting i forsoningen (forsonDagskort)", async () => {
    const d = await nyDag("returned");
    await dag().forsonDagskort({ sheetId: d.sheetId, slettinger: [d.rad2!] });
    await forventEnSlettePost(d.sheetId, "timer", d.rad2!);
  });
});

// ---------------------------------------------------------------------------
//  Test 2 — appens slettinger i syncBatch
// ---------------------------------------------------------------------------

describe("SL1 test 2 — appens sletting i syncBatch på en returnert dag", () => {
  it("timer, tillegg, maskin og utlegg gir én post hver; samme batch to ganger gir fortsatt én", async () => {
    const d = await nyDag("returned");
    const rad2 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: d.rad2! } });
    const batch = {
      clientUuid: d.sheetId,
      projectId: P,
      aktivitetId: AKT,
      dato: iso(d.dato),
      status: "returned" as const,
      pauseMin: 30,
      timer: [],
      tillegg: [],
      maskiner: [],
      utlegg: [],
      slettedeIder: {
        timer: [],
        timerVersjoner: [{ id: rad2.id, serverVersjon: rad2.updatedAt.toISOString() }],
        tillegg: [d.tillegg],
        maskiner: [d.maskin],
        utlegg: [d.utlegg],
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forste = await dag().syncBatch({ sedler: [batch as any] });
    expect(forste.resultater[0]).toMatchObject({ resultat: "ok" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad2! } })).toBeNull();
    const poster = async () =>
      (await slettePoster(d.sheetId)).map((p) => [p.radType, p.originalRadId, p.erstattetAvUserId]).sort();
    const forventet = [
      ["maskin", d.maskin, ARB],
      ["tillegg", d.tillegg, ARB],
      ["timer", d.rad2!, ARB],
      ["utlegg", d.utlegg, ARB],
    ].sort();
    expect(await poster()).toEqual(forventet);
    // Samme batch sendt på nytt (telefonen fikk ikke svaret).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dag().syncBatch({ sedler: [batch as any] });
    expect(await poster()).toEqual(forventet);
    expect(await historikk(d.sheetId)).toHaveLength(4);
  });

  it("utkast: appens sletting gir ingen post (test 5)", async () => {
    const d = await nyDag("draft");
    const batch = {
      clientUuid: d.sheetId, projectId: P, aktivitetId: AKT, dato: iso(d.dato), status: "draft" as const,
      pauseMin: 30, timer: [], tillegg: [], maskiner: [], utlegg: [],
      slettedeIder: { timer: [], timerVersjoner: [], tillegg: [d.tillegg], maskiner: [d.maskin], utlegg: [d.utlegg] },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dag().syncBatch({ sedler: [batch as any] });
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: d.tillegg } })).toBeNull();
    expect(await historikk(d.sheetId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
//  Test 4 og 6 — attestantens sletting får markøren; leserne er uendret
// ---------------------------------------------------------------------------

/** «Rediger sedel»: hele sedelen som den står, minus det som er nevnt i `uten`. */
async function redigerUten(sheetId: string, uten: { timer?: string[]; maskin?: string[]; tillegg?: string[] }) {
  const [timer, maskiner, tillegg] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where: { sheetId } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId } }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId } }),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  await dag(ATT).redigerSedelRader({
    sheetId,
    nyeRader: {
      timer: timer.filter((r) => !uten.timer?.includes(r.id)).map((r) => ({
        originalId: r.id, projectId: r.projectId!, lonnsartId: r.lonnsartId, aktivitetId: r.aktivitetId,
        externalCostObjectId: r.externalCostObjectId, byggeplassId: r.byggeplassId, fraTid: r.fraTid, tilTid: r.tilTid,
        timer: Number(r.timer), pauseMin: r.pauseMin, vehicleId: r.vehicleId,
      })),
      tillegg: tillegg.filter((r) => !uten.tillegg?.includes(r.id)).map((r) => ({
        originalId: r.id, projectId: r.projectId, tilleggId: r.tilleggId, antall: Number(r.antall), kommentar: r.kommentar,
        byggeplassId: r.byggeplassId, externalCostObjectId: r.externalCostObjectId,
      })),
      maskin: maskiner.filter((r) => !uten.maskin?.includes(r.id)).map((r) => ({
        originalId: r.id, projectId: r.projectId, externalCostObjectId: r.externalCostObjectId, vehicleId: r.vehicleId,
        byggeplassId: r.byggeplassId, fraTid: r.fraTid, tilTid: r.tilTid, timer: Number(r.timer), mengde: num(r.mengde), enhet: r.enhet,
      })),
    },
  });
}

async function lesereNaa(sheetId: string) {
  const [timer, tillegg, maskiner] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { id: "asc" } }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId }, orderBy: { id: "asc" } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId }, orderBy: { id: "asc" } }),
  ]);
  const sedel: SedelForKorrigering = { id: sheetId, userId: ARB, organizationId: ORG, timer, tillegg, maskiner };
  const k = { prisma, prismaTimer, prismaMaskin };
  const rettede = await hentRettedeFelter(prismaTimer, prisma, [
    ...timer.map((rad) => ({ type: "timer" as const, rad })),
    ...tillegg.map((rad) => ({ type: "tillegg" as const, rad })),
    ...maskiner.map((rad) => ({ type: "maskin" as const, rad })),
  ]);
  const korrigert = await hentKorrigeringer(k, sedel);
  const prDag = await hentKorrigertAvPrDag(k, [sedel]);
  return JSON.parse(JSON.stringify({ rettede: Array.from(rettede.entries()), korrigert, prDag: Array.from(prDag.entries()) }));
}

describe("SL1 test 4 og 6 — attestantens sletting i «Rediger sedel»", () => {
  it("slettet linje får `hendelse: \"slettet\"`; en retting står uten markør (test 4)", async () => {
    const d = await nyDag("sent");
    await redigerUten(d.sheetId, { maskin: [d.maskin], tillegg: [d.tillegg] });
    const h = await historikk(d.sheetId);
    expect(h.map((p) => [p.radType, p.originalRadId, p.erstattetAvUserId, (p.snapshot as Record<string, unknown>).hendelse])).toEqual(
      [
        ["maskin", d.maskin, ATT, "slettet"],
        ["tillegg", d.tillegg, ATT, "slettet"],
      ],
    );
    await dag(ATT).rettRadFelt({ radType: "timer", radId: d.rad2!, felter: { tilTid: "15:15", timer: 0.25 } });
    const retting = (await historikk(d.sheetId)).filter((p) => p.originalRadId === d.rad2);
    expect(retting).toHaveLength(1);
    expect((retting[0]!.snapshot as Record<string, unknown>).hendelse).toBeUndefined();
  });

  it("hentRettedeFelter, hentKorrigeringer og hentKorrigertAvPrDag er uendret etter en sletting (test 6)", async () => {
    const d = await nyDag("sent");
    await dag(ATT).rettRadFelt({ radType: "timer", radId: d.rad2!, felter: { tilTid: "15:15", timer: 0.25 } });
    const foer = await lesereNaa(d.sheetId);
    expect(foer.korrigert.timer[d.rad2!]).toBeTruthy();
    await redigerUten(d.sheetId, { maskin: [d.maskin], tillegg: [d.tillegg] });
    expect((await slettePoster(d.sheetId)).length).toBe(2);
    const etter = await lesereNaa(d.sheetId);
    // Maskinen og tillegget er borte fra dagen; det som står igjen, leses likt.
    expect(etter.rettede).toEqual(foer.rettede.filter(([n]: [string]) => !n.includes(d.maskin) && !n.includes(d.tillegg)));
    expect(etter.korrigert).toEqual({ ...foer.korrigert, maskin: {}, tillegg: {} });
    expect(etter.prDag).toEqual(foer.prDag);
  });
});

// ---------------------------------------------------------------------------
//  Test 5 og 7 — utkast og firmagrensen
// ---------------------------------------------------------------------------

describe("SL1 test 5 — utkast som aldri er sendt: ingen post", () => {
  it("maskin, tillegg, utlegg, vare, linje 2 og «Slett jobben» på utkast", async () => {
    const d = await nyDag("draft");
    await dag().maskin.fjern({ id: d.maskin });
    await dag().fjernTilleggRad({ id: d.tillegg });
    await dag().fjernUtleggRad({ id: d.utlegg });
    await vare().slett({ id: d.vare });
    await prismaTimer.sheetTimer.update({ where: { id: d.reise }, data: { kortId: randomUUID() } });
    await dag().lagreJobbTid({
      sheetId: d.sheetId, kortId: d.kortId, fraTid: "07:00", tilTid: "15:00", pauseMin: 30,
      linjer: [{ radId: d.rad1, lonnsartId: TL }, { radId: d.rad2!, lonnsartId: OT50 }],
    });
    await dag().slettKort({ id: d.sheetId, kortId: d.kortId });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: d.sheetId, kortId: d.kortId } })).toBe(0);
    expect(await historikk(d.sheetId)).toHaveLength(0);
  });
});

describe("SL1 test 7 — en bruker i et annet firma kan ikke utløse posten", () => {
  it("tillegg, utlegg, maskin og vare på arbeiderens returnerte dag avvises; ingen post, ingenting slettet", async () => {
    const d = await nyDag("returned");
    await expect(dag(FREMMED).fjernTilleggRad({ id: d.tillegg })).rejects.toThrow();
    await expect(dag(FREMMED).fjernUtleggRad({ id: d.utlegg })).rejects.toThrow();
    await expect(dag(FREMMED).maskin.fjern({ id: d.maskin })).rejects.toThrow();
    await expect(vare(FREMMED).slett({ id: d.vare })).rejects.toThrow();
    expect(await historikk(d.sheetId)).toHaveLength(0);
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: d.tillegg } })).not.toBeNull();
    expect(await prismaVarelager.vareforbruk.findUnique({ where: { id: d.vare } })).not.toBeNull();
  });
});
