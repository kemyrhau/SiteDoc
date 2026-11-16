import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";

/**
 * Ordre (34) — PDF-eksporten skal gi en fil eller en forståelig melding, aldri en tom PDF.
 * Gjennom prosedyren (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 * Data med faste id-er (prefiks e5a77e34) ryddes i afterAll.
 *
 * Kenneths utvalg (test.sitedoc.no 2026-11-16): én ansatt, 11 sedler — 1 attestert,
 * 4 sendt, 6 kladd. Januar 2027 speiler det; februar 2027 har bare kladd og sendt,
 * så standardeksporten (bare attesterte) har ingen rader der.
 *
 * pdf-render-containeren byttes ut og kallene telles. `PDF_EKTE=1` bruker den ekte
 * klienten mot `PDF_URL` (lokal pdf-render) for en ende-til-ende-måling.
 */

const renderKall = { antall: 0 };
vi.mock("../services/pdf-render-klient", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("../services/pdf-render-klient")>();
  return {
    renderPdfViaContainer: async (...args: Parameters<typeof ekte.renderPdfViaContainer>) => {
      renderKall.antall++;
      if (process.env.PDF_EKTE === "1") return ekte.renderPdfViaContainer(...args);
      return { pdf: Buffer.from("%PDF-falsk"), renderTimeout: false };
    },
  };
});

const { rapportRouter } = await import("./timer/rapport");

const id = (n: string) => `e5a77e34-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const FADMIN = id("03");
const P1 = id("11");
const ORD = id("41");
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

const JANUAR = { organizationId: ORG, fra: "2027-01-01", til: "2027-01-31" };
const FEBRUAR = { organizationId: ORG, fra: "2027-02-01", til: "2027-02-28" };

async function sedel(dato: string, status: string, timer: number, attestertStatus: string) {
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
  await prismaTimer.sheetTimer.create({
    data: { sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer, attestertStatus },
  });
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
      { id: USER, email: "pdf34-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: FADMIN, email: "pdf34-fadmin@sitedoc.test", name: "Lønn", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "PDF-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG } });
  await prisma.project.create({
    data: { id: P1, projectNumber: "PDF-1", name: "PDF P1", primaryOrganizationId: ORG },
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

  // Januar: 1 attestert, 4 sendt, 6 kladd (Kenneths fordeling).
  await sedel("2027-01-04", "accepted", 8, "attestert");
  for (const d of ["05", "06", "07", "08"]) await sedel(`2027-01-${d}`, "sent", 8, "pending");
  for (const d of ["11", "12", "13", "14", "15", "18"]) await sedel(`2027-01-${d}`, "draft", 7.5, "pending");
  // Februar: bare kladd og sendt — ingen attesterte rader.
  await sedel("2027-02-01", "sent", 8, "pending");
  await sedel("2027-02-02", "draft", 8, "pending");
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);
beforeEach(() => {
  renderKall.antall = 0;
});

const tekster = new Proxy({} as Record<string, unknown>, {
  get: (_m, k) => (k === "statusEtiketter" ? {} : String(k)),
});
const pdfInput = (periode: typeof JANUAR, ekstra: Record<string, unknown> = {}) => ({
  ...periode,
  firmanavn: "PDF-firma",
  filnavn: "SiteDoc-Timerapport.pdf",
  footerGenerert: "g",
  footerSide: "s",
  footerAv: "av",
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

// De tre innebygde malene slik `byggInnebygde` i rapport/page.tsx sender dem via PDF-knappen.
const MALER: Record<string, Record<string, unknown>> = {
  "Full eksport": { mottaker: "intern", gruppering: "ingen", orientering: "auto" },
  Lønnsgrunnlag: { mottaker: "intern", gruppering: "ansatt", orientering: "auto" },
  Fakturagrunnlag: {
    mottaker: "ekstern",
    gruppering: "prosjekt",
    orientering: "liggende",
    topptekstLinjer: ["{firma}", "Fakturagrunnlag", "{periode}", "{prosjekt}"],
    kolonner: [
      "dato", "prosjekt", "type", "betegnelse", "aktivitet",
      "timer", "maskintimer", "antall", "belop", "mengde", "enhet", "beskrivelse",
    ],
  },
};

describe("pdfEksport — Kenneths utvalg gir en fil", () => {
  for (const [navn, mal] of Object.entries(MALER)) {
    for (const taMedUattesterte of [false, true]) {
      it(`${navn}, «Ta med uattesterte» ${taMedUattesterte ? "på" : "av"}: PDF og filnavn`, async () => {
        const res = await rapport().pdfEksport(pdfInput(JANUAR, { ...mal, taMedUattesterte }) as never);
        expect(res.tomtUtvalg).toBe(false);
        if (res.tomtUtvalg) return;
        expect(res.filnavn).toBe("SiteDoc-Timerapport.pdf");
        expect(Buffer.from(res.pdf, "base64").subarray(0, 4).toString()).toBe("%PDF");
        expect(renderKall.antall).toBe(1);
      });
    }
  }
});

describe("pdfEksport — tomt utvalg gir melding, ikke en tom PDF", () => {
  it("ingen attesterte rader i perioden: tomtUtvalg, ingen render", async () => {
    const res = await rapport().pdfEksport(pdfInput(FEBRUAR) as never);
    expect(res.tomtUtvalg).toBe(true);
    expect(renderKall.antall).toBe(0);
  });

  it("samme periode med «Ta med uattesterte»: fil", async () => {
    const res = await rapport().pdfEksport(pdfInput(FEBRUAR, { taMedUattesterte: true }) as never);
    expect(res.tomtUtvalg).toBe(false);
    expect(renderKall.antall).toBe(1);
  });

  it("radvalg uten rader (bare utlegg, ingen utlegg i perioden): tomtUtvalg", async () => {
    const res = await rapport().pdfEksport(
      pdfInput(JANUAR, { radTyper: ["utlegg"], taMedUattesterte: true }) as never,
    );
    expect(res.tomtUtvalg).toBe(true);
    expect(renderKall.antall).toBe(0);
  });
});
