import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * HULL 2 (persondata-gjerde 2026-09-10): medlem.oppdater er gated med
 * `verifiserAdmin` (prosjektadmin) og skrev navn/e-post/telefon rett på User —
 * en sideinngang til å redigere firmaets ansatte utenom firmaadmin-veien.
 *
 * Skillet er hvem personen ER:
 *   - Ansatt i prosjektets eier-firma → kontaktinfo eies av HR → FORBIDDEN.
 *   - Ekstern kontakt (ingen OrganizationMember i eier-firmaet) → fortsatt lov,
 *     ingen andre vedlikeholder dem.
 *
 * Prosjektdata (rolle) skal ALLTID virke for prosjektadmin — også for en ansatt.
 *
 * Auth mockes: verifiserAdmin resolver (prosjektadmin passerer). ctx.prisma er en
 * egen mock. Diskriminatoren er organizationMember.findFirst mot eier-firmaet.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  verifiserAdminEllerFirmaansvarlig: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukerTillatelser: vi.fn(),
  hentBrukersOrg: vi.fn().mockResolvedValue(null),
  hentBrukersFlytMedlemskap: vi.fn(),
  hentBrukersOpprettFlytMedlemskap: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));

vi.mock("../services/epost", () => ({ sendInvitasjonsEpost: vi.fn() }));

import { medlemRouter } from "./medlem";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";
const MEDLEM = "22222222-2222-2222-2222-222222222222";
const BRUKER = "33333333-3333-3333-3333-333333333333";
const EIER_ORG = "44444444-4444-4444-4444-444444444444";

function lagPrisma(overstyr: Record<string, unknown> = {}) {
  const p: Record<string, unknown> = {
    projectMember: {
      findUniqueOrThrow: vi
        .fn()
        // 1. kall (hent medlem) → raden med user; 2. kall (retur) → ferdig rad
        .mockResolvedValueOnce({
          id: MEDLEM,
          userId: BRUKER,
          user: { id: BRUKER, email: "person@ekstern.no", name: "Per", phone: "1" },
        })
        .mockResolvedValue({ id: MEDLEM, user: {}, faggruppeKoblinger: [] }),
      update: vi.fn().mockResolvedValue({ id: MEDLEM }),
    },
    project: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ primaryOrganizationId: EIER_ORG }),
    },
    organizationMember: {
      // Default: personen ER ansatt i eier-firmaet.
      findFirst: vi.fn().mockResolvedValue({ id: "om-1" }),
    },
    user: { update: vi.fn().mockResolvedValue({ id: BRUKER }), findFirst: vi.fn() },
  };
  Object.assign(p, overstyr);
  return p;
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "admin-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return medlemRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HULL 2 — medlem.oppdater gjerder kontaktinfo på firmaets ansatte", () => {
  it("ansatt i eier-firma + endrer telefon → FORBIDDEN, User røres ikke", async () => {
    const p = lagPrisma();
    const caller = lagCaller(p);

    await expect(
      caller.oppdater({ id: MEDLEM, projectId: PROSJEKT, phone: "99887766" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect((p.user as { update: ReturnType<typeof vi.fn> }).update).not.toHaveBeenCalled();
  });

  it("ekstern kontakt (ingen ansettelse i eier-firma) + endrer telefon → lov, User oppdateres", async () => {
    const p = lagPrisma({
      organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const caller = lagCaller(p);

    await caller.oppdater({ id: MEDLEM, projectId: PROSJEKT, phone: "99887766" });

    const update = (p.user as { update: ReturnType<typeof vi.fn> }).update;
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0]).toMatchObject({
      where: { id: BRUKER },
      data: { phone: "99887766" },
    });
  });

  it("ansatt i eier-firma + endrer KUN prosjektrolle → lov (prosjektdata gjerdes ikke)", async () => {
    const p = lagPrisma();
    const caller = lagCaller(p);

    await caller.oppdater({ id: MEDLEM, projectId: PROSJEKT, role: "admin" });

    // Gjerdet skal ikke ha slått til: ingen firma-oppslag, rolle skrevet.
    expect(
      (p.organizationMember as { findFirst: ReturnType<typeof vi.fn> }).findFirst,
    ).not.toHaveBeenCalled();
    const update = (p.projectMember as { update: ReturnType<typeof vi.fn> }).update;
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0]).toMatchObject({ data: { role: "admin" } });
  });
});
