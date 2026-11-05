import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L1 — myk fjerning fra dokumentflyt (ordre 2026-11-05 (3), B1/B7/B10). Fjern skriver periodeSlutt
 * i stedet for å slette, ballen på åpne dokumenter hos personen flyttes til leddets nye
 * hovedansvarlig (eller leddet selv når det blir tomt), gjenlegging gjenåpner raden, og Activity
 * `flytmedlem_avsluttet` bærer hva som skjedde. Kjører de EKTE prosedyrene mot en mock-klient.
 */

const userFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    projectMember: { findUnique: vi.fn() },
    projectOrganization: { findMany: vi.fn() },
    organizationMember: { findUnique: vi.fn() },
  },
}));

import { dokumentflytRouter } from "./dokumentflyt";

const FLYT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MEDLEM = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PM_KENNETH = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PM_ANNE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

beforeEach(() => {
  userFindUnique.mockReset();
  userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lagCaller(prisma: any) {
  const ctx = {
    userId: "admin-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dokumentflytRouter.createCaller(ctx);
}

interface Oppsett {
  /** Andre aktive personer i leddet (gjenværende). */
  gjenvarende?: Array<{ projectMemberId: string; navn: string; erHovedansvarlig?: boolean }>;
  /** Åpne sjekklister med ballen hos personen. */
  apneSjekklister?: string[];
  /** Personen står i flere ledd i samme flyt. */
  andreLedd?: number;
  /** Den som fjernes er leddets hovedansvarlig. */
  varHovedansvarlig?: boolean;
}

function prismaMed(o: Oppsett = {}) {
  const medlem = {
    id: MEDLEM,
    dokumentflytId: FLYT,
    rolle: "godkjenner",
    steg: 3,
    groupId: null,
    projectMemberId: PM_KENNETH,
    erHovedansvarlig: o.varHovedansvarlig ?? false,
    projectMember: { userId: "u-kenneth" },
  };
  const gjenvarende = (o.gjenvarende ?? []).map((g) => ({
    projectMemberId: g.projectMemberId,
    erHovedansvarlig: g.erHovedansvarlig ?? false,
    projectMember: { user: { name: g.navn, email: null } },
  }));
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin" }) },
    projectMember: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        [PM_KENNETH, PM_ANNE].includes(where.id) ? { userId: where.id === PM_ANNE ? "u-anne" : "u-kenneth" } : null,
      ),
    },
    dokumentflytMedlem: {
      // Første findFirst = hentAktivtFlytmedlem; i transaksjonen = «finnes erstatteren i leddet».
      findFirst: vi.fn(async ({ where }: { where: { id?: string; projectMemberId?: string } }): Promise<unknown> =>
        where.id === MEDLEM ? medlem : null,
      ),
      findMany: vi.fn().mockResolvedValue(gjenvarende),
      count: vi.fn(async ({ where }: { where: { projectMemberId?: unknown } }) =>
        where.projectMemberId === PM_KENNETH ? (o.andreLedd ?? 0) : 0,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "ny-rad" }),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    checklist: {
      findMany: vi.fn().mockResolvedValue((o.apneSjekklister ?? []).map((id) => ({ id }))),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    activity: { create: vi.fn().mockResolvedValue({}) },
    documentTransfer: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
}

describe("fjernMedlem — myk avslutning (B1)", () => {
  it("🔴 setter periodeSlutt — raden står, slettes ikke, ingen sperre selv med åpne dokumenter", async () => {
    const prisma = prismaMed({
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }],
      apneSjekklister: ["s-1", "s-2"],
    });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: PM_ANNE });
    expect(prisma.dokumentflytMedlem.delete).not.toHaveBeenCalled();
    const avslutt = prisma.dokumentflytMedlem.update.mock.calls[0]![0];
    expect(avslutt.where).toEqual({ id: MEDLEM });
    expect(avslutt.data.periodeSlutt).toBeInstanceOf(Date);
    expect(avslutt.data.erHovedansvarlig).toBe(false);
  });

  it("medlemmet slås opp scopet til prosjektet og bare blant aktive", async () => {
    const prisma = prismaMed();
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: null });
    expect(prisma.dokumentflytMedlem.findFirst.mock.calls[0]![0].where).toMatchObject({
      id: MEDLEM,
      dokumentflyt: { projectId: PROSJEKT },
      periodeSlutt: null,
    });
  });

  it("allerede avsluttet / annet prosjekt → NOT_FOUND, ingenting endret", async () => {
    const prisma = prismaMed();
    prisma.dokumentflytMedlem.findFirst.mockResolvedValue(null);
    await expect(
      lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.dokumentflytMedlem.update).not.toHaveBeenCalled();
  });
});

