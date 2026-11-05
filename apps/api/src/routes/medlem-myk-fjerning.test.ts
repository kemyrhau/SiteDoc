import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L2b — myk medlemsfjerning (ordre 2026-11-05 (5), Kenneth B1–B10).
 *
 * Prosjekt-, faggruppe- og gruppemedlemskap slettes aldri: raden får `periodeSlutt`, en Activity-rad
 * skrives, og en ny innmelding gjenåpner den samme raden. Fjerning fra prosjektet avslutter også
 * flytmedlemskapene etter B7 (ballen flyttes). Kjører de EKTE prosedyrene og tjenestene mot en
 * mock-klient; bare tilgangsportene er stubbet.
 *
 * Kjør: cd apps/api && npx vitest run src/routes/medlem-myk-fjerning.test.ts
 */

vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserAdmin: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentProsjektRolleNivaa: vi.fn().mockResolvedValue({ erAdmin: true }),
}));

import { medlemRouter } from "./medlem";
import { gruppeRouter } from "./gruppe";
import { gjenapneEllerOpprettProsjektmedlem } from "../services/prosjektmedlemskap";
import { sikreProsjektmedlemmer } from "../services/ansatt";
import { hentMottakerEposter } from "../services/epost";

const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PM_KENNETH = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PM_ANNE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const GRUPPE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const GM = "99999999-9999-9999-9999-999999999999";
const AVSLUTTET = new Date("2026-11-01");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxMed(prisma: any) {
  return {
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
}

type Where = Record<string, unknown>;

/** Prosjektet: Kenneth står i et flytledd (hovedansvarlig, én åpen sjekkliste); Anne står i samme ledd. */
function prismaForFjern(o: { kennethAvsluttet?: boolean } = {}) {
  const flytrad = {
    id: "dfm-kenneth",
    dokumentflytId: "flyt-1",
    rolle: "godkjenner",
    steg: 2,
    groupId: null,
    projectMemberId: PM_KENNETH,
    erHovedansvarlig: true,
    projectMember: { userId: "u-kenneth" },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin" }) },
    projectMember: {
      // Som Prisma: periodefilteret i `where` skjuler en avsluttet rad.
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        if (where.id === PM_KENNETH) {
          return o.kennethAvsluttet && "periodeSlutt" in where ? null : { id: PM_KENNETH, userId: "u-kenneth" };
        }
        if (where.id === PM_ANNE) return { id: PM_ANNE, userId: "u-anne" };
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Where }) => ({ id: where.id, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    dokumentflytMedlem: {
      findMany: vi.fn(async ({ where }: { where: Where }) => {
        if (where.hovedansvarligPersonId) return [];
        if (where.projectMemberId === PM_KENNETH) return [flytrad];
        // hentGjenvarendeILeddet
        return [{ projectMemberId: PM_ANNE, erHovedansvarlig: false, projectMember: { user: { name: "Anne", email: null } } }];
      }),
      findFirst: vi.fn().mockResolvedValue({ id: "dfm-anne", periodeSlutt: null }),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    faggruppeKobling: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn() },
    projectGroupMember: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn() },
    checklist: {
      // B7 spør med flytpeker (dokumentflytId); M3 spør etter rest uten — den er tom her.
      findMany: vi.fn(async ({ where }: { where: Where }) => ("dokumentflytId" in where ? [{ id: "s-1" }] : [])),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    task: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    activity: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
}

describe("medlem.fjern — myk avslutning (B8)", () => {
  it("🔴 raden står med periodeSlutt — slettes ikke", async () => {
    const prisma = prismaForFjern();
    await medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_KENNETH, projectId: PROSJEKT });

    expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    expect(prisma.projectMember.deleteMany).not.toHaveBeenCalled();
    const avslutt = prisma.projectMember.update.mock.calls.find((c) => c[0].where.id === PM_KENNETH)![0];
    expect(avslutt.data.periodeSlutt).toBeInstanceOf(Date);
  });

  it("🔴 faggruppe- og gruppekoblingene avsluttes sammen med medlemmet (forsvinner fra lister og e-post)", async () => {
    const prisma = prismaForFjern();
    await medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_KENNETH, projectId: PROSJEKT });

    for (const tabell of [prisma.faggruppeKobling, prisma.projectGroupMember]) {
      const kall = tabell.updateMany.mock.calls[0]![0];
      expect(kall.where).toMatchObject({ projectMemberId: PM_KENNETH, periodeSlutt: null });
      expect(kall.data.periodeSlutt).toBeInstanceOf(Date);
      expect(tabell.deleteMany).not.toHaveBeenCalled();
    }
  });

  it("🔴 punkt 5: flytmedlemskapet avsluttes og ballen flyttes til den som blir igjen i leddet (B7)", async () => {
    const prisma = prismaForFjern();
    await medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_KENNETH, projectId: PROSJEKT });

    const flytAvslutt = prisma.dokumentflytMedlem.update.mock.calls.find((c) => c[0].where.id === "dfm-kenneth")![0];
    expect(flytAvslutt.data.periodeSlutt).toBeInstanceOf(Date);
    expect(prisma.dokumentflytMedlem.delete).not.toHaveBeenCalled();
    expect(prisma.checklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s-1"] } },
      data: { recipientUserId: "u-anne" },
    });
  });

  it("Activity prosjektmedlem_avsluttet bærer personen og hva som skjedde i flytene", async () => {
    const prisma = prismaForFjern();
    await medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_KENNETH, projectId: PROSJEKT });

    const data = prisma.activity.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      actorUserId: "admin-1",
      projectId: PROSJEKT,
      targetType: "prosjekt_medlem",
      targetId: PM_KENNETH,
      action: "prosjektmedlem_avsluttet",
    });
    expect(data.payload).toMatchObject({
      userId: "u-kenneth",
      flyt: [{ medlemId: "dfm-kenneth", nyHovedansvarligPmId: PM_ANNE, dokumentIder: ["s-1"] }],
    });
  });

  it("allerede avsluttet → NOT_FOUND, ingenting endret", async () => {
    const prisma = prismaForFjern({ kennethAvsluttet: true });
    await expect(
      medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_KENNETH, projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
  });
});

