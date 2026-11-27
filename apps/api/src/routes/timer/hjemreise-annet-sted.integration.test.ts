import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { løsAnnetStedHjemreise, løsAnnetStedKort } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Runde 4 timer — hjemreise fra «Annet sted» (Kenneth 2026-11-26: «annet sted, foreslå hjemmreise
 * men ikke bloker annen registrering»). Spørringen `apenAnnetStedReise` finner utreisen uten
 * hjemreise (siste 31 dager); hjemreisen lagres som retur med stedet i `reiseRegel.annetSted`
 * (ingen migrering). Forslaget sperrer aldri: send dag går med åpen utreise. Telefonens synk
 * (`syncBatch`, pull + push) tåler en lagret hjemreise uendret.
 *
 * Mot ekte Postgres (lokal sandkasse). Faste id-er med prefiks 0260a5f4, ryddes i afterAll.
 */
const id = (n: string) => `0260a5f4-0000-4000-8000-0000000000${n}`;
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

async function nySedel(status = "draft", dato = nyDato()) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(dato), status },
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
      { id: USER, email: "hjemreise-arbeider@sitedoc.test", name: "Arbeider Annet sted", role: "user" },
      { id: ADMIN, email: "hjemreise-admin@sitedoc.test", name: "Admin Annet sted", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Hjemreise-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({
    data: { id: PI, projectNumber: "HR-INT", name: "Internt arbeid", type: "internt", primaryOrganizationId: ORG },
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

const REGEL = {
  reiseTerskelEnhet: "minutter" as const,
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid" as const,
  reiseOverTerskelType: "reisetid" as const,
};

async function forReise(sid: string, hjem: boolean, startTid: string, sluttTid: string, sted = "Bergen") {
  const los = hjem ? løsAnnetStedHjemreise : løsAnnetStedKort;
  const r = los({ fraOppmotestedId: KONTOR, sted, regel: REGEL, grensepunkter: [], resolverLonnsartId: LR, standardLonnsartId: TL, startTid, sluttTid });
  const s = r.spor!;
  await dag().tilfoyTimerRad({
    sheetId: sid, erReise: true, projectId: PI, lonnsartId: r.klassifisering!.lonnsartId!, aktivitetId: AKT,
    timer: r.timer, fraTid: startTid, tilTid: sluttTid, pauseMin: 0, byggeplassId: null, externalCostObjectId: null, vehicleId: null,
    beskrivelse: "Kurs",
    reiseKilde: s.reiseKilde!, reiseRetning: s.reiseRetning, reiseOppmotestedId: s.reiseOppmotestedId,
    reiseKjoretidMin: s.reiseKjoretidMin, reiseAvstandM: s.reiseAvstandM,
    reiseRegel: s.reiseRegel as unknown as Record<string, unknown>,
  });
}

const dagFor = (dato: string, n: number) => new Date(Date.parse(dato) + n * 86_400_000).toISOString().slice(0, 10);

describe("VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 2–6 i testpanelet, runde 4) — Runde 4 — hjemreise fra «Annet sted»", () => {
  it("utreise mandag: onsdagens sedel får forslaget; hjemreisen lagres som retur og lukker det", async () => {
    const man = nyDato();
    nyDato(); nyDato();
    const utSid = await nySedel("draft", man);
    await forReise(utSid, false, "06:00", "09:30");
    const onsSid = await nySedel("draft", dagFor(man, 2));
    expect(await dag().apenAnnetStedReise({ sheetId: onsSid })).toEqual({
      sted: "Bergen", oppmotestedId: KONTOR, projectId: PI, externalCostObjectId: null, dato: man,
    });

    await forReise(onsSid, true, "15:00", "18:30");
    const hjem = (await prismaTimer.sheetTimer.findMany({ where: { sheetId: onsSid } }))[0]!;
    expect(hjem).toMatchObject({ erReise: true, reiseRetning: "retur", reiseOppmotestedId: KONTOR, byggeplassId: null, projectId: PI });
    expect((hjem.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
    expect(await dag().apenAnnetStedReise({ sheetId: onsSid })).toBeNull();

    // Telefonens synk: pull leverer hjemreisen; push av samme rad uendret lar den stå.
    const synk = await dag().hentEndringerSiden({ organizationId: ORG });
    expect(JSON.stringify(synk)).toContain('"reiseRetning":"retur"');
    const sedel = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: onsSid } });
    const svar = await dag().syncBatch({
      sedler: [{
        clientUuid: onsSid, projectId: PI, aktivitetId: AKT, dato: sedel.dato.toISOString().slice(0, 10), status: "draft", pauseMin: 0,
        timer: [{
          id: hjem.id, projectId: PI, lonnsartId: hjem.lonnsartId, aktivitetId: AKT, timer: Number(hjem.timer),
          fraTid: hjem.fraTid, tilTid: hjem.tilTid, pauseMin: 0, beskrivelse: hjem.beskrivelse, byggeplassId: null,
          erReise: true, reiseRetning: "retur", reiseOppmotestedId: KONTOR, reiseKjoretidMin: null, reiseAvstandM: null,
          reiseKilde: "manuell", reiseRegel: hjem.reiseRegel, kortId: hjem.kortId,
          serverVersjon: hjem.updatedAt.toISOString(), endretLokalt: false,
        }],
        tillegg: [], maskiner: [], utlegg: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any],
    });
    expect(svar.resultater).toHaveLength(1);
    const etter = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: hjem.id } });
    expect(etter).toMatchObject({ erReise: true, reiseRetning: "retur", reiseOppmotestedId: KONTOR, fraTid: "15:00", tilTid: "18:30" });
    expect((etter.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
  });

  it("utreise eldre enn 31 dager foreslås ikke", async () => {
    const gammel = dagFor(nyDato(), -40);
    const utSid = await nySedel("draft", gammel);
    await forReise(utSid, false, "06:00", "09:30", "Trondheim");
    const sid = await nySedel("draft", dagFor(gammel, 32));
    expect(await dag().apenAnnetStedReise({ sheetId: sid })).toBeNull();
  });

  it("VAKTTEST aldri sperre: med åpen utreise lagres jobb og send dag går uten feil", async () => {
    const d = nyDato();
    const sid = await nySedel("draft", d);
    await forReise(sid, false, "06:00", "09:30", "Stavanger");
    expect((await dag().apenAnnetStedReise({ sheetId: sid }))?.sted).toBe("Stavanger");
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: PI, lonnsartId: TL, aktivitetId: AKT, timer: 6, fraTid: "10:00", tilTid: "16:00", pauseMin: 0,
      byggeplassId: null, externalCostObjectId: null, vehicleId: null, beskrivelse: "Kurs",
    });
    await dag().send({ id: sid });
    expect((await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sid } })).status).toBe("sent");
  });

  it("andres sedler: en annen bruker får ikke spørre på sedelen", async () => {
    const sid = await nySedel();
    await expect(dagsseddelRouter.createCaller(ctx(id("99"))).apenAnnetStedReise({ sheetId: sid })).rejects.toBeTruthy();
  });
});
