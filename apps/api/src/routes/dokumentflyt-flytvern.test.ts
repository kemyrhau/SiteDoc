import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * D — ledd-vern på fjernMedlem + oppdaterRoller (en flyt med aktive dokumenter kan ikke tømmes for
 * ledd; samme skade som å slette den) og E — registrator må stå i første ledd ved lagring.
 * Kenneth-vedtak 2026-08-22. Kjører de EKTE prosedyrene; verifiserAdmin passerer via sitedoc_admin.
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
const MEDLEM = "cccccccc-cccc-cccc-cccc-cccccccccccc";

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

function prismaMed(opts: { docs?: number; eksisterendeRoller?: Array<{ rolle: string }>; medlemFlytId?: string }) {
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
      findUniqueOrThrow: vi.fn().mockResolvedValue({ dokumentflytId: opts.medlemFlytId ?? FLYT }),
      deleteMany: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ id: MEDLEM }),
    },
  };
}

describe("D — ledd-vern (fjernMedlem)", () => {
  it("flyt med aktive dokumenter → BAD_REQUEST, medlemmet IKKE fjernet", async () => {
    const prisma = prismaMed({ docs: 2 });
    await expect(
      lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflytMedlem.delete).not.toHaveBeenCalled();
  });

  it("tom flyt → medlemmet fjernes", async () => {
    const prisma = prismaMed({ docs: 0 });
    await lagCaller(prisma).fjernMedlem({ id: MEDLEM, projectId: PROSJEKT });
    expect(prisma.dokumentflytMedlem.delete).toHaveBeenCalledWith({ where: { id: MEDLEM } });
  });
});

describe("D — ledd-vern (oppdaterRoller)", () => {
  it("FJERNER en rolle mens flyten har dokumenter → BAD_REQUEST", async () => {
    // Eksisterende: [registrator, godkjenner]; ny: [registrator] → godkjenner fjernes.
    const prisma = prismaMed({ docs: 3, eksisterendeRoller: [{ rolle: "registrator" }, { rolle: "godkjenner" }] });
    await expect(
      lagCaller(prisma).oppdaterRoller({ id: FLYT, projectId: PROSJEKT, roller: [{ rolle: "registrator" }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflytMedlem.deleteMany).not.toHaveBeenCalled();
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
