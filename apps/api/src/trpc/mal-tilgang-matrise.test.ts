import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `autoriserMalTilgang` — ÉN kobling nivå → rettighet (ordre malbygger-tre-nivaa Krav 3 +
 * TILLEGG 1). Funksjonen svarer på TO spørsmål: hvilket nivå, og LES vs REDIGER. Testen
 * beviser matrisen der typecheck ikke kan — en invertert les/rediger-gren ville bestått
 * kompilering men åpnet redigering for en leser:
 *
 *   Rolle          | Firmaarkiv | Sentralarkiv
 *   ---------------|------------|-------------
 *   sitedoc_admin  | rediger    | rediger
 *   firmaadmin     | rediger    | les
 *   prosjektadmin  | les        | ingen
 *
 * Kjører UTEN DB (prisma mocket).
 */

const userFindUnique = vi.fn();
const projectFindUnique = vi.fn();
const projectMemberFindUnique = vi.fn();
const orgMemberFindUnique = vi.fn();
const orgMemberFindMany = vi.fn();
const projectOrgFindMany = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    project: { findUnique: (...a: unknown[]) => projectFindUnique(...a) },
    projectMember: { findUnique: (...a: unknown[]) => projectMemberFindUnique(...a) },
    organizationMember: {
      findUnique: (...a: unknown[]) => orgMemberFindUnique(...a),
      findMany: (...a: unknown[]) => orgMemberFindMany(...a),
    },
    projectOrganization: { findMany: (...a: unknown[]) => projectOrgFindMany(...a) },
  },
}));

import { autoriserMalTilgang } from "./tilgangskontroll";

const USER = "user-1";
const PROJECT = "prosjekt-1";
const ORG = "org-1";

beforeEach(() => {
  for (const m of [
    userFindUnique,
    projectFindUnique,
    projectMemberFindUnique,
    orgMemberFindUnique,
    orgMemberFindMany,
    projectOrgFindMany,
  ]) {
    m.mockReset();
  }
  // Standardtilstand: vanlig bruker, standalone aktivt prosjekt (fryse-/ansettelsesvakt no-op).
  userFindUnique.mockResolvedValue({ role: "user" });
  projectFindUnique.mockResolvedValue({ primaryOrganizationId: null, status: "active" });
  projectOrgFindMany.mockResolvedValue([]);
  orgMemberFindUnique.mockResolvedValue(null);
  orgMemberFindMany.mockResolvedValue([]);
});

describe("autoriserMalTilgang — matrise (nivå × handling)", () => {
  it("prosjektadmin LESER firmaarkivet (firma+les via prosjekt) → OK", async () => {
    projectMemberFindUnique.mockResolvedValue({ role: "admin" });
    await expect(
      autoriserMalTilgang(USER, { nivaa: "firma", handling: "les", viaProjectId: PROJECT }),
    ).resolves.toBeUndefined();
  });

  it("prosjektadmin kan IKKE REDIGERE firmaarkivet (firma+rediger) → FORBIDDEN", async () => {
    // Prosjektadmin, men ikke firma_admin i orgen → autoriserAdminForFirma nekter.
    projectMemberFindUnique.mockResolvedValue({ role: "admin" });
    orgMemberFindUnique.mockResolvedValue({ firmaRoller: [], status: "aktiv" });
    await expect(
      autoriserMalTilgang(USER, { nivaa: "firma", handling: "rediger", organizationId: ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("firmaadmin REDIGERER firmaarkivet (firma+rediger) → OK", async () => {
    orgMemberFindUnique.mockResolvedValue({ firmaRoller: ["firma_admin"], status: "aktiv" });
    await expect(
      autoriserMalTilgang(USER, { nivaa: "firma", handling: "rediger", organizationId: ORG }),
    ).resolves.toBeUndefined();
  });

  it("firmaadmin LESER sentralarkivet (sitedoc+les) → OK", async () => {
    orgMemberFindMany.mockResolvedValue([{ firmaRoller: ["firma_admin"] }]);
    await expect(
      autoriserMalTilgang(USER, { nivaa: "sitedoc", handling: "les" }),
    ).resolves.toBeUndefined();
  });

  it("prosjektadmin uten firma-rolle kan IKKE lese sentralarkivet (sitedoc+les) → FORBIDDEN", async () => {
    orgMemberFindMany.mockResolvedValue([]); // ingen firma_admin-rolle noe sted
    await expect(
      autoriserMalTilgang(USER, { nivaa: "sitedoc", handling: "les" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("firmaadmin kan IKKE REDIGERE sentralarkivet (sitedoc+rediger) → FORBIDDEN", async () => {
    orgMemberFindMany.mockResolvedValue([{ firmaRoller: ["firma_admin"] }]);
    await expect(
      autoriserMalTilgang(USER, { nivaa: "sitedoc", handling: "rediger" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sitedoc_admin REDIGERER sentralarkivet (sitedoc+rediger) → OK", async () => {
    userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
    await expect(
      autoriserMalTilgang(USER, { nivaa: "sitedoc", handling: "rediger" }),
    ).resolves.toBeUndefined();
  });
});
