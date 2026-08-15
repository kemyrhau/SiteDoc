import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit-test for det delte bypass-predikatet `erFirmaAdminForProsjekt`
 * (fabel-presedens 2026-08-15: ett felles bypass-sett for alle porter).
 *
 * Kjører UTEN DB (prisma mocket), i motsetning til *.integration.test.ts. Beviser at
 * ekstraksjonen er atferdsbevarende der typecheck ikke kan: en invertert boolsk ville
 * bestått typecheck men åpnet fem porter samtidig. To assertions:
 *   - firma-admin i en org KOBLET til prosjektet   → true  (bypass slår inn)
 *   - firma-admin kun i en ANNEN org (ikke koblet) → false (gjennomfall, ingen bypass)
 *
 * Kjør: cd apps/api && npx vitest run src/trpc/tilgangskontroll.test.ts
 */

const findMany = vi.fn();
const findUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    projectOrganization: { findMany: (...a: unknown[]) => findMany(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => findUnique(...a) },
  },
}));

// Importeres ETTER mock (vi.mock heises, men vær eksplisitt).
import { erFirmaAdminForProsjekt } from "./tilgangskontroll";

const USER = "user-1";
const PROJECT = "prosjekt-1";
const KOBLET_ORG = "org-koblet";
const ANNEN_ORG = "org-annen";

describe("erFirmaAdminForProsjekt — delt bypass-predikat", () => {
  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset();
  });

  it("firma-admin i en org KOBLET til prosjektet → true (bypass slår inn)", async () => {
    // Prosjektet er koblet til KOBLET_ORG.
    findMany.mockResolvedValue([{ organizationId: KOBLET_ORG }]);
    // Bruker er firma_admin i den koblede orgen.
    findUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
      Promise.resolve(
        where.userId_organizationId.organizationId === KOBLET_ORG
          ? { firmaRoller: ["firma_admin"] }
          : null,
      ),
    );

    expect(await erFirmaAdminForProsjekt(USER, PROJECT)).toBe(true);
    expect(findMany).toHaveBeenCalledWith({ where: { projectId: PROJECT }, select: { organizationId: true } });
  });

  it("firma-admin kun i en ANNEN org (ikke koblet til prosjektet) → false (gjennomfall)", async () => {
    // Prosjektet er koblet til KOBLET_ORG — der bruker IKKE er firma-admin.
    findMany.mockResolvedValue([{ organizationId: KOBLET_ORG }]);
    // Bruker er firma_admin, men bare i en ANNEN org som prosjektet ikke er koblet til.
    findUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
      Promise.resolve(
        where.userId_organizationId.organizationId === ANNEN_ORG
          ? { firmaRoller: ["firma_admin"] }
          : { firmaRoller: ["hms_ansvarlig"] },
      ),
    );

    expect(await erFirmaAdminForProsjekt(USER, PROJECT)).toBe(false);
  });
});
