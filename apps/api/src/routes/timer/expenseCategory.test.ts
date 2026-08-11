import { describe, it, expect, vi } from "vitest";

/**
 * U5-invariant (fabel-vilkår, 2026-08-11): `settOverstyring` er en EKTE upsert —
 * en eksisterende overstyring endres via `update({ where: { id } })`, ALDRI via
 * delete+create. Grunnen er ikke UX: mellom en delete og en create finnes et
 * vindu der prosjektet faller til firma-default, og et utlegg ført akkurat da
 * ville fått feil `ordningVedFoering` (immutabelt). Denne testen hindrer at noen
 * senere «forenkler» tilbake til delete+create.
 *
 * Drives via router.createCaller med en mocket ctx. tilgangskontroll mockes
 * (ingen ekte DB); tokenKilde=null omgår token-rotasjons-middlewaren.
 */

vi.mock("../../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  // Ikke brukt av settOverstyring, men må eksporteres for at modulen skal laste.
  resolverOrgFraInput: vi.fn(),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const PROSJEKT = "22222222-2222-2222-2222-222222222222";
const KATEGORI = "33333333-3333-3333-3333-333333333333";

import { expenseCategoryRouter } from "./expenseCategory";

function lagCtx(overstyring: {
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      project: { findFirst: vi.fn().mockResolvedValue({ id: PROSJEKT }) },
    },
    prismaTimer: {
      expenseCategory: { findFirst: vi.fn().mockResolvedValue({ id: KATEGORI }) },
      prosjektOrdningOverstyring: overstyring,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("settOverstyring — ekte upsert (samme id, aldri delete+create)", () => {
  it("eksisterende overstyring → update({ where: { id } }) kalles, create ALDRI", async () => {
    const update = vi.fn().mockResolvedValue({ id: "ov-1", ordning: "utlegg" });
    const create = vi.fn();
    const findFirst = vi.fn().mockResolvedValue({ id: "ov-1" });
    const caller = expenseCategoryRouter.createCaller(
      lagCtx({ findFirst, update, create }),
    );

    await caller.settOverstyring({
      organizationId: ORG,
      prosjektId: PROSJEKT,
      expenseCategoryId: KATEGORI,
      ordning: "utlegg",
    });

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]![0].where).toEqual({ id: "ov-1" });
    expect(create).not.toHaveBeenCalled();
  });

  it("ingen overstyring → create kalles, update ALDRI", async () => {
    const update = vi.fn();
    const create = vi.fn().mockResolvedValue({ id: "ov-ny", ordning: "lonnstillegg" });
    const findFirst = vi.fn().mockResolvedValue(null);
    const caller = expenseCategoryRouter.createCaller(
      lagCtx({ findFirst, update, create }),
    );

    await caller.settOverstyring({
      organizationId: ORG,
      prosjektId: PROSJEKT,
      expenseCategoryId: KATEGORI,
      ordning: "lonnstillegg",
    });

    expect(create).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("fakturert er ikke valgbar → avvises før handler (SETTBAR_ORDNING_ENUM)", async () => {
    const update = vi.fn();
    const create = vi.fn();
    const findFirst = vi.fn();
    const caller = expenseCategoryRouter.createCaller(
      lagCtx({ findFirst, update, create }),
    );

    await expect(
      caller.settOverstyring({
        organizationId: ORG,
        prosjektId: PROSJEKT,
        expenseCategoryId: KATEGORI,
        // @ts-expect-error — fakturert er bevisst utenfor SETTBAR_ORDNING_ENUM
        ordning: "fakturert",
      }),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
