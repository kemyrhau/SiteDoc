import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firmagrense punkt 2 (A) (ordre 2026-11-03 (2), Kenneth: «Ja, alle»).
 *
 * Firma-admin-bypassen gjelder bare eierfirmaet (`Project.primaryOrganizationId`), ikke
 * ethvert firma med en `ProjectOrganization`-rad. En firma-admin i et deltakerfirma (UE,
 * konsulent, byggherre) får tilgang som et vanlig medlem: medlemsrad, grupper og mappetilgang.
 *
 * Dekker predikatet `erFirmaAdminForProsjekt` og de to parallelle sjekkene som lå utenfor det:
 * `gruppe.hentMinFlytInfo` og `dagsseddel.kanAttestere` (`erProsjektLeder`).
 * Kjører den EKTE tilgangskontrollen mot en mocket `@sitedoc/db`.
 *
 * Rød før fiksen: firma-admin i deltakerfirmaet slapp gjennom alle tre.
 */

const { EIER, DELTAKER, PROSJEKT, UTEN_EIER, USER, tilstand, prismaMock } = vi.hoisted(() => {
  const EIER = "aaaaaaaa-0000-4000-8000-00000000000a";
  const DELTAKER = "cccccccc-0000-4000-8000-00000000000c";
  const PROSJEKT = "11111111-1111-4111-8111-111111111111";
  const UTEN_EIER = "22222222-2222-4222-8222-222222222222";
  const USER = "bruker-1";

  /** Prosjekt → eierfirma og koblede firmaer. */
  const PROSJEKTER: Record<string, { eier: string | null; koblinger: string[] }> = {
    [PROSJEKT]: { eier: EIER, koblinger: [EIER, DELTAKER] },
    [UTEN_EIER]: { eier: null, koblinger: [DELTAKER] },
  };
  /** Firmaet brukeren er aktiv firma_admin i (settes pr. test). */
  const tilstand = { adminI: EIER };

  const prismaMock = {
    user: { findUnique: vi.fn(async () => ({ role: "user" })) },
    project: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = PROSJEKTER[where.id];
        return p ? { id: where.id, primaryOrganizationId: p.eier, status: "active" } : null;
      }),
    },
    projectOrganization: {
      findMany: vi.fn(async ({ where }: { where: { projectId: string } }) =>
        (PROSJEKTER[where.projectId]?.koblinger ?? []).map((organizationId) => ({ organizationId })),
      ),
      findFirst: vi.fn(async ({ where }: { where: { projectId: string; organizationId: string } }) =>
        PROSJEKTER[where.projectId]?.koblinger.includes(where.organizationId)
          ? { projectId: where.projectId, organizationId: where.organizationId }
          : null,
      ),
    },
    organizationMember: {
      findUnique: vi.fn(
        async ({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
          where.userId_organizationId.organizationId === tilstand.adminI
            ? { firmaRoller: ["firma_admin"], status: "aktiv" }
            : null,
      ),
      findMany: vi.fn(async () => [{ organizationId: tilstand.adminI }]),
    },
    // Ingen medlemsrad: bypassen er eneste vei inn.
    // L2: hentMinFlytInfo slår opp aktivt medlem med findFirst (aktivtProsjektmedlemWhere).
    projectMember: { findFirst: vi.fn(async () => null) },
  };
  return { EIER, DELTAKER, PROSJEKT, UTEN_EIER, USER, tilstand, prismaMock };
});

vi.mock("@sitedoc/db", async () => ({
  prisma: prismaMock,
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../services/timer", () => ({ krevTimerAktivert: vi.fn(), hentEffektivArbeidstid: vi.fn() }));

import { erFirmaAdminForProsjekt } from "./tilgangskontroll";
import { gruppeRouter } from "../routes/gruppe";
import { dagsseddelRouter } from "../routes/timer/dagsseddel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = { userId: USER, prisma: prismaMock } as any;

beforeEach(() => {
  tilstand.adminI = EIER;
});

describe("erFirmaAdminForProsjekt — bare eierfirmaet", () => {
  it("🔴 firma-admin i deltakerfirma (koblet, ikke eier) → false", async () => {
    tilstand.adminI = DELTAKER;
    expect(await erFirmaAdminForProsjekt(USER, PROSJEKT)).toBe(false);
  });

  it("negativkontroll: firma-admin i eierfirmaet → true", async () => {
    expect(await erFirmaAdminForProsjekt(USER, PROSJEKT)).toBe(true);
  });

  it("🔴 prosjekt uten eier (null) → false, også for admin i et koblet firma", async () => {
    tilstand.adminI = DELTAKER;
    expect(await erFirmaAdminForProsjekt(USER, UTEN_EIER)).toBe(false);
  });

  it("ukjent prosjekt → false, ingen krasj", async () => {
    expect(await erFirmaAdminForProsjekt(USER, "33333333-3333-4333-8333-333333333333")).toBe(false);
  });
});

describe("gruppe.hentMinFlytInfo — bare eierfirmaet", () => {
  it("🔴 firma-admin i deltakerfirma uten medlemsrad → FORBIDDEN", async () => {
    tilstand.adminI = DELTAKER;
    await expect(gruppeRouter.createCaller(ctx).hentMinFlytInfo({ projectId: PROSJEKT })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("negativkontroll: firma-admin i eierfirmaet → erAdmin, adminNiva null", async () => {
    const res = await gruppeRouter.createCaller(ctx).hentMinFlytInfo({ projectId: PROSJEKT });
    expect(res).toMatchObject({ erAdmin: true, adminNiva: null });
  });
});

describe("dagsseddel.kanAttestere (erProsjektLeder) — bare eierfirmaet", () => {
  it("🔴 firma-admin i deltakerfirma uten medlemsrad → false", async () => {
    tilstand.adminI = DELTAKER;
    expect(await dagsseddelRouter.createCaller(ctx).kanAttestere({ projectId: PROSJEKT })).toBe(false);
  });

  it("negativkontroll: firma-admin i eierfirmaet → true", async () => {
    expect(await dagsseddelRouter.createCaller(ctx).kanAttestere({ projectId: PROSJEKT })).toBe(true);
  });
});
