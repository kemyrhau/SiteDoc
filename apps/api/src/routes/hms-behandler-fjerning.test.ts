import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre 2026-11-05 (9) — HMS-behandler:
 * - L3: `gruppe.hentHmsAnsvarlige` tar bare med aktive ansatte; hver rad bærer firmaet som ga
 *   rollen og om innlogget bruker kan fjerne den (firma-admin i det firmaet / sitedoc_admin).
 * - Fjerning av firma-rollen (og forhåndsvisningen) krever firma-admin i firmaet — serveren avgjør.
 */

// Global prisma brukes av autoriserAdminForFirma (tilgangsvakten), ctx.prisma av rutene.
const tilgang = vi.hoisted(() => ({
  rolle: "user" as string,
  medlemskap: null as { firmaRoller: string[]; status: string } | null,
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: {
    user: { findUnique: vi.fn(() => Promise.resolve({ role: tilgang.rolle })) },
    organizationMember: { findUnique: vi.fn(() => Promise.resolve(tilgang.medlemskap)) },
  },
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
}));

import { gruppeRouter } from "./gruppe";
import { organisasjonRouter } from "./organisasjon";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const FIRMA = "aaaaaaaa-0000-4000-8000-00000000000a";
const ANNET_FIRMA = "aaaaaaaa-0000-4000-8000-00000000000b";
const MEG = "cccccccc-0000-4000-8000-00000000000c";
const AKTIV = "dddddddd-0000-4000-8000-00000000000d";
const DEAKTIVERT = "eeeeeeee-0000-4000-8000-00000000000e";

type Rad = { userId: string; organizationId: string; firmaRoller: string[]; status: string };

