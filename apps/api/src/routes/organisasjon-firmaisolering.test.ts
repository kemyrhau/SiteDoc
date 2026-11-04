import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firmaisolering (måle-ordre 2026-11-03, Kenneth: «Vi må ikke kunne søke dokumenter på tvers av firma»).
 *
 * `organisasjon.leggTilProsjekt` gater bare på at kalleren er firma_admin i `input.organizationId` —
 * ikke at prosjektet tilhører firmaet. En `ProjectOrganization`-rad er nøkkelen i
 * `erFirmaAdminForProsjekt` (tilgangskontroll.ts), som er bypass i `verifiserProsjektmedlem`,
 * `verifiserAdmin`, `hentTilgjengeligeMappeIder` (null = alle mapper) m.fl. Admin i firma A kan
 * dermed koble prosjekt B til A og få full lese-/admintilgang i B — også søket.
 *
 * 🔴 Første sak er RØD på develop (kun tester, ingen fiks — ny ordre kreves). Negativkontrollene er
 * grønne og skal forbli grønne etter fiks. Kjører den EKTE `autoriserAdminForFirma` (mocker
 * `@sitedoc/db`-singletonen, samme mønster som dokumentflyt-slett-adminvakt.test.ts).
 */

const { FIRMA_A, FIRMA_B, PROSJEKT_A, PROSJEKT_B, userFindUnique, orgMemberFindUnique, prismaMock } = vi.hoisted(() => {
  const FIRMA_A = "aaaaaaaa-0000-0000-0000-00000000000a";
  const FIRMA_B = "bbbbbbbb-0000-0000-0000-00000000000b";
  const PROSJEKT_A = "aaaaaaaa-1111-1111-1111-11111111111a";
  const PROSJEKT_B = "bbbbbbbb-1111-1111-1111-11111111111b";

  /** Prosjekt → eier-firma. Ingen ProjectOrganization-rad for A på B. */
  const EIER: Record<string, string> = { [PROSJEKT_A]: FIRMA_A, [PROSJEKT_B]: FIRMA_B };

  const userFindUnique = vi.fn();
  const orgMemberFindUnique = vi.fn();

  const projectFindUnique = vi.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(
      EIER[where.id] ? { id: where.id, primaryOrganizationId: EIER[where.id], status: "active", type: "kunde" } : null,
    ),
  );
  const projectFindFirst = vi.fn(({ where }: { where: { id?: string } & Record<string, unknown> }) =>
    projectFindUnique({ where: { id: where.id ?? "" } }),
  );
  const projectOrgFindMany = vi.fn(({ where }: { where: { projectId?: string } }) =>
    Promise.resolve(where.projectId && EIER[where.projectId] ? [{ organizationId: EIER[where.projectId] }] : []),
  );
  const projectOrgFindUnique = vi.fn(
    ({ where }: { where: { projectId_organizationId: { projectId: string; organizationId: string } } }) => {
      const { projectId, organizationId } = where.projectId_organizationId;
      return Promise.resolve(EIER[projectId] === organizationId ? { projectId, organizationId } : null);
    },
  );

  const prismaMock = {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => orgMemberFindUnique(...a) },
    project: {
      findUnique: (...a: unknown[]) => projectFindUnique(...(a as [never])),
      findFirst: (...a: unknown[]) => projectFindFirst(...(a as [never])),
    },
    projectOrganization: {
      findMany: (...a: unknown[]) => projectOrgFindMany(...(a as [never])),
      findUnique: (...a: unknown[]) => projectOrgFindUnique(...(a as [never])),
    },
  };
  return { FIRMA_A, FIRMA_B, PROSJEKT_A, PROSJEKT_B, userFindUnique, orgMemberFindUnique, prismaMock };
});

vi.mock("@sitedoc/db", () => ({ prisma: prismaMock }));

import { organisasjonRouter } from "./organisasjon";

function lagCaller(upsert: ReturnType<typeof vi.fn>, del: ReturnType<typeof vi.fn> = vi.fn()) {
  const ctx = {
    userId: "admin-i-a",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      ...prismaMock,
      projectOrganization: { ...prismaMock.projectOrganization, upsert, delete: del },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return organisasjonRouter.createCaller(ctx);
}

/** Kalleren er aktiv firma_admin i A og ingenting i B. */
function adminIA() {
  userFindUnique.mockResolvedValue({ role: "user" });
  orgMemberFindUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
    Promise.resolve(
      where.userId_organizationId.organizationId === FIRMA_A ? { firmaRoller: ["firma_admin"], status: "aktiv" } : null,
    ),
  );
}

beforeEach(() => {
  userFindUnique.mockReset();
  orgMemberFindUnique.mockReset();
});

describe("organisasjon.leggTilProsjekt — firmagrense", () => {
  it("🔴 admin i A kobler prosjekt eid av B til A → FORBIDDEN, ingen ProjectOrganization-rad", async () => {
    adminIA();
    const upsert = vi.fn().mockResolvedValue({});

    const kall = lagCaller(upsert).leggTilProsjekt({ projectId: PROSJEKT_B, organizationId: FIRMA_A });

    await expect(kall).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("negativkontroll: admin i A kobler eget prosjekt (eid av A) → upsert skjer", async () => {
    adminIA();
    const upsert = vi.fn().mockResolvedValue({});

    await lagCaller(upsert).leggTilProsjekt({ projectId: PROSJEKT_A, organizationId: FIRMA_A });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]![0]).toMatchObject({ create: { projectId: PROSJEKT_A, organizationId: FIRMA_A } });
  });

  it("negativkontroll: vanlig bruker uten firma_admin → FORBIDDEN (firma-gaten virker)", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    orgMemberFindUnique.mockResolvedValue({ firmaRoller: [], status: "aktiv" });
    const upsert = vi.fn();

    await expect(
      lagCaller(upsert).leggTilProsjekt({ projectId: PROSJEKT_A, organizationId: FIRMA_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("negativkontroll: admin i A kan ikke oppgi B som organizationId → FORBIDDEN", async () => {
    adminIA();
    const upsert = vi.fn();

    await expect(
      lagCaller(upsert).leggTilProsjekt({ projectId: PROSJEKT_B, organizationId: FIRMA_B }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("organisasjon.fjernProsjekt — rører bare egen kobling", () => {
  it("admin i A kan bare slette (B-prosjekt, A)-koblingen, aldri Bs eierkobling", async () => {
    adminIA();
    const del = vi.fn().mockResolvedValue({});

    await lagCaller(vi.fn(), del).fjernProsjekt({ projectId: PROSJEKT_B, organizationId: FIRMA_A });

    expect(del).toHaveBeenCalledWith({
      where: { projectId_organizationId: { projectId: PROSJEKT_B, organizationId: FIRMA_A } },
    });
  });

  it("admin i A som oppgir B → FORBIDDEN, ingen sletting", async () => {
    adminIA();
    const del = vi.fn();

    await expect(
      lagCaller(vi.fn(), del).fjernProsjekt({ projectId: PROSJEKT_B, organizationId: FIRMA_B }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(del).not.toHaveBeenCalled();
  });
});
