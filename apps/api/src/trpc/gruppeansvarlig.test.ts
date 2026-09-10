import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit-test for `erGruppeansvarlig` — per-gruppe-retten (Kenneth-vedtak 2026-09-10).
 * Kjører UTEN DB (prisma mocket).
 *
 * Kontrakten denne låser:
 *   - medlem er ProjectGroupMember.isAdmin i gruppa → true
 *   - medlem finnes, men ikke isAdmin i gruppa       → false
 *   - ikke prosjektmedlem i det hele tatt            → false
 *
 * Porten (medlem.registrer) komponerer predikatet over ALLE forespurte grupper med
 * `.every(Boolean)` — «ansvarlig for én av tre» avvises. Admin-veien er dekket av de
 * eksisterende medlem-registrer-testene (uendret {erAdmin:true}-sti).
 */

const memberFindUnique = vi.fn();
const groupMemberFindFirst = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    projectMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    projectGroupMember: { findFirst: (...a: unknown[]) => groupMemberFindFirst(...a) },
  },
}));

import { erGruppeansvarlig } from "./tilgangskontroll";

const USER = "user-1";
const PROJECT = "prosjekt-1";
const GROUP = "gruppe-1";

describe("erGruppeansvarlig — per-gruppe-rett", () => {
  beforeEach(() => {
    memberFindUnique.mockReset();
    groupMemberFindFirst.mockReset();
  });

  it("medlem med isAdmin i gruppa → true", async () => {
    memberFindUnique.mockResolvedValue({ id: "pm-1" });
    groupMemberFindFirst.mockResolvedValue({ id: "gm-1" });
    expect(await erGruppeansvarlig(USER, PROJECT, GROUP)).toBe(true);
  });

  it("medlem uten isAdmin i gruppa → false", async () => {
    memberFindUnique.mockResolvedValue({ id: "pm-1" });
    // findFirst med isAdmin:true-filteret finner ingen rad.
    groupMemberFindFirst.mockResolvedValue(null);
    expect(await erGruppeansvarlig(USER, PROJECT, GROUP)).toBe(false);
  });

  it("ikke prosjektmedlem → false (slår aldri opp gruppemedlemskap)", async () => {
    memberFindUnique.mockResolvedValue(null);
    expect(await erGruppeansvarlig(USER, PROJECT, GROUP)).toBe(false);
    expect(groupMemberFindFirst).not.toHaveBeenCalled();
  });
});