describe("fjernMedlem — ballen flyttes (B7)", () => {
  it("🔴 åpne dokumenter hos personen får ny hovedansvarlig som mottaker", async () => {
    const prisma = prismaMed({
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }],
      apneSjekklister: ["s-1", "s-2"],
    });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: PM_ANNE });

    const finn = prisma.checklist.findMany.mock.calls[0]![0].where;
    expect(finn).toMatchObject({ dokumentflytId: FLYT, recipientUserId: "u-kenneth", deletedAt: null });
    expect(finn.status).toEqual({ notIn: ["closed", "approved", "cancelled"] });
    expect(finn.aktivPosisjon).toBeUndefined(); // personen står bare i dette leddet

    expect(prisma.checklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s-1", "s-2"] } },
      data: { recipientUserId: "u-anne" },
    });
    expect(prisma.documentTransfer.create).not.toHaveBeenCalled();
  });

  it("erstatteren blir hovedansvarlig i leddet (andre nullstilles først)", async () => {
    const prisma = prismaMed({ gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }] });
    prisma.dokumentflytMedlem.findFirst.mockImplementation(async ({ where }) =>
      where.id === MEDLEM
        ? {
            id: MEDLEM, dokumentflytId: FLYT, rolle: "godkjenner", steg: 3, groupId: null,
            projectMemberId: PM_KENNETH, projectMember: { userId: "u-kenneth" },
          }
        : where.projectMemberId === PM_ANNE ? { id: "anne-rad" } : null,
    );
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: PM_ANNE });
    expect(prisma.dokumentflytMedlem.updateMany).toHaveBeenCalledWith({
      where: { dokumentflytId: FLYT, rolle: "godkjenner", steg: 3, periodeSlutt: null },
      data: { erHovedansvarlig: false, hovedansvarligPersonId: null },
    });
    expect(prisma.dokumentflytMedlem.update).toHaveBeenLastCalledWith({
      where: { id: "anne-rad" },
      data: { periodeSlutt: null, erHovedansvarlig: true },
    });
  });

  it("C: erstatter utenfor leddet → ny rad i samme ledd som hovedansvarlig", async () => {
    const prisma = prismaMed({ apneSjekklister: ["s-1"] });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: PM_ANNE });
    expect(prisma.dokumentflytMedlem.create).toHaveBeenCalledWith({
      data: { dokumentflytId: FLYT, rolle: "godkjenner", steg: 3, projectMemberId: PM_ANNE, erHovedansvarlig: true },
    });
    expect(prisma.checklist.updateMany.mock.calls[0]![0].data).toEqual({ recipientUserId: "u-anne" });
  });

  it("B10: tomt ledd uten erstatter → ballen ligger på leddet (null)", async () => {
    const prisma = prismaMed({ apneSjekklister: ["s-1"] });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: null });
    expect(prisma.dokumentflytMedlem.create).not.toHaveBeenCalled();
    expect(prisma.checklist.updateMany.mock.calls[0]![0].data).toEqual({ recipientUserId: null });
  });

  it("uten valg → første gjenværende i leddet overtar", async () => {
    const prisma = prismaMed({
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne", erHovedansvarlig: true }],
      apneSjekklister: ["s-1"],
    });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT });
    expect(prisma.checklist.updateMany.mock.calls[0]![0].data).toEqual({ recipientUserId: "u-anne" });
  });

  it("🔴 uten valg, ikke hovedansvarlig og ingen åpne dokumenter → leddets hovedansvarlig røres ikke", async () => {
    const prisma = prismaMed({ gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }] });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT });
    expect(prisma.dokumentflytMedlem.updateMany).not.toHaveBeenCalled();
    expect(prisma.dokumentflytMedlem.create).not.toHaveBeenCalled();
    expect(prisma.dokumentflytMedlem.update).toHaveBeenCalledTimes(1);
  });

  it("uten valg, var hovedansvarlig → første gjenværende overtar selv uten dokumenter", async () => {
    const prisma = prismaMed({ gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }], varHovedansvarlig: true });
    prisma.dokumentflytMedlem.findFirst.mockImplementation(async ({ where }) =>
      where.id === MEDLEM
        ? {
            id: MEDLEM, dokumentflytId: FLYT, rolle: "godkjenner", steg: 3, groupId: null,
            projectMemberId: PM_KENNETH, erHovedansvarlig: true, projectMember: { userId: "u-kenneth" },
          }
        : where.projectMemberId === PM_ANNE ? { id: "anne-rad" } : null,
    );
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT });
    expect(prisma.dokumentflytMedlem.update).toHaveBeenLastCalledWith({
      where: { id: "anne-rad" },
      data: { periodeSlutt: null, erHovedansvarlig: true },
    });
  });

  it("personen i flere ledd i flyten → bare dokumenter på dette steget flyttes", async () => {
    const prisma = prismaMed({ andreLedd: 1, apneSjekklister: ["s-1"] });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: null });
    expect(prisma.checklist.findMany.mock.calls[0]![0].where.aktivPosisjon).toBe(3);
  });

  it("erstatter utenfor prosjektet → BAD_REQUEST, ingenting endret", async () => {
    const prisma = prismaMed();
    await expect(
      lagCaller(prisma).fjernMedlem({
        id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflytMedlem.update).not.toHaveBeenCalled();
  });
});

