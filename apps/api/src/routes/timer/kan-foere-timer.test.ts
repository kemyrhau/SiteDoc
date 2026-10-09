import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `dagsseddel.kanFoereTimer` — Kontrollør-funn 2026-10-09: firmanavnet må ALDRI lekke til
 * en kaller uten forhold til firmaet (ellers kan en fremmed enumerere firmanavn via
 * gjettede org-UUID-er). Relasjonen gates av `resolverOrgFraInput` (sitedoc_admin ∪ eget
 * medlemskap, ellers FORBIDDEN).
 *
 * Mocker tilgangskontroll-helperne direkte så vi tester prosedyrens KONTRAKT (relasjonen
 * sjekkes før navnet hentes), ikke resolverens interne regel (den har egen test).
 */

const resolverOrgFraInput = vi.fn();
const erAnsattIFirma = vi.fn();
const hentBrukersOrg = vi.fn();

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: (...a: unknown[]) => hentBrukersOrg(...a),
  krevBrukersOrg: vi.fn(),
  resolverOrgFraInput: (...a: unknown[]) => resolverOrgFraInput(...a),
  resolverOrgForEgenTimeføring: vi.fn(),
  verifiserAnsattIFirma: vi.fn(),
  erAnsattIFirma: (...a: unknown[]) => erAnsattIFirma(...a),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn(),
  hentEffektivArbeidstid: vi.fn(),
}));

const orgFindUnique = vi.fn();
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { dagsseddelRouter } from "./dagsseddel";

const USER = "user-1";
const EGET_FIRMA = "11111111-1111-1111-1111-111111111111";
const FREMMED = "99999999-9999-9999-9999-999999999999";

function lagCaller() {
  const ctx = {
    userId: USER,
    prisma: { organization: { findUnique: (...a: unknown[]) => orgFindUnique(...a) } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dagsseddelRouter.createCaller(ctx);
}

describe("dagsseddel.kanFoereTimer — ingen firmanavn-lekkasje", () => {
  beforeEach(() => {
    resolverOrgFraInput.mockReset();
    erAnsattIFirma.mockReset();
    hentBrukersOrg.mockReset();
    orgFindUnique.mockReset();
  });

  it("fremmed organizationId → FORBIDDEN fra resolveren, firmanavn aldri hentet", async () => {
    resolverOrgFraInput.mockRejectedValue(new Error("Ikke ditt firma"));
    await expect(
      lagCaller().kanFoereTimer({ organizationId: FREMMED }),
    ).rejects.toThrow(/Ikke ditt firma/);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it("eget firma, ikke ansatt → kanFoere=false MED firmanavn (kalleren er verifisert)", async () => {
    resolverOrgFraInput.mockResolvedValue(EGET_FIRMA);
    erAnsattIFirma.mockResolvedValue(false);
    orgFindUnique.mockResolvedValue({ name: "SITEDOC MYRHAUG" });
    const svar = await lagCaller().kanFoereTimer({ organizationId: EGET_FIRMA });
    expect(svar).toEqual({ kanFoere: false, firmanavn: "SITEDOC MYRHAUG" });
  });

  it("eget firma, ansatt → kanFoere=true uten navn (ingen melding trengs)", async () => {
    resolverOrgFraInput.mockResolvedValue(EGET_FIRMA);
    erAnsattIFirma.mockResolvedValue(true);
    const svar = await lagCaller().kanFoereTimer({ organizationId: EGET_FIRMA });
    expect(svar).toEqual({ kanFoere: true, firmanavn: null });
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it("org-løs bruker uten oppgitt firma → nøytralt svar, resolveren aldri kalt", async () => {
    hentBrukersOrg.mockResolvedValue(null);
    const svar = await lagCaller().kanFoereTimer(undefined);
    expect(svar).toEqual({ kanFoere: false, firmanavn: null });
    expect(resolverOrgFraInput).not.toHaveBeenCalled();
  });
});
