import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Prosjektkort L1 (2026-11-05) — `vareforbruk.hentMineForDato`.
 *
 * Varer-kolonnen på prosjektkortet leser innlogget brukers eget forbruk for
 * én dato. Låser isolasjonen: kun firmaets prosjekter (primaryOrganizationId),
 * kun egne rader (registrertAvUserId = ctx.userId), og medlemsporten på firmaet.
 */

const { projectFindMany } = vi.hoisted(() => ({ projectFindMany: vi.fn() }));
vi.mock("@sitedoc/db", () => ({ prisma: { project: { findMany: projectFindMany } } }));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  verifiserOrganisasjonTilgang: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { vareforbrukRouter } from "./vareforbruk";
import { verifiserOrganisasjonTilgang } from "../trpc/tilgangskontroll";

const ORG = "11111111-1111-1111-1111-111111111111";
const BRUKER = "22222222-2222-2222-2222-222222222222";

function lagCtx(rader: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rader);
  const ctx = {
    userId: BRUKER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prismaVarelager: { vareforbruk: { findMany } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, findMany };
}

beforeEach(() => {
  projectFindMany.mockReset();
  vi.mocked(verifiserOrganisasjonTilgang).mockReset().mockResolvedValue(undefined);
});

describe("vareforbruk.hentMineForDato", () => {
  it("filtrerer på firmaets prosjekter, egen bruker og datoen", async () => {
    projectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const { ctx, findMany } = lagCtx([
      { id: "v1", projectId: "p1", byggeplassId: null, externalCostObjectId: "eco-1", dagsseddelId: null, antall: "2.50", vare: { id: "a", navn: "Grus", enhet: "m3" } },
    ]);
    const res = await vareforbrukRouter
      .createCaller(ctx)
      .hentMineForDato({ organizationId: ORG, dato: "2026-11-05" });

    expect(verifiserOrganisasjonTilgang).toHaveBeenCalledWith(BRUKER, ORG);
    expect(projectFindMany.mock.calls[0]![0].where).toEqual({ primaryOrganizationId: ORG });
    const where = findMany.mock.calls[0]![0].where;
    expect(where.registrertAvUserId).toBe(BRUKER);
    expect(where.projectId).toEqual({ in: ["p1", "p2"] });
    expect(where.dato).toEqual(new Date("2026-11-05"));
    // ORDRE 36b: underprosjektet hentes og returneres (dagsoversikten flytter raden).
    expect(findMany.mock.calls[0]![0].select.externalCostObjectId).toBe(true);
    expect(res[0]!.externalCostObjectId).toBe("eco-1");
    // Decimal → number for klienten.
    expect(res[0]!.antall).toBe(2.5);
  });

  it("firma uten prosjekter gir tom liste uten å spørre varelageret", async () => {
    projectFindMany.mockResolvedValue([]);
    const { ctx, findMany } = lagCtx();
    const res = await vareforbrukRouter
      .createCaller(ctx)
      .hentMineForDato({ organizationId: ORG, dato: "2026-11-05" });
    expect(res).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("bruker uten tilgang til firmaet avvises før noe leses", async () => {
    vi.mocked(verifiserOrganisasjonTilgang).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN" }),
    );
    const { ctx, findMany } = lagCtx();
    await expect(
      vareforbrukRouter.createCaller(ctx).hentMineForDato({ organizationId: ORG, dato: "2026-11-05" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(projectFindMany).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
