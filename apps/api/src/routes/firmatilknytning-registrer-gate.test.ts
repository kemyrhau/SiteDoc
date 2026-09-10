import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Krav 1a (firmatilknytning 2026-09-10): medlem.registrer validerte IKKE
 * organizationId i admin-grenen — en prosjektadmin kunne knytte en person til et
 * HVILKET SOM HELST firma, også et ekte kundefirma. Skillet er Organization.erKunde:
 *   - skall-firma (erKunde=false) = prosjektets sak → prosjektadmin OK.
 *   - kundefirma (erKunde=true) = en ANSETTELSE → autoriserAdminForFirma (firmaadmin
 *     i DET firmaet eller sitedoc_admin).
 *
 * Auth mockes: hentProsjektRolleNivaa → {erAdmin:true} (prosjektadmin passerer porten).
 * autoriserAdminForFirma er en spy vi styrer: for kundefirma SKAL den kalles og dens
 * FORBIDDEN propagere; for skall-firma skal den ALDRI kalles.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserAdmin: vi.fn(),
  verifiserAdminEllerFirmaansvarlig: vi.fn(),
  hentProsjektRolleNivaa: vi.fn().mockResolvedValue({ erAdmin: true, erFirmaansvarlig: false }),
  erGruppeansvarlig: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukerTillatelser: vi.fn(),
  hentBrukersOrg: vi.fn().mockResolvedValue(null),
  hentBrukersFlytMedlemskap: vi.fn(),
  hentBrukersOpprettFlytMedlemskap: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../services/epost", () => ({ sendInvitasjonsEpost: vi.fn() }));

import { TRPCError } from "@trpc/server";
import { medlemRouter } from "./medlem";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";
const KUNDE_ORG = "22222222-2222-2222-2222-222222222222";
const SKALL_ORG = "33333333-3333-3333-3333-333333333333";
const BRUKER = "55555555-5555-5555-5555-555555555555";

function lagPrisma(erKunde: boolean) {
  const p: Record<string, unknown> = {
    organization: { findUnique: vi.fn().mockResolvedValue({ erKunde }) },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Inviterer" }),
      create: vi.fn().mockResolvedValue({ id: BRUKER, email: "ny@firma.no", name: "Ny Person" }),
      update: vi.fn(),
    },
    organizationMember: { upsert: vi.fn().mockResolvedValue({}) },
    projectMember: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: "pm-1", user: {}, faggruppeKoblinger: [] }),
      create: vi.fn().mockResolvedValue({ id: "pm-1" }),
    },
    account: { findFirst: vi.fn().mockResolvedValue({ id: "acc-1" }) },
    projectInvitation: { findFirst: vi.fn(), create: vi.fn() },
  };
  p.$transaction = (cb: (tx: unknown) => unknown) => cb(p);
  return p;
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "prosjektadmin-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return medlemRouter.createCaller(ctx);
}

beforeEach(() => vi.clearAllMocks());

describe("medlem.registrer — krav 1a: kundefirma krever firmaadmin", () => {
  const input = {
    projectId: PROSJEKT,
    email: "ny@firma.no",
    firstName: "Ny",
    lastName: "Person",
  };

  it("kundefirma (erKunde=true) → autoriserAdminForFirma kalles, FORBIDDEN propagerer, ingen medlemskap opprettes", async () => {
    (autoriserAdminForFirma as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "nei" }),
    );
    const p = lagPrisma(true);
    const caller = lagCaller(p);

    await expect(
      caller.registrer({ ...input, organizationId: KUNDE_ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(autoriserAdminForFirma).toHaveBeenCalledWith("prosjektadmin-1", KUNDE_ORG);
    expect((p.organizationMember as { upsert: ReturnType<typeof vi.fn> }).upsert).not.toHaveBeenCalled();
  });

  it("skall-firma (erKunde=false) → autoriserAdminForFirma kalles ALDRI, medlemskap opprettes", async () => {
    const p = lagPrisma(false);
    const caller = lagCaller(p);

    await caller.registrer({ ...input, organizationId: SKALL_ORG });

    expect(autoriserAdminForFirma).not.toHaveBeenCalled();
    expect((p.organizationMember as { upsert: ReturnType<typeof vi.fn> }).upsert).toHaveBeenCalledOnce();
  });

  it("ukjent firma → NOT_FOUND", async () => {
    const p = lagPrisma(true);
    (p.organization as { findUnique: ReturnType<typeof vi.fn> }).findUnique = vi
      .fn()
      .mockResolvedValue(null);
    const caller = lagCaller(p);

    await expect(
      caller.registrer({ ...input, organizationId: KUNDE_ORG }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
