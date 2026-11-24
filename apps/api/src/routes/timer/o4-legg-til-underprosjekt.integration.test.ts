import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O4 (plan § 8.22, «Kenneths test av L3a», punkt 7) gjennom prosedyrene (`createCaller`) mot
 * EKTE Postgres (kastbar lokal sandkasse, aldri test/prod).
 *
 * «Legg til timer-rad» fra en jobb: velges et annet underprosjekt enn jobbens, sender vinduet en
 * NY kort-id (regel 1, `TimerRadDialog` → `nyRadEgenJobb`); likt underprosjekt sender jobbens
 * kort-id. Testen viser at serveren lar raden stå som egen jobb — også når dagen alt har en annen
 * jobb med samme underprosjekt (registreringer slås aldri sammen) — og at jobben den ble ført fra,
 * er uendret. Ingen serverendring.
 *
 * Data lages her med faste id-er (prefiks 04e5e5f0) og ryddes i afterAll.
 */

const id = (n: string) => `04e5e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const B1 = id("21");
const E1 = id("31");
const E2 = id("32");
const ORD = id("41");
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
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [E1, E2] } } });
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
  await prisma.user.create({ data: { id: USER, email: "o4-underprosjekt@sitedoc.test", name: "Arbeider O4", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "O4-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O4-1", name: "O4 Skole", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.byggeplass.create({ data: { id: B1, projectId: P1, name: "O4 Blokk A" } });
  for (const [eid, nr] of [[E1, "O4-TILL-1"], [E2, "O4-TILL-2"]] as const) {
    await prisma.externalCostObject.create({
      data: { id: eid, organizationId: ORG, projectId: P1, proAdmId: nr, kortNavn: nr, kilde: "manuell", opprettetAvUserId: USER },
    });
  }
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Arbeid" } });
}

/** Dagen: jobb A 07:00–15:00 på E2, jobb B 15:00–16:00 på E1 (samme prosjekt og byggeplass). */
async function dagen(dato: string) {
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
  await dag().tilfoyTimerRad({ ...felles, externalCostObjectId: E2, timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kortId: kA, beskrivelse: "Forskaling" });
  await dag().tilfoyTimerRad({ ...felles, externalCostObjectId: E1, timer: 1, fraTid: "15:00", tilTid: "16:00", pauseMin: 0, kortId: kB, beskrivelse: "Graving" });
  return { sid, kA, kB, felles };
}

/** Det «Legg til timer-rad» fra jobb B sender: 16:00–17:00, valgt underprosjekt og kort-id. */
const nyRad = (felles: Record<string, unknown>, ecoId: string | null, kortId: string) => ({
  ...(felles as { sheetId: string; projectId: string; lonnsartId: string; aktivitetId: string; byggeplassId: string }),
  timer: 1,
  fraTid: "16:00",
  tilTid: "17:00",
  pauseMin: 0,
  externalCostObjectId: ecoId,
  vehicleId: null,
  beskrivelse: "Opprydding",
  kortId,
});

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O4 — underprosjekt i «Legg til timer-rad»", () => {
  it("annet underprosjekt enn jobbens (E2) med ny kort-id: egen jobb, ikke slått sammen med jobb A (også E2) eller B", async () => {
    const { sid, kA, kB, felles } = await dagen("2026-11-21");
    const ny = randomUUID();
    await dag().tilfoyTimerRad(nyRad(felles, E2, ny));
    const r = await rader(sid);
    const lagt = r.find((x) => x.fraTid === "16:00")!;
    expect(lagt.kortId).toBe(ny);
    expect(lagt.externalCostObjectId).toBe(E2);
    expect(r.filter((x) => x.kortId === kA).map((x) => x.fraTid)).toEqual(["07:00"]);
    expect(r.filter((x) => x.kortId === kB).map((x) => x.fraTid)).toEqual(["15:00"]);
    expect(new Set(r.map((x) => x.kortId)).size).toBe(3);
  });

  it("kontroll: uten kort-id legger regel 3 raden i jobb A (eldste med E2) — derfor sender vinduet ny id", async () => {
    const { sid, kA, felles } = await dagen("2026-11-18");
    const { kortId: _k, ...utenKort } = nyRad(felles, E2, "x");
    await dag().tilfoyTimerRad(utenKort);
    const r = await rader(sid);
    expect(r.find((x) => x.fraTid === "16:00")!.kortId).toBe(kA);
  });

  it("«—» (uten underprosjekt) på en jobb med underprosjekt, med ny kort-id: egen jobb uten underprosjekt", async () => {
    const { sid, kB, felles } = await dagen("2026-11-20");
    const ny = randomUUID();
    await dag().tilfoyTimerRad(nyRad(felles, null, ny));
    const r = await rader(sid);
    const lagt = r.find((x) => x.fraTid === "16:00")!;
    expect(lagt.kortId).toBe(ny);
    expect(lagt.externalCostObjectId).toBeNull();
    expect(r.filter((x) => x.kortId === kB)).toHaveLength(1);
  });

  it("samme underprosjekt som jobben (E1) med jobbens kort-id: raden står i jobb B", async () => {
    const { sid, kB, felles } = await dagen("2026-11-19");
    await dag().tilfoyTimerRad(nyRad(felles, E1, kB));
    const r = await rader(sid);
    expect(r.find((x) => x.fraTid === "16:00")!.kortId).toBe(kB);
    expect(r.filter((x) => x.kortId === kB).map((x) => x.fraTid)).toEqual(["15:00", "16:00"]);
  });
});
