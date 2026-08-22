import { describe, it, expect, vi } from "vitest";

/**
 * Slett-vern på dokumentflyt (Kenneth-bestilling 2026-08-22). `Checklist`/`Task` → `Dokumentflyt`
 * er `onDelete: SetNull` → uten vakt ville sletting stille nullstilt flyt-id på alle dokumenter i
 * flyten. Vakten teller IKKE-slettede sjekklister + oppgaver og avviser med lesbar melding.
 *
 * Drives via router.createCaller med mocket ctx (samme mønster som expenseCategory.test.ts).
 * tilgangskontroll mockes (ingen ekte DB); tokenKilde=null omgår token-rotasjons-middlewaren.
 */

// `slett` kjører nå BÅDE admin-gate (verifiserAdmin) OG count-vakt (kombinert ved merge). Denne
// fila tester COUNT-atferden isolert → la admin-gaten passere (no-op). Admin-gaten selv testes i
// dokumentflyt-slett-adminvakt.test.ts (ekte verifiserAdmin).
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import { dokumentflytRouter } from "./dokumentflyt";

const FLYT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lagCtx(counts: { checklist: number; task: number }, del: ReturnType<typeof vi.fn>) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      checklist: { count: vi.fn().mockResolvedValue(counts.checklist) },
      task: { count: vi.fn().mockResolvedValue(counts.task) },
      dokumentflyt: { delete: del },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("dokumentflyt.slett — slett-vern", () => {
  it("flyt med dokumenter (2 sjekklister + 1 oppgave) → BAD_REQUEST med antall + hva brukeren kan gjøre, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = dokumentflytRouter.createCaller(lagCtx({ checklist: 2, task: 1 }, del));

    await expect(caller.slett({ id: FLYT, projectId: PROSJEKT })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      // Mikrotekst-standard: antall + neste steg, ikke bare «kan ikke slettes».
      message: "Flyten har 3 dokumenter og kan ikke slettes. Flytt eller lukk dem først.",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("entall: 1 dokument → «1 dokument» (ikke «1 dokumenter»)", async () => {
    const del = vi.fn();
    const caller = dokumentflytRouter.createCaller(lagCtx({ checklist: 1, task: 0 }, del));
    await expect(caller.slett({ id: FLYT, projectId: PROSJEKT })).rejects.toThrow(
      /Flyten har 1 dokument og kan ikke slettes/,
    );
  });

  it("tom flyt → slettes", async () => {
    const del = vi.fn().mockResolvedValue({ id: FLYT });
    const caller = dokumentflytRouter.createCaller(lagCtx({ checklist: 0, task: 0 }, del));

    await caller.slett({ id: FLYT, projectId: PROSJEKT });
    expect(del).toHaveBeenCalledWith({ where: { id: FLYT } });
  });

  it("teller KUN ikke-slettede (deletedAt: null) — papirkurv holdes utenfor", async () => {
    const del = vi.fn().mockResolvedValue({ id: FLYT });
    const ctx = lagCtx({ checklist: 0, task: 0 }, del);
    const caller = dokumentflytRouter.createCaller(ctx);

    await caller.slett({ id: FLYT, projectId: PROSJEKT });
    expect(ctx.prisma.checklist.count).toHaveBeenCalledWith({ where: { dokumentflytId: FLYT, deletedAt: null } });
    expect(ctx.prisma.task.count).toHaveBeenCalledWith({ where: { dokumentflytId: FLYT, deletedAt: null } });
  });
});
