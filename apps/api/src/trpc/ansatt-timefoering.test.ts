import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `verifiserAnsattIFirma` + `resolverOrgForEgenTimeføring` — Kenneth-vedtak 2026-10-09 (2):
 * «timer kan bare føres av ansatte». For EGEN timeføring kreves et aktivt
 * `OrganizationMember` i det valgte firmaet — admin-roller (sitedoc_admin/company_admin)
 * erstatter IKKE medlemskap (til forskjell fra `resolverOrgFraInput`, som har admin-bypass
 * for LESING).
 *
 * Vedtakets testlinje: ikke-ansatt (f.eks. superadmin i et firma han ikke er ansatt i) →
 * FORBIDDEN; ansatt → får føre timer.
 */

const orgMemberFindUnique = vi.fn();
const orgMemberFindMany = vi.fn();
const orgFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationMember: {
      findUnique: (...a: unknown[]) => orgMemberFindUnique(...a),
      findMany: (...a: unknown[]) => orgMemberFindMany(...a),
    },
    organization: { findUnique: (...a: unknown[]) => orgFindUnique(...a) },
  },
  Prisma: {},
}));

import { verifiserAnsattIFirma, resolverOrgForEgenTimeføring } from "./tilgangskontroll";

const FIRMA_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FIRMA_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("egen timeføring krever aktivt ansettelsesforhold", () => {
  beforeEach(() => {
    orgMemberFindUnique.mockReset();
    orgMemberFindMany.mockReset();
    orgFindUnique.mockReset();
    orgFindUnique.mockResolvedValue({ name: "SITEDOC MYRHAUG" });
  });

  it("verifiserAnsattIFirma: aktivt medlem slipper gjennom", async () => {
    orgMemberFindUnique.mockResolvedValue({ status: "aktiv" });
    await expect(verifiserAnsattIFirma("arbeider", FIRMA_A)).resolves.toBeUndefined();
  });

  it("verifiserAnsattIFirma: ingen medlemsrad → lesbar FORBIDDEN med firmanavn", async () => {
    orgMemberFindUnique.mockResolvedValue(null);
    await expect(verifiserAnsattIFirma("superadmin", FIRMA_A)).rejects.toThrow(
      /ikke registrert som ansatt i SITEDOC MYRHAUG/,
    );
  });

  it("verifiserAnsattIFirma: deaktivert ansettelse → FORBIDDEN", async () => {
    orgMemberFindUnique.mockResolvedValue({ status: "deaktivert" });
    await expect(verifiserAnsattIFirma("sluttet", FIRMA_A)).rejects.toThrow(
      /ikke registrert som ansatt/,
    );
  });

  it("resolverOrgForEgenTimeføring: ansatt i valgt firma → returnerer firmaet", async () => {
    orgMemberFindUnique.mockResolvedValue({ status: "aktiv" });
    await expect(resolverOrgForEgenTimeføring("arbeider", FIRMA_A)).resolves.toBe(FIRMA_A);
  });

  it("resolverOrgForEgenTimeføring: IKKE ansatt i valgt firma → FORBIDDEN (ingen admin-bypass)", async () => {
    // Superadmin som velger et firma han ikke er ansatt i: ingen medlemsrad.
    orgMemberFindUnique.mockResolvedValue(null);
    await expect(resolverOrgForEgenTimeføring("superadmin", FIRMA_B)).rejects.toThrow(
      /ikke registrert som ansatt/,
    );
  });

  it("resolverOrgForEgenTimeføring: uten oppgitt firma → egen org, og krever ansatt der", async () => {
    orgMemberFindMany.mockResolvedValue([{ organizationId: FIRMA_A }]); // krevBrukersOrg
    orgMemberFindUnique.mockResolvedValue({ status: "aktiv" }); // verifiserAnsattIFirma
    await expect(resolverOrgForEgenTimeføring("arbeider", undefined)).resolves.toBe(FIRMA_A);
  });
});