describe("fjernMedlem — loggen (Activity)", () => {
  it("🔴 flytmedlem_avsluttet bærer person, erstatter og flyttede dokumenter", async () => {
    const prisma = prismaMed({
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne" }],
      apneSjekklister: ["s-1", "s-2"],
    });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT, nyHovedansvarligPmId: PM_ANNE });
    const { data } = prisma.activity.create.mock.calls[0]![0];
    expect(data).toMatchObject({
      actorUserId: "admin-1",
      actorNavnSnapshot: "Admin",
      projectId: PROSJEKT,
      targetType: "dokumentflyt_medlem",
      targetId: MEDLEM,
      action: "flytmedlem_avsluttet",
      payload: {
        dokumentflytId: FLYT,
        medlemId: MEDLEM,
        userId: "u-kenneth",
        nyHovedansvarligPmId: PM_ANNE,
        dokumentIder: ["s-1", "s-2"],
      },
    });
  });
});

describe("gjenlegging gjenåpner raden", () => {
  it("🔴 leggTilMedlem på en avsluttet binding → periodeSlutt nullstilles, ingen ny rad", async () => {
    const prisma = prismaMed();
    prisma.dokumentflytMedlem.findFirst.mockResolvedValue({ id: MEDLEM });
    await lagCaller(prisma).leggTilMedlem({
      dokumentflytId: FLYT, projectId: PROSJEKT, projectMemberId: PM_KENNETH, rolle: "godkjenner", steg: 3,
    });
    expect(prisma.dokumentflytMedlem.findFirst.mock.calls[0]![0].where).toMatchObject({
      dokumentflytId: FLYT,
      dokumentflyt: { projectId: PROSJEKT },
      projectMemberId: PM_KENNETH,
      faggruppeId: null,
      groupId: null,
      rolle: "godkjenner",
      steg: 3,
      periodeSlutt: { not: null },
    });
    expect(prisma.dokumentflytMedlem.update.mock.calls[0]![0]).toMatchObject({
      where: { id: MEDLEM },
      data: { periodeSlutt: null },
    });
    expect(prisma.dokumentflytMedlem.create).not.toHaveBeenCalled();
  });

  it("ingen avsluttet binding → ny rad som før", async () => {
    const prisma = prismaMed();
    prisma.dokumentflytMedlem.findFirst.mockResolvedValue(null);
    await lagCaller(prisma).leggTilMedlem({
      dokumentflytId: FLYT, projectId: PROSJEKT, projectMemberId: PM_ANNE, rolle: "godkjenner", steg: 3,
    });
    expect(prisma.dokumentflytMedlem.create).toHaveBeenCalled();
    expect(prisma.dokumentflytMedlem.update).not.toHaveBeenCalled();
  });
});

