import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import {
  arbeidsreiseKortId,
  effektivKortByggeplass,
  jobberFraArbeidsrader,
  klassifiserManuellReise,
} from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O1 (plan § 8.22, «Kenneths test av L3a», feil a+b) gjennom prosedyrene (`createCaller`) mot
 * EKTE Postgres (kastbar lokal sandkasse, aldri test/prod).
 *
 * Kenneths dag: jobb 1 07:00–15:00 (pause 30 = 7,5 t) og jobb 2 15:00–16:00 på samme prosjekt
 * og byggeplass (samme nøkkel). «+ Reise» fra jobb 2 gir en retur under terskelen, 16:00–17:04.
 * Under terskelen er turen ARBEID (ordinær art, ingen reisespor — som `ReiseKort` sender,
 * `reise-terskel-dialog.test.tsx`). Uten kort-id la `sikreKortId` regel 3 den i ELDSTE kort med
 * samme nøkkel — jobb 1 — som da sto 07:00–17:04 / 8,57 t.
 *
 * Etter O1 sender kortet jobbens kort-id (regel 1) når nøkkelen er lik, regnet med den delte
 * `arbeidsreiseKortId` (samme funksjon som web-kortet bruker via `reiseHavnerI`). Ingen
 * serverendring: serveren godtar oppgitt kort-id for arbeid.
 *
 * Data lages her med faste id-er (prefiks 01e5e5f0) og ryddes i afterAll.
 */

