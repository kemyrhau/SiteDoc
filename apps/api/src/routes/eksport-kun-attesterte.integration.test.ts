import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import type { TimerRapportData } from "@sitedoc/pdf";

/**
 * Ordre (31) — eksporten tar bare attesterte rader; «Ta med uattesterte» gir alle.
 * Gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 * All data lages her med faste id-er (prefiks e5a77e00) og ryddes i afterAll.
 *
 * Utvalg pr. radtype (standard): timer, maskin og tillegg = radens `attestertStatus = 'attestert'`;
 * utlegg (ingen egen status) = sedelens `status = 'accepted'` (attestert sedel).
 *
 * PDF-motoren (pdf-render-containeren) finnes ikke lokalt: den byttes ut, og dataene
 * pdfEksport gir til HTML-byggeren fanges, så testen måler radsettet PDF-en får.
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

const id = (n: string) => `e5a77e00-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const FADMIN = id("03");
const P1 = id("11");
const ORD = id("41");
const AKT = id("42");
const TL = id("43");
const KAT = id("44");
const BIL = id("45"); // vehicleId (svak FK; navnet faller tilbake til id-en)

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

// Desember 2026 — utenfor periodene de andre integrasjonstestene bruker.
const D1 = "2026-12-01"; // attestert sedel (accepted): alt attestert
const D2 = "2026-12-02"; // sendt sedel: alt pending
const D3 = "2026-12-03"; // sendt sedel, blandet: én attestert og én pending timerad
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

async function timerRad(sheetId: string, timer: number, attestertStatus: string) {
  const r = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer, attestertStatus },
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
async function utleggRad(sheetId: string, belop: number) {
  const r = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId: P1, expenseCategoryId: KAT, belop, ordningVedFoering: "utlegg" },
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

// Rad-id-ene testene måler på.
const r: Record<string, string> = {};

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "eksport-attest-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: FADMIN, email: "eksport-attest-fadmin@sitedoc.test", name: "Lønn", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Eksport-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG } });
  await prisma.project.create({
    data: { id: P1, projectNumber: "EKSP-1", name: "Eksport P1", primaryOrganizationId: ORG },
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

  // D1: attestert sedel — timer, maskin (nøstet), tillegg og utlegg er attestert.
  const s1 = await nySedel(D1, "accepted");
  r.tAtt = await timerRad(s1, 2, "attestert");
  r.mAtt = await maskinRad(s1, r.tAtt, 1, "attestert");
  r.tlAtt = await tilleggRad(s1, "attestert");
  r.uAtt = await utleggRad(s1, 100);

  // D2: sendt sedel — alt pending.
  const s2 = await nySedel(D2, "sent");
  r.tPend = await timerRad(s2, 3, "pending");
  r.mPend = await maskinRad(s2, r.tPend, 2, "pending");
  r.mPendLos = await maskinRad(s2, null, 0.5, "pending");
  r.tlPend = await tilleggRad(s2, "pending");
  r.uPend = await utleggRad(s2, 200);

  // D3: sendt sedel, blandet (rad-nivå, ikke sedel-nivå). Maskinen er attestert, men
  // timeraden den hører til er ikke → den kan ikke nøstes under en rad som er ute.
  const s3 = await nySedel(D3, "sent");
  r.tAtt2 = await timerRad(s3, 1.5, "attestert");
  r.tPend2 = await timerRad(s3, 4, "pending");
  r.mAttPaaPend = await maskinRad(s3, r.tPend2, 3, "attestert");
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("detaljEksport — standard bare attesterte", () => {
  it("timer, maskin og tillegg følger radens attestertStatus; utlegg følger sedelens status", async () => {
    const d = await rapport().detaljEksport(periode);
    expect(d.timerader.map((x) => x.id).sort()).toEqual([r.tAtt, r.tAtt2].sort());
    expect(d.timerader.every((x) => x.radstatus === "attestert")).toBe(true);
    expect(d.timerader.find((x) => x.id === r.tAtt)!.maskiner.map((m) => m.id)).toEqual([r.mAtt]);
    expect(d.tillegg.map((x) => x.id)).toEqual([r.tlAtt]);
    expect(d.utlegg.map((x) => x.id)).toEqual([r.uAtt]);
    expect(d.utlegg[0]!.seddelstatus).toBe("accepted");
    // Pending løs maskin er ute; attestert maskin på en pending timerad står på egen linje.
    expect(d.maskinUtenTimerad).toEqual([]);
    expect(d.maskinIkkeEksporterbar.map((m) => m.id)).toEqual([r.mAttPaaPend]);
  });

  it("taMedUattesterte: true gir alle rader (dagens atferd)", async () => {
    const d = await rapport().detaljEksport({ ...periode, taMedUattesterte: true });
    expect(d.timerader.map((x) => x.id).sort()).toEqual([r.tAtt, r.tPend, r.tAtt2, r.tPend2].sort());
    expect(d.timerader.find((x) => x.id === r.tPend)!.maskiner.map((m) => m.id)).toEqual([r.mPend]);
    expect(d.timerader.find((x) => x.id === r.tPend2)!.maskiner.map((m) => m.id)).toEqual([r.mAttPaaPend]);
    expect(d.maskinUtenTimerad.map((m) => m.id)).toEqual([r.mPendLos]);
    expect(d.maskinIkkeEksporterbar).toEqual([]);
    expect(d.tillegg.map((x) => x.id).sort()).toEqual([r.tlAtt, r.tlPend].sort());
    expect(d.utlegg.map((x) => x.id).sort()).toEqual([r.uAtt, r.uPend].sort());
  });
});

describe("aggregat-arkene — samme utvalg som detaljarkene", () => {
  it("standard: aggregat og detalj summerer likt (bare attesterte timer)", async () => {
    const agg = await rapport().firmaPeriodeRapport({ ...periode, kunEksporterbare: true });
    const d = await rapport().detaljEksport(periode);
    const detaljSum = sum(d.timerader.map((x) => x.timer));
    expect(detaljSum).toBe(3.5);
    expect(agg.totalTimer).toBe(detaljSum);
    const a = agg.ansatte.find((x) => x.userId === USER)!;
    expect(sum(a.perProsjekt.map((p) => p.timer))).toBe(detaljSum);
    // Etter dag: hver dag lik detaljradene den dagen.
    for (const dag of [D1, D2, D3]) {
      const aggDag = a.perDag.find((p) => p.dato === dag)?.timer ?? 0;
      expect(aggDag).toBe(sum(d.timerader.filter((x) => x.dato === dag).map((x) => x.timer)));
    }
  });

  it("taMedUattesterte: true: aggregat og detalj summerer likt (alle timer)", async () => {
    const agg = await rapport().firmaPeriodeRapport({ ...periode, kunEksporterbare: true, taMedUattesterte: true });
    const d = await rapport().detaljEksport({ ...periode, taMedUattesterte: true });
    expect(sum(d.timerader.map((x) => x.timer))).toBe(10.5);
    expect(agg.totalTimer).toBe(10.5);
  });

  it("skjermrapporten (uten eksportflagg) er uendret og viser alle rader", async () => {
    const skjerm = await rapport().firmaPeriodeRapport(periode);
    expect(skjerm.totalTimer).toBe(10.5);
    expect(skjerm.antallSedler).toBe(3);
  });
});

describe("pdfEksport — samme utvalg (også byggherredokumentet)", () => {
  const tekster = new Proxy({} as Record<string, unknown>, {
    get: (_m, k) => (k === "statusEtiketter" ? {} : String(k)),
  });
  const pdfInput = (ekstra: Record<string, unknown> = {}) => ({
    ...periode,
    firmanavn: "Eksport-firma",
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
  const timerSum = (data: TimerRapportData) =>
    sum(data.grupper.flatMap((g) => g.rader).filter((x) => x.type === "timer").map((x) => x.timer ?? 0));
  const antall = (data: TimerRapportData, type: string) =>
    data.grupper.flatMap((g) => g.rader).filter((x) => x.type === type).length;

  it("standard: bare attesterte rader, sammendraget summerer likt detaljene", async () => {
    fanget.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rapport().pdfEksport(pdfInput() as any);
    const data = fanget[0]!;
    expect(antall(data, "timer")).toBe(2);
    expect(antall(data, "tillegg")).toBe(1);
    expect(antall(data, "utlegg")).toBe(1);
    expect(timerSum(data)).toBe(3.5);
    expect(sum(data.ansatte.map((a) => a.totalTimer))).toBe(3.5);
  });

  it("byggherredokumentet (mottaker ekstern) får samme utvalg", async () => {
    fanget.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rapport().pdfEksport(pdfInput({ mottaker: "ekstern", gruppering: "prosjekt" }) as any);
    expect(timerSum(fanget[0]!)).toBe(3.5);
  });

  it("taMedUattesterte: true gir alle rader", async () => {
    fanget.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rapport().pdfEksport(pdfInput({ taMedUattesterte: true }) as any);
    const data = fanget[0]!;
    expect(antall(data, "timer")).toBe(4);
    expect(antall(data, "utlegg")).toBe(2);
    expect(timerSum(data)).toBe(10.5);
    expect(sum(data.ansatte.map((a) => a.totalTimer))).toBe(10.5);
  });
});
