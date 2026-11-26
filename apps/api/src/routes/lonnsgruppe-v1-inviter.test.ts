import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L1 LØNNSGRUPPER (spec-lonnsgrupper.md § 2, Kenneth 2026-11-26):
 * «Ved registrering av ansatt må den enkelte som standard få ordinær gruppe.»
 *
 * V1 organisasjon.inviterBruker — begge greinene (ny bruker og adoptert foreldreløs bruker)
 * skal skrive den ansattes lønnsgruppe rett etter firmamedlemmet. Uten valgt gruppe får
 * hen standardgruppa (sikreAnsattLonnsgruppeApi uten lonnsgruppeId); en valgt gruppe må
 * være firmaets og aktiv, ellers BAD_REQUEST før noe lagres. Mot ekte DB:
 * lonnsgruppe-v1-v3.integration.test.ts.
 */

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  autoriserAdminForFirma: vi.fn(),
  hentBrukersOrg: vi.fn().mockResolvedValue(null),
}));
vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerNyAnsattIProsjekter: vi.fn() }));
const sikreAnsattLonnsgruppeApi = vi.fn().mockResolvedValue({ lonnsgruppeId: "g-ordinaer" });
vi.mock("../services/lonnsgruppe", () => ({
  sikreAnsattLonnsgruppeApi: (...a: unknown[]) => sikreAnsattLonnsgruppeApi(...a),
}));

import { organisasjonRouter } from "./organisasjon";

const ORG = "66666666-6666-4666-8666-666666666666";
const GRUPPE = "77777777-7777-4777-8777-777777777777";
const NY = "88888888-8888-4888-8888-888888888888";

function lagPrisma(eksisterende: { id: string } | null) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue(eksisterende),
      create: vi.fn().mockResolvedValue({ id: NY, name: "Ny", email: "ny@firma.no", role: "user" }),
      update: vi.fn().mockResolvedValue({ id: NY, name: "Ny", email: "ny@firma.no", role: "user" }),
    },
    organizationMember: { create: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({}) },
  };
}

function lagCaller(prisma: unknown, gruppeFinnes = true) {
  const prismaTimer = {
    lonnsgruppe: { findFirst: vi.fn().mockResolvedValue(gruppeFinnes ? { id: GRUPPE } : null) },
  };
  const ctx = {
    userId: "admin-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    prismaTimer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { caller: organisasjonRouter.createCaller(ctx), prismaTimer };
}

const input = { organizationId: ORG, navn: "Ny Person", email: "ny@firma.no" };

beforeEach(() => sikreAnsattLonnsgruppeApi.mockClear());

describe("organisasjon.inviterBruker — L1: ny ansatt får lønnsgruppe", () => {
  it("ny bruker uten valgt gruppe → standardgruppa (sikre uten lonnsgruppeId) etter firmamedlemmet", async () => {
    const p = lagPrisma(null);
    await lagCaller(p).caller.inviterBruker(input);
    expect(p.organizationMember.create).toHaveBeenCalledOnce();
    expect(sikreAnsattLonnsgruppeApi).toHaveBeenCalledOnce();
    expect(sikreAnsattLonnsgruppeApi.mock.calls[0]![1]).toMatchObject({ organizationId: ORG, userId: NY });
    expect(sikreAnsattLonnsgruppeApi.mock.calls[0]![1].lonnsgruppeId).toBeUndefined();
  });

  it("adoptert foreldreløs bruker → får også gruppe", async () => {
    const p = lagPrisma({ id: NY });
    await lagCaller(p).caller.inviterBruker(input);
    expect(p.organizationMember.upsert).toHaveBeenCalledOnce();
    expect(sikreAnsattLonnsgruppeApi).toHaveBeenCalledOnce();
    expect(sikreAnsattLonnsgruppeApi.mock.calls[0]![1]).toMatchObject({ organizationId: ORG, userId: NY });
  });

  it("valgt gruppe → sendes videre", async () => {
    const p = lagPrisma(null);
    await lagCaller(p).caller.inviterBruker({ ...input, lonnsgruppeId: GRUPPE });
    expect(sikreAnsattLonnsgruppeApi.mock.calls[0]![1]).toMatchObject({ lonnsgruppeId: GRUPPE });
  });

  it("valgt gruppe som ikke er firmaets/aktiv → BAD_REQUEST, ingenting lagres", async () => {
    const p = lagPrisma(null);
    await expect(
      lagCaller(p, false).caller.inviterBruker({ ...input, lonnsgruppeId: GRUPPE }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(p.user.create).not.toHaveBeenCalled();
    expect(p.organizationMember.create).not.toHaveBeenCalled();
    expect(sikreAnsattLonnsgruppeApi).not.toHaveBeenCalled();
  });
});