/** Minimal Prisma-mock som filtrerer på organizationId/userId/firmaRoller/status slik spørringen ber om. */
function lagGruppeCaller(rader: Rad[], opts: { rolle?: string } = {}) {
  const findMany = vi.fn(
    ({ where }: { where: { organizationId: { in: string[] }; userId?: string; firmaRoller: { has: string }; status?: string } }) =>
      Promise.resolve(
        rader
          .filter((r) => where.organizationId.in.includes(r.organizationId))
          .filter((r) => !where.userId || r.userId === where.userId)
          .filter((r) => r.firmaRoller.includes(where.firmaRoller.has))
          .filter((r) => !where.status || r.status === where.status)
          .map((r) => ({
            userId: r.userId,
            organizationId: r.organizationId,
            organization: { name: r.organizationId === FIRMA ? "Firma AS" : "Annet AS" },
            user: { id: r.userId, name: `Navn ${r.userId.slice(0, 4)}`, email: `${r.userId.slice(0, 4)}@x.no` },
          })),
      ),
  );
  const prisma = {
    projectOrganization: {
      findMany: vi.fn().mockResolvedValue([{ organizationId: FIRMA }, { organizationId: ANNET_FIRMA }]),
    },
    organizationMember: { findMany },
    user: { findUnique: vi.fn().mockResolvedValue({ role: opts.rolle ?? "user" }) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return gruppeRouter.createCaller({ userId: MEG, prisma } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  tilgang.rolle = "user";
  tilgang.medlemskap = null;
});

describe("ordre (9) L3 — hentHmsAnsvarlige", () => {
  it("🔴 deaktivert HMS-ansvarlig utelates", async () => {
    const svar = await lagGruppeCaller([
      { userId: AKTIV, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: DEAKTIVERT, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "deaktivert" },
    ]).hentHmsAnsvarlige({ projectId: PROSJEKT });
    expect(svar.map((r) => r.userId)).toEqual([AKTIV]);
  });

  it("raden bærer firmaet som ga rollen; ikke firma-admin → kanFjerne false", async () => {
    const [rad] = await lagGruppeCaller([
      { userId: AKTIV, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
    ]).hentHmsAnsvarlige({ projectId: PROSJEKT });
    expect(rad).toMatchObject({ organizationId: FIRMA, organisasjonNavn: "Firma AS", kanFjerne: false });
  });

  it("firma-admin i firmaet som ga rollen → kanFjerne true; admin i et annet firma gir det ikke", async () => {
    const svar = await lagGruppeCaller([
      { userId: AKTIV, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: DEAKTIVERT, organizationId: ANNET_FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: MEG, organizationId: FIRMA, firmaRoller: ["firma_admin"], status: "aktiv" },
    ]).hentHmsAnsvarlige({ projectId: PROSJEKT });
    expect(svar.find((r) => r.userId === AKTIV)?.kanFjerne).toBe(true);
    expect(svar.find((r) => r.userId === DEAKTIVERT)?.kanFjerne).toBe(false);
  });

  it("🔴 deaktivert firma-admin → kanFjerne false", async () => {
    const [rad] = await lagGruppeCaller([
      { userId: AKTIV, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: MEG, organizationId: FIRMA, firmaRoller: ["firma_admin"], status: "deaktivert" },
    ]).hentHmsAnsvarlige({ projectId: PROSJEKT });
    expect(rad?.kanFjerne).toBe(false);
  });

  it("samme person i to firma → én rad, den med fjern-valg vinner", async () => {
    const svar = await lagGruppeCaller([
      { userId: AKTIV, organizationId: ANNET_FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: AKTIV, organizationId: FIRMA, firmaRoller: ["hms_ansvarlig"], status: "aktiv" },
      { userId: MEG, organizationId: FIRMA, firmaRoller: ["firma_admin"], status: "aktiv" },
    ]).hentHmsAnsvarlige({ projectId: PROSJEKT });
    expect(svar).toHaveLength(1);
    expect(svar[0]).toMatchObject({ organizationId: FIRMA, kanFjerne: true });
  });
});

const P1 = "11111111-1111-4111-8111-1111111111a1";
const P2 = "11111111-1111-4111-8111-1111111111a2";
const HMS_GRUPPE = "99999999-0000-4000-8000-000000000001";

type Sak = { id: string; status: string; recipientGroupId: string | null; template: { projectId: string } };
const sak = (id: string, projectId: string): Sak => ({
  id,
  status: "sent",
  recipientGroupId: HMS_GRUPPE,
  template: { projectId },
});

/**
 * Prisma-mock for organisasjon-ruten. `findMany` på sjekkliste/oppgave svarer med sakene databasen ville
 * gitt for utvalget (where-formen sjekkes for seg); `projectMember.findMany` gir personens medlemskap.
 */
function orgCaller(
  opts: {
    sjekklister?: Sak[];
    oppgaver?: Sak[];
    medlemskap?: { projectId: string; role: string; groupMemberships: { group: { domains: string[] } }[] }[];
  } = {},
) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    organizationMember: {
      findUnique: vi.fn().mockResolvedValue({ id: "m1", firmaRoller: ["hms_ansvarlig"], user: { role: "user" } }),
      update,
    },
    checklist: { findMany: vi.fn().mockResolvedValue(opts.sjekklister ?? []), updateMany: vi.fn().mockResolvedValue({}) },
    task: { findMany: vi.fn().mockResolvedValue(opts.oppgaver ?? []), updateMany: vi.fn().mockResolvedValue({}) },
    projectMember: { findMany: vi.fn().mockResolvedValue(opts.medlemskap ?? []) },
    documentTransfer: { create: vi.fn().mockResolvedValue({}) },
    activity: { create: vi.fn().mockResolvedValue({}) },
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Admin" }) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  const caller = organisasjonRouter.createCaller({
    userId: MEG,
    prisma,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { caller, update, prisma };
}

describe("ordre (9) — fjerning av firma-rollen krever firma-admin", () => {
  const ikkeAdmin = [
    ["vanlig ansatt", { firmaRoller: ["hms_ansvarlig"], status: "aktiv" }],
    ["deaktivert firma-admin", { firmaRoller: ["firma_admin"], status: "deaktivert" }],
    ["ikke ansatt i firmaet", null],
  ] as const;

  it.each(ikkeAdmin)("🔴 %s → FORBIDDEN på fjerning, ingenting skrives", async (_navn, medlemskap) => {
    tilgang.medlemskap = medlemskap ? { ...medlemskap, firmaRoller: [...medlemskap.firmaRoller] } : null;
    const { caller, update, prisma } = orgCaller({ sjekklister: [sak("s1", P1)] });
    await expect(
      caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
    expect(prisma.checklist.updateMany).not.toHaveBeenCalled();
  });

  it.each(ikkeAdmin)("🔴 %s → FORBIDDEN på forhåndsvisning, ingenting telles", async (_navn, medlemskap) => {
    tilgang.medlemskap = medlemskap ? { ...medlemskap, firmaRoller: [...medlemskap.firmaRoller] } : null;
    const { caller, prisma } = orgCaller();
    await expect(
      caller.forhandsvisFjernHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.checklist.findMany).not.toHaveBeenCalled();
  });

  it("firma-admin → forhåndsvisning teller åpne HMS-saker personen har ballen i, i firmaets prosjekter", async () => {
    tilgang.medlemskap = { firmaRoller: ["firma_admin"], status: "aktiv" };
    const { caller, prisma } = orgCaller({ sjekklister: [sak("s1", P1), sak("s2", P1)], oppgaver: [sak("o1", P2)] });
    await expect(caller.forhandsvisFjernHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA })).resolves.toEqual({
      antallApne: 3,
    });
    const where = (prisma.checklist.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      recipientUserId: AKTIV,
      template: { domain: "hms", project: { primaryOrganizationId: FIRMA } },
      // Ballen som melder på eget dokument (utenfor Ledd 2) er ikke gitt av rollen.
      OR: [{ aktivPosisjon: 2 }, { bestillerUserId: { not: AKTIV } }],
    });
  });

  it("🔴 firma-admin, person ikke ansatt i firmaet → FORBIDDEN på forhåndsvisning", async () => {
    tilgang.medlemskap = { firmaRoller: ["firma_admin"], status: "aktiv" };
    const { caller, prisma } = orgCaller();
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await expect(
      caller.forhandsvisFjernHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.checklist.findMany).not.toHaveBeenCalled();
  });

  it("firma-admin → rollen fjernes", async () => {
    tilgang.medlemskap = { firmaRoller: ["firma_admin"], status: "aktiv" };
    const { caller, update } = orgCaller();
    await caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false });
    expect(update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { firmaRoller: [] } });
  });
});