describe("gjenåpning — samme rad, ingen ny", () => {
  function txMedRad(rad: { id: string; periodeSlutt: Date | null } | null) {
    return {
      projectMember: {
        findUnique: vi.fn().mockResolvedValue(rad),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: "pm-ny" }),
      },
    };
  }

  it("🔴 avsluttet medlem → samme rad gjenåpnes (periodeSlutt null, rollen settes på nytt)", async () => {
    const tx = txMedRad({ id: PM_KENNETH, periodeSlutt: AVSLUTTET });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await gjenapneEllerOpprettProsjektmedlem(tx as any, { userId: "u-kenneth", projectId: PROSJEKT, role: "member" });
    expect(res).toEqual({ id: PM_KENNETH, status: "gjenapnet" });
    expect(tx.projectMember.update).toHaveBeenCalledWith({
      where: { id: PM_KENNETH },
      data: { periodeSlutt: null, role: "member" },
    });
    expect(tx.projectMember.create).not.toHaveBeenCalled();
  });

  it("aktivt medlem → urørt; ingen rad → ny", async () => {
    const aktiv = txMedRad({ id: PM_KENNETH, periodeSlutt: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await gjenapneEllerOpprettProsjektmedlem(aktiv as any, { userId: "u", projectId: PROSJEKT, role: "member" }))
      .toEqual({ id: PM_KENNETH, status: "aktiv" });
    expect(aktiv.projectMember.update).not.toHaveBeenCalled();

    const ingen = txMedRad(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await gjenapneEllerOpprettProsjektmedlem(ingen as any, { userId: "u", projectId: PROSJEKT, role: "member" }))
      .toEqual({ id: "pm-ny", status: "ny" });
  });

  it("🔴 gruppe.meldMegInn: avsluttet prosjekt- og gruppemedlem gjenåpnes på samme rader", async () => {
    const prisma = {
      projectGroup: { findFirst: vi.fn().mockResolvedValue({ id: GRUPPE }) },
      projectMember: {
        findUnique: vi.fn().mockResolvedValue({ id: PM_KENNETH, periodeSlutt: AVSLUTTET }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn(),
      },
      projectGroupMember: { upsert: vi.fn().mockResolvedValue({ id: GM }) },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));

    await gruppeRouter.createCaller(ctxMed(prisma)).meldMegInn({ groupId: GRUPPE, projectId: PROSJEKT });

    expect(prisma.projectMember.create).not.toHaveBeenCalled();
    expect(prisma.projectMember.update).toHaveBeenCalledWith({
      where: { id: PM_KENNETH },
      data: { periodeSlutt: null, role: "member" },
    });
    expect(prisma.projectGroupMember.upsert.mock.calls[0]![0]).toMatchObject({
      where: { groupId_projectMemberId: { groupId: GRUPPE, projectMemberId: PM_KENNETH } },
      update: { periodeSlutt: null },
    });
  });

  it("🔴 sikreProsjektmedlemmer (ansattvelger/auto): tidligere ansatt gjenåpnes og telles som lagt til", async () => {
    const tx = {
      organizationMember: { findMany: vi.fn().mockResolvedValue([{ userId: "u-kenneth" }]) },
      projectMember: {
        findMany: vi.fn().mockResolvedValue([{ id: PM_KENNETH, userId: "u-kenneth", periodeSlutt: AVSLUTTET }]),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn(),
      },
      faggruppeKobling: { upsert: vi.fn().mockResolvedValue({}) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await sikreProsjektmedlemmer(tx as any, {
      projectId: PROSJEKT,
      organizationId: "org-1",
      userIds: ["u-kenneth"],
      faggruppeIder: ["fg-1"],
    });
    expect(res.lagtTil).toBe(1);
    expect(res.projectMemberIdByUserId.get("u-kenneth")).toBe(PM_KENNETH);
    expect(tx.projectMember.create).not.toHaveBeenCalled();
    expect(tx.projectMember.update).toHaveBeenCalledWith({
      where: { id: PM_KENNETH },
      data: { periodeSlutt: null, role: "member" },
    });
    expect(tx.faggruppeKobling.upsert.mock.calls[0]![0].update).toEqual({ periodeSlutt: null });
  });
});

describe("gruppe.fjernMedlem — myk (B8)", () => {
  it("🔴 gruppemedlemskapet avsluttes med periodeSlutt og logges, slettes ikke", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin" }) },
      projectGroupMember: {
        findFirst: vi.fn().mockResolvedValue({ groupId: GRUPPE, projectMemberId: PM_KENNETH }),
        update: vi.fn().mockResolvedValue({ id: GM }),
        delete: vi.fn(),
      },
      activity: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));

    await gruppeRouter.createCaller(ctxMed(prisma)).fjernMedlem({ id: GM, projectId: PROSJEKT });

    expect(prisma.projectGroupMember.findFirst.mock.calls[0]![0].where).toMatchObject({ id: GM, periodeSlutt: null });
    expect(prisma.projectGroupMember.delete).not.toHaveBeenCalled();
    expect(prisma.projectGroupMember.update.mock.calls[0]![0].data.periodeSlutt).toBeInstanceOf(Date);
    expect(prisma.activity.create.mock.calls[0]![0].data).toMatchObject({ action: "gruppemedlem_avsluttet", targetId: GM });
  });
});

