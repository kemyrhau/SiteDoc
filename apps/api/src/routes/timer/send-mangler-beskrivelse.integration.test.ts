import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Plan § 8.22 L2 «ikke ferdig» (Kenneth 2026-11-21): `send` avviser dagen når en jobb mangler
 * «Hva gjorde du?» — bare når sedelens firma bruker prosjektkort-modus. Dagskort-modus er urørt.
 * Mot EKTE Postgres (lokal sandkasse, aldri test/prod). Faste id-er (prefiks f2a2e5f1), ryddes.
 */

const id = (n: string) => `f2a2e5f1-0000-4000-8000-0000000000${n}`;
const USER = id("02");
const ORG_PK = id("01"); // prosjektkort-modus
const ORG_DK = id("03"); // dagskort-modus
const P_PK = id("11");
const P_DK = id("12");
const ORD_PK = id("41");
const ORD_DK = id("42");
const AKT_PK = id("43");
const AKT_DK = id("44");

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

/** Sedel med én arbeidsrad (jobb k1) uten beskrivelse. */
async function sedelMedJobb(org: string, projectId: string, lonnsartId: string, aktivitetId: string, dato: string) {
  const sheet = await dag().opprett({ clientUuid: randomUUID(), aktivitetId, projectId, dato, organizationId: org });
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId: sheet.id } });
  await prismaTimer.sheetTimer.create({
    data: { sheetId: sheet.id, lonnsartId, aktivitetId, projectId, kortId: randomUUID(), fraTid: "07:00", tilTid: "15:00", timer: 7.5 },
  });
  return sheet.id;
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
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD_PK, ORD_DK] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT_PK, AKT_DK] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P_PK, P_DK] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P_PK, P_DK] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P_PK, P_DK] } } });
  for (const org of [ORG_PK, ORG_DK]) {
    await prisma.organizationSetting.deleteMany({ where: { organizationId: org } });
    await prisma.organizationModule.deleteMany({ where: { organizationId: org } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org } });
  }
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_PK, ORG_DK] } } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "l2-send@sitedoc.test", name: "Arbeider L2", role: "user" } });
  const firmaer = [
    { org: ORG_PK, p: P_PK, ord: ORD_PK, akt: AKT_PK, modus: "prosjektkort", nr: "L2-PK" },
    { org: ORG_DK, p: P_DK, ord: ORD_DK, akt: AKT_DK, modus: "dagskort", nr: "L2-DK" },
  ];
  for (const f of firmaer) {
    await prisma.organization.create({ data: { id: f.org, name: `${f.nr}-firma` } });
    await prisma.organizationMember.create({ data: { userId: USER, organizationId: f.org, status: "aktiv" } });
    await prisma.organizationModule.create({ data: { organizationId: f.org, moduleSlug: "timer", status: "aktiv" } });
    await prisma.organizationSetting.create({ data: { organizationId: f.org, timerRegistreringsmodus: f.modus } });
    await prisma.project.create({ data: { id: f.p, projectNumber: f.nr, name: `${f.nr} prosjekt`, primaryOrganizationId: f.org } });
    await prisma.projectMember.create({ data: { userId: USER, projectId: f.p, role: "member" } });
    await prisma.projectModule.create({ data: { projectId: f.p, moduleSlug: "timer", organizationId: f.org, status: "aktiv" } });
    await prismaTimer.lonnsart.create({
      data: { id: f.ord, organizationId: f.org, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
    });
    await prismaTimer.aktivitet.create({ data: { id: f.akt, organizationId: f.org, navn: "Anleggsarbeid" } });
  }
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const status = async (sheetId: string) =>
  (await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sheetId } })).status;

describe("§ 8.22 L2 — «Send dagen» sperres når en jobb mangler beskrivelse", () => {
  it("prosjektkort-firma, jobb uten beskrivelse → BAD_REQUEST, dagen står som utkast", async () => {
    const sheetId = await sedelMedJobb(ORG_PK, P_PK, ORD_PK, AKT_PK, "2026-11-02");
    await expect(dag().send({ id: sheetId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await status(sheetId)).toBe("draft");
  });

  it("prosjektkort-firma, blank beskrivelse teller som tom → BAD_REQUEST", async () => {
    const sheetId = await sedelMedJobb(ORG_PK, P_PK, ORD_PK, AKT_PK, "2026-11-03");
    await prismaTimer.sheetTimer.updateMany({ where: { sheetId }, data: { beskrivelse: "   " } });
    await expect(dag().send({ id: sheetId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // O14 pkt 4 (plan § 8.22 L2, Kenneth 2026-11-22 «s4 ja»): reise i jobbens kort teller ikke;
  // et kort med bare reise er en jobb og mangler beskrivelse til reisen har tekst.
  const reiseRad = (sheetId: string, kortId: string, beskrivelse: string | null = null) =>
    prismaTimer.sheetTimer.create({
      data: { sheetId, lonnsartId: ORD_PK, aktivitetId: AKT_PK, projectId: P_PK, kortId, erReise: true, timer: 1, beskrivelse },
    });
  const jobbensKort = async (sheetId: string) =>
    (await prismaTimer.sheetTimer.findFirstOrThrow({ where: { sheetId, erReise: false } })).kortId!;

  it("prosjektkort-firma, jobb med beskrivelse og reise i samme kort uten beskrivelse → sendt", async () => {
    const sheetId = await sedelMedJobb(ORG_PK, P_PK, ORD_PK, AKT_PK, "2026-11-04");
    await prismaTimer.sheetTimer.updateMany({ where: { sheetId }, data: { beskrivelse: "Graving av grøft" } });
    await reiseRad(sheetId, await jobbensKort(sheetId));
    await dag().send({ id: sheetId });
    expect(await status(sheetId)).toBe("sent");
  });

  it("O14 pkt 4: reise i eget kort uten beskrivelse → BAD_REQUEST, dagen står som utkast", async () => {
    const sheetId = await sedelMedJobb(ORG_PK, P_PK, ORD_PK, AKT_PK, "2026-11-06");
    await prismaTimer.sheetTimer.updateMany({ where: { sheetId }, data: { beskrivelse: "Graving av grøft" } });
    await reiseRad(sheetId, randomUUID());
    await expect(dag().send({ id: sheetId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await status(sheetId)).toBe("draft");
  });

  it("O14 pkt 4: reise i eget kort med beskrivelse → sendt", async () => {
    const sheetId = await sedelMedJobb(ORG_PK, P_PK, ORD_PK, AKT_PK, "2026-11-07");
    await prismaTimer.sheetTimer.updateMany({ where: { sheetId }, data: { beskrivelse: "Graving av grøft" } });
    await reiseRad(sheetId, randomUUID(), "Hentet stillas");
    await dag().send({ id: sheetId });
    expect(await status(sheetId)).toBe("sent");
  });

  it("vakt dagskort-firma: jobb uten beskrivelse → sendt som før", async () => {
    const sheetId = await sedelMedJobb(ORG_DK, P_DK, ORD_DK, AKT_DK, "2026-11-05");
    await dag().send({ id: sheetId });
    expect(await status(sheetId)).toBe("sent");
  });
});
