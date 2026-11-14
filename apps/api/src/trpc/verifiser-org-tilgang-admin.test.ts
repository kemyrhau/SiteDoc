import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * POST 2026-11-14 (7) punkt 4 — `verifiserOrganisasjonTilgang` behandler
 * `sitedoc_admin` som `autoriserAdminForFirma`: har admin valgt et firma, opptrer
 * den som firmaadmin der (Kenneth 2026-11-14). Vanlig bruker utenfor firmaet får
 * fortsatt FORBIDDEN.
 */

const userFindUnique = vi.fn();
const memberFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
  },
  Prisma: {},
}));

import { verifiserOrganisasjonTilgang } from "./tilgangskontroll";

const FIRMA_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

async function feilkode(p: Promise<unknown>): Promise<string | null> {
  return p.then(
    () => null,
    (e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
  );
}

describe("verifiserOrganisasjonTilgang — sitedoc_admin som firmaadmin (punkt 4)", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    memberFindUnique.mockReset();
  });

  it("sitedoc_admin uten medlemskap i firmaet slipper gjennom", async () => {
    userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
    memberFindUnique.mockResolvedValue(null);
    expect(await feilkode(verifiserOrganisasjonTilgang("admin", FIRMA_B))).toBeNull();
  });

  it("vanlig bruker utenfor firmaet: FORBIDDEN", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue(null);
    expect(await feilkode(verifiserOrganisasjonTilgang("u", FIRMA_B))).toBe("FORBIDDEN");
  });

  it("company_admin i et annet firma: FORBIDDEN", async () => {
    userFindUnique.mockResolvedValue({ role: "company_admin" });
    memberFindUnique.mockResolvedValue(null);
    expect(await feilkode(verifiserOrganisasjonTilgang("ca", FIRMA_B))).toBe("FORBIDDEN");
  });

  it("medlem av firmaet slipper gjennom (uendret)", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue({ id: "m1" });
    expect(await feilkode(verifiserOrganisasjonTilgang("u", FIRMA_B))).toBeNull();
  });

  it("ukjent bruker uten medlemskap: FORBIDDEN", async () => {
    userFindUnique.mockResolvedValue(null);
    memberFindUnique.mockResolvedValue(null);
    expect(await feilkode(verifiserOrganisasjonTilgang("x", FIRMA_B))).toBe("FORBIDDEN");
  });
});
