import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import type { TimerRapportData } from "@sitedoc/pdf";

/**
 * Ordre (37) — sammendraget i PDF/Excel teller dagssedler med rader i eksporttabellen
 * (Kenneth 2026-11-16, spec § 12.8.5). «Sedler» og kladd/sendt/attestert på eksportveien
 * (`kunEksporterbare`) teller bare sedler med minst én rad detaljEksport gir ut.
 * Skjermen (uten flagget) teller alle sedler som før.
 * Gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 * All data lages her med faste id-er (prefiks 37a3d5e0) og ryddes i afterAll.
 *
 * PDF-motoren finnes ikke lokalt: den byttes ut, og dataene pdfEksport gir til
 * HTML-byggeren fanges, så testen måler sammendraget PDF-en får.
 */

const fanget: TimerRapportData[] = [];
vi.mock("../services/pdf-render-klient", () => ({
  renderPdfViaContainer: async () => ({ pdf: Buffer.from("pdf") }),
}));
vi.mock("@sitedoc/pdf", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("@sitedoc/pdf")>();
  return {
    ...ekte,
    byggTimerRapportHtml: (data: TimerRapportData, tekster: unknown) => {
      fanget.push(data);
      return ekte.byggTimerRapportHtml(data, tekster as Parameters<typeof ekte.byggTimerRapportHtml>[1]);
    },
  };
});

// Importeres ETTER vi.mock (vitest heiser mockene uansett; rekkefølgen dokumenterer avhengigheten).
const { rapportRouter } = await import("./timer/rapport");

