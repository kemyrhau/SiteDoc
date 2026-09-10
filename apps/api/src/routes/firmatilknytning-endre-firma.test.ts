import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Krav 2 (firmatilknytning 2026-09-10): medlem.endreFirma skiller TO hendelser:
 *   - firmabytte: gammel rad AVSLUTTES (status="deaktivert"), ny rad opprettes/reaktiveres.
 *   - feilregistrering: gammel rad FLYTTES (organizationId oppdateres, samme id).
 *
 * Auth speiler regeltabellen på erKunde(FRA)/erKunde(TIL). Vi styrer verifiserAdmin
 * og autoriserAdminForFirma som spies for å bekrefte hvilken port som velges.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  verifiserAdminEllerFirmaansvarlig: vi.fn().mockResolvedValue({ erAdmin: true }),
  hentProsjektRolleNivaa: vi.fn(),
  erGruppeansvarlig: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukerTillatelser: vi.fn(),
  hentBrukersOrg: vi.fn(),
  hentBrukersFlytMedlemskap: vi.fn(),
  hentBrukersOpprettFlytMedlemskap: vi.fn(),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../services/epost", () => ({ sendInvitasjonsEpost: vi.fn() }));

import { medlemRouter } from "./medlem";
import { verifiserAdmin, autoriserAdminForFirma } from "../trpc/tilgangskontroll";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";
const MEDLEM = "22222222-2222-2222-2222-222222222222";
const BRUKER = "33333333-3333-3333-3333-333333333333";
const FRA = "44444444-4444-4444-4444-444444444444";
const TIL = "55555555-5555-5555-5555-555555555555";

function lagPrisma(opts: {
  fraKunde?: boolean;
  tilKunde?: boolean;
  harFra?: boolean;
  harTil?: boolean;
  rolle?: string;
} = {}) {
  const { fraKunde = false, tilKunde = false, harFra = true, harTil = false, rolle = "user" } = opts;
  const orgFindUnique = vi.fn((args: { where: { id: string } }) =>
    Promise.resolve(args.where.id === FRA ? { erKunde: fraKunde } : { erKunde: tilKunde }),
  );
  const omFindUnique = vi.fn((args: { where: { userId_organizationId: { organizationId: string } } }) => {
    const org = args.where.userId_organizationId.organizationId;
    if (org === FRA) return Promise.resolve(harFra ? { id: "om-fra" } : null);
    return Promise.resolve(harTil ? { id: "om-til" } : null);
  });
  const p: Record<string, unknown> = {
    projectMember: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: MEDLEM, userId: BRUKER, projectId: PROSJEKT }),
    },
    organization: { findUnique: orgFindUnique },
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: rolle }) },
    organizationMember: {
      findUnique: omFindUnique,
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  p.$transaction = (cb: (tx: unknown) => unknown) => cb(p);
  return p;
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "kaller-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return medlemRouter.createCaller(ctx);
}

const basis = { projectId: PROSJEKT, projectMemberId: MEDLEM, fraOrganizationId: FRA, tilOrganizationId: TIL };

beforeEach(() => vi.clearAllMocks());

describe("medlem.endreFirma — regeltabellen", () => {
  it("skall→skall → prosjektadmin (verifiserAdmin), autoriserAdminForFirma ikke kalt", async () => {
    const p = lagPrisma({ fraKunde: false, tilKunde: false });
    await lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" });
    expect(verifiserAdmin).toHaveBeenCalledWith("kaller-1", PROSJEKT);
    expect(autoriserAdminForFirma).not.toHaveBeenCalled();
  });

  it("skall→kunde → firmaadmin i TIL (autoriserAdminForFirma på TIL)", async () => {
    const p = lagPrisma({ fraKunde: false, tilKunde: true });
    await lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" });
    expect(autoriserAdminForFirma).toHaveBeenCalledWith("kaller-1", TIL);
    expect(verifiserAdmin).not.toHaveBeenCalled();
  });

  it("kunde→skall → firmaadmin i FRA (autoriserAdminForFirma på FRA)", async () => {
    const p = lagPrisma({ fraKunde: true, tilKunde: false });
    await lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" });
    expect(autoriserAdminForFirma).toHaveBeenCalledWith("kaller-1", FRA);
  });

  it("kunde→kunde uten sitedoc_admin → FORBIDDEN", async () => {
    const p = lagPrisma({ fraKunde: true, tilKunde: true, rolle: "company_admin" });
    await expect(lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("kunde→kunde med sitedoc_admin → tillatt", async () => {
    const p = lagPrisma({ fraKunde: true, tilKunde: true, rolle: "sitedoc_admin" });
    await lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" });
    expect((p.organizationMember as { upsert: ReturnType<typeof vi.fn> }).upsert).toHaveBeenCalledOnce();
  });
});

describe("medlem.endreFirma — de to hendelsene", () => {
  it("firmabytte → gammel rad deaktiveres, ny rad upsertes aktiv", async () => {
    const p = lagPrisma({ harTil: false });
    await lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" });
    const om = p.organizationMember as { update: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    expect(om.update).toHaveBeenCalledOnce();
    expect(om.update.mock.calls[0]![0]).toMatchObject({
      where: { id: "om-fra" },
      data: { status: "deaktivert" },
    });
    expect(om.upsert).toHaveBeenCalledOnce();
  });

  it("feilregistrering uten til-rad → gammel rad FLYTTES til nytt firma (samme id)", async () => {
    const p = lagPrisma({ harTil: false });
    await lagCaller(p).endreFirma({ ...basis, modus: "feilregistrering" });
    const om = p.organizationMember as { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    expect(om.update).toHaveBeenCalledOnce();
    expect(om.update.mock.calls[0]![0]).toMatchObject({
      where: { id: "om-fra" },
      data: { organizationId: TIL, status: "aktiv" },
    });
    expect(om.delete).not.toHaveBeenCalled();
  });

  it("feilregistrering NÅR til-rad finnes → feilført rad slettes (unngår duplikat)", async () => {
    const p = lagPrisma({ harTil: true });
    await lagCaller(p).endreFirma({ ...basis, modus: "feilregistrering" });
    const om = p.organizationMember as { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    expect(om.delete).toHaveBeenCalledWith({ where: { id: "om-fra" } });
    expect(om.update).not.toHaveBeenCalled();
  });

  it("personen mangler fra-medlemskap → NOT_FOUND", async () => {
    const p = lagPrisma({ harFra: false });
    await expect(lagCaller(p).endreFirma({ ...basis, modus: "firmabytte" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("fra == til → BAD_REQUEST", async () => {
    const p = lagPrisma();
    await expect(
      lagCaller(p).endreFirma({ ...basis, tilOrganizationId: FRA, modus: "firmabytte" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
