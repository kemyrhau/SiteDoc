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

// ── ORDRE 21: sjekkliste.opprett + byggeplass-vakt ────────────────────────────

const BYGGEPLASS = "44444444-4444-4444-4444-444444444444";
const MAL = "22222222-2222-2222-2222-222222222222";
/** Sentinel fra tx.checklist.create (tRPC pakker den inn, meldingen består): kallet nådde skriving. */
const NÅDDE_SKRIVING = "NÅDDE_SKRIVING";

/**
 * opprett via HMS-grenen (færrest forutsetninger). $transaction kjører tilbakekallet med en
 * tx-mock; vaktene får tx og leser drawing/byggeplass derfra. `checklist.create` kaster
 * sentinel — beviser at vaktene slapp kallet gjennom til skrivingen.
 */
function lagOpprettCtx(opts: {
  tegningProsjekt?: string | null;
  byggeplassProsjekt?: string | null;
  omradeProsjekt?: string | null;
}) {
  const create = vi.fn().mockRejectedValue(new Error(NÅDDE_SKRIVING));
  const drawingFindUnique = vi
    .fn()
    .mockResolvedValue(opts.tegningProsjekt ? { projectId: opts.tegningProsjekt } : null);
  const byggeplassFindUnique = vi
    .fn()
    .mockResolvedValue(opts.byggeplassProsjekt ? { projectId: opts.byggeplassProsjekt } : null);
  const tx = {
    reportTemplate: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ prefix: null, name: "SJA", projectId: PROSJEKT }),
    },
    drawing: { findUnique: drawingFindUnique },
    byggeplass: { findUnique: byggeplassFindUnique },
    omrade: {
      findUnique: vi
        .fn()
        .mockResolvedValue(opts.omradeProsjekt ? { projectId: opts.omradeProsjekt, byggeplassId: BYGGEPLASS } : null),
    },
    checklist: { create },
  };
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      reportTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue({ domain: "hms", projectId: PROSJEKT }) },
      projectGroup: { findFirst: vi.fn().mockResolvedValue({ id: "hms-gruppe" }) },
      dokumentflytMal: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, create, drawingFindUnique, byggeplassFindUnique };
}

describe("sjekkliste.opprett — tegnings- og byggeplass-vakt (ORDRE 21)", () => {
  const basis = { templateId: MAL };

  it("løs tegning (uten byggeplass) i eget prosjekt → når skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ tegningProsjekt: PROSJEKT });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING }),
    ).rejects.toMatchObject({ message: NÅDDE_SKRIVING });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("tegning med byggeplass i eget prosjekt → når skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ tegningProsjekt: PROSJEKT, byggeplassProsjekt: PROSJEKT });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING, byggeplassId: BYGGEPLASS }),
    ).rejects.toMatchObject({ message: NÅDDE_SKRIVING });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("tegning i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ tegningProsjekt: FREMMED });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Tegningen hører til et annet prosjekt." });
    expect(create).not.toHaveBeenCalled();
  });

  it("byggeplass i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ byggeplassProsjekt: FREMMED });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ ...basis, byggeplassId: BYGGEPLASS }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Byggeplassen hører til et annet prosjekt." });
    expect(create).not.toHaveBeenCalled();
  });

  it("uten tegning og byggeplass → ingen oppslag, når skriving", async () => {
    const { ctx, create, drawingFindUnique, byggeplassFindUnique } = lagOpprettCtx({});
    await expect(sjekklisteRouter.createCaller(ctx).opprett(basis)).rejects.toMatchObject({
      message: NÅDDE_SKRIVING,
    });
    expect(drawingFindUnique).not.toHaveBeenCalled();
    expect(byggeplassFindUnique).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("sjekkliste.oppdater — byggeplass-vakt (ORDRE 21)", () => {
  function medByggeplass(byggeplassProsjekt: string | null) {
    const base = lagCtx(null);
    const byggeplassFindUnique = vi
      .fn()
      .mockResolvedValue(byggeplassProsjekt ? { projectId: byggeplassProsjekt } : null);
    base.ctx.prisma.byggeplass = { findUnique: byggeplassFindUnique };
    return { ...base, byggeplassFindUnique };
  }

  it("byggeplass i eget prosjekt → lagres", async () => {
    const { ctx, checklistUpdate } = medByggeplass(PROSJEKT);
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, byggeplassId: BYGGEPLASS });
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });

  it("byggeplass i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, checklistUpdate } = medByggeplass(FREMMED);
    await expect(
      sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, byggeplassId: BYGGEPLASS }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Byggeplassen hører til et annet prosjekt." });
    expect(checklistUpdate).not.toHaveBeenCalled();
  });

  it("byggeplassId null → lagres uten oppslag", async () => {
    const { ctx, checklistUpdate, byggeplassFindUnique } = medByggeplass(null);
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, byggeplassId: null });
    expect(byggeplassFindUnique).not.toHaveBeenCalled();
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });
});