const id = (n: string) => `37a3d5e0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const FADMIN = id("03");
const P1 = id("11");
const ORD = id("41");
const AKT = id("42");
const TL = id("43");
const KAT = id("44");

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

// Eget firma (ORG) — periodene til andre tester berøres ikke.
const D1 = "2026-12-07"; // attestert sedel med attestert rad
const D2 = "2026-12-08"; // attestert sedel med attestert rad
const D3 = "2026-12-09"; // sendt sedel, pending timerad → ingen rad i tabellen
const D4 = "2026-12-10"; // kladd, pending timerad → ingen rad i tabellen
const D5 = "2026-12-11"; // sendt sedel: pending timerad + ATTESTERT tillegg (egen describe)
const periode = { organizationId: ORG, fra: D1, til: D4 };

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

async function timerRad(sheetId: string, timer: number, attestertStatus: string) {
  const r = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer, attestertStatus },
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
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KAT } });
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

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "sammendrag-sedler-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: FADMIN, email: "sammendrag-sedler-fadmin@sitedoc.test", name: "Lønn", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Sammendrag-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG } });
  await prisma.project.create({
    data: { id: P1, projectNumber: "SAMM-1", name: "Sammendrag P1", primaryOrganizationId: ORG },
  });
  await prisma.projectOrganization.create({ data: { projectId: P1, organizationId: ORG } });
  await prisma.projectModule.create({
    data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
  });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TL, organizationId: ORG, navn: "Smusstillegg", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KAT, organizationId: ORG, navn: "Parkering" } });

  // Ordrens eksempel: 4 dagssedler — 2 attestert med rader, 1 sendt og 1 kladd uten rader i tabellen.
  const s1 = await nySedel(D1, "accepted");
  await timerRad(s1, 2, "attestert");
  const s2 = await nySedel(D2, "accepted");
  await timerRad(s2, 3, "attestert");
  const s3 = await nySedel(D3, "sent");
  await timerRad(s3, 4, "pending");
  const s4 = await nySedel(D4, "draft");
  await timerRad(s4, 5, "pending");

  // Utenfor `periode`: sendt sedel der timeraden er pending, men tillegget er attestert.
  // Tillegget står i eksporttabellen → sedelen har en rad i tabellen.
  const s5 = await nySedel(D5, "sent");
  await timerRad(s5, 1, "pending");
  await tilleggRad(s5, "attestert");
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const tekster = new Proxy({} as Record<string, unknown>, {
  get: (_m, k) => (k === "statusEtiketter" ? {} : String(k)),
});
const pdfInput = (ekstra: Record<string, unknown> = {}) => ({
  ...periode,
  firmanavn: "Sammendrag-firma",
  filnavn: "x.pdf",
  footerGenerert: "g",
  footerSide: "s",
  footerAv: "av",
  // teksterSchema krever hver nøkkel; Proxy-en svarer på alle.
  tekster: Object.fromEntries(
    [
      "dokumentTittel", "periode", "prosjekt", "ansatt", "alle", "ingenData", "sum", "sammendrag",
      "kolAnsattnr", "kolTotalTimer", "kolSedler", "kolSistRegistrert", "kolKladd", "kolSent",
      "kolAttestert", "detaljer", "subtotal", "kolDato", "kolByggeplass", "kolUnderprosjekt", "kolType",
      "kolBetegnelse", "kolAktivitet", "kolFra", "kolTil", "kolTimer", "kolMaskintimer", "kolAntall",
      "kolBelop", "kolMengde", "kolEnhet", "kolBeskrivelse", "kolStatus", "typeTimer", "typeMaskin",
      "typeTillegg", "typeUtlegg", "maskinUtenTimerad", "maskinIkkeEksporterbar", "statusEtiketter",
    ].map((k) => [k, tekster[k]]),
  ),
  ...ekstra,
});

describe("ordre (37) — eksportveien teller sedler med rader i tabellen", () => {
  it("Excel-veien (aggregat med kunEksporterbare): Sedler 2 · Attestert 2", async () => {
    const agg = await rapport().firmaPeriodeRapport({ ...periode, kunEksporterbare: true });
    expect(agg.antallSedler).toBe(2);
    expect(agg.statusFordeling).toEqual({ kladd: 0, sent: 0, attestert: 2 });
    const a = agg.ansatte.find((x) => x.userId === USER)!;
    expect(a.antallSedler).toBe(2);
    expect(a.statusFordeling).toEqual({ kladd: 0, sent: 0, attestert: 2 });
    expect(a.totalTimer).toBe(5);
  });

  it("PDF-sammendraget: Sedler 2 · Attestert 2", async () => {
    fanget.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rapport().pdfEksport(pdfInput() as any);
    const a = fanget[0]!.ansatte[0]!;
    expect(a.antallSedler).toBe(2);
    expect({ kladd: a.kladd, sent: a.sent, attestert: a.attestert }).toEqual({ kladd: 0, sent: 0, attestert: 2 });
  });

  it("negativkontroll «Ta med uattesterte»: alle 4 sedler har rader i tabellen", async () => {
    const agg = await rapport().firmaPeriodeRapport({ ...periode, kunEksporterbare: true, taMedUattesterte: true });
    expect(agg.antallSedler).toBe(4);
    expect(agg.statusFordeling).toEqual({ kladd: 1, sent: 1, attestert: 2 });
    fanget.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rapport().pdfEksport(pdfInput({ taMedUattesterte: true }) as any);
    expect(fanget[0]!.ansatte[0]!.antallSedler).toBe(4);
  });

  it("skjermen (uten eksportflagg) teller alle 4 som før", async () => {
    const skjerm = await rapport().firmaPeriodeRapport(periode);
    expect(skjerm.antallSedler).toBe(4);
    expect(skjerm.statusFordeling).toEqual({ kladd: 1, sent: 1, attestert: 2 });
    expect(skjerm.ansatte.find((x) => x.userId === USER)!.antallSedler).toBe(4);
  });
});

describe("ordre (37) — alle radtyper i tabellen teller, ikke bare timer", () => {
  it("sendt sedel med pending timerad og attestert tillegg telles (tillegget står i tabellen)", async () => {
    const p = { organizationId: ORG, fra: D5, til: D5 };
    const d = await rapport().detaljEksport(p);
    expect(d.timerader).toEqual([]);
    expect(d.tillegg).toHaveLength(1);
    const agg = await rapport().firmaPeriodeRapport({ ...p, kunEksporterbare: true });
    expect(agg.antallSedler).toBe(1);
    expect(agg.statusFordeling).toEqual({ kladd: 0, sent: 1, attestert: 0 });
    expect(agg.totalTimer).toBe(0);
  });
});
