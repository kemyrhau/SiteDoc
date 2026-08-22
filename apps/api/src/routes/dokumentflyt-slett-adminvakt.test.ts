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

// ---------------------------------------------------------------------------
//  Admin-gate på ALLE åtte flyt-konfig-mutasjonene (Kenneth-vedtak 2026-08-22).
//  Gjenbruker samme harness: ekte verifiserAdmin + mocket @sitedoc/db-prisma.
//  Permissiv ctx.prisma lar hver prosedyre-kropp fullføre for slipp-scenariene.
// ---------------------------------------------------------------------------

const ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function scenarioMedlem() {
  userFindUnique.mockResolvedValue({ role: "user" });
  memberFindUnique.mockResolvedValue({ role: "member" });
  orgFindMany.mockResolvedValue([]); // ingen org → ingen firmaadmin-fallback
}
function scenarioProsjektadmin() {
  userFindUnique.mockResolvedValue({ role: "user" });
  memberFindUnique.mockResolvedValue({ role: "admin" });
}
function scenarioFirmaadmin() {
  userFindUnique.mockResolvedValue({ role: "company_admin" }); // ikke sitedoc_admin
  memberFindUnique.mockResolvedValue(null); // INGEN medlemsrad
  orgFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
  orgMemberFindUnique.mockResolvedValue({ firmaRoller: ["firma_admin"] });
}

function permissivPrisma() {
  return {
    dokumentflyt: {
      create: vi.fn().mockResolvedValue({ id: FLYT }),
      update: vi.fn().mockResolvedValue({ id: FLYT }),
      delete: vi.fn().mockResolvedValue({ id: FLYT }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FLYT, roller: [] }),
    },
    dokumentflytMal: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
    dokumentflytMedlem: {
      create: vi.fn().mockResolvedValue({ id: "m" }),
      delete: vi.fn().mockResolvedValue({ id: "m" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "m", dokumentflytId: FLYT, rolle: "registrator", steg: 1 }),
      updateMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({ id: "m" }),
    },
  };
}

function lagCallerMed(prisma: unknown) {
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dokumentflytRouter.createCaller(ctx);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROSEDYRER: Array<{ navn: string; kall: (c: any) => Promise<unknown> }> = [
  { navn: "opprett", kall: (c) => c.opprett({ projectId: PROSJEKT, name: "F" }) },
  { navn: "oppdater", kall: (c) => c.oppdater({ id: ID, projectId: PROSJEKT }) },
  { navn: "oppdaterRoller", kall: (c) => c.oppdaterRoller({ id: ID, projectId: PROSJEKT, roller: [] }) },
  { navn: "leggTilMedlem", kall: (c) => c.leggTilMedlem({ dokumentflytId: ID, projectId: PROSJEKT, rolle: "registrator" }) },
  { navn: "fjernMedlem", kall: (c) => c.fjernMedlem({ id: ID, projectId: PROSJEKT }) },
  { navn: "settHovedansvarlig", kall: (c) => c.settHovedansvarlig({ id: ID, projectId: PROSJEKT, erHovedansvarlig: true }) },
  { navn: "settGruppeHovedansvarlig", kall: (c) => c.settGruppeHovedansvarlig({ id: ID, projectId: PROSJEKT, hovedansvarligPersonId: null }) },
  { navn: "settKanRedigere", kall: (c) => c.settKanRedigere({ id: ID, projectId: PROSJEKT, kanRedigere: true }) },
];

describe.each(PROSEDYRER)("dokumentflyt.$navn — admin-gate (verifiserAdmin)", ({ kall }) => {
  it("vanlig medlem → FORBIDDEN (gaten stopper før kroppen)", async () => {
    scenarioMedlem();
    await expect(kall(lagCallerMed(permissivPrisma()))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("prosjektadmin → slipper", async () => {
    scenarioProsjektadmin();
    await expect(kall(lagCallerMed(permissivPrisma()))).resolves.toBeDefined();
  });
  it("firmaadmin uten ProjectMember-rad → slipper (riktig hjelper)", async () => {
    scenarioFirmaadmin();
    await expect(kall(lagCallerMed(permissivPrisma()))).resolves.toBeDefined();
  });
});
