import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * kontrollplan.hentForTegning — medlemskap via tegningens EGEN `projectId` (ORDRE 21). Før gikk
 * oppslaget via `drawing.byggeplass.projectId`, så en løs tegning (uten byggeplass) ga NOT_FOUND
 * og ingen kontrollpunkt-markører. Ikke-medlem/fremmed prosjekt feiler fortsatt lukket.
 */

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const TEGNING = "33333333-3333-3333-3333-333333333333";

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(async (_u: string, pid: string) => {
    if (pid !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") throw new TRPCError({ code: "FORBIDDEN" });
  }),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/kontrollplanKobling", () => ({ koblePunktTilSjekkliste: vi.fn() }));

import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { kontrollplanRouter } from "./kontrollplan";

function lagCtx(tegningProsjekt: string) {
  const findMany = vi.fn().mockResolvedValue([{ id: "punkt-1" }]);
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      drawing: { findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: tegningProsjekt }) },
      kontrollplanPunkt: { findMany },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, findMany };
}

describe("kontrollplan.hentForTegning — drawing.projectId", () => {
  it("løs tegning i eget prosjekt → punktene returneres", async () => {
    const { ctx, findMany } = lagCtx(PROSJEKT);
    await expect(kontrollplanRouter.createCaller(ctx).hentForTegning({ drawingId: TEGNING })).resolves.toEqual([
      { id: "punkt-1" },
    ]);
    expect(verifiserProsjektmedlem).toHaveBeenLastCalledWith("user-1", PROSJEKT);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("tegning i fremmed prosjekt (ikke medlem) → FORBIDDEN, ingen punkter lest", async () => {
    const { ctx, findMany } = lagCtx(FREMMED);
    await expect(
      kontrollplanRouter.createCaller(ctx).hentForTegning({ drawingId: TEGNING }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(findMany).not.toHaveBeenCalled();
  });
});