describe("forhandsvisFjerning", () => {
  it("teller åpne dokumenter hos personen og lister gjenværende i leddet", async () => {
    const prisma = prismaMed({
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne", erHovedansvarlig: true }],
      apneSjekklister: ["s-1", "s-2", "s-3"],
    });
    const res = await lagCaller(prisma).forhandsvisFjerning({ id: MEDLEM, projectId: PROSJEKT });
    expect(res).toEqual({
      antallApne: 3,
      gjenvarende: [{ projectMemberId: PM_ANNE, navn: "Anne", erHovedansvarlig: true }],
      andreILeddet: 1,
    });
    expect(prisma.checklist.updateMany).not.toHaveBeenCalled();
  });
});

describe("M1 — avsluttet flytmedlem kan ikke endres (L2b)", () => {
  /**
   * Raden står med periodeSlutt. Mocken svarer som Prisma: findFirst med periodefilter finner den
   * ikke, mens findUnique/findUniqueOrThrow (uten filter) gjør det. Gjeninnføres findUniqueOrThrow
   * i prosedyren, slipper kallet gjennom — og testen blir rød.
   */
  function prismaMedAvsluttet() {
    const prisma = prismaMed();
    const avsluttet = { id: MEDLEM, dokumentflytId: FLYT, rolle: "godkjenner", steg: 3, periodeSlutt: new Date("2026-11-01") };
    prisma.dokumentflytMedlem.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      "periodeSlutt" in where ? null : avsluttet,
    );
    Object.assign(prisma.dokumentflytMedlem, {
      findUnique: vi.fn().mockResolvedValue(avsluttet),
      findUniqueOrThrow: vi.fn().mockResolvedValue(avsluttet),
    });
    return prisma;
  }

  const kall: Array<[string, (c: ReturnType<typeof lagCaller>) => Promise<unknown>]> = [
    ["settHovedansvarlig", (c) => c.settHovedansvarlig({ id: MEDLEM, projectId: PROSJEKT, erHovedansvarlig: true })],
    ["settGruppeHovedansvarlig", (c) => c.settGruppeHovedansvarlig({ id: MEDLEM, projectId: PROSJEKT, hovedansvarligPersonId: PM_ANNE })],
    ["settKanRedigere", (c) => c.settKanRedigere({ id: MEDLEM, projectId: PROSJEKT, kanRedigere: true })],
  ];

  it.each(kall)("🔴 %s på avsluttet rad → NOT_FOUND, ingenting endret", async (_navn, k) => {
    const prisma = prismaMedAvsluttet();
    await expect(k(lagCaller(prisma))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.dokumentflytMedlem.update).not.toHaveBeenCalled();
    expect(prisma.dokumentflytMedlem.updateMany).not.toHaveBeenCalled();
  });
});
