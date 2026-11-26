import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { organisasjonRouter } from "./organisasjon";
import { medlemRouter } from "./medlem";

/**
 * L1 LØNNSGRUPPER (spec-lonnsgrupper.md § 2, Kenneth 2026-11-26):
 * «Ved registrering av ansatt må den enkelte som standard få ordinær gruppe.»
 *
 * Mot EKTE Postgres (lokal sandkasse, aldri test/prod), etter migreringen
 * 20261126120000_l1_lonnsgrupper. Hver av de tre veiene som lager et firmamedlem
 * (V1 organisasjon.inviterBruker, V2 medlem.registrer, V3 medlem.endreFirma) skal etterlate
 * en rad i timer.ansatt_lonnsgrupper. Testen blir rød når sikreAnsattLonnsgruppeApi-kallet
 * fjernes fra én av dem.
 */

const id = (n: string) => `11111111-0000-4000-8000-0000000000${n}`;
const ORG_A = id("01");
const ORG_B = id("02");
const ADMIN = id("03");
const PROSJEKT = id("11");
const DOMENE = "@l1-lonnsgruppe.invalid";

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

async function rydd() {
  const brukere = await prisma.user.findMany({ where: { email: { endsWith: DOMENE } }, select: { id: true } });
  const ider = [ADMIN, ...brukere.map((b) => b.id)];
  await prismaTimer.ansattLonnsgruppe.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prismaTimer.lonnsgruppe.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.activity.deleteMany({ where: { OR: [{ actorUserId: { in: ider } }, { projectId: PROSJEKT }] } });
  await prisma.projectInvitation.deleteMany({ where: { projectId: PROSJEKT } });
  await prisma.projectMember.deleteMany({ where: { projectId: PROSJEKT } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.project.deleteMany({ where: { id: PROSJEKT } });
  await prisma.user.deleteMany({ where: { id: { in: ider } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
}

async function gruppeFor(organizationId: string, userId: string) {
  const rad = await prismaTimer.ansattLonnsgruppe.findUnique({
    where: { uq_ansatt_lonnsgruppe: { organizationId, userId } },
    include: { lonnsgruppe: { select: { navn: true, erStandard: true } } },
  });
  return rad ? { navn: rad.lonnsgruppe.navn, erStandard: rad.lonnsgruppe.erStandard, lonnsgruppeId: rad.lonnsgruppeId } : null;
}

beforeAll(async () => {
  await rydd();
  await prisma.organization.createMany({
    data: [
      { id: ORG_A, name: "L1 Firma A", erKunde: false },
      { id: ORG_B, name: "L1 Firma B", erKunde: false },
    ],
  });
  await prisma.user.create({ data: { id: ADMIN, email: `admin${DOMENE}`, name: "L1 Admin", role: "sitedoc_admin" } });
  await prisma.project.create({
    data: { id: PROSJEKT, projectNumber: "L1-TEST-0001", name: "L1 prosjekt" },
  });
});

afterAll(async () => {
  await rydd();
});

describe("L1 — ingen ansatt uten lønnsgruppe (V1–V3)", () => {
  it("V1 inviterBruker uten valgt gruppe gir firmaets «Ordinær»", async () => {
    const svar = await organisasjonRouter.createCaller(ctx(ADMIN)).inviterBruker({
      organizationId: ORG_A,
      navn: "Vera Invitert",
      email: `v1${DOMENE}`,
    });
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: `v1${DOMENE}` } })).id;
    expect(svar).toBeTruthy();
    expect(await gruppeFor(ORG_A, userId)).toMatchObject({ navn: "Ordinær", erStandard: true });
  });

  it("V1 inviterBruker med valgt gruppe setter den gruppa", async () => {
    const laerling = await prismaTimer.lonnsgruppe.create({
      data: { organizationId: ORG_A, navn: "Lærling", erStandard: false, aktiv: true },
    });
    await organisasjonRouter.createCaller(ctx(ADMIN)).inviterBruker({
      organizationId: ORG_A,
      navn: "Lars Lærling",
      email: `v1b${DOMENE}`,
      lonnsgruppeId: laerling.id,
    });
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: `v1b${DOMENE}` } })).id;
    expect(await gruppeFor(ORG_A, userId)).toMatchObject({ navn: "Lærling", lonnsgruppeId: laerling.id });
  });

  it("V2 medlem.registrer med firma gir firmaets «Ordinær»", async () => {
    await medlemRouter.createCaller(ctx(ADMIN)).registrer({
      projectId: PROSJEKT,
      email: `v2${DOMENE}`,
      firstName: "Rita",
      lastName: "Registrert",
      organizationId: ORG_A,
      role: "member",
      faggruppeIder: [],
      gruppeIder: [],
      flytBindinger: [],
    });
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: `v2${DOMENE}` } })).id;
    expect(await gruppeFor(ORG_A, userId)).toMatchObject({ navn: "Ordinær", erStandard: true });
  });

  it("V3 medlem.endreFirma (firmabytte) gir mottakerfirmaets «Ordinær»", async () => {
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: `v2${DOMENE}` } })).id;
    const pm = await prisma.projectMember.findFirstOrThrow({ where: { projectId: PROSJEKT, userId } });
    await medlemRouter.createCaller(ctx(ADMIN)).endreFirma({
      projectId: PROSJEKT,
      projectMemberId: pm.id,
      fraOrganizationId: ORG_A,
      tilOrganizationId: ORG_B,
      modus: "firmabytte",
    });
    expect(await gruppeFor(ORG_B, userId)).toMatchObject({ navn: "Ordinær", erStandard: true });
  });

  it("V3 medlem.endreFirma (feilregistrering) gir mottakerfirmaets «Ordinær»", async () => {
    const userId = (await prisma.user.findFirstOrThrow({ where: { email: `v1${DOMENE}` } })).id;
    await prisma.projectMember.create({ data: { projectId: PROSJEKT, userId, role: "member" } });
    const pm = await prisma.projectMember.findFirstOrThrow({ where: { projectId: PROSJEKT, userId } });
    await medlemRouter.createCaller(ctx(ADMIN)).endreFirma({
      projectId: PROSJEKT,
      projectMemberId: pm.id,
      fraOrganizationId: ORG_A,
      tilOrganizationId: ORG_B,
      modus: "feilregistrering",
    });
    expect(await gruppeFor(ORG_B, userId)).toMatchObject({ navn: "Ordinær", erStandard: true });
  });

  it("ingen firmamedlem i testfirmaene står uten gruppe", async () => {
    const medlemmer = await prisma.organizationMember.findMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
      select: { organizationId: true, userId: true },
    });
    expect(medlemmer.length).toBeGreaterThanOrEqual(4);
    for (const m of medlemmer) {
      expect(await gruppeFor(m.organizationId, m.userId), `${m.userId} i ${m.organizationId}`).not.toBeNull();
    }
  });
});
