import { describe, it, expect, vi } from "vitest";

/**
 * Tegningsvakt i sjekkliste.oppdater etter ORDRE 20: vakten sjekker tegningens EGEN
 * `projectId`. Funksjonsendring (Kenneth-hjemmel A, 2026-11-06): en løs tegning (uten
 * byggeplass) i eget prosjekt godtas nå — før ble den avvist. Fremmed prosjekt avvises
 * fortsatt før skriving. Vakten kjører ekte; kun tilgangskontroll og prisma er mocket.
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => {
  const ekte = await importOriginal<Record<string, unknown>>();
  const mock: Record<string, unknown> = {};
  for (const navn of Object.keys(ekte)) mock[navn] = vi.fn().mockResolvedValue(undefined);
  return mock;
});

import { sjekklisteRouter } from "./sjekkliste";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const SJEKKLISTE = "11111111-1111-1111-1111-111111111111";
const TEGNING = "33333333-3333-3333-3333-333333333333";

function lagCtx(tegningProsjekt: string | null) {
  const checklistUpdate = vi.fn().mockResolvedValue({ id: SJEKKLISTE });
  const drawingFindUnique = vi
    .fn()
    .mockResolvedValue(tegningProsjekt ? { projectId: tegningProsjekt } : null);
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      drawing: { findUnique: drawingFindUnique },
      checklist: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: SJEKKLISTE,
          status: "draft",
          bestillerFaggruppeId: "bf",
          utforerFaggruppeId: "uf",
          template: { projectId: PROSJEKT, domain: "bygg" },
          kontrollplanPunkt: null,
          lokasjonOmfang: null,
          omradeId: null,
        }),
        update: checklistUpdate,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, checklistUpdate, drawingFindUnique };
}

describe("sjekkliste.oppdater — tegningsvakt (drawing.projectId)", () => {
  it("FUNKSJONSENDRING: løs tegning (uten byggeplass) i samme prosjekt → lagres", async () => {
    const { ctx, checklistUpdate } = lagCtx(PROSJEKT);
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, drawingId: TEGNING });
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });

  it("tegning i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, checklistUpdate } = lagCtx(FREMMED);
    await expect(
      sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, drawingId: TEGNING }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Tegningen hører til et annet prosjekt." });
    expect(checklistUpdate).not.toHaveBeenCalled();
  });

  it("drawingId null → lagres uten tegningsoppslag", async () => {
    const { ctx, checklistUpdate, drawingFindUnique } = lagCtx(null);
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, drawingId: null });
    expect(drawingFindUnique).not.toHaveBeenCalled();
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });
});
