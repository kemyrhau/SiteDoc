import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Filter i mobilens HMS-liste (filter-hms 2026-11-03): `hms.hentDokumenter` må sende
 * emne, tegningsnavn og utførende faggruppe for alle tre faner, og prioritet for
 * avvik/RUH (Task). Mobilen bygger filterarket fra disse feltene; mangler de, skjules
 * filtrene stille. Låser selecten som går til Prisma.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: prismaMock,
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

import { hmsRouter } from "./hms";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";

function lagCtx() {
  const taskFindMany = vi.fn().mockResolvedValue([]);
  const checklistFindMany = vi.fn().mockResolvedValue([]);
  const ctx = {
    userId: "bruker-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: { task: { findMany: taskFindMany }, checklist: { findMany: checklistFindMany } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, taskFindMany, checklistFindMany };
}

beforeEach(() => {
  vi.clearAllMocks();
  // sitedoc_admin → ingen synlighetsfilter (ortogonalt til selecten).
  prismaMock.user.findUnique.mockResolvedValue({ role: "sitedoc_admin" });
});

describe("hms.hentDokumenter — filterfelt", () => {
  it("avvik og RUH (Task) sender emne, prioritet, tegningsnavn og utførende faggruppe", async () => {
    const { ctx, taskFindMany } = lagCtx();
    await hmsRouter.createCaller(ctx).hentDokumenter({ projectId: PROSJEKT });
    expect(taskFindMany).toHaveBeenCalledTimes(2);
    for (const [arg] of taskFindMany.mock.calls) {
      expect(arg.select).toMatchObject({
        subject: true,
        priority: true,
        drawing: { select: { byggeplassId: true, name: true } },
        utforerFaggruppe: { select: { name: true } },
      });
    }
  });

  it("SJA (Checklist) sender emne, tegningsnavn og utførende faggruppe", async () => {
    const { ctx, checklistFindMany } = lagCtx();
    await hmsRouter.createCaller(ctx).hentDokumenter({ projectId: PROSJEKT });
    expect(checklistFindMany).toHaveBeenCalledTimes(1);
    expect(checklistFindMany.mock.calls[0]?.[0].select).toMatchObject({
      subject: true,
      drawing: { select: { name: true } },
      utforerFaggruppe: { select: { name: true } },
    });
  });
});
