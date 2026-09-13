import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `prosjekt.settLivssyklus` — avslutt/arkiver-GATEN (ordre synliggjor-malforvaltning, krav 3).
 *
 * 🔴 Kjernen: et prosjekt kan ikke avsluttes/arkiveres fra aktiv uten at et ferdig
 * dataeksport-arkiv (`EksportJobb` status "klar") finnes — etter avslutning er dokumentene
 * utilgjengelige for deltakerne. Testen beviser at gaten HOLDER.
 *
 * Negativ kontroll: fjernes gaten i `settLivssyklus`, slutter «nektes uten arkiv»-testen
 * å kaste, og den blir RØD. En test som bare sjekker suksess-veien måler ikke gaten.
 */

const eksportFindFirst = vi.fn();
const projectUpdate = vi.fn();
const activityCreate = vi.fn();
const erFirmaAdmin = vi.fn();

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  verifiserAdmin: vi.fn(),
  hentBrukersOrg: vi.fn(),
  hentDeaktiverteOrgIder: vi.fn(),
  erFirmaAdminForProsjekt: (...a: unknown[]) => erFirmaAdmin(...a),
  kanOppretteProsjekt: vi.fn(),
}));
vi.mock("../services/firmamodul", () => ({ hentAktiveFirmamoduler: vi.fn() }));
vi.mock("../services/autoProsjektAdmin", () => ({ autoLeggFirmaAdmins: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerProsjektmedlemskap: vi.fn() }));
vi.mock("../services/prosjektSeed", () => ({ seedStandardProsjektoppsett: vi.fn() }));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { prosjektRouter } from "./prosjekt";

const PROSJEKT = "44444444-4444-4444-4444-444444444444";

/**
 * @param rolle       User.role (company_admin = ikke-sitedoc → gaten gjelder).
 * @param harArkiv    finnes et EksportJobb med status "klar"?
 * @param prosjektStatus  nåværende status (active → gaten kan slå inn).
 */
function lagCaller(opts: {
  rolle?: string;
  harArkiv?: boolean;
  prosjektStatus?: string;
}) {
  const { rolle = "company_admin", harArkiv = false, prosjektStatus = "active" } = opts;
  erFirmaAdmin.mockResolvedValue(true);
  eksportFindFirst.mockResolvedValue(harArkiv ? { id: "arkiv-1" } : null);
  projectUpdate.mockResolvedValue({ id: PROSJEKT, status: "completed" });
  activityCreate.mockResolvedValue({});
  const ctx = {
    userId: "user-1",
    ipAddress: null,
    userAgent: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: rolle, name: "Test" }) },
      project: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: prosjektStatus,
          name: "Prosjekt",
          primaryOrganizationId: "org-1",
        }),
        update: (...a: unknown[]) => projectUpdate(...a),
      },
      eksportJobb: { findFirst: (...a: unknown[]) => eksportFindFirst(...a) },
      activity: { create: (...a: unknown[]) => activityCreate(...a) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return prosjektRouter.createCaller(ctx);
}

describe("prosjekt.settLivssyklus — avslutt-gate", () => {
  beforeEach(() => {
    eksportFindFirst.mockReset();
    projectUpdate.mockReset();
    activityCreate.mockReset();
    erFirmaAdmin.mockReset();
  });

  it("NEKTER avslutt (completed) fra aktiv uten ferdig eksport-arkiv", async () => {
    const caller = lagCaller({ harArkiv: false });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "completed" })).rejects.toThrow(
      /dataeksport-arkiv/i,
    );
    // Gaten stopper FØR skriving — prosjektet endres ikke.
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("NEKTER arkiver (archived) fra aktiv uten ferdig eksport-arkiv", async () => {
    const caller = lagCaller({ harArkiv: false });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "archived" })).rejects.toThrow(
      /dataeksport-arkiv/i,
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("TILLATER avslutt når et ferdig eksport-arkiv finnes", async () => {
    const caller = lagCaller({ harArkiv: true });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  it("sitedoc-admin er nødutgang: avslutter uten arkiv", async () => {
    const caller = lagCaller({ rolle: "sitedoc_admin", harArkiv: false });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  it("gjenåpning (active) er ikke gatet — tillates uten arkiv", async () => {
    const caller = lagCaller({ harArkiv: false, prosjektStatus: "completed" });
    await caller.settLivssyklus({ id: PROSJEKT, status: "active" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });
});