const id = (n: string) => `01e5e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const B1 = id("21");
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
const dag = () => dagsseddelRouter.createCaller(ctx(USER));

async function rader(sheetId: string) {
  return prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { createdAt: "asc" } });
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.byggeplass.deleteMany({ where: { id: B1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "o1-reise@sitedoc.test", name: "Arbeider O1", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "O1-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", reiseLonnsartId: REISE } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O1-1", name: "O1 Boligfelt", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.byggeplass.create({ data: { id: B1, projectId: P1, name: "O1 B12" } });
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.lonnsart.create({
    data: { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", erStandardvalg: false, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
}

/** Kenneths dag fram til «+ Reise» på jobb 2. */
async function kennethsDag(dato: string) {
  const sid = randomUUID();
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
    },
  });
  const kA = randomUUID();
  const kB = randomUUID();
  const felles = { sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, byggeplassId: B1 };
  await dag().tilfoyTimerRad({ ...felles, timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kortId: kA });
  await dag().tilfoyTimerRad({ ...felles, timer: 1, fraTid: "15:00", tilTid: "16:00", pauseMin: 0, kortId: kB });
  return { sid, kA, kB, felles };
}

/** Det `ReiseKort` sender under terskel (ordinær art, ingen spor), med eller uten kort-id. */
const reiseUnderTerskel = (felles: Record<string, unknown>, kortId?: string | null) => ({
  ...(felles as { sheetId: string; projectId: string; lonnsartId: string; aktivitetId: string; byggeplassId: string }),
  timer: 1.07,
  fraTid: "16:00",
  tilTid: "17:04",
  pauseMin: 0,
  externalCostObjectId: null,
  vehicleId: null,
  beskrivelse: null,
  ...(kortId ? { kortId } : {}),
});

/** Jobbene slik kortet ser dem (`reiseHavnerI` → `jobberFraArbeidsrader`). */
async function jobber(sid: string) {
  const r = await rader(sid);
  return jobberFraArbeidsrader(
    r
      .filter((x) => !x.erReise)
      .map((x) => ({
        kortId: x.kortId,
        projectId: x.projectId,
        ecoId: x.externalCostObjectId,
        byggeplassId: effektivKortByggeplass(x.projectId, x.byggeplassId, null),
        fraTid: x.fraTid,
        opprettet: x.createdAt.getTime(),
        attestertStatus: x.attestertStatus,
      })),
  );
}

function jobbSum(r: Awaited<ReturnType<typeof rader>>, kortId: string) {
  const paa = r.filter((x) => x.kortId === kortId && !x.erReise);
  const timer = paa.reduce((s, x) => s + Number(x.timer), 0);
  const fra = paa.map((x) => x.fraTid!).sort()[0];
  const til = paa.map((x) => x.tilTid!).sort().at(-1);
  return { timer: Math.round(timer * 100) / 100, spenn: `${fra}–${til}` };
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O1 — reise under terskel havner på jobben den ble ført fra", () => {
  it("«+ Reise» fra jobb 2: raden står i jobb 2, jobb 1 er uendret 7,5 t / 07:00–15:00", async () => {
    const { sid, kA, kB, felles } = await kennethsDag("2026-11-21");
    const kortId = arbeidsreiseKortId({ projectId: P1, byggeplassId: B1, ecoId: null }, await jobber(sid), kB);
    expect(kortId).toBe(kB);
    await dag().tilfoyTimerRad(reiseUnderTerskel(felles, kortId));

    const r = await rader(sid);
    const ny = r.find((x) => x.fraTid === "16:00")!;
    expect(ny.erReise).toBe(false);
    expect(ny.kortId).toBe(kB);
    expect(jobbSum(r, kA)).toEqual({ timer: 7.5, spenn: "07:00–15:00" });
    expect(jobbSum(r, kB)).toEqual({ timer: 2.07, spenn: "15:00–17:04" });
  });

  it("kontroll (slik det var før O1): uten kort-id legger regel 3 raden i jobb 1 — 8,57 t, 07:00–17:04", async () => {
    const { sid, kA, felles } = await kennethsDag("2026-11-20");
    await dag().tilfoyTimerRad(reiseUnderTerskel(felles, null));
    const r = await rader(sid);
    expect(r.find((x) => x.fraTid === "16:00")!.kortId).toBe(kA);
    expect(jobbSum(r, kA)).toEqual({ timer: 8.57, spenn: "07:00–17:04" });
  });

  it("annen nøkkel enn jobben (annen byggeplass): ingen kort-id — serveren velger som før", async () => {
    const { sid, kB } = await kennethsDag("2026-11-19");
    expect(arbeidsreiseKortId({ projectId: P1, byggeplassId: null, ecoId: null }, await jobber(sid), kB)).toBeNull();
  });
});

/**
 * O1 TILLEGG (§ 8.22, Kenneth 2026-11-21: «Her skal valget reisetid eller arbeidstid være
 * tilstede»). Arbeideren velger reisetid under terskelen: kortet sender det
 * `klassifiserManuellReise` gir med `kategoriValg` — reiseart, kilde «manuell», kjøretid og
 * regelsporet (med `regelKategori`). Serveren tar imot klassifiseringen (K5); DB-CHECK sperrer
 * bare reisefelt på arbeid. Ingen migrering.
 */
describe("O1 TILLEGG — arbeideren velger reisetid under terskelen", () => {
  it("lagres som reise (erReise, kilde manuell, art Reisetid); jobb 1 og 2 er urørt", async () => {
    const { sid, kA, kB, felles } = await kennethsDag("2026-11-18");
    const k = klassifiserManuellReise({
      regel: {
        reiseTerskelEnhet: "minutter",
        reiseTerskelMin: 30,
        reiseTerskelM: null,
        reiseUnderTerskelType: "arbeidstid",
        reiseOverTerskelType: "reisetid",
      },
      reisetimer: 4 / 60,
      avstandM: 3000,
      grensepunkter: [],
      resolverLonnsartId: REISE,
      standardLonnsartId: ORD,
      kategoriValg: "reisetid",
    });
    expect(k).toMatchObject({ erReise: true, regelKategori: "arbeidstid", lonnsartId: REISE });
    await dag().tilfoyTimerRad({
      ...(felles as { sheetId: string; projectId: string; aktivitetId: string; byggeplassId: string }),
      lonnsartId: k.lonnsartId!,
      timer: 0.07,
      fraTid: "16:00",
      tilTid: "16:04",
      pauseMin: 0,
      reiseKilde: "manuell",
      reiseRetning: "retur",
      reiseKjoretidMin: 4,
      reiseAvstandM: k.reiseAvstandM,
      reiseRegel: k.reiseRegel as unknown as Record<string, unknown>,
    });

    const r = await rader(sid);
    const ny = r.find((x) => x.fraTid === "16:00")!;
    expect(ny.erReise).toBe(true);
    expect(ny.reiseKilde).toBe("manuell");
    expect(ny.lonnsartId).toBe(REISE);
    expect(ny.reiseKjoretidMin).toBe(4);
    expect(ny.reiseRegel).toMatchObject({ kategori: "reisetid", regelKategori: "arbeidstid" });
    expect(ny.kortId).toBe(kB); // retur → siste jobb (velgReiseKort)
    expect(jobbSum(r, kA)).toEqual({ timer: 7.5, spenn: "07:00–15:00" });
    expect(jobbSum(r, kB)).toEqual({ timer: 1, spenn: "15:00–16:00" });
  });
});
