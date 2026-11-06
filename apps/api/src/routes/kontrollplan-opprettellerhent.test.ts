import { describe, it, expect, vi } from "vitest";

/**
 * kontrollplan.opprettEllerHent — byggeplass-vakt (ORDRE 22). Før sjekket ruten kun medlemskap
 * i `input.projectId`; en byggeplass fra et annet prosjekt kunne kobles til planen, og navnet
 * derfra lekket inn i `navn`.
 */

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const BYGGEPLASS = "44444444-4444-4444-4444-444444444444";

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/kontrollplanKobling", () => ({ koblePunktTilSjekkliste: vi.fn() }));

import { kontrollplanRouter } from "./kontrollplan";

function lagCtx(byggeplassProsjekt: string) {
  const findUnique = vi.fn().mockResolvedValue({ projectId: byggeplassProsjekt });
  const findUniqueOrThrow = vi.fn().mockResolvedValue({ name: "Blokk B" });
  const upsert = vi.fn().mockResolvedValue({ id: "plan-1" });
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      byggeplass: { findUnique, findUniqueOrThrow },
      kontrollplan: { upsert },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, findUniqueOrThrow, upsert };
}

describe("kontrollplan.opprettEllerHent — byggeplass-vakt (ORDRE 22)", () => {
  it("byggeplass i eget prosjekt → upsert kalles", async () => {
    const { ctx, upsert } = lagCtx(PROSJEKT);
    await expect(
      kontrollplanRouter.createCaller(ctx).opprettEllerHent({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS }),
    ).resolves.toEqual({ id: "plan-1" });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("byggeplass i fremmed prosjekt → BAD_REQUEST, ingen navn-lesing, ingen upsert", async () => {
    const { ctx, findUniqueOrThrow, upsert } = lagCtx(FREMMED);
    await expect(
      kontrollplanRouter.createCaller(ctx).opprettEllerHent({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Byggeplassen hører til et annet prosjekt." });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
