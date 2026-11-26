import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { løsAnnetStedKort } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Runde 2 timer — kursreise «Annet sted» (Kenneth 2026-11-26: «hva om jeg sendes til bergen på
 * kurs» → «1. ja»). Reisevinduet lagrer en vanlig manuell reise på firmaets interne prosjekt
 * «Internt arbeid», uten byggeplass, med stedet i `reiseRegel.annetSted` (Json — ingen migrering).
 * Serveren og mobilens synk (`hentEndringerSiden`) og attesteringen (`hentForAttestering`) skal
 * tåle raden uten feil og levere stedet uendret.
 *
 * Mot ekte Postgres (lokal sandkasse). Faste id-er med prefiks 0260a5f0, ryddes i afterAll.
 */

const id = (n: string) => `0260a5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("03");
const PI = id("11"); // «Internt arbeid» (type internt)
const KONTOR = id("21");
const TL = id("41");
const LR = id("42");
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
  // Nær i tid — `hentEndringerSiden` henter de siste 90 dagene.
  const idag = new Date();
  return new Date(Date.UTC(idag.getUTCFullYear(), idag.getUTCMonth(), idag.getUTCDate()) - (5 + datoTeller++) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function nySedel(status = "draft") {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(nyDato()), status },
  });
  return sid;
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
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, LR] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.oppmotested.deleteMany({ where: { id: KONTOR } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: PI } });
  await prisma.projectMember.deleteMany({ where: { projectId: PI } });
  await prisma.project.deleteMany({ where: { id: PI } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "annetsted-arbeider@sitedoc.test", name: "Arbeider Annet sted", role: "user" },
      { id: ADMIN, email: "annetsted-admin@sitedoc.test", name: "Admin Annet sted", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Annet sted-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({
    data: { id: PI, projectNumber: "AS-INT", name: "Internt arbeid", type: "internt", primaryOrganizationId: ORG },
  });
  await prisma.projectMember.create({ data: { userId: USER, projectId: PI, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: PI, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.oppmotested.create({ data: { id: KONTOR, organizationId: ORG, navn: "Kontor Tromsø", lat: 69.65, lng: 18.96 } });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: LR, organizationId: ORG, type: "ordinaer", navn: "Reisetid", erStandardvalg: false, aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Kurs" } });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: LR, tillattRedigerVedAttestering: true, timerRegistreringsmodus: "prosjektkort" },
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

/** Sporet reisevinduet lagrer — samme delte regel (`løsAnnetStedKort`). */
function spor(fraOppmotestedId: string | null, startTid: string, sluttTid: string) {
  const r = løsAnnetStedKort({
    fraOppmotestedId,
    sted: "Bergen",
    regel: {
      reiseTerskelEnhet: "minutter",
      reiseTerskelMin: 30,
      reiseTerskelM: null,
      reiseUnderTerskelType: "arbeidstid",
      reiseOverTerskelType: "reisetid",
    },
    grensepunkter: [],
    resolverLonnsartId: LR,
    standardLonnsartId: TL,
    startTid,
    sluttTid,
    tillatDeling: { omvendt: "fram" },
  });
  expect(r.spor).not.toBeNull();
  return { r, s: r.spor! };
}

describe("VAKTTEST 2026-11-26 (Kenneth: «alt fungerer såvidt jeg kan se», runde 2) — Runde 2 — reise til «Annet sted» på «Internt arbeid»", () => {
  it("lagres som reise på det interne prosjektet, uten byggeplass, med stedet og oppmøtestedet", async () => {
    const sid = await nySedel();
    const { r, s } = spor(KONTOR, "06:00", "09:30");
    await dag().tilfoyTimerRad({
      sheetId: sid, erReise: true, projectId: PI, lonnsartId: r.klassifisering!.lonnsartId!, aktivitetId: AKT,
      timer: r.timer, fraTid: "06:00", tilTid: "09:30", pauseMin: 0, byggeplassId: null, externalCostObjectId: null, vehicleId: null,
      beskrivelse: null,
      reiseKilde: s.reiseKilde!, reiseRetning: s.reiseRetning, reiseOppmotestedId: s.reiseOppmotestedId,
      reiseKjoretidMin: s.reiseKjoretidMin, reiseAvstandM: s.reiseAvstandM,
      reiseRegel: s.reiseRegel as unknown as Record<string, unknown>,
    });
    const rader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid } });
    expect(rader).toHaveLength(1);
    const rad = rader[0]!;
    expect(rad).toMatchObject({ projectId: PI, byggeplassId: null, erReise: true, reiseKilde: "manuell", reiseRetning: "ut", reiseOppmotestedId: KONTOR, lonnsartId: LR });
    expect(Number(rad.timer)).toBe(3.5);
    expect((rad.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
    // Ingen oppmøtested-periode skrives.
    expect(await prisma.oppmotePeriode.count({ where: { organizationId: ORG } })).toBe(0);

    // Mobilens synk (pull) tåler raden og leverer stedet uendret.
    const synk = await dag().hentEndringerSiden({ organizationId: ORG });
    const synkRad = JSON.stringify(synk).includes('"annetSted":{"sted":"Bergen"}');
    expect(synkRad).toBe(true);

    // Attesteringen tåler raden og leverer stedet til rutelinja.
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "sent" } });
    const att = await dag(ADMIN).hentForAttestering({ id: sid });
    const attRad = (att.timer as Array<{ id: string; reiseRegel: unknown; projectId: string | null }>).find((t) => t.id === rad.id)!;
    expect(attRad.projectId).toBe(PI);
    expect((attRad.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
  });

  it("uten oppmøtested (O22): lagres med reiseOppmotestedId null", async () => {
    const sid = await nySedel();
    const { r, s } = spor(null, "13:00", "16:30");
    await dag().tilfoyTimerRad({
      sheetId: sid, erReise: true, projectId: PI, lonnsartId: r.klassifisering!.lonnsartId!, aktivitetId: AKT,
      timer: r.timer, fraTid: "13:00", tilTid: "16:30", pauseMin: 0, byggeplassId: null,
      reiseKilde: s.reiseKilde!, reiseRetning: s.reiseRetning, reiseOppmotestedId: s.reiseOppmotestedId,
      reiseKjoretidMin: s.reiseKjoretidMin, reiseAvstandM: s.reiseAvstandM,
      reiseRegel: s.reiseRegel as unknown as Record<string, unknown>,
    });
    const rad = (await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid } }))[0]!;
    expect(rad).toMatchObject({ erReise: true, reiseOppmotestedId: null, byggeplassId: null });
    expect((rad.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
  });

  it("O19: over midnatt deles i to rader, begge med stedet", async () => {
    const sid = await nySedel();
    const { r, s } = spor(KONTOR, "22:00", "02:00");
    expect(r.deles).toBe("fram");
    await dag().tilfoyDeltReise({
      sheetId: sid, vei: "fram",
      del1: { fraTid: "22:00", tilTid: "24:00" },
      del2: { fraTid: "00:00", tilTid: "02:00" },
      projectId: PI, byggeplassId: null, lonnsartId: r.klassifisering!.lonnsartId!, aktivitetId: AKT,
      beskrivelse: null, externalCostObjectId: null,
      reiseKilde: s.reiseKilde!, reiseRetning: s.reiseRetning, reiseOppmotestedId: s.reiseOppmotestedId,
      reiseKjoretidMin: s.reiseKjoretidMin, reiseAvstandM: s.reiseAvstandM,
      reiseRegel: s.reiseRegel as unknown as Record<string, unknown>,
    });
    const del1 = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid } });
    expect(del1).toHaveLength(1);
    expect((del1[0]!.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
    const alle = await prismaTimer.sheetTimer.findMany({ where: { sheet: { userId: USER }, projectId: PI, fraTid: "00:00", tilTid: "02:00" } });
    expect(alle).toHaveLength(1);
    expect((alle[0]!.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
  });
});
