import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `dagsseddel.slett` — Kenneth-vedtak 2026-10-09 (2): en RETURNERT, ennå IKKE attestert
 * dagsseddel kan slettes av eieren, som et utkast. Sendte/attesterte/eksporterte kan ikke.
 *
 * Negativkontroll (rød uten fiksen): fjernes `returned && attestertVed === null`-grenen,
 * blir «sletter returnert» rød (gammel regel tillot kun draft). Drives via
 * dagsseddelRouter.createCaller med mocket ctx — samme mønster som forson-dagskort.test.ts.
 */

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn(),
  resolverOrgFraInput: vi.fn(),
  resolverOrgForEgenTimeføring: vi.fn(),
  verifiserAnsattIFirma: vi.fn(),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn(),
  hentEffektivArbeidstid: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { dagsseddelRouter } from "./dagsseddel";

const USER = "user-1";
const SHEET = "22222222-2222-2222-2222-222222222222";

const slett = vi.fn();
const findUnique = vi.fn();

function lagCaller(sheet: { status: string; attestertVed: Date | null }) {
  findUnique.mockImplementation(({ where }: { where: { id?: string; clientUuid?: string } }) => {
    // hentEgenDagsseddel slår opp på id FØRST; returner sedelen der.
    if (where.id === SHEET) {
      return Promise.resolve({ id: SHEET, clientUuid: SHEET, userId: USER, organizationId: "org", ...sheet });
    }
    return Promise.resolve(null);
  });
  slett.mockResolvedValue({ id: SHEET });
  const ctx = {
    userId: USER,
    prismaTimer: {
      dailySheet: {
        findUnique: (...a: unknown[]) => findUnique(...(a as [{ where: { id?: string; clientUuid?: string } }])),
        delete: (...a: unknown[]) => slett(...a),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dagsseddelRouter.createCaller(ctx);
}

describe("dagsseddel.slett — utkast + returnert-ikke-attestert", () => {
  beforeEach(() => {
    slett.mockReset();
    findUnique.mockReset();
  });

  it("sletter utkast (draft) — bevart oppførsel", async () => {
    await lagCaller({ status: "draft", attestertVed: null }).slett({ id: SHEET });
    expect(slett).toHaveBeenCalledOnce();
  });

  it("sletter returnert dagsseddel som ikke er attestert", async () => {
    await lagCaller({ status: "returned", attestertVed: null }).slett({ id: SHEET });
    expect(slett).toHaveBeenCalledOnce();
  });

  it("NEKTER sletting av returnert som ER attestert", async () => {
    await expect(
      lagCaller({ status: "returned", attestertVed: new Date("2026-09-01") }).slett({ id: SHEET }),
    ).rejects.toThrow(/Bare utkast eller returnerte/);
    expect(slett).not.toHaveBeenCalled();
  });

  it("NEKTER sletting av sendt dagsseddel", async () => {
    await expect(
      lagCaller({ status: "sent", attestertVed: null }).slett({ id: SHEET }),
    ).rejects.toThrow(/Bare utkast eller returnerte/);
    expect(slett).not.toHaveBeenCalled();
  });
});
