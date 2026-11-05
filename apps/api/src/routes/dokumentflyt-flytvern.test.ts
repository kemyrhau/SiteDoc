import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * D — ledd-vern på oppdaterRoller (et ledd som forsvinner med åpne dokumenter på seg kan ikke
 * fjernes; B2 2026-11-05: teller bare åpne dokumenter på stegene) og E — registrator må stå i første
 * ledd ved lagring. Kenneth-vedtak 2026-08-22. Person-fjerning har ingen sperre lenger (B1) — dekket
 * i dokumentflyt-myk-fjerning.test.ts. Kjører de EKTE prosedyrene; verifiserAdmin passerer via
 * sitedoc_admin.
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

beforeEach(() => {
  userFindUnique.mockReset();
  memberFindUnique.mockReset();
  orgFindMany.mockReset();
  orgMemberFindUnique.mockReset();
  // Admin-gaten passerer: sitedoc_admin returnerer tidlig i verifiserAdmin.
  userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lagCaller(prisma: any) {
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

function prismaMed(opts: { docs?: number; eksisterendeRoller?: Array<{ rolle: string }> }) {
  const docs = opts.docs ?? 0;
  return {
    checklist: { count: vi.fn().mockResolvedValue(docs) },
    task: { count: vi.fn().mockResolvedValue(0) }, // sjekkliste-tallet bærer testene
    dokumentflyt: {
      create: vi.fn().mockResolvedValue({ id: FLYT }),
      update: vi.fn().mockResolvedValue({ id: FLYT }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ roller: opts.eksisterendeRoller ?? [] }),
    },
    dokumentflytMedlem: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("D — ledd-vern (oppdaterRoller)", () => {
  it("FJERNER en rolle med åpne dokumenter på steget → BAD_REQUEST, ingen avslutning", async () => {
    // Eksisterende: [registrator, godkjenner]; ny: [registrator] → godkjenner (steg 2) fjernes.
    const prisma = prismaMed({ docs: 3, eksisterendeRoller: [{ rolle: "registrator" }, { rolle: "godkjenner" }] });
    await expect(
      lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "registrator" }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflytMedlem.updateMany).not.toHaveBeenCalled();
    expect(prisma.dokumentflytMedlem.deleteMany).not.toHaveBeenCalled();
  });

  it("🔴 B2: tellingen gjelder ÅPNE dokumenter på det fjernede steget, ikke hele flyten", async () => {
    const prisma = prismaMed({ docs: 0, eksisterendeRoller: [{ rolle: "registrator" }, { rolle: "godkjenner" }] });
    prisma.dokumentflytMedlem.findMany.mockResolvedValue([
      { steg: 2, groupId: null, projectMember: { userId: "u-godkjenner" } },
    ]);
    await lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "registrator" }] });
    const where = prisma.checklist.count.mock.calls[0]![0].where;
    expect(where.dokumentflytId).toBe(FLYT);
    expect(where.status).toEqual({ notIn: ["closed", "approved", "cancelled"] });
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toContainEqual({ aktivPosisjon: { in: [2] } });
    expect(where.OR).toContainEqual({ aktivPosisjon: null, recipientUserId: { in: ["u-godkjenner"] } });
  });

  it("🔴 B2: rolle uten åpne dokumenter → medlemmene avsluttes mykt (periodeSlutt), ikke slettet", async () => {
    const prisma = prismaMed({ docs: 0, eksisterendeRoller: [{ rolle: "registrator" }, { rolle: "godkjenner" }] });
    await lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "registrator" }] });
    expect(prisma.dokumentflytMedlem.deleteMany).not.toHaveBeenCalled();
    const arg = prisma.dokumentflytMedlem.updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ dokumentflytId: FLYT, rolle: { in: ["godkjenner"] }, periodeSlutt: null });
    expect(arg.data.periodeSlutt).toBeInstanceOf(Date);
  });

  it("LEGGER TIL en rolle (ingen fjerning) med dokumenter → tillatt", async () => {
    const prisma = prismaMed({ docs: 3, eksisterendeRoller: [{ rolle: "registrator" }] });
    await lagCaller(prisma).oppdaterRoller({
      id: FLYT,
      projectId: PROSJEKT,
      roller: [{ rolle: "registrator" }, { rolle: "bestiller" }],
    });
    expect(prisma.dokumentflyt.update).toHaveBeenCalled();
  });
});

describe("E — registrator i første ledd", () => {
  it("opprett med Godkjenner først → BAD_REQUEST", async () => {
    const prisma = prismaMed({});
    await expect(
      lagCaller(prisma).opprett({ projectId: PROSJEKT, name: "F", roller: [{ rolle: "godkjenner" }, { rolle: "registrator" }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflyt.create).not.toHaveBeenCalled();
  });

  it("opprett uten roller → default registrator-først → tillatt", async () => {
    const prisma = prismaMed({});
    await lagCaller(prisma).opprett({ projectId: PROSJEKT, name: "F" });
    expect(prisma.dokumentflyt.create).toHaveBeenCalled();
  });

  it("oppdaterRoller med Godkjenner først → BAD_REQUEST (før dokument-vakten)", async () => {
    const prisma = prismaMed({ docs: 0, eksisterendeRoller: [{ rolle: "registrator" }] });
    await expect(
      lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "godkjenner" }, { rolle: "registrator" }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("oppdaterRoller med Registrator først → tillatt", async () => {
    const prisma = prismaMed({ docs: 0, eksisterendeRoller: [{ rolle: "registrator" }] });
    await lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "registrator" }, { rolle: "bestiller" }] });
    expect(prisma.dokumentflyt.update).toHaveBeenCalled();
  });
});
