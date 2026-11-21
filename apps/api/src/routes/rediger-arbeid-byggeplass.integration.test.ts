import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * F68 (web-timeforing-plan § 4.15 del H punkt 34) — «Lagre endringer» i «Rediger
 * arbeid» mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 *
 * En ventende timerad og en maskinrad med byggeplass i jobben, og en rad i en
 * annen jobb på samme sedel. Lagringen sendes slik vinduet bygger den
 * (`byggRedigerNyeRader` i `RedigerRadModal.tsx`, testet i
 * `apps/web/.../__tests__/rediger-rad-lagre.test.ts`) med én rettet time.
 * Den andre testen er premisset: payloaden vinduet sendte før F68 (`null`).
 *
 * Faste id-er (prefiks f68f68f6) ryddes i afterAll.
 */
const id = (n: string) => `f68f68f6-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("04");
const P1 = id("11");
const B1 = id("21");
const B2 = id("22");
const E1 = id("31");
const E2 = id("32");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const MASKIN = id("51");
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
const dag = () => dagsseddelRouter.createCaller(ctx(ADMIN));

let datoTeller = 0;
async function nySedel() {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      aktivitetId: AKT,
      dato: new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000),
      status: "sent",
    },
  });
  return sid;
}

/** Sedelen: jobben (E1, B1) med timerad + maskin, og en annen jobb (E2, B2) med timerad. */
async function lagDagen() {
  const sid = await nySedel();
  const tJobb = await prismaTimer.sheetTimer.create({
    data: {
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      fraTid: "07:00", tilTid: "11:00", timer: 4,
      byggeplassId: B1, externalCostObjectId: E1, kortId: "kort-jobb", attestertStatus: "pending",
    },
  });
  const tAnnen = await prismaTimer.sheetTimer.create({
    data: {
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      fraTid: "12:00", tilTid: "15:00", timer: 3,
      byggeplassId: B2, externalCostObjectId: E2, kortId: "kort-annen", attestertStatus: "pending",
    },
  });
  const mJobb = await prismaTimer.sheetMachine.create({
    data: {
      sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 2, sheetTimerId: tJobb.id,
      byggeplassId: B1, externalCostObjectId: E1, kortId: "kort-jobb", attestertStatus: "pending",
    },
  });
  return { sid, tJobb: tJobb.id, tAnnen: tAnnen.id, mJobb: mJobb.id };
}

/**
 * Lagringen slik vinduet sender den for jobben E1: radene leses som leseren gir
 * dem, jobbens timerad rettes 07–11 → 07–10. `byggeplass` = "uendret" er vinduet
 * etter F68; "null" er vinduet før.
 */
async function lagreEndringer(sid: string, byggeplass: "uendret" | "null") {
  const sedel = await dag().hentForAttestering({ id: sid });
  const timer = sedel.timer as Array<{ id: string; projectId: string; externalCostObjectId: string | null; byggeplassId: string | null; lonnsartId: string; aktivitetId: string; fraTid: string | null; tilTid: string | null; timer: unknown }>;
  const maskiner = sedel.maskiner as Array<{ id: string; projectId: string; externalCostObjectId: string | null; byggeplassId: string | null; vehicleId: string; timer: unknown }>;
  const b = (r: { byggeplassId: string | null }) => (byggeplass === "uendret" ? r.byggeplassId : null);
  await dag().redigerSedelRader({
    sheetId: sid,
    pauseFra: null,
    pauseTil: null,
    nyeRader: {
      timer: timer.map((r) => {
        const iJobben = r.externalCostObjectId === E1;
        return {
          originalId: r.id,
          projectId: r.projectId,
          lonnsartId: r.lonnsartId,
          aktivitetId: r.aktivitetId,
          externalCostObjectId: r.externalCostObjectId,
          byggeplassId: b(r),
          fraTid: r.fraTid,
          tilTid: iJobben ? "10:00" : r.tilTid,
          timer: iJobben ? 3 : Number(r.timer),
        };
      }),
      tillegg: [],
      maskin: maskiner.map((r) => ({
        originalId: r.id,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId,
        vehicleId: r.vehicleId,
        byggeplassId: b(r),
        fraTid: null,
        tilTid: null,
        timer: Number(r.timer),
        mengde: null,
        enhet: null,
      })),
    },
  });
}

async function radene(sid: string) {
  const where = { sheetId: sid, attestertStatus: { not: "erstattet" } };
  const sel = { id: true, parentRadId: true, byggeplassId: true, kortId: true, tilTid: true } as const;
  const [timer, maskin] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where, select: sel }),
    prismaTimer.sheetMachine.findMany({ where, select: { id: true, parentRadId: true, byggeplassId: true, kortId: true } }),
  ]);
  const finn = <R extends { id: string; parentRadId: string | null }>(rs: R[], gammel: string) =>
    rs.find((r) => r.id === gammel || r.parentRadId === gammel)!;
  return { timer, maskin, finn };
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
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [E1, E2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: { in: [B1, B2] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "f68-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: ADMIN, email: "f68-attestant@sitedoc.test", name: "Attestant", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "F68-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((m) => ({ organizationId: ORG, moduleSlug: m, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.create({
    data: { id: P1, projectNumber: "F68-1", name: "F68 P1", primaryOrganizationId: ORG },
  });
  await prisma.projectOrganization.create({ data: { projectId: P1, organizationId: ORG, rolle: "hovedeier" } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({
    data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
  });
  await prisma.byggeplass.createMany({
    data: [
      { id: B1, projectId: P1, name: "F68 Byggeplass 1" },
      { id: B2, projectId: P1, name: "F68 Byggeplass 2" },
    ],
  });
  await prisma.externalCostObject.createMany({
    data: [
      { id: E1, organizationId: ORG, projectId: P1, proAdmId: "F68-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: E2, organizationId: ORG, projectId: P1, proAdmId: "F68-E2", kortNavn: "Mur", kilde: "manuell", opprettetAvUserId: ADMIN },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", internNavn: "Graver", utleieEnhet: "time" },
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("F68 — «Lagre endringer» i «Rediger arbeid» tømmer ikke byggeplassen", () => {
  it("byggeplassen sendt uendret: alle radene har byggeplassen sin etterpå, og kort-id er uendret", async () => {
    const d = await lagDagen();
    await lagreEndringer(d.sid, "uendret");
    const { timer, maskin, finn } = await radene(d.sid);
    expect(finn(timer, d.tJobb)).toMatchObject({ byggeplassId: B1, kortId: "kort-jobb", tilTid: "10:00" });
    expect(finn(timer, d.tAnnen)).toMatchObject({ byggeplassId: B2, kortId: "kort-annen" });
    expect(finn(maskin, d.mJobb)).toMatchObject({ byggeplassId: B1, kortId: "kort-jobb" });
  });

  it("premisset: payloaden vinduet sendte før F68 (byggeplass null) tømmer byggeplassen og bytter kort-id", async () => {
    const d = await lagDagen();
    await lagreEndringer(d.sid, "null");
    const { timer, maskin, finn } = await radene(d.sid);
    for (const r of [finn(timer, d.tJobb), finn(timer, d.tAnnen), finn(maskin, d.mJobb)]) {
      expect(r.byggeplassId).toBeNull();
    }
    expect(finn(timer, d.tJobb).kortId).not.toBe("kort-jobb");
    expect(finn(timer, d.tAnnen).kortId).not.toBe("kort-annen");
  });
});
