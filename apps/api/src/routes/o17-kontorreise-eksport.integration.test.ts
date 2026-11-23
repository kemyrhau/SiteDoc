import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";

/**
 * O17 (vedtak-timer-web.md § Reisevinduet pkt 21): en reise mellom to kontorer (tur 3) eksporteres
 * med «Fra» = fra-kontoret og «Til» = til-kontoret. Før O17 ble «Til» tom: oppslaget tok bare
 * `reiseOppmotestedId` (fra-kontoret) og «Til» ble regnet av byggeplassen, som ikke finnes.
 * Gjennom `detaljEksport` (Excel, PDF, skjerm og lønn leser samme `fraSted`/`tilSted`) mot EKTE
 * Postgres (lokal sandkasse). Faste id-er (prefiks 0a17e000), ryddes i afterAll.
 */
const { rapportRouter } = await import("./timer/rapport");

const id = (n: string) => `0a17e000-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const FADMIN = id("03");
const P1 = id("11");
const KT = id("21"); // Tromsø
const KN = id("22"); // Narvik
const LR = id("41");
const AKT = id("42");
const BRUKERE = [USER, FADMIN];

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
const rapport = () => rapportRouter.createCaller(ctx(FADMIN));

const DATO = "2026-12-14";
const periode = { organizationId: ORG, fra: DATO, til: DATO, taMedUattesterte: true };
const r: Record<string, string> = {};

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: LR } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.oppmotested.deleteMany({ where: { id: { in: [KT, KN] } } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: P1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function reiseRad(sheetId: string, data: Record<string, unknown>) {
  const rad = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: P1, lonnsartId: LR, aktivitetId: AKT, timer: 1, erReise: true, attestertStatus: "pending", ...data },
  });
  return rad.id;
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "o17-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: FADMIN, email: "o17-fadmin@sitedoc.test", name: "Lønn", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "O17-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O17-1", name: "O17 P1", primaryOrganizationId: ORG } });
  await prisma.projectOrganization.create({ data: { projectId: P1, organizationId: ORG } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.oppmotested.createMany({
    data: [
      { id: KT, organizationId: ORG, navn: "Tromsø", lat: 69.65, lng: 18.96 },
      { id: KN, organizationId: ORG, navn: "Narvik", lat: 68.44, lng: 17.43 },
    ],
  });
  await prismaTimer.lonnsart.create({
    data: { id: LR, organizationId: ORG, type: "ordinaer", navn: "Reise", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Reise" } });

  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(DATO), status: "sent" },
  });
  // Tur 3 (O16): fra-kontoret i `reiseOppmotestedId`, ingen byggeplass, ruten i `reiseRegel.overforing`.
  r.tur3 = await reiseRad(sid, {
    reiseRetning: "ut",
    reiseOppmotestedId: KT,
    reiseKilde: "overforing",
    fraTid: "15:00",
    tilTid: "18:50",
    reiseRegel: { overforing: { fra: { type: "kontor", oppmotestedId: KT }, til: { type: "kontor", oppmotestedId: KN }, periodeId: null } },
  });
  // Vakt: vanlig retur uten byggeplass — (ingen) → kontor.
  r.vanlig = await reiseRad(sid, { reiseRetning: "retur", reiseOppmotestedId: KN, reiseKilde: "matrise", fraTid: "19:00", tilTid: "19:30" });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O17 pkt 21 — detaljEksport: kontorreise", () => {
  it("tur 3: Fra = Tromsø, Til = Narvik (før O17: Til tom)", async () => {
    const d = await rapport().detaljEksport(periode);
    const rad = d.timerader.find((x) => x.id === r.tur3)!;
    expect(rad.fraSted).toBe("Tromsø");
    expect(rad.tilSted).toBe("Narvik");
  });

  it("vakt: vanlig retur uten kontor-rute er uendret (Til = kontoret, Fra = byggeplass/ingen)", async () => {
    const d = await rapport().detaljEksport(periode);
    const rad = d.timerader.find((x) => x.id === r.vanlig)!;
    expect(rad.fraSted).toBeNull();
    expect(rad.tilSted).toBe("Narvik");
  });
});
