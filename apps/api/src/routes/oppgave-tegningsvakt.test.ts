import { describe, it, expect, vi } from "vitest";

/**
 * Tegningsvakt i oppgave.opprett/oppdater (ORDRE 20). En `drawingId` på oppgaven MÅ tilhøre
 * oppgavens prosjekt (utledet på serveren — malens/oppgavens prosjekt). Løse tegninger (uten
 * byggeplass) i eget prosjekt er lovlige; fremmed prosjekt avvises FØR noe skrives; `null`
 * (fjern tegning) slipper uten oppslag. Vakten kjører ekte (tegningVakt mockes ikke) — kun
 * tilgangskontrollen og prisma er mocket.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  byggTilgangsFilter: vi.fn(),
  verifiserFaggruppeTilhorighet: vi.fn().mockResolvedValue(undefined),
  hentBrukersOpprettFlytMedlemskap: vi.fn().mockResolvedValue([]),
  verifiserDokumentTilgang: vi.fn().mockResolvedValue(undefined),
  verifiserRetningsrett: vi.fn(),
  byggFlytBruker: vi.fn(),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserHmsHandling: vi.fn(),
  hentBrukerTillatelser: vi.fn(),
  hentBrukerProsjektTilgang: vi.fn(),
  finnBrukersBoks: vi.fn(),
  kanByttFlyt: vi.fn(),
  aktivtMedlemWhere: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
}));

import { TRPCError } from "@trpc/server";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { oppgaveRouter } from "./oppgave";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const OPPGAVE = "11111111-1111-1111-1111-111111111111";
const MAL = "22222222-2222-2222-2222-222222222222";
const TEGNING = "33333333-3333-3333-3333-333333333333";

/** Sentinel fra $transaction (tRPC pakker den inn, meldingen består): beviser at opprett kom forbi vakten. */
const NÅDDE_SKRIVING = new Error("NÅDDE_SKRIVING");

function lagCtx(tegning: { projectId: string; byggeplassId: string | null } | null) {
  const drawingFindUnique = vi.fn().mockResolvedValue(tegning ? { projectId: tegning.projectId } : null);
  const taskUpdate = vi.fn().mockResolvedValue({ id: OPPGAVE });
  const transaction = vi.fn().mockRejectedValue(NÅDDE_SKRIVING);
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      drawing: { findUnique: drawingFindUnique },
      task: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: OPPGAVE,
          status: "draft",
          bestillerFaggruppeId: "bf",
          utforerFaggruppeId: "uf",
          bestillerFaggruppe: { projectId: PROSJEKT },
          template: { domain: "bygg", projectId: PROSJEKT },
          lokasjonOmfang: null,
          omradeId: null,
        }),
        update: taskUpdate,
      },
      // opprett via HMS-grenen (færrest forutsetninger) med sitedoc_admin (ingen gratis-grense).
      reportTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          prefix: "HMS",
          domain: "hms",
          projectId: PROSJEKT,
          project: { name: "P" },
        }),
      },
      projectGroup: { findFirst: vi.fn().mockResolvedValue({ id: "hms-gruppe" }) },
      dokumentflytMal: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
      $transaction: transaction,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, drawingFindUnique, taskUpdate, transaction };
}

const LØS = { projectId: PROSJEKT, byggeplassId: null };
const MED_BYGGEPLASS = { projectId: PROSJEKT, byggeplassId: "bp-1" };
const FREMMED_TEGNING = { projectId: FREMMED, byggeplassId: "bp-x" };

describe("oppgave.oppdater — tegningsvakt", () => {
  it("løs tegning (uten byggeplass) i samme prosjekt → lagres", async () => {
    const { ctx, taskUpdate } = lagCtx(LØS);
    await oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, drawingId: TEGNING });
    expect(taskUpdate).toHaveBeenCalledTimes(1);
  });

  it("tegning med byggeplass i samme prosjekt → lagres", async () => {
    const { ctx, taskUpdate } = lagCtx(MED_BYGGEPLASS);
    await oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, drawingId: TEGNING });
    expect(taskUpdate).toHaveBeenCalledTimes(1);
  });

  it("tegning i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, taskUpdate } = lagCtx(FREMMED_TEGNING);
    await expect(
      oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, drawingId: TEGNING }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Tegningen hører til et annet prosjekt." });
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("drawingId null (fjern tegning) → lagres uten tegningsoppslag", async () => {
    const { ctx, taskUpdate, drawingFindUnique } = lagCtx(null);
    await oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, drawingId: null });
    expect(drawingFindUnique).not.toHaveBeenCalled();
    expect(taskUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("oppgave.opprett — tegningsvakt", () => {
  const basis = { title: "T", templateId: MAL };

  it("løs tegning i samme prosjekt → passerer vakten og når skriving", async () => {
    const { ctx, transaction } = lagCtx(LØS);
    await expect(
      oppgaveRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING }),
    ).rejects.toMatchObject({ message: "NÅDDE_SKRIVING" });
    expect(transaction).toHaveBeenCalled();
  });

  it("tegning med byggeplass i samme prosjekt → passerer vakten og når skriving", async () => {
    const { ctx, transaction } = lagCtx(MED_BYGGEPLASS);
    await expect(
      oppgaveRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING }),
    ).rejects.toMatchObject({ message: "NÅDDE_SKRIVING" });
    expect(transaction).toHaveBeenCalled();
  });

  it("tegning i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, transaction } = lagCtx(FREMMED_TEGNING);
    await expect(
      oppgaveRouter.createCaller(ctx).opprett({ ...basis, drawingId: TEGNING }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Tegningen hører til et annet prosjekt." });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("uten tegning → ingen tegningsoppslag, når skriving", async () => {
    const { ctx, transaction, drawingFindUnique } = lagCtx(null);
    await expect(oppgaveRouter.createCaller(ctx).opprett(basis)).rejects.toMatchObject({ message: "NÅDDE_SKRIVING" });
    expect(drawingFindUnique).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled();
  });
});

