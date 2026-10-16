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
      // RETUR 5: nullstillingen i `provKonverteringIgjen` går via `updateMany`, betinget
      // på `updatedAt` (samme kappløps-vakt som `oppdaterAlleTegninger`). Disse testene
      // gjelder ikke kappløpet — raden har ikke rørt seg, treffer alltid (count 1).
      updateMany: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        oppdateringer.push({ where: { id: arg.where.id }, data: arg.data });
        return { count: 1 };
      }),
      findUnique: vi.fn().mockResolvedValue(eksisterende),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ctx = { userId: "user-1", prisma } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ctx, oppdateringer };
}

function tegning(status: string | null, alderMin = 0) {
  return {
    id: TEGNING,
    projectId: PROSJEKT,
    name: "Plan",
    byggeplassId: null,
    conversionStatus: status,
    originalFileUrl: "/uploads/original.dwg",
    updatedAt: new Date(Date.now() - alderMin * 60 * 1000),
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

  it("status=pending (fersk) → starter IKKE ny konvertering", async () => {
    const { ctx } = lagCtx(tegning("pending", 1));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });

  it("status=failed → starter konvertering (gyldig retry)", async () => {
    const { ctx } = lagCtx(tegning("failed"));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });

  it("status=converting ELDRE enn 10 min → rømningsvei: starter ny konvertering", async () => {
    const { ctx } = lagCtx(tegning("converting", 11));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });

  it("status=converting rett under 10 min → fortsatt avvist", async () => {
    const { ctx } = lagCtx(tegning("converting", 9));
    await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });

  it("RETUR 5 — kappløp: raden fullføres (annen kjøring) mellom lesing og merking → ingen ny jobb, gjeldende status returneres", async () => {
    const { ctx } = lagCtx(tegning("failed"));
    // Simulerer at raden har rørt seg (en annen kjøring tok/fullførte den) mellom vår
    // `findUniqueOrThrow`-lesing og vårt betingede `updateMany` — betinget skriv treffer 0.
    ctx.prisma.drawing.updateMany.mockResolvedValueOnce({ count: 0 });
    ctx.prisma.drawing.findUnique.mockResolvedValueOnce({ conversionStatus: "done" });

    const res = await tegningRouter.createCaller(ctx).provKonverteringIgjen({ id: TEGNING });

    expect(h.konverterDwg).not.toHaveBeenCalled();
    expect(res.status).toBe("done");
  });
});
