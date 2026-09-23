import { describe, it, expect, vi } from "vitest";

/**
 * mal.slettMal — «knappen skal ikke lyve» (Kenneth 2026-09-11). KontrollplanPunkt.
 * sjekklisteMalId er påkrevd uten onDelete → Prisma Restrict; uten telling kaster DB-en
 * kontrollplan_punkter_sjekkliste_mal_id_fkey rett i UI. slettMal skal telle punkter og
 * avvise med PRECONDITION_FAILED som navngir bruken. slettbarhet-query speiler tellingen.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import { malRouter } from "./mal";

const MAL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lagCtx(
  counts: { task: number; checklist: number; kurvTask: number; kurvChecklist: number; punkter: number },
  del: ReturnType<typeof vi.fn>,
) {
  // task.count kalles to ganger (IKKE_SLETTET så KUN_SLETTET) — samme for checklist.
  const taskCount = vi
    .fn()
    .mockResolvedValueOnce(counts.task)
    .mockResolvedValueOnce(counts.kurvTask);
  const checklistCount = vi
    .fn()
    .mockResolvedValueOnce(counts.checklist)
    .mockResolvedValueOnce(counts.kurvChecklist);
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      reportTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT }),
        delete: del,
      },
      task: { count: taskCount },
      checklist: { count: checklistCount },
      kontrollplanPunkt: { count: vi.fn().mockResolvedValue(counts.punkter) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const TOMT = { task: 0, checklist: 0, kurvTask: 0, kurvChecklist: 0, punkter: 0 };

describe("mal.slettMal — kontrollplan-vern", () => {
  it("mal brukt i 2 kontrollpunkter blokkeres med PRECONDITION_FAILED som navngir bruken, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = malRouter.createCaller(lagCtx({ ...TOMT, punkter: 2 }, del));
    await expect(caller.slettMal({ id: MAL })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Malen er i bruk (2 kontrollpunkter i en kontrollplan) og kan ikke slettes. Fjern punktet fra kontrollplanen først.",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("entall: 1 kontrollpunkt → «1 kontrollpunkt» (ikke «1 kontrollpunkter»)", async () => {
    const del = vi.fn();
    const caller = malRouter.createCaller(lagCtx({ ...TOMT, punkter: 1 }, del));
    await expect(caller.slettMal({ id: MAL })).rejects.toThrow(/1 kontrollpunkt i en kontrollplan/);
  });

  it("mal uten bruk slettes", async () => {
    const del = vi.fn().mockResolvedValue({ id: MAL });
    const caller = malRouter.createCaller(lagCtx(TOMT, del));
    await caller.slettMal({ id: MAL });
    expect(del).toHaveBeenCalledWith({ where: { id: MAL } });
  });

  it("slettbarhet: iKontrollplan>0 gir kanSlettes=false", async () => {
    const del = vi.fn();
    const caller = malRouter.createCaller(lagCtx({ ...TOMT, punkter: 3 }, del));
    const res = await caller.slettbarhet({ id: MAL });
    expect(res).toMatchObject({ iKontrollplan: 3, kanSlettes: false });
  });
});
