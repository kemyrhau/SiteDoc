import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firma-admin i søket (Kenneth 2026-10-28): `hentTilgjengeligeMappeIder` ga `[]` til en firma-admin
 * uten medlemsrad (og 500 i søket), selv om de har tilgang til prosjektet via
 * `erFirmaAdminForProsjekt`. Rød på develop 5551b461: firma-admin i eget firma → `[]`.
 */

const { user, projectMember, folder, erFirmaAdminForProsjekt } = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  folder: { findMany: vi.fn() },
  erFirmaAdminForProsjekt: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: { user, projectMember, folder } }));
vi.mock("../trpc/tilgangskontroll", () => ({ erFirmaAdminForProsjekt }));

import { hentTilgjengeligeMappeIder } from "./folder-tilgang";

const PROSJEKT = "p1";
const LUKKET_MAPPE = { id: "m1", parentId: null, accessMode: "custom", accessEntries: [] };

beforeEach(() => {
  user.findUnique.mockReset().mockResolvedValue({ role: "company_admin" });
  projectMember.findUnique.mockReset().mockResolvedValue(null);
  folder.findMany.mockReset().mockResolvedValue([LUKKET_MAPPE]);
  erFirmaAdminForProsjekt.mockReset().mockResolvedValue(false);
});

describe("hentTilgjengeligeMappeIder — firma-admin", () => {
  it("firma-admin i prosjektets firma, uten medlemsrad → null (ser alle mapper)", async () => {
    erFirmaAdminForProsjekt.mockResolvedValue(true);
    expect(await hentTilgjengeligeMappeIder("fa", PROSJEKT)).toBeNull();
    expect(erFirmaAdminForProsjekt).toHaveBeenCalledWith("fa", PROSJEKT);
  });

  it("firma-admin i prosjektets firma MED vanlig medlemsrad → null (admin, som i verifiserAdmin)", async () => {
    erFirmaAdminForProsjekt.mockResolvedValue(true);
    projectMember.findUnique.mockResolvedValue({ role: "member", faggruppeKoblinger: [], groupMemberships: [] });
    expect(await hentTilgjengeligeMappeIder("fa", PROSJEKT)).toBeNull();
  });

  it("firma-admin fra et ANNET firma, uten medlemsrad → [] (ingen mapper)", async () => {
    expect(await hentTilgjengeligeMappeIder("fa-annet", PROSJEKT)).toEqual([]);
  });

  it("vanlig medlem uten tilgang til noen mapper → []", async () => {
    user.findUnique.mockResolvedValue({ role: "user" });
    projectMember.findUnique.mockResolvedValue({ role: "member", faggruppeKoblinger: [], groupMemberships: [] });
    expect(await hentTilgjengeligeMappeIder("u", PROSJEKT)).toEqual([]);
  });
});
