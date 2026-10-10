import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `resolverOrgFraInput` — tilgangsregelen timer-isolasjonen hviler på (Kenneth-vedtak
 * 2026-10-09: «timer følger firmaet man er logget inn i, med streng firma-isolasjon»).
 *
 * Klienten sender det valgte firmaet; serveren avgjør om brukeren har lov:
 *   - sitedoc_admin          → hvilket som helst firma (cross-tenant)
 *   - aktivt medlem av orgen  → det firmaet (dekker company_admin av eget firma)
 *   - ellers                  → FORBIDDEN (ingen fallback til medlemskapet)
 *   - uten input              → brukerens egen org (eldre klient / mobil-bakoverkompat)
 *
 * Dette er vedtakets to testlinjer: superadmin med medlemskap i A og valgt firma B får B;
 * vanlig bruker med medlemskap i A får FORBIDDEN mot B.
 */

const userFindUnique = vi.fn();
const orgMemberFindMany = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    organizationMember: { findMany: (...a: unknown[]) => orgMemberFindMany(...a) },
  },
  Prisma: {},
}));

import { resolverOrgFraInput } from "./tilgangskontroll";

const FIRMA_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FIRMA_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("resolverOrgFraInput — én firmakilde, streng isolasjon", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    orgMemberFindMany.mockReset();
  });

  it("superadmin (medlem i A) fører timer i valgt firma B", async () => {
    userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
    const org = await resolverOrgFraInput("kenneth", FIRMA_B);
    expect(org).toBe(FIRMA_B);
    // sitedoc_admin trenger ikke medlemskap — medlemskaps-oppslag skal ikke skje.
    expect(orgMemberFindMany).not.toHaveBeenCalled();
  });

  it("vanlig bruker (medlem i A) får valgt firma A", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    orgMemberFindMany.mockResolvedValue([{ organizationId: FIRMA_A }]);
    const org = await resolverOrgFraInput("arbeider", FIRMA_A);
    expect(org).toBe(FIRMA_A);
  });

  it("vanlig bruker (medlem i A) får FORBIDDEN mot firma B", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    orgMemberFindMany.mockResolvedValue([{ organizationId: FIRMA_A }]);
    await expect(resolverOrgFraInput("arbeider", FIRMA_B)).rejects.toThrow(/Ikke ditt firma/);
  });

  it("uten oppgitt firma faller tilbake til brukerens egen org", async () => {
    orgMemberFindMany.mockResolvedValue([{ organizationId: FIRMA_A }]);
    const org = await resolverOrgFraInput("arbeider", undefined);
    expect(org).toBe(FIRMA_A);
    // Ingen input → ingen rolle-sjekk, kun egen-org-oppslag.
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});
