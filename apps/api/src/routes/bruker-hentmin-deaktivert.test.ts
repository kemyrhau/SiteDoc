import { describe, it, expect, vi } from "vitest";

/**
 * SYSADMIN-IKKE-DEAKTIVERT (Kenneth 2026-11-25, «Ja, bestill»): en systemadmin skal aldri
 * regnes som deaktivert. Feltfunn i prod: sitedoc_admin med én ansattrad satt til
 * `deaktivert` fikk `erDeaktivert: true` fra `bruker.hentMin`, og `dashbord/layout.tsx`
 * stengte hele web (også admin-siden). Drives via router.createCaller med mocket ctx.
 */

import { brukerRouter } from "./bruker";

type Rad = { organizationId: string; status: string };

function kall(role: string, medlemskap: Rad[]) {
  const ctx = {
    userId: "user-1",
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1", name: "N", email: "n@x.no", role }),
      },
      organizationMember: {
        findMany: vi.fn().mockResolvedValue(medlemskap),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return brukerRouter.createCaller(ctx).hentMin();
}

const deaktivertRad: Rad = { organizationId: "org-a", status: "deaktivert" };
const aktivRad: Rad = { organizationId: "org-b", status: "aktiv" };

describe("bruker.hentMin — erDeaktivert", () => {
  it("sitedoc_admin med bare deaktiverte rader regnes ikke som deaktivert", async () => {
    const svar = await kall("sitedoc_admin", [deaktivertRad]);
    expect(svar?.erDeaktivert).toBe(false);
    // organizationId beholder dagens logikk (første rad når ingen er aktiv).
    expect(svar?.organizationId).toBe("org-a");
  });

  it("vanlig bruker med bare deaktiverte rader er deaktivert", async () => {
    const svar = await kall("user", [deaktivertRad]);
    expect(svar?.erDeaktivert).toBe(true);
  });

  it("vanlig bruker med én aktiv rad er ikke deaktivert", async () => {
    const svar = await kall("user", [deaktivertRad, aktivRad]);
    expect(svar?.erDeaktivert).toBe(false);
    expect(svar?.organizationId).toBe("org-b");
  });

  it("bruker uten rader er ikke deaktivert (venter på tilgang)", async () => {
    const svar = await kall("user", []);
    expect(svar?.erDeaktivert).toBe(false);
    expect(svar?.organizationId).toBeNull();
  });
});
