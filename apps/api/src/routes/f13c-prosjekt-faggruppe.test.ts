import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F13c (Kenneth 2026-11-23) — nytt prosjekt, faggrupper og dokumentflyt.
 *
 *  - 1A: sitedoc_admin som oppretter for et annet firma enn sitt eget blir ikke medlem
 *    (verken via admin.opprettProsjekt, prosjekt.opprett eller opprettTestprosjekt).
 *    Eget firma = som før. Tilgangen etterpå går via bypass, ikke medlemskap.
 *  - 2A: siste aktive prosjektadmin kan ikke fjernes med medlem.fjern.
 *  - B:  faggruppe.slett sperrer når faggruppen står som ledd i en flyt, og sier hvilke.
 *
 * Kjører de ekte prosedyrene mot en mock-klient. Seed/autoadmin/provisjonering er stubbet —
 * de dekkes av egne tester (prosjektSeed.test.ts).
 *
 * Kjør: cd apps/api && npx vitest run src/routes/f13c-prosjekt-faggruppe.test.ts
 */

const ansatt = vi.hoisted(() => ({ erAnsatt: false }));

vi.mock("@sitedoc/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sitedoc/db")>()),
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
    projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  erAnsattIFirma: vi.fn(async () => ansatt.erAnsatt),
  hentBrukersOrg: vi.fn().mockResolvedValue(null),
  kanOppretteProsjekt: vi.fn().mockResolvedValue(true),
}));
vi.mock("../services/prosjektSeed", () => ({ seedStandardProsjektoppsett: vi.fn() }));
vi.mock("../services/autoProsjektAdmin", () => ({ autoLeggFirmaAdmins: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerProsjektmedlemskap: vi.fn() }));
vi.mock("../services/firmamodul", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/firmamodul")>()),
  hentAktiveFirmamoduler: vi.fn().mockResolvedValue([]),
}));

import { adminRouter } from "./admin";
import { prosjektRouter } from "./prosjekt";
import { medlemRouter } from "./medlem";
import { faggruppeRouter } from "./faggruppe";
import { verifiserAdmin, verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { seedStandardProsjektoppsett } from "../services/prosjektSeed";

const KUNDEFIRMA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PM_ADMIN = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FAGGRUPPE = "ffffffff-ffff-ffff-ffff-ffffffffffff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxMed(prisma: any, userId = "sitedoc-admin-1") {
  return {
    userId,
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

function prismaForOpprett() {
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: "sitedoc_admin", name: "Admin" }) },
    project: {
      count: vi.fn().mockResolvedValue(2),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: PROSJEKT, ...data })),
    },
    projectOrganization: { create: vi.fn() },
    projectModule: { createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
}

const opprettData = (p: ReturnType<typeof prismaForOpprett>) =>
  p.project.create.mock.calls[0]![0].data as Record<string, unknown>;

describe("F13c 1A — oppretteren legges ikke inn ved annet firma", () => {
  beforeEach(() => {
    ansatt.erAnsatt = false;
    vi.mocked(seedStandardProsjektoppsett).mockClear();
  });

  it("🔴 admin.opprettProsjekt for kundefirma: ingen ProjectMember for sitedoc_admin", async () => {
    const prisma = prismaForOpprett();
    await adminRouter.createCaller(ctxMed(prisma)).opprettProsjekt({ name: "Prosessanlegg", organizationId: KUNDEFIRMA });
    expect(opprettData(prisma)).not.toHaveProperty("members");
    // Seeden får fortsatt bruker-ID, men finner ikke noe medlem → ingen Byggherre-kobling (prosjektSeed.test.ts).
    expect(seedStandardProsjektoppsett).toHaveBeenCalledOnce();
  });

  it("🔴 prosjekt.opprett for kundefirma: ingen ProjectMember", async () => {
    const prisma = prismaForOpprett();
    await prosjektRouter.createCaller(ctxMed(prisma)).opprett({ name: "Prosessanlegg", organizationId: KUNDEFIRMA });
    expect(opprettData(prisma)).not.toHaveProperty("members");
  });

  it("🔴 prosjekt.opprettTestprosjekt for kundefirma: ingen ProjectMember", async () => {
    const prisma = prismaForOpprett();
    await prosjektRouter.createCaller(ctxMed(prisma)).opprettTestprosjekt({ organizationId: KUNDEFIRMA });
    expect(opprettData(prisma)).not.toHaveProperty("members");
  });

  it("eget firma (aktiv ansatt): oppretteren blir admin som før", async () => {
    ansatt.erAnsatt = true;
    for (const kall of [
      (p: ReturnType<typeof prismaForOpprett>) =>
        adminRouter.createCaller(ctxMed(p)).opprettProsjekt({ name: "Eget", organizationId: KUNDEFIRMA }),
      (p: ReturnType<typeof prismaForOpprett>) =>
        prosjektRouter.createCaller(ctxMed(p)).opprett({ name: "Eget", organizationId: KUNDEFIRMA }),
    ]) {
      const prisma = prismaForOpprett();
      await kall(prisma);
      expect(opprettData(prisma).members).toEqual({ create: { userId: "sitedoc-admin-1", role: "admin" } });
    }
  });

  it("sitedoc_admin har fortsatt admin- og medlemstilgang uten medlemskap (bypass)", async () => {
    // @sitedoc/db-mocken: rolle sitedoc_admin, ingen ProjectMember-rad.
    await expect(verifiserAdmin("sitedoc-admin-1", PROSJEKT)).resolves.toBeUndefined();
    await expect(verifiserProsjektmedlem("sitedoc-admin-1", PROSJEKT)).resolves.toBeUndefined();
  });
});

