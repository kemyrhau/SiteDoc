import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit-test for `kanOppretteProsjekt` — den delegerbare opprett-retten
 * (Kenneth-vedtak 2026-09-10). Kjører UTEN DB (prisma mocket).
 *
 * Kontrakten denne låser:
 *   - firma_admin        → true  (arver retten)
 *   - prosjekt_oppretter → true  (delegert rett)
 *   - vanlig ansatt      → false (retten er ikke alles — hullet ordren lukket)
 *   - deaktivert ansatt  → false (selv med rollen)
 *   - ikke-medlem        → false
 *
 * `sitedoc_admin`-bypass ligger hos kallerne (prosjekt.opprett/opprettTestprosjekt/
 * kanOpprette), ikke i predikatet — testes ikke her.
 */

const memberFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
  },
}));

import { kanOppretteProsjekt } from "./tilgangskontroll";

const USER = "user-1";
const ORG = "org-1";

describe("kanOppretteProsjekt — delegerbar opprett-rett", () => {
  beforeEach(() => memberFindUnique.mockReset());

  it("firma_admin → true", async () => {
    memberFindUnique.mockResolvedValue({ firmaRoller: ["firma_admin"], status: "aktiv" });
    expect(await kanOppretteProsjekt(USER, ORG)).toBe(true);
  });

  it("prosjekt_oppretter → true", async () => {
    memberFindUnique.mockResolvedValue({ firmaRoller: ["prosjekt_oppretter"], status: "aktiv" });
    expect(await kanOppretteProsjekt(USER, ORG)).toBe(true);
  });

  it("vanlig ansatt uten rollene → false", async () => {
    memberFindUnique.mockResolvedValue({ firmaRoller: ["hms_ansvarlig"], status: "aktiv" });
    expect(await kanOppretteProsjekt(USER, ORG)).toBe(false);
  });

  it("deaktivert ansatt med prosjekt_oppretter → false", async () => {
    memberFindUnique.mockResolvedValue({ firmaRoller: ["prosjekt_oppretter"], status: "deaktivert" });
    expect(await kanOppretteProsjekt(USER, ORG)).toBe(false);
  });

  it("ikke medlem av firmaet → false", async () => {
    memberFindUnique.mockResolvedValue(null);
    expect(await kanOppretteProsjekt(USER, ORG)).toBe(false);
  });
});