describe("ordre (9), A — sweep når firma-rollen fjernes", () => {
  beforeEach(() => {
    tilgang.medlemskap = { firmaRoller: ["firma_admin"], status: "aktiv" };
  });

  it("🔴 (a) personen har ballen og bare firma-rollen → personpekeren null, ballen på leddet, historikk + Activity", async () => {
    const { caller, prisma } = orgCaller({ sjekklister: [sak("s1", P1)], oppgaver: [sak("o1", P1)] });
    await caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.checklist.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] } }, data: { recipientUserId: null } });
    expect(prisma.task.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["o1"] } }, data: { recipientUserId: null } });
    // Bare personpekeren nullstilles — leddet (aktivPosisjon) og HMS-gruppa røres ikke.
    for (const kall of [...prisma.checklist.updateMany.mock.calls, ...prisma.task.updateMany.mock.calls]) {
      expect(Object.keys((kall[0] as { data: object }).data)).toEqual(["recipientUserId"]);
    }
    expect(prisma.documentTransfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checklistId: "s1",
        senderId: MEG,
        recipientUserId: null,
        recipientGroupId: HMS_GRUPPE,
        fromStatus: "sent",
        toStatus: "sent",
        comment: expect.stringContaining("HMS-ansvarlig-rollen er fjernet"),
      }),
    });
    expect(prisma.documentTransfer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ taskId: "o1" }) });
    expect(prisma.activity.create).toHaveBeenCalledTimes(1);
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: P1,
        actorUserId: MEG,
        targetType: "hms_ansvarlig",
        targetId: AKTIV,
        action: "hms_ansvarlig_fjernet",
        payload: { organizationId: FIRMA, sjekklister: ["s1"], oppgaver: ["o1"] },
      }),
    });
  });

  it.each([
    ["prosjekt-admin", { role: "admin", groupMemberships: [] }],
    ["aktivt medlem av en HMS-gruppe", { role: "member", groupMemberships: [{ group: { domains: ["hms"] } }] }],
  ])("🔴 (b) %s i prosjektet beholder ballen der", async (_navn, m) => {
    const { caller, prisma } = orgCaller({
      sjekklister: [sak("s1", P1), sak("s2", P2)],
      medlemskap: [
        { projectId: P1, ...m },
        { projectId: P2, role: "member", groupMemberships: [{ group: { domains: ["bygg"] } }] },
      ],
    });
    await caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false });
    expect(prisma.checklist.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s2"] } }, data: { recipientUserId: null } });
    expect(prisma.documentTransfer.create).toHaveBeenCalledTimes(1);
    expect(prisma.activity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ projectId: P2 }) });
    expect(prisma.activity.create).not.toHaveBeenCalledWith({ data: expect.objectContaining({ projectId: P1 }) });
    // Medlemskapet som avgjør er det aktive.
    expect(prisma.projectMember.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: AKTIV, periodeSlutt: null },
    });
  });

  it("🔴 (c) antallet i forhåndsvisningen = antallet sweepen treffer", async () => {
    const data = {
      sjekklister: [sak("s1", P1), sak("s2", P2), sak("s3", P2)],
      oppgaver: [sak("o1", P1), sak("o2", P2)],
      medlemskap: [{ projectId: P1, role: "admin", groupMemberships: [] }],
    };
    const forhånd = orgCaller(data);
    const { antallApne } = await forhånd.caller.forhandsvisFjernHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA });

    const sweep = orgCaller(data);
    await sweep.caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false });
    const flyttet = [...sweep.prisma.checklist.updateMany.mock.calls, ...sweep.prisma.task.updateMany.mock.calls]
      .flatMap((k) => (k[0] as { where: { id: { in: string[] } } }).where.id.in);

    expect(antallApne).toBe(3);
    expect(flyttet).toHaveLength(antallApne);
    expect(sweep.prisma.documentTransfer.create).toHaveBeenCalledTimes(antallApne);
    // Samme utvalg i begge kall.
    expect(sweep.prisma.checklist.findMany.mock.calls[0]).toEqual(forhånd.prisma.checklist.findMany.mock.calls[0]);
    expect(sweep.prisma.task.findMany.mock.calls[0]).toEqual(forhånd.prisma.task.findMany.mock.calls[0]);
  });

  it("ingen åpne saker → bare rollen fjernes, ingen historikk eller Activity", async () => {
    const { caller, prisma, update } = orgCaller();
    await caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: false });
    expect(update).toHaveBeenCalled();
    expect(prisma.checklist.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentTransfer.create).not.toHaveBeenCalled();
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it("rollen gis → ingen sweep", async () => {
    const { caller, prisma } = orgCaller({ sjekklister: [sak("s1", P1)] });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: "m1", firmaRoller: [], user: { role: "user" } });
    await caller.settFirmaHmsAnsvarlig({ userId: AKTIV, organizationId: FIRMA, harTilgang: true });
    expect(prisma.checklist.findMany).not.toHaveBeenCalled();
  });
});
