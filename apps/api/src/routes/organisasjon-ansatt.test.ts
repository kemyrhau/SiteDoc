import { describe, it, expect, vi } from "vitest";

/**
 * Timer «ikke ansatt» (ordre 2026-11-04 (8)): `hentMineMedlemskap` sier per firma om
 * brukeren er ansatt — aktiv OrganizationMember-rad, samme regel som `erAnsattIFirma`
 * (som `verifiserAnsattIFirma` på timer-synken håndhever). Ingen admin-bypass: en
 * sitedoc_admin uten medlemsrad er ikke ansatt, og serveren ville nektet sedelen.
 *
 * Rød før fiksen: feltet fantes ikke.
 */

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));

import { organisasjonRouter } from "./organisasjon";

const BRUKER = "bruker-1";
const AKTIV = { id: "aaaaaaaa-0000-4000-8000-00000000000a", name: "Aktiv AS", erKunde: true };
const DEAKTIVERT = { id: "bbbbbbbb-0000-4000-8000-00000000000b", name: "Deaktivert AS", erKunde: true };
const UTEN_RAD = { id: "cccccccc-0000-4000-8000-00000000000c", name: "Uten rad AS", erKunde: true };

type MedlemRad = { userId: string; organizationId: string; status: string };
type MedlemWhere = {
  userId: string;
  organizationId?: { in: string[] };
  status?: string;
};

function lagCaller(rolle: "user" | "sitedoc_admin", medlemmer: MedlemRad[]) {
  const orgs = [AKTIV, DEAKTIVERT, UTEN_RAD];
  const memberFindMany = vi.fn(async ({ where }: { where: MedlemWhere }) =>
    medlemmer.filter(
      (m) =>
        m.userId === where.userId &&
        (!where.organizationId || where.organizationId.in.includes(m.organizationId)) &&
        (!where.status || m.status === where.status),
    ),
  );
  const prisma = {
    user: { findUniqueOrThrow: vi.fn(async () => ({ role: rolle })) },
    organizationMember: { findMany: memberFindMany },
    organization: {
      findMany: vi.fn(async ({ where }: { where: { id?: { in: string[] } } }) =>
        where.id ? orgs.filter((o) => where.id!.in.includes(o.id)) : orgs,
      ),
    },
    organizationModule: { findMany: vi.fn(async () => []) },
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caller: organisasjonRouter.createCaller({ userId: BRUKER, prisma } as any),
    memberFindMany,
  };
}

describe("organisasjon.hentMineMedlemskap — erAnsatt", () => {
  it("🔴 aktiv rad → true; deaktivert rad → false", async () => {
    const { caller, memberFindMany } = lagCaller("user", [
      { userId: BRUKER, organizationId: AKTIV.id, status: "aktiv" },
      { userId: BRUKER, organizationId: DEAKTIVERT.id, status: "deaktivert" },
    ]);
    const res = await caller.hentMineMedlemskap();
    const perId = Object.fromEntries(res.map((f) => [f.id, f.erAnsatt]));
    expect(perId).toEqual({ [AKTIV.id]: true, [DEAKTIVERT.id]: false });
    // Ikke N+1: medlemsoppslag + én ansatt-spørring, uansett antall firmaer.
    expect(memberFindMany).toHaveBeenCalledTimes(2);
  });

  it("🔴 sitedoc_admin uten medlemsrad → false (ingen admin-bypass)", async () => {
    const { caller } = lagCaller("sitedoc_admin", [
      { userId: BRUKER, organizationId: AKTIV.id, status: "aktiv" },
    ]);
    const res = await caller.hentMineMedlemskap();
    const perId = Object.fromEntries(res.map((f) => [f.id, f.erAnsatt]));
    expect(perId).toEqual({
      [AKTIV.id]: true,
      [DEAKTIVERT.id]: false,
      [UTEN_RAD.id]: false,
    });
  });
});
