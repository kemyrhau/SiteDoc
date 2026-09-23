import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * papirkurv — flervalg (gjenopprett + slett endelig) og «Tøm papirkurv» (Kenneth-vedtak
 * 2026-08-18 del 1+2). Verifiserer: tilgangsregel per vei (gjenopprett = oppretter/admin,
 * slett+tøm = admin), retur med antall fordelt på sjekklister/oppgaver, opprydding av
 * transfers+bilder FØR raden, og at bunker aldri stille dropper rader (NOT_FOUND ved miss).
 * Drives via createCaller med mocket ctx (som de andre slettevern-testene).
 */

const tilgang = vi.fn();
vi.mock("../trpc/tilgangskontroll", () => ({
  hentBrukerProsjektTilgang: (...a: unknown[]) => tilgang(...a),
}));

import { papirkurvRouter } from "./papirkurv";

const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SJEKK = "11111111-1111-1111-1111-111111111111";
const OPPG = "22222222-2222-2222-2222-222222222222";

function lagTx() {
  return {
    documentTransfer: { deleteMany: vi.fn() },
    image: { deleteMany: vi.fn() },
    checklist: { deleteMany: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    task: { deleteMany: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    // Frigjøring av koblede kontrollpunkter FØR sjekkliste-sletting (base krav 5).
    kontrollplanPunkt: { updateMany: vi.fn() },
  };
}

function lagCtx(opts: {
  userId?: string;
  funnetSjekk?: { id: string; bestillerUserId: string }[];
  funnetOppg?: { id: string; bestillerUserId: string }[];
  tx?: ReturnType<typeof lagTx>;
}) {
  const tx = opts.tx ?? lagTx();
  return {
    userId: opts.userId ?? "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      checklist: { findMany: vi.fn().mockResolvedValue(opts.funnetSjekk ?? []) },
      task: { findMany: vi.fn().mockResolvedValue(opts.funnetOppg ?? []) },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    },
    _tx: tx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  tilgang.mockReset();
});

describe("papirkurv.tomPapirkurv", () => {
  it("admin: sletter alt, rydder transfers+bilder før raden, returnerer antall per type", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: true, erSitedocAdmin: false });
    const ctx = lagCtx({
      funnetSjekk: [{ id: SJEKK, bestillerUserId: "x" }],
      funnetOppg: [{ id: OPPG, bestillerUserId: "y" }],
    });
    const caller = papirkurvRouter.createCaller(ctx);
    const res = await caller.tomPapirkurv({ projectId: PROSJEKT });
    expect(res).toEqual({ sjekklister: 1, oppgaver: 1 });
    expect(ctx._tx.documentTransfer.deleteMany).toHaveBeenCalledWith({
      where: { checklistId: { in: [SJEKK] } },
    });
    expect(ctx._tx.image.deleteMany).toHaveBeenCalledWith({ where: { checklistId: { in: [SJEKK] } } });
    expect(ctx._tx.checklist.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [SJEKK] } } });
    expect(ctx._tx.task.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [OPPG] } } });
    // Base krav 5: koblede kontrollpunkter frigjøres (status → planlagt, kobling nullstilt)
    // så ingen punkter blir stående som «Påbegynt» på slettede dokumenter.
    expect(ctx._tx.kontrollplanPunkt.updateMany).toHaveBeenCalledWith({
      where: { sjekklisteId: { in: [SJEKK] } },
      data: { sjekklisteId: null, status: "planlagt" },
    });
  });

  it("ikke-admin: FORBIDDEN, ingenting slettet", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: false, erSitedocAdmin: false });
    const ctx = lagCtx({});
    const caller = papirkurvRouter.createCaller(ctx);
    await expect(caller.tomPapirkurv({ projectId: PROSJEKT })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("papirkurv.slettEndeligFlere", () => {
  it("admin: sletter valgte, returnerer antall", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: true, erSitedocAdmin: false });
    const ctx = lagCtx({ funnetSjekk: [{ id: SJEKK, bestillerUserId: "x" }] });
    const caller = papirkurvRouter.createCaller(ctx);
    const res = await caller.slettEndeligFlere({
      projectId: PROSJEKT,
      items: [{ id: SJEKK, type: "checklist" }],
    });
    expect(res).toEqual({ sjekklister: 1, oppgaver: 0 });
  });

  it("ikke-admin: FORBIDDEN", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: false, erSitedocAdmin: false });
    const caller = papirkurvRouter.createCaller(lagCtx({}));
    await expect(
      caller.slettEndeligFlere({ projectId: PROSJEKT, items: [{ id: SJEKK, type: "checklist" }] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("en id mangler i kurven → NOT_FOUND (aldri stille drop)", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: true, erSitedocAdmin: false });
    // Ba om 2 sjekklister, fant bare 1.
    const ctx = lagCtx({ funnetSjekk: [{ id: SJEKK, bestillerUserId: "x" }] });
    const caller = papirkurvRouter.createCaller(ctx);
    await expect(
      caller.slettEndeligFlere({
        projectId: PROSJEKT,
        items: [
          { id: SJEKK, type: "checklist" },
          { id: "33333333-3333-3333-3333-333333333333", type: "checklist" },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("papirkurv.slettEndelig (enkelt) — frigjør koblet punkt (base krav 5)", () => {
  it("admin: hardsletter sjekkliste og frigjør koblet punkt (status→planlagt, kobling nullstilt)", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: true, erSitedocAdmin: false });
    const tx = lagTx();
    const ctx = {
      userId: "user-1",
      tokenKilde: null,
      sessionToken: null,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      nyttSessionTokenForRespons: { value: null },
      prisma: {
        checklist: {
          findUnique: vi.fn().mockResolvedValue({
            deletedAt: new Date("2026-09-01T00:00:00Z"),
            bestillerUserId: "x",
            template: { projectId: PROSJEKT },
          }),
        },
        $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      },
      _tx: tx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const caller = papirkurvRouter.createCaller(ctx);
    await caller.slettEndelig({ id: SJEKK, type: "checklist" });
    expect(tx.kontrollplanPunkt.updateMany).toHaveBeenCalledWith({
      where: { sjekklisteId: SJEKK },
      data: { sjekklisteId: null, status: "planlagt" },
    });
    expect(tx.checklist.delete).toHaveBeenCalledWith({ where: { id: SJEKK } });
  });
});

describe("papirkurv.gjenopprettFlere", () => {
  it("oppretter (ikke-admin) gjenoppretter egne: updateMany nuller deletedAt", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: false, erSitedocAdmin: false });
    const ctx = lagCtx({ funnetSjekk: [{ id: SJEKK, bestillerUserId: "user-1" }] });
    const caller = papirkurvRouter.createCaller(ctx);
    const res = await caller.gjenopprettFlere({
      projectId: PROSJEKT,
      items: [{ id: SJEKK, type: "checklist" }],
    });
    expect(res).toEqual({ sjekklister: 1, oppgaver: 0 });
    expect(ctx._tx.checklist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [SJEKK] } },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it("ikke-admin med en annens dokument i bunken → FORBIDDEN, ingenting gjenopprettet", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: false, erSitedocAdmin: false });
    const ctx = lagCtx({ funnetSjekk: [{ id: SJEKK, bestillerUserId: "en-annen" }] });
    const caller = papirkurvRouter.createCaller(ctx);
    await expect(
      caller.gjenopprettFlere({ projectId: PROSJEKT, items: [{ id: SJEKK, type: "checklist" }] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("admin gjenoppretter en annens dokument", async () => {
    tilgang.mockResolvedValue({ erProsjektAdmin: true, erSitedocAdmin: false });
    const ctx = lagCtx({ funnetOppg: [{ id: OPPG, bestillerUserId: "en-annen" }] });
    const caller = papirkurvRouter.createCaller(ctx);
    const res = await caller.gjenopprettFlere({
      projectId: PROSJEKT,
      items: [{ id: OPPG, type: "task" }],
    });
    expect(res).toEqual({ sjekklister: 0, oppgaver: 1 });
    expect(ctx._tx.task.updateMany).toHaveBeenCalledOnce();
  });
});
