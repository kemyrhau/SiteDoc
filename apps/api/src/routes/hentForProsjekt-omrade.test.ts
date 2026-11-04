import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Metadata S-pakke B-1: `sjekkliste.hentForProsjekt` og `oppgave.hentForProsjekt` må sende
 * `include.omrade` til Prisma. Web-kolonnen «Område» og mobilfilteret bygges fra feltet;
 * mangler det, skjules filteret stille (gammelt-API-regelen). Låser includen i begge rutene.
 */

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

import { sjekklisteRouter } from "./sjekkliste";
import { oppgaveRouter } from "./oppgave";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const OMRADE_INCLUDE = { omrade: { select: { id: true, navn: true, type: true } } };

function lagCtx() {
  const taskFindMany = vi.fn().mockResolvedValue([]);
  const checklistFindMany = vi.fn().mockResolvedValue([]);
  const ctx = {
    userId: "bruker-1",
    prisma: { task: { findMany: taskFindMany }, checklist: { findMany: checklistFindMany } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, taskFindMany, checklistFindMany };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hentForProsjekt — include.omrade (B-1)", () => {
  it("sjekkliste sender omrade-include til findMany", async () => {
    const { ctx, checklistFindMany } = lagCtx();
    await sjekklisteRouter.createCaller(ctx).hentForProsjekt({ projectId: PROSJEKT });
    expect(checklistFindMany).toHaveBeenCalledTimes(1);
    expect(checklistFindMany.mock.calls[0]![0].include).toMatchObject(OMRADE_INCLUDE);
  });

  it("oppgave sender omrade-include til findMany", async () => {
    const { ctx, taskFindMany } = lagCtx();
    await oppgaveRouter.createCaller(ctx).hentForProsjekt({ projectId: PROSJEKT });
    expect(taskFindMany).toHaveBeenCalledTimes(1);
    expect(taskFindMany.mock.calls[0]![0].include).toMatchObject(OMRADE_INCLUDE);
  });
});
