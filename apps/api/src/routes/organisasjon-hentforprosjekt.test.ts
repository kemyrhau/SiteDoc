import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Firmagrense funn 3 (ordre 2026-11-03 (2), Kenneth: «Ja, alle»).
 *
 * `organisasjon.hentForProsjekt` returnerte hele `Organization`-raden for et vilkårlig prosjekt
 * uten tilgangssjekk, og valgte en tilfeldig `ProjectOrganization`-rad (kan være et deltakerfirma).
 * Nå kreves prosjektmedlemskap (`verifiserProsjektmedlem`, som også slipper inn sitedoc_admin
 * og firma-admin i eierfirmaet), og svaret er eierfirmaet (`Project.primaryOrganization`).
 *
 * Rød før fiksen: ikke-medlem fikk firmaet, og deltakerfirmaet kunne returneres i stedet for eieren.
 */

const { verifiserProsjektmedlem } = vi.hoisted(() => ({ verifiserProsjektmedlem: vi.fn() }));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", async () => ({
  ...(await vi.importActual<typeof import("../trpc/tilgangskontroll")>("../trpc/tilgangskontroll")),
  verifiserProsjektmedlem,
}));

import { organisasjonRouter } from "./organisasjon";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const EIER = { id: "aaaaaaaa-0000-4000-8000-00000000000a", name: "Eier AS" };
const DELTAKER = { id: "cccccccc-0000-4000-8000-00000000000c", name: "Deltaker AS" };

function lagCaller() {
  const prisma = {
    project: {
      findUnique: vi.fn(async () => ({ primaryOrganization: EIER })),
    },
    // Deltakerkoblingen ligger først — den gamle findFirst traff den.
    projectOrganization: {
      findFirst: vi.fn(async () => ({ organization: DELTAKER })),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return organisasjonRouter.createCaller({ userId: "bruker-1", prisma } as any);
}

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
});

describe("organisasjon.hentForProsjekt — medlemskap + eierfirma", () => {
  it("🔴 ikke-medlem → FORBIDDEN", async () => {
    verifiserProsjektmedlem.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(lagCaller().hentForProsjekt({ projectId: PROSJEKT })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("🔴 medlem → eierfirmaet, ikke et deltakerfirma", async () => {
    const res = await lagCaller().hentForProsjekt({ projectId: PROSJEKT });
    expect(res).toMatchObject({ id: EIER.id });
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith("bruker-1", PROSJEKT);
  });
});
