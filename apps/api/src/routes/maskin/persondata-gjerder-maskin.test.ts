import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * HULL 1 (persondata-gjerde 2026-09-10): maskin.equipment.hentMuligeAnsvarlige
 * ga navn + e-post på ALLE i firmaet — også `status: "deaktivert"` (folk som har
 * sluttet). Fikset ved å (a) filtrere på det delte kandidatpredikatet
 * `aktivAnsattIFirmaWhere` og (b) bytte `email` mot `phone` (Kenneth: «navn og
 * telefonnummer»).
 *
 * Testen mocker @sitedoc/db-singletonen (equipment.ts leser `prisma` derfra, ikke
 * ctx.prisma) og tilgangskontroll-hjelperne, og verifiserer where + select som
 * faktisk sendes til findMany. `aktivAnsattIFirmaWhere` er IKKE mocket — vi
 * beviser at prosedyren bruker det ekte, delte predikatet.
 */

const organizationMemberFindMany = vi.fn();
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationMember: {
      findMany: (...a: unknown[]) => organizationMemberFindMany(...a),
    },
  },
}));

vi.mock("../../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn().mockResolvedValue("org-1"),
  krevBrukersOrg: vi.fn().mockResolvedValue("org-1"),
}));

// Mock maskin-tjenestene equipment.ts drar inn (ikke brukt i denne prosedyren,
// men modulen lastes ved import — hold dem billige).
vi.mock("../../services/maskin", () => ({
  forhandsvisningSynkron: vi.fn(),
  extractKjennemerke: vi.fn(),
  parseForhandsvisning: vi.fn(),
  krevMaskinAktivert: vi.fn(),
  VegvesenIkkeFunnetError: class extends Error {},
  VegvesenRateLimitError: class extends Error {},
  VegvesenApiNokkelMangler: class extends Error {},
}));

import { equipmentRouter } from "./equipment";

const ORG = "11111111-1111-1111-1111-111111111111";

function lagCaller() {
  const ctx = {
    userId: "bruker-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return equipmentRouter.createCaller(ctx);
}

beforeEach(() => {
  organizationMemberFindMany.mockReset();
  organizationMemberFindMany.mockResolvedValue([]);
});

describe("HULL 1 — hentMuligeAnsvarlige gjerder på aktiv ansettelse", () => {
  it("filtrerer på det delte kandidatpredikatet (status aktiv + canLogin) — deaktiverte utelukkes", async () => {
    const caller = lagCaller();
    await caller.hentMuligeAnsvarlige({ organizationId: ORG });

    expect(organizationMemberFindMany).toHaveBeenCalledOnce();
    const arg = organizationMemberFindMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    // Beviser at deaktiverte/sluttede ikke kan ligge i lista: where krever
    // status="aktiv" + user.canLogin — nøyaktig aktivAnsattIFirmaWhere(ORG).
    expect(arg.where).toEqual({
      organizationId: ORG,
      status: "aktiv",
      user: { canLogin: true },
    });
  });

  it("velger navn + telefon, ALDRI e-post (Kenneth: «navn og telefonnummer»)", async () => {
    const caller = lagCaller();
    await caller.hentMuligeAnsvarlige({ organizationId: ORG });

    const arg = organizationMemberFindMany.mock.calls[0]![0] as {
      select: { user: { select: Record<string, boolean> } };
    };
    expect(arg.select.user.select).toEqual({ id: true, name: true, phone: true });
    expect(arg.select.user.select).not.toHaveProperty("email");
  });

  it("returnerer telefonnummeret fra hver ansatt", async () => {
    organizationMemberFindMany.mockResolvedValue([
      { user: { id: "u1", name: "Kari", phone: "99887766" } },
      { user: { id: "u2", name: "Ola", phone: null } },
    ]);
    const caller = lagCaller();
    const res = await caller.hentMuligeAnsvarlige({ organizationId: ORG });

    expect(res).toEqual([
      { id: "u1", name: "Kari", phone: "99887766" },
      { id: "u2", name: "Ola", phone: null },
    ]);
  });
});
