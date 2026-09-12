import { describe, it, expect, vi } from "vitest";

/**
 * kontrollplan.slettPunkt — kriteriet er en LEVENDE kobling, ikke `sjekklisteId`
 * (Kenneth-vedtak 2026-09-12). Sjekkliste-sletting er MYK (`sjekkliste.slett` setter bare
 * `deletedAt`), så FK-ens `ON DELETE SET NULL` fyrer aldri ved den vanlige veien — raden
 * består og `sjekklisteId` blir stående. En vakt på `sjekklisteId !== null` låste derfor et
 * punkt PERMANENT så snart sjekklisten lå i papirkurven. Ny regel: et punkt kan slettes så
 * lenge det ikke har en LEVENDE (ikke-slettet) koblet sjekkliste.
 *
 * Regresjonsvakt (TILLEGG-krav): testen «papirkurv-sjekkliste → kan slettes» FEILER hvis
 * vakten igjen låser på `sjekklisteId`/en slettet kobling. Drives via createCaller med
 * mocket ctx (som slettevern-testene).
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
  sjekkliste: { deletedAt: Date | null } | null,
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
          kontrollplan: { projectId: PROSJEKT },
          sjekkliste,
        }),
        delete: del,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("kontrollplan.slettPunkt — levende kobling, ikke sjekklisteId", () => {
  it("ubrukt punkt (ingen koblet sjekkliste) slettes", async () => {
    const del = vi.fn().mockResolvedValue({ id: PUNKT });
    const caller = kontrollplanRouter.createCaller(lagCtx(null, del));
    await caller.slettPunkt({ punktId: PUNKT });
    expect(del).toHaveBeenCalledWith({ where: { id: PUNKT } });
  });

  it("REGRESJONSVAKT: punkt med sjekkliste i papirkurven (deletedAt satt) slettes — aldri permanent låst", async () => {
    const del = vi.fn().mockResolvedValue({ id: PUNKT });
    const caller = kontrollplanRouter.createCaller(
      lagCtx({ deletedAt: new Date("2026-09-01T00:00:00Z") }, del),
    );
    await caller.slettPunkt({ punktId: PUNKT });
    expect(del).toHaveBeenCalledWith({ where: { id: PUNKT } });
  });

  it("punkt med LEVENDE sjekkliste (deletedAt null) blokkeres med PRECONDITION_FAILED + neste steg, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = kontrollplanRouter.createCaller(lagCtx({ deletedAt: null }, del));
    await expect(caller.slettPunkt({ punktId: PUNKT })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Punktet har en aktiv sjekkliste koblet til seg og kan ikke slettes. Slett sjekklisten først.",
    });
    expect(del).not.toHaveBeenCalled();
  });
});
