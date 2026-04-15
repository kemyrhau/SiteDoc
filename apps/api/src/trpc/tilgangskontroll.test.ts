/**
 * Tester for company_admin-fallback i verifiserProsjektmedlem() og verifiserAdmin().
 *
 * Fire eksplisitte caser:
 * 1. Bruker med ProjectMember-rad → får tilgang
 * 2. Bruker uten ProjectMember-rad, ikke company_admin → 403
 * 3. company_admin med riktig org → får tilgang
 * 4. company_admin med feil org → 403
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Hoisted mocks — tilgjengelig for vi.mock factories
const mockFns = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  pmFindUnique: vi.fn(),
  opFindFirst: vi.fn(),
}));

vi.mock("@sitedoc/shared", () => ({
  PERMISSIONS: [],
  utvidTillatelser: () => new Set(),
  utledMinRolle: () => null,
  erTillattForRolle: () => false,
}));

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: mockFns.userFindUnique },
    projectMember: { findUnique: mockFns.pmFindUnique },
    organizationProject: { findFirst: mockFns.opFindFirst },
  },
}));

import { verifiserProsjektmedlem, verifiserAdmin, verifiserOrganisasjonTilgang } from "./tilgangskontroll";

const mockPrisma = {
  user: { findUnique: mockFns.userFindUnique },
  projectMember: { findUnique: mockFns.pmFindUnique },
  organizationProject: { findFirst: mockFns.opFindFirst },
};

const USER_ID = "user-1";
const PROJECT_ID = "project-1";
const ORG_ID = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// --------------------------------------------------------------------------
// verifiserProsjektmedlem
// --------------------------------------------------------------------------

describe("verifiserProsjektmedlem", () => {
  it("1. Bruker med ProjectMember-rad → får tilgang", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      id: "pm-1",
      userId: USER_ID,
      projectId: PROJECT_ID,
      role: "member",
    });

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();
  });

  it("2. Bruker uten ProjectMember-rad, ikke company_admin → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user" });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).rejects.toThrow(TRPCError);

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("3. company_admin med riktig org → får tilgang (uten ProjectMember-rad)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "company_admin",
      organizationId: ORG_ID,
    });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    mockPrisma.organizationProject.findFirst.mockResolvedValue({
      id: "op-1",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();
  });

  it("4. company_admin med feil org → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "company_admin",
      organizationId: "org-annen",
    });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    mockPrisma.organizationProject.findFirst.mockResolvedValue(null);

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("company_admin uten organizationId → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "company_admin",
      organizationId: null,
    });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sitedoc_admin → alltid tilgang", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "sitedoc_admin" });

    await expect(
      verifiserProsjektmedlem(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();

    // projectMember skal ikke sjekkes
    expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// verifiserAdmin
// --------------------------------------------------------------------------

describe("verifiserAdmin", () => {
  it("1. Bruker med ProjectMember.role=admin → får tilgang", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      id: "pm-1",
      role: "admin",
    });

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();
  });

  it("2. Bruker uten ProjectMember-rad, ikke company_admin → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user" });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Bruker med ProjectMember.role=member → 403 (ikke admin)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      id: "pm-1",
      role: "member",
    });

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("3. company_admin med riktig org → får tilgang som admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "company_admin",
      organizationId: ORG_ID,
    });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    mockPrisma.organizationProject.findFirst.mockResolvedValue({
      id: "op-1",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();
  });

  it("4. company_admin med feil org → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "company_admin",
      organizationId: "org-annen",
    });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    mockPrisma.organizationProject.findFirst.mockResolvedValue(null);

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sitedoc_admin → alltid tilgang", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "sitedoc_admin" });

    await expect(
      verifiserAdmin(USER_ID, PROJECT_ID),
    ).resolves.toBeUndefined();

    expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// verifiserOrganisasjonTilgang
// --------------------------------------------------------------------------

describe("verifiserOrganisasjonTilgang", () => {
  it("1. Bruker med riktig org → tilgang", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: ORG_ID,
    });

    await expect(
      verifiserOrganisasjonTilgang(USER_ID, ORG_ID),
    ).resolves.toBeUndefined();
  });

  it("2. Bruker med feil org → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: "org-annen",
    });

    await expect(
      verifiserOrganisasjonTilgang(USER_ID, ORG_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("3. Bruker uten organizationId → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: null,
    });

    await expect(
      verifiserOrganisasjonTilgang(USER_ID, ORG_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("4. Bruker finnes ikke → 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      verifiserOrganisasjonTilgang(USER_ID, ORG_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
