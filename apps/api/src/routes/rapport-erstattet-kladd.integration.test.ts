import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { rapportRouter } from "./timer/rapport";

/**
 * Ordre (32) — timerapporten (`firmaPeriodeRapport`) skal ikke telle erstattet-rader,
 * og kladd-sedler (`draft`, og returnerte `returned`) skal telles som kladd, ikke attestert.
 * Gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 * All data lages her med faste id-er (prefiks e5a77e32) og ryddes i afterAll.
 *
 * Merk: ingen kodesti skriver `attestertStatus = 'erstattet'` lenger (rediger/splitt
 * flytter originalen til SheetRadHistorikk siden 2026-07-13). Radene lages her direkte
 * for å låse at aggregatet og detaljeksporten bruker samme utvalg.
 */

const id = (n: string) => `e5a77e32-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const FADMIN = id("03");
const P1 = id("11");
const P2 = id("12"); // har bare en erstattet rad → skal ikke i prosjektlista
const ORD = id("41");
const AKT = id("42");
const TL = id("43");
const BIL = id("45");

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

// Januar 2027 — utenfor periodene de andre integrasjonstestene bruker.
const D1 = "2027-01-04"; // attestert sedel med erstattet-rader (timer, maskin, tillegg)
const D2 = "2027-01-05"; // kladd (draft)
const D3 = "2027-01-06"; // returnert (returned)
const periode = { organizationId: ORG, fra: D1, til: D3 };

async function nySedel(dato: string, status: string) {
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
      status,
    },
  });
  return sid;
}
async function timerRad(sheetId: string, timer: number, attestertStatus: string, projectId = P1) {
  const r = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId, lonnsartId: ORD, aktivitetId: AKT, timer, attestertStatus },
  });
  return r.id;
}
async function maskinRad(sheetId: string, sheetTimerId: string | null, timer: number, attestertStatus: string) {
  const r = await prismaTimer.sheetMachine.create({
    data: { sheetId, sheetTimerId, vehicleId: BIL, projectId: P1, timer, attestertStatus },
  });
  return r.id;
}
async function tilleggRad(sheetId: string, attestertStatus: string) {
  const r = await prismaTimer.sheetTillegg.create({
    data: { sheetId, tilleggId: TL, projectId: P1, antall: 1, attestertStatus },
  });
  return r.id;
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
  await prismaTimer.lonnsart.deleteMany({ where: { id: ORD } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TL } });
  for (const p of [P1, P2]) {
    await prisma.projectOrganization.deleteMany({ where: { projectId: p } });
    await prisma.projectModule.deleteMany({ where: { projectId: p } });
    await prisma.projectMember.deleteMany({ where: { projectId: p } });
  }
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

const r: Record<string, string> = {};

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "rapport-erst-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: FADMIN, email: "rapport-erst-fadmin@sitedoc.test", name: "Lønn", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Rapport-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG } });
  for (const [p, nr] of [[P1, "RERST-1"], [P2, "RERST-2"]] as const) {
    await prisma.project.create({
      data: { id: p, projectNumber: nr, name: `Rapport ${nr}`, primaryOrganizationId: ORG },
    });
    await prisma.projectOrganization.create({ data: { projectId: p, organizationId: ORG } });
    await prisma.projectModule.create({
      data: { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
    });
    await prisma.projectMember.create({ data: { userId: USER, projectId: p, role: "member" } });
  }
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TL, organizationId: ORG, navn: "Smusstillegg", type: "avhuking" } });

  // D1: attestert sedel. Den gjeldende raden er attestert (2 t); originalen den
  // erstattet (5 t) står igjen som `erstattet`, med erstattet maskin og tillegg.
  const s1 = await nySedel(D1, "accepted");
  r.tAtt = await timerRad(s1, 2, "attestert");
  r.tErst = await timerRad(s1, 5, "erstattet");
  r.tErstP2 = await timerRad(s1, 3, "erstattet", P2);
  r.mErst = await maskinRad(s1, r.tErst, 4, "erstattet");
  r.tlErst = await tilleggRad(s1, "erstattet");

  // D2: kladd. D3: returnert til arbeideren.
  const s2 = await nySedel(D2, "draft");
  r.tKladd = await timerRad(s2, 1, "pending");
  const s3 = await nySedel(D3, "returned");
  r.tRet = await timerRad(s3, 1.5, "pending");
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("O1 — erstattet-rader telles ikke i aggregatet", () => {
  it("detaljEksport (alle rader) utelater erstattet timer, maskin og tillegg", async () => {
    const d = await rapport().detaljEksport({ ...periode, taMedUattesterte: true });
    expect(d.timerader.map((x) => x.id).sort()).toEqual([r.tAtt, r.tKladd, r.tRet].sort());
    expect(sum(d.timerader.map((x) => x.timer))).toBe(4.5);
    expect(d.timerader.flatMap((x) => x.maskiner)).toEqual([]);
    expect(d.maskinUtenTimerad).toEqual([]);
    expect(d.tillegg).toEqual([]);
  });

  it("skjermen (uten flagg) summerer likt detaljEksport — total, pr. prosjekt og pr. dag", async () => {
    const skjerm = await rapport().firmaPeriodeRapport(periode);
    const d = await rapport().detaljEksport({ ...periode, taMedUattesterte: true });
    const detaljSum = sum(d.timerader.map((x) => x.timer));
    expect(skjerm.totalTimer).toBe(detaljSum);
    const a = skjerm.ansatte.find((x) => x.userId === USER)!;
    expect(a.totalTimer).toBe(detaljSum);
    expect(a.perProsjekt.map((p) => p.prosjektId)).toEqual([P1]);
    for (const dag of [D1, D2, D3]) {
      const aggDag = a.perDag.find((p) => p.dato === dag)?.timer ?? 0;
      expect(aggDag).toBe(sum(d.timerader.filter((x) => x.dato === dag).map((x) => x.timer)));
    }
  });

  it("eksport med «Ta med uattesterte» summerer likt detaljEksport", async () => {
    const agg = await rapport().firmaPeriodeRapport({ ...periode, kunEksporterbare: true, taMedUattesterte: true });
    expect(agg.totalTimer).toBe(4.5);
  });

  it("prosjektfilteret på et prosjekt med bare erstattet-rader gir 0 timer", async () => {
    const skjerm = await rapport().firmaPeriodeRapport({ ...periode, prosjektId: P2 });
    expect(skjerm.totalTimer).toBe(0);
  });

  it("prosjektlista i filteret tar ikke med prosjekt som bare har erstattet-rader", async () => {
    const liste = await rapport().hentFirmaProsjekterMedTimer({ organizationId: ORG });
    expect(liste.map((p) => p.id)).toEqual([P1]);
  });
});

describe("O2 — sedelstatus i statusFordeling", () => {
  it("draft og returned telles som kladd, accepted som attestert", async () => {
    const skjerm = await rapport().firmaPeriodeRapport(periode);
    expect(skjerm.statusFordeling).toEqual({ kladd: 2, sent: 0, attestert: 1 });
    const a = skjerm.ansatte.find((x) => x.userId === USER)!;
    expect(a.statusFordeling).toEqual({ kladd: 2, sent: 0, attestert: 1 });
  });
});
