import { describe, it, expect, vi } from "vitest";

/**
 * kontrollplan.slettPunkt — kriteriet er KOBLINGEN (sjekklisteId), ikke statusen
 * (Kenneth 2026-09-11). Et ubrukt punkt (sjekklisteId=null) skal kunne slettes uansett
 * status; et koblet punkt skal blokkeres med PRECONDITION_FAILED + neste steg, ALDRI en
 * generisk `throw new Error`. Drives via createCaller med mocket ctx (som slettevern-testene).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));
// Kobling-servicen importeres av routeren, men slettPunkt rører den ikke.
vi.mock("../services/kontrollplanKobling", () => ({
  koblePunktTilSjekkliste: vi.fn(),
  verifiserTegningIProsjekt: vi.fn(),
}));

import { kontrollplanRouter } from "./kontrollplan";

const PUNKT = "punkt-1";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lagCtx(
  punkt: { status: string; sjekklisteId: string | null },
  del: ReturnType<typeof vi.fn>,
) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      kontrollplanPunkt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: PUNKT,
          status: punkt.status,
          sjekklisteId: punkt.sjekklisteId,
          kontrollplan: { projectId: PROSJEKT },
        }),
        delete: del,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("kontrollplan.slettPunkt — kobling, ikke status", () => {
  it("ubrukt punkt (sjekklisteId=null) slettes selv om status er utfort", async () => {
    const del = vi.fn().mockResolvedValue({ id: PUNKT });
    const caller = kontrollplanRouter.createCaller(
      lagCtx({ status: "utfort", sjekklisteId: null }, del),
    );
    await caller.slettPunkt({ punktId: PUNKT });
    expect(del).toHaveBeenCalledWith({ where: { id: PUNKT } });
  });

  it("ubrukt punkt med status planlagt slettes (uendret for det vanlige tilfellet)", async () => {
    const del = vi.fn().mockResolvedValue({ id: PUNKT });
    const caller = kontrollplanRouter.createCaller(
      lagCtx({ status: "planlagt", sjekklisteId: null }, del),
    );
    await caller.slettPunkt({ punktId: PUNKT });
    expect(del).toHaveBeenCalledOnce();
  });

  it("koblet punkt (sjekklisteId satt) blokkeres med PRECONDITION_FAILED + neste steg, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = kontrollplanRouter.createCaller(
      lagCtx({ status: "planlagt", sjekklisteId: "sjekk-1" }, del),
    );
    await expect(caller.slettPunkt({ punktId: PUNKT })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Punktet har en sjekkliste koblet til seg og kan ikke slettes. Fjern koblingen til sjekklisten først.",
    });
    expect(del).not.toHaveBeenCalled();
  });
});
