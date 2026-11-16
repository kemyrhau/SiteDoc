import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-14 (8) punkt 2 — `organisasjon.hentReiseForutsetninger`
 * («Dette må være på plass» i Reise-regelsett).
 *
 * Firmagrensen sjekkes på serveren: admin i A får FORBIDDEN for B, og hvert
 * oppslag bærer firmaet i where (oppmøtested/matrise på organizationId,
 * byggeplass via prosjektets primaryOrganizationId). Kjører den EKTE
 * `autoriserAdminForFirma` (samme mønster som organisasjon-firmaisolering.test.ts).
 */

const { FIRMA_A, FIRMA_B, userFindUnique, orgMemberFindUnique, prismaMock } = vi.hoisted(() => {
  const FIRMA_A = "aaaaaaaa-0000-0000-0000-00000000000a";
  const FIRMA_B = "bbbbbbbb-0000-0000-0000-00000000000b";
  const userFindUnique = vi.fn();
  const orgMemberFindUnique = vi.fn();
  const prismaMock = {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => orgMemberFindUnique(...a) },
  };
  return { FIRMA_A, FIRMA_B, userFindUnique, orgMemberFindUnique, prismaMock };
});

vi.mock("@sitedoc/db", () => ({ prisma: prismaMock }));

import { organisasjonRouter } from "./organisasjon";

const oppmotestedFindMany = vi.fn();
const byggeplassFindMany = vi.fn();
const matriseFindMany = vi.fn();

function lagCaller() {
  const ctx = {
    userId: "admin-i-a",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      ...prismaMock,
      oppmotested: { findMany: oppmotestedFindMany },
      byggeplass: { findMany: byggeplassFindMany },
      reisetidMatrise: { findMany: matriseFindMany },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return organisasjonRouter.createCaller(ctx);
}

const bp = (
  id: string,
  navn: string,
  over: Partial<{ latitude: number | null; longitude: number | null; radiusM: number | null }> = {},
) => ({
  id,
  name: navn,
  latitude: 69.6,
  longitude: 18.9,
  radiusM: 150,
  project: { id: "p1", name: "Prosjekt 1" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ role: "user" });
  orgMemberFindUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
    Promise.resolve(
      where.userId_organizationId.organizationId === FIRMA_A ? { firmaRoller: ["firma_admin"], status: "aktiv" } : null,
    ),
  );
  oppmotestedFindMany.mockResolvedValue([
    { id: "o1", navn: "Lager" },
    { id: "o2", navn: "Kontor" },
  ]);
  byggeplassFindMany.mockResolvedValue([
    bp("b1", "Bygg 1"),
    bp("b2", "Bygg 2"),
    bp("b3", "Uten punkt", { latitude: null }),
    bp("b4", "Uten radius", { radiusM: null }),
  ]);
  // o1×b1 OK, o1×b2 uoppnåelig, o2×b1 uten avstand, resten mangler rad.
  matriseFindMany.mockResolvedValue([
    { oppmotestedId: "o1", byggeplassId: "b1", kjoretidMin: 20, avstandM: 15000 },
    { oppmotestedId: "o1", byggeplassId: "b2", kjoretidMin: -1, avstandM: null },
    { oppmotestedId: "o2", byggeplassId: "b1", kjoretidMin: 20, avstandM: null },
  ]);
});

describe("hentReiseForutsetninger — firmagrense", () => {
  it("admin i A får FORBIDDEN for firma B, og ingen data hentes", async () => {
    await expect(lagCaller().hentReiseForutsetninger({ organizationId: FIRMA_B })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(oppmotestedFindMany).not.toHaveBeenCalled();
    expect(byggeplassFindMany).not.toHaveBeenCalled();
    expect(matriseFindMany).not.toHaveBeenCalled();
  });

  it("negativkontroll: admin i A får svar for A, og hvert oppslag bærer firma A", async () => {
    await lagCaller().hentReiseForutsetninger({ organizationId: FIRMA_A });
    expect(oppmotestedFindMany.mock.calls[0]![0].where).toMatchObject({ organizationId: FIRMA_A, aktiv: true });
    expect(byggeplassFindMany.mock.calls[0]![0].where).toEqual({
      project: { primaryOrganizationId: FIRMA_A, status: "active" },
    });
    expect(matriseFindMany.mock.calls[0]![0].where).toMatchObject({ organizationId: FIRMA_A });
  });
});

describe("hentReiseForutsetninger — innhold", () => {
  it("teller oppmøtesteder, lister mangelfulle byggeplasser og par", async () => {
    const r = await lagCaller().hentReiseForutsetninger({ organizationId: FIRMA_A });
    expect(r.oppmotesteder).toBe(2);
    expect(r.byggeplasserMangler).toEqual([
      { id: "b3", navn: "Uten punkt", prosjektId: "p1", prosjektNavn: "Prosjekt 1", manglerPunkt: true, manglerRadius: false },
      { id: "b4", navn: "Uten radius", prosjektId: "p1", prosjektNavn: "Prosjekt 1", manglerPunkt: false, manglerRadius: true },
    ]);
    // Par = 2 oppmøtesteder × 3 byggeplasser med punkt (b1, b2, b4).
    expect(r.parTotalt).toBe(6);
    // Mangler: o2×b1 (avstand null), o1×b4, o2×b2, o2×b4 (ingen rad). Ikke o1×b2 (uoppnåelig).
    expect(r.parManglerAvstand).toBe(4);
    expect(r.uoppnaaelige).toEqual([{ oppmotested: "Lager", byggeplass: "Bygg 2", prosjekt: "Prosjekt 1" }]);
  });

  it("ingen oppmøtested → ingen par og ingen matrise-oppslag", async () => {
    oppmotestedFindMany.mockResolvedValue([]);
    const r = await lagCaller().hentReiseForutsetninger({ organizationId: FIRMA_A });
    expect(r.oppmotesteder).toBe(0);
    expect(r.parTotalt).toBe(0);
    expect(matriseFindMany).not.toHaveBeenCalled();
  });
});