describe("B6 — medlemslista skjuler tidligere medlemmer som standard", () => {
  function prismaForListe() {
    return {
      project: { findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: null }) },
      projectMember: { findMany: vi.fn().mockResolvedValue([]) },
    };
  }

  it("🔴 uten bryter → bare aktive", async () => {
    const prisma = prismaForListe();
    await medlemRouter.createCaller(ctxMed(prisma)).hentForProsjekt({ projectId: PROSJEKT });
    expect(prisma.projectMember.findMany.mock.calls[0]![0].where).toEqual({ projectId: PROSJEKT, periodeSlutt: null });
  });

  it("🔴 «Vis tidligere medlemmer» → avsluttede er med", async () => {
    const prisma = prismaForListe();
    await medlemRouter.createCaller(ctxMed(prisma)).hentForProsjekt({ projectId: PROSJEKT, inkluderTidligere: true });
    expect(prisma.projectMember.findMany.mock.calls[0]![0].where).toEqual({ projectId: PROSJEKT });
  });
});

describe("e-post når til aktive gruppemedlemmer", () => {
  it("🔴 fjernet fra gruppen eller prosjektet → ingen e-post", async () => {
    const rader = [
      { periodeSlutt: null, pmSlutt: null, email: "aktiv@x.no" },
      { periodeSlutt: AVSLUTTET, pmSlutt: null, email: "ute-av-gruppa@x.no" },
      { periodeSlutt: null, pmSlutt: AVSLUTTET, email: "ute-av-prosjektet@x.no" },
    ];
    const prisma = {
      projectGroupMember: {
        // Som Prisma: periodefilteret gjelder bare når `where` ber om det.
        findMany: vi.fn(async ({ where }: { where: Where & { projectMember?: Where } }) =>
          rader
            .filter((r) => !("periodeSlutt" in where) || r.periodeSlutt === null)
            .filter((r) => !(where.projectMember && "periodeSlutt" in where.projectMember) || r.pmSlutt === null)
            .map((r) => ({ projectMember: { user: { id: r.email, email: r.email } } })),
        ),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eposter = await hentMottakerEposter(prisma as any, { recipientGroupId: GRUPPE, ekskluderUserId: "admin-1" });
    expect(eposter).toEqual(["aktiv@x.no"]);
  });
});

describe("M6 — medlem.*-mutasjoner er bundet til prosjektet i input", () => {
  const ANNET_PM = "12121212-1212-4212-8212-121212121212"; // medlem i et annet prosjekt
  const FG_EGEN = "34343434-3434-4434-8434-343434343434";
  const FG_ANNET = "56565656-5656-4656-8656-565656565656";
  /** Som Prisma: en rad treffes bare når `projectId` i `where` er radens prosjekt. */
  function prismaForM6() {
    const iProsjekt = (where: { id: { in: string[] }; projectId: string }, egne: string[]) =>
      where.projectId === PROSJEKT ? where.id.in.filter((id) => egne.includes(id)).length : 0;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin" }), update: vi.fn() },
      projectMember: {
        // Kenneth i PROSJEKT, ANNET_PM i et annet; prosjektfilteret gjelder bare når `where` ber om det.
        findFirst: vi.fn(async ({ where }: { where: Where }) => {
          const rad = [
            { id: PM_KENNETH, userId: "u-kenneth", projectId: PROSJEKT },
            { id: ANNET_PM, userId: "u-annet", projectId: "annet-prosjekt" },
          ].find((r) => r.id === where.id && (!("projectId" in where) || r.projectId === where.projectId));
          return rad ? { id: rad.id, userId: rad.userId } : null;
        }),
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          userId: where.id === ANNET_PM ? "u-annet" : "u-kenneth",
          user: { id: "u-x", name: "X", email: "x@x.no" },
        })),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Where }) => ({ id: where.id, ...data })),
      },
      faggruppe: { count: vi.fn(async ({ where }: { where: never }) => iProsjekt(where, [FG_EGEN])) },
      projectGroup: { count: vi.fn(async ({ where }: { where: never }) => iProsjekt(where, [])) },
      dokumentflyt: { count: vi.fn(async ({ where }: { where: never }) => iProsjekt(where, [])) },
      faggruppeKobling: {
        // Koblingen til FG_ANNET finnes på medlemmet, men faggruppen ligger i et annet prosjekt.
        findFirst: vi.fn(async ({ where }: { where: Where & { faggruppe?: Where } }) =>
          where.faggruppeId === FG_ANNET && where.faggruppe?.projectId === PROSJEKT ? null : { id: "fk-1", periodeSlutt: null },
        ),
        update: vi.fn(),
        create: vi.fn(),
      },
      activity: { create: vi.fn() },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    return prisma;
  }
  const NOT_FOUND = expect.objectContaining({ code: "NOT_FOUND" });

  it("🔴 oppdater, oppdaterRolle, settFirmaansvarlig, settKanAttestere med medlem fra et annet prosjekt → NOT_FOUND, ingenting skrives", async () => {
    const prisma = prismaForM6();
    const m = medlemRouter.createCaller(ctxMed(prisma));
    const id = ANNET_PM;
    await expect(m.oppdater({ id, projectId: PROSJEKT, name: "Kapret" })).rejects.toEqual(NOT_FOUND);
    await expect(m.oppdaterRolle({ id, projectId: PROSJEKT, role: "admin" })).rejects.toEqual(NOT_FOUND);
    await expect(m.settFirmaansvarlig({ id, projectId: PROSJEKT, erFirmaansvarlig: true })).rejects.toEqual(NOT_FOUND);
    await expect(m.settKanAttestere({ id, projectId: PROSJEKT, kanAttestere: true })).rejects.toEqual(NOT_FOUND);
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("samme kall med medlem i prosjektet går gjennom (porten slipper riktige kall)", async () => {
    const prisma = prismaForM6();
    const m = medlemRouter.createCaller(ctxMed(prisma));
    await m.oppdaterRolle({ id: PM_KENNETH, projectId: PROSJEKT, role: "admin" });
    await m.settKanAttestere({ id: PM_KENNETH, projectId: PROSJEKT, kanAttestere: true });
    expect(prisma.projectMember.update).toHaveBeenCalledTimes(2);
  });

  it("🔴 leggTilFaggruppe: medlem eller faggruppe fra et annet prosjekt → NOT_FOUND", async () => {
    const prisma = prismaForM6();
    const m = medlemRouter.createCaller(ctxMed(prisma));
    await expect(m.leggTilFaggruppe({ projectMemberId: ANNET_PM, faggruppeId: FG_EGEN, projectId: PROSJEKT })).rejects.toEqual(NOT_FOUND);
    await expect(m.leggTilFaggruppe({ projectMemberId: PM_KENNETH, faggruppeId: FG_ANNET, projectId: PROSJEKT })).rejects.toEqual(NOT_FOUND);
    expect(prisma.faggruppeKobling.create).not.toHaveBeenCalled();
    expect(prisma.faggruppeKobling.update).not.toHaveBeenCalled();
  });

  it("🔴 fjernFraFaggruppe: faggruppe fra et annet prosjekt → NOT_FOUND", async () => {
    const prisma = prismaForM6();
    await expect(
      medlemRouter.createCaller(ctxMed(prisma)).fjernFraFaggruppe({ projectMemberId: PM_KENNETH, faggruppeId: FG_ANNET, projectId: PROSJEKT }),
    ).rejects.toEqual(NOT_FOUND);
    expect(prisma.faggruppeKobling.update).not.toHaveBeenCalled();
  });

  // Flyt og gruppe har eget kryss-prosjekt-vern i registrer (medlem-registrer.test.ts).
  it("🔴 registrer: faggruppe fra et annet prosjekt → NOT_FOUND før noe opprettes", async () => {
    const prisma = prismaForM6();
    await expect(
      medlemRouter.createCaller(ctxMed(prisma)).registrer({
        projectId: PROSJEKT, email: "ny@x.no", firstName: "Ny", lastName: "Person", faggruppeIder: [FG_ANNET],
      }),
    ).rejects.toEqual(NOT_FOUND);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