describe("F13c 2A — siste admin kan ikke fjernes", () => {
  function prismaForFjern(andreAdmins: number) {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin", role: "sitedoc_admin" }) },
      projectMember: {
        findFirst: vi.fn().mockResolvedValue({ id: PM_ADMIN, userId: "u-1", role: "admin" }),
        count: vi.fn().mockResolvedValue(andreAdmins),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data })),
      },
      dokumentflytMedlem: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      faggruppeKobling: { updateMany: vi.fn() },
      projectGroupMember: { updateMany: vi.fn() },
      checklist: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      task: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      activity: { create: vi.fn() },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    return prisma;
  }

  it("🔴 siste aktive admin → PRECONDITION_FAILED, raden avsluttes ikke", async () => {
    const prisma = prismaForFjern(0);
    await expect(
      medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_ADMIN, projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("siste admin") });
    expect(prisma.projectMember.update).not.toHaveBeenCalled();
  });

  it("med en annen aktiv admin fjernes adminen (myk avslutning)", async () => {
    const prisma = prismaForFjern(1);
    await medlemRouter.createCaller(ctxMed(prisma)).fjern({ id: PM_ADMIN, projectId: PROSJEKT });
    const tellKall = prisma.projectMember.count.mock.calls[0]![0];
    expect(tellKall.where).toMatchObject({ projectId: PROSJEKT, role: "admin", id: { not: PM_ADMIN }, periodeSlutt: null });
    expect(prisma.projectMember.update.mock.calls[0]![0].data.periodeSlutt).toBeInstanceOf(Date);
  });
});

describe("F13c B — faggruppe.slett sperrer når faggruppen står i en flyt", () => {
  function prismaForSlett(o: { ledd: string[]; eide?: string[]; medlemmer?: number }) {
    return {
      faggruppe: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT, name: "Elektro" }),
        delete: vi.fn().mockResolvedValue({ id: FAGGRUPPE }),
      },
      checklist: { count: vi.fn().mockResolvedValue(0) },
      task: { count: vi.fn().mockResolvedValue(0) },
      faggruppeKobling: { count: vi.fn().mockResolvedValue(o.medlemmer ?? 0) },
      dokumentflyt: { findMany: vi.fn().mockResolvedValue((o.eide ?? []).map((name) => ({ name }))) },
      dokumentflytMedlem: {
        findMany: vi.fn().mockResolvedValue(o.ledd.map((name) => ({ dokumentflyt: { name } }))),
      },
    };
  }

  it("🔴 faggruppe uten medlemmer men som ledd i flyter → avvist med flytnavnene, ingen sletting", async () => {
    const prisma = prismaForSlett({ ledd: ["HMS-avvik", "Byggherre → Elektro", "HMS-avvik"] });
    await expect(
      faggruppeRouter.createCaller(ctxMed(prisma)).slett({ id: FAGGRUPPE }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Kan ikke slette «Elektro» fordi den står i dokumentflytene «Byggherre → Elektro», «HMS-avvik». Fjern dem fra faggruppen og flytene først.",
    });
    expect(prisma.faggruppe.delete).not.toHaveBeenCalled();
    // Bare aktive ledd teller.
    expect(prisma.dokumentflytMedlem.findMany.mock.calls[0]![0].where).toEqual({ faggruppeId: FAGGRUPPE, periodeSlutt: null });
  });

  it("medlemmer og eid flyt nevnes begge", async () => {
    const prisma = prismaForSlett({ ledd: [], eide: ["Elektro rapporterer"], medlemmer: 2 });
    await expect(
      faggruppeRouter.createCaller(ctxMed(prisma)).slett({ id: FAGGRUPPE }),
    ).rejects.toMatchObject({
      message: "Kan ikke slette «Elektro» fordi den har 2 medlemmer og den står i dokumentflyten «Elektro rapporterer». Fjern dem fra faggruppen og flytene først.",
    });
  });

  it("faggruppe uten medlemmer, flyter eller ledd slettes", async () => {
    const prisma = prismaForSlett({ ledd: [] });
    await faggruppeRouter.createCaller(ctxMed(prisma)).slett({ id: FAGGRUPPE });
    expect(prisma.faggruppe.delete).toHaveBeenCalledWith({ where: { id: FAGGRUPPE } });
  });
});
