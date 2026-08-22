import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Admin-gate på dokumentflyt-sletting (Kenneth-vedtak 2026-08-22): prosjektadmin eller høyere
 * (firmaadmin, sitedocadmin). Sletting rører ALLE dokumenter i flyten → ikke en menig-medlem-
 * operasjon.
 *
 * Testen kjører den EKTE `verifiserAdmin` (mocker `@sitedoc/db`-prisma-singletonen den bruker,
 * samme mønster som tilgangskontroll.test.ts) — ikke en spion. Poenget er case 3: firmaadmin har
 * INGEN ProjectMember-rad, så en håndrullet `medlem.role`-sjekk ville avvist ham. At han slipper
 * gjennom `slett` beviser at riktig hjelper (`verifiserAdmin`, med firmaadmin-fallback) brukes.
 */

const userFindUnique = vi.fn();
const memberFindUnique = vi.fn();
const orgFindMany = vi.fn();
const orgMemberFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    projectMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    projectOrganization: { findMany: (...a: unknown[]) => orgFindMany(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => orgMemberFindUnique(...a) },
  },
}));

import { dokumentflytRouter } from "./dokumentflyt";

const FLYT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lagCaller(del: ReturnType<typeof vi.fn>) {
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: { dokumentflyt: { delete: del } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dokumentflytRouter.createCaller(ctx);
}

beforeEach(() => {
  userFindUnique.mockReset();
  memberFindUnique.mockReset();
  orgFindMany.mockReset();
  orgMemberFindUnique.mockReset();
});

describe("dokumentflyt.slett — admin-gate (verifiserAdmin)", () => {
  it("prosjektmedlem UTEN adminrolle → FORBIDDEN, ikke slettet", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue({ role: "member" });
    orgFindMany.mockResolvedValue([]); // ingen org → ingen firmaadmin-fallback
    const del = vi.fn();

    await expect(lagCaller(del).slett({ id: FLYT, projectId: PROSJEKT })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("prosjektadmin (ProjectMember.role='admin') → slipper, slettet", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue({ role: "admin" });
    const del = vi.fn().mockResolvedValue({ id: FLYT });

    await lagCaller(del).slett({ id: FLYT, projectId: PROSJEKT });
    expect(del).toHaveBeenCalledWith({ where: { id: FLYT } });
  });

  it("firmaadmin UTEN ProjectMember-rad → slipper (beviser riktig hjelper: firmaadmin-fallback)", async () => {
    userFindUnique.mockResolvedValue({ role: "company_admin" }); // ikke sitedoc_admin
    memberFindUnique.mockResolvedValue(null); // INGEN medlemsrad — en medlem.role-sjekk ville avvist
    orgFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
    orgMemberFindUnique.mockResolvedValue({ firmaRoller: ["firma_admin"] });
    const del = vi.fn().mockResolvedValue({ id: FLYT });

    await lagCaller(del).slett({ id: FLYT, projectId: PROSJEKT });
    expect(del).toHaveBeenCalledWith({ where: { id: FLYT } });
  });
});