// ── ORDRE 29 #13: område-vakt ─────────────────────────────────────────────────

const OMRADE = "55555555-5555-5555-5555-555555555555";
const OMRADE_AVVIST = { code: "BAD_REQUEST", message: "Området hører til et annet prosjekt." };

describe("sjekkliste.opprett — område-vakt (ORDRE 29 #13)", () => {
  it("område i eget prosjekt → når skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ omradeProsjekt: PROSJEKT });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ templateId: MAL, omradeId: OMRADE }),
    ).rejects.toMatchObject({ message: NÅDDE_SKRIVING });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("område i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ omradeProsjekt: FREMMED });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ templateId: MAL, omradeId: OMRADE }),
    ).rejects.toMatchObject(OMRADE_AVVIST);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("sjekkliste.oppdater — område-vakt (ORDRE 29 #13)", () => {
  function medOmrade(omradeProsjekt: string) {
    const base = lagCtx(null);
    base.ctx.prisma.omrade = {
      findUnique: vi.fn().mockResolvedValue({ projectId: omradeProsjekt, byggeplassId: BYGGEPLASS }),
    };
    return base;
  }

  it("område i eget prosjekt → lagres", async () => {
    const { ctx, checklistUpdate } = medOmrade(PROSJEKT);
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, omradeId: OMRADE });
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });

  it("område i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, checklistUpdate } = medOmrade(FREMMED);
    await expect(
      sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, omradeId: OMRADE }),
    ).rejects.toMatchObject(OMRADE_AVVIST);
    expect(checklistUpdate).not.toHaveBeenCalled();
  });
});

// ── ORDRE 33: område må ligge på dokumentets EFFEKTIVE byggeplass ────────────

const BP2 = "66666666-6666-6666-6666-666666666662";
const ANNEN_BYGGEPLASS = { code: "BAD_REQUEST", message: "Området hører til en annen byggeplass." };

describe("sjekkliste — område mot byggeplass (ORDRE 33)", () => {
  it("O5 opprett: område på annen byggeplass enn valgt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ byggeplassProsjekt: PROSJEKT, omradeProsjekt: PROSJEKT });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ templateId: MAL, byggeplassId: BP2, omradeId: OMRADE }),
    ).rejects.toMatchObject(ANNEN_BYGGEPLASS);
    expect(create).not.toHaveBeenCalled();
  });

  it("O5 opprett: område på samme byggeplass → når skriving", async () => {
    const { ctx, create } = lagOpprettCtx({ byggeplassProsjekt: PROSJEKT, omradeProsjekt: PROSJEKT });
    await expect(
      sjekklisteRouter.createCaller(ctx).opprett({ templateId: MAL, byggeplassId: BYGGEPLASS, omradeId: OMRADE }),
    ).rejects.toMatchObject({ message: NÅDDE_SKRIVING });
    expect(create).toHaveBeenCalledTimes(1);
  });

  /** Området ligger på BYGGEPLASS; sjekklisten får `rad`-feltene. */
  async function medRad(rad: { byggeplassId?: string | null; omradeId?: string | null }) {
    const base = lagCtx(null);
    base.ctx.prisma.omrade = {
      findUnique: vi.fn().mockResolvedValue({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS }),
    };
    base.ctx.prisma.byggeplass = { findUnique: vi.fn().mockResolvedValue({ projectId: PROSJEKT }) };
    const dagens = await base.ctx.prisma.checklist.findUniqueOrThrow();
    base.ctx.prisma.checklist.findUniqueOrThrow = vi.fn().mockResolvedValue({ ...dagens, ...rad });
    return base;
  }

  it("O6 oppdater: nytt område mot radens byggeplass (ingen byggeplassId i input) → BAD_REQUEST", async () => {
    const { ctx, checklistUpdate } = await medRad({ byggeplassId: BP2 });
    await expect(
      sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, omradeId: OMRADE }),
    ).rejects.toMatchObject(ANNEN_BYGGEPLASS);
    expect(checklistUpdate).not.toHaveBeenCalled();
  });

  it("O6 oppdater: byggeplass byttes, området beholdes → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, checklistUpdate } = await medRad({ byggeplassId: BYGGEPLASS, omradeId: OMRADE });
    await expect(
      sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, byggeplassId: BP2 }),
    ).rejects.toMatchObject(ANNEN_BYGGEPLASS);
    expect(checklistUpdate).not.toHaveBeenCalled();
  });

  it("O6 oppdater: område på radens byggeplass → lagres", async () => {
    const { ctx, checklistUpdate } = await medRad({ byggeplassId: BYGGEPLASS });
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: SJEKKLISTE, omradeId: OMRADE });
    expect(checklistUpdate).toHaveBeenCalledTimes(1);
  });
});