// ── ORDRE 21: hentForTegning via drawing.projectId ───────────────────────────

describe("oppgave.hentForTegning — medlemskap via drawing.projectId (ORDRE 21)", () => {
  function lagLeseCtx(tegningProsjekt: string) {
    const findMany = vi.fn().mockResolvedValue([{ id: OPPGAVE }]);
    const ctx = {
      userId: "user-1",
      tokenKilde: null,
      sessionToken: null,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      nyttSessionTokenForRespons: { value: null },
      prisma: {
        drawing: { findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: tegningProsjekt }) },
        task: { findMany },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    return { ctx, findMany };
  }

  it("løs tegning i eget prosjekt → markørene returneres", async () => {
    vi.mocked(verifiserProsjektmedlem).mockImplementation(async (_u, pid) => {
      if (pid !== PROSJEKT) throw new TRPCError({ code: "FORBIDDEN" });
    });
    const { ctx, findMany } = lagLeseCtx(PROSJEKT);
    await expect(oppgaveRouter.createCaller(ctx).hentForTegning({ drawingId: TEGNING })).resolves.toEqual([
      { id: OPPGAVE },
    ]);
    expect(verifiserProsjektmedlem).toHaveBeenLastCalledWith("user-1", PROSJEKT);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("tegning i fremmed prosjekt (ikke medlem) → FORBIDDEN, ingen markører lest", async () => {
    vi.mocked(verifiserProsjektmedlem).mockImplementation(async (_u, pid) => {
      if (pid !== PROSJEKT) throw new TRPCError({ code: "FORBIDDEN" });
    });
    const { ctx, findMany } = lagLeseCtx(FREMMED);
    await expect(oppgaveRouter.createCaller(ctx).hentForTegning({ drawingId: TEGNING })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

// ── ORDRE 29 #13: område-vakt ─────────────────────────────────────────────────

const OMRADE = "55555555-5555-5555-5555-555555555555";
const OMRADE_AVVIST = { code: "BAD_REQUEST", message: "Området hører til et annet prosjekt." };

describe("oppgave — område-vakt (ORDRE 29 #13)", () => {
  function medOmrade(omradeProsjekt: string) {
    const base = lagCtx(null);
    base.ctx.prisma.omrade = {
      findUnique: vi.fn().mockResolvedValue({ projectId: omradeProsjekt, byggeplassId: "bp-1" }),
    };
    return base;
  }

  it("opprett: område i eget prosjekt → når skriving", async () => {
    const { ctx, transaction } = medOmrade(PROSJEKT);
    await expect(
      oppgaveRouter.createCaller(ctx).opprett({ title: "T", templateId: MAL, omradeId: OMRADE }),
    ).rejects.toMatchObject({ message: "NÅDDE_SKRIVING" });
    expect(transaction).toHaveBeenCalled();
  });

  it("opprett: område i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, transaction } = medOmrade(FREMMED);
    await expect(
      oppgaveRouter.createCaller(ctx).opprett({ title: "T", templateId: MAL, omradeId: OMRADE }),
    ).rejects.toMatchObject(OMRADE_AVVIST);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("oppdater: område i eget prosjekt → lagres", async () => {
    const { ctx, taskUpdate } = medOmrade(PROSJEKT);
    await oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, omradeId: OMRADE });
    expect(taskUpdate).toHaveBeenCalledTimes(1);
  });

  it("oppdater: område i fremmed prosjekt → BAD_REQUEST, INGEN skriving", async () => {
    const { ctx, taskUpdate } = medOmrade(FREMMED);
    await expect(
      oppgaveRouter.createCaller(ctx).oppdater({ id: OPPGAVE, omradeId: OMRADE }),
    ).rejects.toMatchObject(OMRADE_AVVIST);
    expect(taskUpdate).not.toHaveBeenCalled();
  });
});
