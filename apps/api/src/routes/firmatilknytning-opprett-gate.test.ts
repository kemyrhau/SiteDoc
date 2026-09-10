import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Krav 1b (firmatilknytning 2026-09-10): organisasjon.opprett hadde INGEN
 * tilgangssjekk — enhver innlogget bruker kunne opprette et skall-firma med fritt
 * navn. Gated til sitedoc_admin (speiler admin.opprettOrganisasjon). Vanlig bruker
 * avvises FØR organization.create; sitedoc_admin slipper gjennom.
 */

vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../services/firmamodul", () => ({
  syncProjektModulerPaaAktiver: vi.fn(),
  syncProjektModulerPaaDeaktiver: vi.fn(),
  skrivOrganizationModuleAktiver: vi.fn(),
  skrivOrganizationModuleDeaktiver: vi.fn(),
  hentAktiveFirmamoduler: vi.fn(),
}));
vi.mock("../services/seed", () => ({ seedFirmamodulKatalog: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerNyAnsattIProsjekter: vi.fn() }));
vi.mock("../services/brreg", () => ({ hentFirmaFraBrreg: vi.fn(), BrregError: class extends Error {} }));
vi.mock("../services/timer", () => ({ hentEffektivArbeidstid: vi.fn() }));
vi.mock("../services/reisetidMatrise", () => ({ recomputeMatriseIBakgrunn: vi.fn() }));

import { organisasjonRouter } from "./organisasjon";

function lagCaller(role: string, orgCreate: ReturnType<typeof vi.fn>) {
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role }) },
    organization: { create: orgCreate },
  };
  const ctx = {
    userId: "bruker-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { caller: organisasjonRouter.createCaller(ctx), orgCreate };
}

beforeEach(() => vi.clearAllMocks());

describe("organisasjon.opprett — krav 1b: kun sitedoc_admin", () => {
  it("vanlig bruker → FORBIDDEN, organization.create kalles aldri", async () => {
    const orgCreate = vi.fn();
    const { caller } = lagCaller("user", orgCreate);

    await expect(caller.opprett({ name: "Fritt Firma" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(orgCreate).not.toHaveBeenCalled();
  });

  it("company_admin → FORBIDDEN (ikke firma-admin-nivå for global skall-opprettelse)", async () => {
    const orgCreate = vi.fn();
    const { caller } = lagCaller("company_admin", orgCreate);

    await expect(caller.opprett({ name: "Fritt Firma" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(orgCreate).not.toHaveBeenCalled();
  });

  it("sitedoc_admin → oppretter firma", async () => {
    const orgCreate = vi.fn().mockResolvedValue({ id: "org-1", name: "Fritt Firma" });
    const { caller } = lagCaller("sitedoc_admin", orgCreate);

    const res = await caller.opprett({ name: "Fritt Firma" });
    expect(res).toMatchObject({ id: "org-1", name: "Fritt Firma" });
    expect(orgCreate).toHaveBeenCalledOnce();
  });
});
