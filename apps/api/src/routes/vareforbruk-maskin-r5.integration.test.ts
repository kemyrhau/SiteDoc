import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { vareforbrukRouter } from "./vareforbruk";

/**
 * Runde 5 timer (Kenneth 2026-11-27, vedtak A): «varer tilhører denne maskinen, men det kan
 * jeg ikke se». `vareforbruk.opprett` tar `sheetMachineId` (maskinraden varen er ført fra i
 * maskinvinduet) mot EKTE Postgres. Myk validering som `gyldigVareRad`: ugyldig kobling → null,
 * varen lagres likevel. Stille tomhet (arkitektur.md § Schema- og migreringsregler): testen
 * feiler hvis maskinvinduets vare lagres uten maskin-id.
 *
 * All data lages her med faste id-er (prefiks 5a5e0005) og ryddes i afterAll.
 */

const id = (n: string) => `5a5e0005-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const USER2 = id("03");
const ADMIN = id("04");
const P1 = id("11");
const P2 = id("12");
const BYGGEPLASS_1 = id("21");
const ECO_1 = id("31");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45");
const MASKIN = id("51");
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
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_1 } });
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
      { id: USER, email: "vare-maskin-r5-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "vare-maskin-r5-2@sitedoc.test", name: "Arbeider To", role: "user" },
      { id: ADMIN, email: "vare-maskin-r5-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Vare-maskin r5-firma" } });
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
      { id: P1, projectNumber: "VMR5-1", name: "Vare-maskin r5 P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "VMR5-2", name: "Vare-maskin r5 P2", primaryOrganizationId: ORG },
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
  await prisma.byggeplass.create({ data: { id: BYGGEPLASS_1, projectId: P1, name: "Vare-maskin r5 B1" } });
  await prisma.externalCostObject.create({
    data: {
      id: ECO_1,
      organizationId: ORG,
      projectId: P1,
      proAdmId: "VMR5-E1",
      kortNavn: "Grøft",
      kilde: "manuell",
      opprettetAvUserId: ADMIN,
    },
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
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));
const vare = (userId = USER) => vareforbrukRouter.createCaller(ctx(userId));

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 10, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

/** Sedel med to arbeidsrader i P1/ECO_1 (r1, r2), maskin på r1, og en arbeidsrad i P2. */
async function oppsett() {
  const sid = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER,
      aktivitetId: AKT, dato: new Date(dato), status: "draft",
    },
  });
  const rad = (f: { fra: string; til: string; projectId?: string; eco?: string | null }) =>
    prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: f.projectId ?? P1, lonnsartId: ORD, aktivitetId: AKT,
        fraTid: f.fra, tilTid: f.til, timer: 4,
        externalCostObjectId: f.eco === undefined ? ECO_1 : f.eco,
      },
    });
  const r1 = await rad({ fra: "07:00", til: "11:00" });
  const r2 = await rad({ fra: "11:30", til: "15:30" });
  const m1 = await prismaTimer.sheetMachine.create({
    data: {
      sheetId: sid, sheetTimerId: r1.id, vehicleId: MASKIN, projectId: P1,
      externalCostObjectId: ECO_1, timer: 2,
    },
  });
  return { sid, dato, r1: r1.id, r2: r2.id, m1: m1.id };
}
const opprett = (o: Awaited<ReturnType<typeof oppsett>>, over: Record<string, unknown> = {}) =>
  vare().opprett({
    projectId: P1, dato: o.dato, vareId: VARE, antall: 3, externalCostObjectId: ECO_1,
    dagsseddelId: o.sid, sheetTimerId: o.r1, sheetMachineId: o.m1, ...over,
  });
const lagretMaskin = async (vid: string) =>
  (await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: vid } })).sheetMachineId;

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("Kenneth 2026-11-27: «varer tilhører denne maskinen, men det kan jeg ikke se» (vedtak A)", () => {
  it("vare fra maskinvinduet lagres med maskinens id — feiler hvis den blir stående tom", async () => {
    const o = await oppsett();
    const v = await opprett(o);
    expect(await lagretMaskin(v.id)).toBe(o.m1);
  });

  it("hentMineForDato leverer sheetMachineId", async () => {
    const o = await oppsett();
    const v = await opprett(o);
    const rader = await vare().hentMineForDato({ organizationId: ORG, dato: o.dato });
    expect(rader.find((r) => r.id === v.id)?.sheetMachineId).toBe(o.m1);
  });

  it("maskin på en annen timerad → null, men varen er lagret", async () => {
    const o = await oppsett();
    const v = await opprett(o, { sheetTimerId: o.r2 });
    expect(await lagretMaskin(v.id)).toBeNull();
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } })).sheetTimerId).toBe(o.r2);
  });

  it("annet underprosjekt (ECO) → null, varen lagret", async () => {
    const o = await oppsett();
    await prismaTimer.sheetTimer.update({ where: { id: o.r1 }, data: { externalCostObjectId: null } });
    const v = await opprett(o, { externalCostObjectId: null });
    expect(await lagretMaskin(v.id)).toBeNull();
  });

  it("maskin på en annen sedel → null, varen lagret", async () => {
    const a = await oppsett();
    const b = await oppsett();
    const v = await opprett(a, { sheetMachineId: b.m1 });
    expect(await lagretMaskin(v.id)).toBeNull();
  });

  it("uten gyldig timerad (ingen sheetTimerId) → null, varen lagret", async () => {
    const o = await oppsett();
    const v = await opprett(o, { sheetTimerId: null });
    expect(await lagretMaskin(v.id)).toBeNull();
  });

  it("ukjent maskin-id → null, varen lagret", async () => {
    const o = await oppsett();
    const v = await opprett(o, { sheetMachineId: randomUUID() });
    expect(await lagretMaskin(v.id)).toBeNull();
  });

  it("«+ Legg til vare» (uten sheetMachineId) → null = vare uten maskin", async () => {
    const o = await oppsett();
    const v = await opprett(o, { sheetMachineId: undefined });
    expect(await lagretMaskin(v.id)).toBeNull();
  });

  it("maskin.fjern sletter ikke varen — den står (leseren viser den i Varer-blokka)", async () => {
    const o = await oppsett();
    const v = await opprett(o);
    await dag().maskin.fjern({ id: o.m1 });
    const etter = await prismaVarelager.vareforbruk.findUnique({ where: { id: v.id } });
    expect(etter).not.toBeNull();
    expect(etter!.antall.toString()).toBe("3");
  });
});
