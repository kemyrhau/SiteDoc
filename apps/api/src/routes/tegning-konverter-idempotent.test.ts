import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reparasjon 2026-10-11 (issue 2, server): `provKonverteringIgjen` skal være IDEMPOTENT
 * mens en konvertering pågår. Kalles «Konverter DWG» mens status er `pending`/`converting`,
 * skal den IKKE starte en ny `konverterDwg` eller avbryte den som går — bare returnere
 * gjeldende status. Starter én kun når status er `failed`/`done`/mangler.
 */

const h = vi.hoisted(() => ({ konverterDwg: vi.fn() }));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dwgKonvertering", () => ({
  // Aldri resolve → vi måler KUN om den ble kalt (ingen anvendDwgResultat-løp).
  konverterDwg: (...a: unknown[]) => {
    h.konverterDwg(...a);
    return new Promise(() => {});
  },
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TEGNING = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function lagCtx(eksisterende: Record<string, unknown>) {
  const oppdateringer: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const prisma = {
    drawing: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(eksisterende),
      update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        oppdateringer.push(arg);
        return { id: arg.where.id, ...arg.data };
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ctx = { userId: "user-1", prisma } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ctx, oppdateringer };
}

function tegning(status: string | null) {
  return {
    id: TEGNING,
    projectId: PROSJEKT,
    name: "Plan",
    byggeplassId: null,
    conversionStatus: status,
    originalFileUrl: "/uploads/original.dwg",
  };
}

describe("provKonverteringIgjen — idempotent mens konvertering pågår", () => {
  beforeEach(() => h.konverterDwg.mockReset());

  it("status=converting → starter IKKE ny konvertering, returnerer status", async () => {
    const { ctx, oppdateringer } = lagCtx(tegning("converting"));
    const res = await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).not.toHaveBeenCalled();
    expect(oppdateringer).toHaveLength(0); // ingen status-nullstilling
    expect(res.status).toBe("converting");
  });

  it("status=pending → starter IKKE ny konvertering", async () => {
    const { ctx } = lagCtx(tegning("pending"));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });

  it("status=failed → starter konvertering (gyldig retry)", async () => {
    const { ctx } = lagCtx(tegning("failed"));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });
});
