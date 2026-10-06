import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gjenåpne-vedtak (Kenneth 2026-09-26): gjenåpning krever begrunnelse — arkivet skal bære
 * HVORFOR et ferdig kvalitetsdokument åpnes. HMS-gjenåpne (`hmsGjenapne`, både oppgave og
 * sjekkliste) hadde INGEN begrunnelse-guard: `kommentar` var valgfri og `documentTransfer`
 * fikk «Gjenåpnet» som default. Nå avvises tom begrunnelse FØR ruting/skriving via den
 * delte kilden `statusKreverBegrunnelse("draft", fraStatus)` (kanonisk gjenåpne-form).
 *
 * `hmsLukk` er bevisst IKKE dekket her — den forblir valgfri (administrativ exit, ikke
 * tilbakesending).
 */

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  // HMS-handlingsautorisasjonen er ortogonal til begrunnelse-guarden — la den passere.
  verifiserHmsHandling: vi.fn().mockResolvedValue(undefined),
}));

import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";

const LUKKET_HMS = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "closed",
  title: "HMS-sak",
  number: 1,
  bestillerUserId: "bestiller-1",
  recipientGroupId: null,
  dokumentflytId: "flyt-1",
  aktivPosisjon: 1,
  template: {
    domain: "hms",
    projectId: "prosjekt-1",
    prefix: "RUH",
    project: { name: "Prosjekt" },
  },
};

function lagCtx(model: "task" | "checklist", update: ReturnType<typeof vi.fn>) {
  const prisma = {
    [model]: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(LUKKET_HMS),
      update,
    },
    $transaction: vi.fn(),
  };
  const ctx = {
    userId: "bruker-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, update, transaction: prisma.$transaction };
}

beforeEach(() => vi.clearAllMocks());

describe("hmsGjenapne — gjenåpne krever begrunnelse (delt kilde, samme som klienten)", () => {
  it("oppgave.hmsGjenapne: tom begrunnelse → BAD_REQUEST, ingen skriving", async () => {
    const update = vi.fn();
    const { ctx, transaction } = lagCtx("task", update);
    await expect(
      oppgaveRouter.createCaller(ctx).hmsGjenapne({ id: LUKKET_HMS.id, kommentar: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Begrunnelse er påkrevd for denne handlingen" });
    expect(update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("oppgave.hmsGjenapne: manglende kommentar → BAD_REQUEST", async () => {
    const update = vi.fn();
    const { ctx } = lagCtx("task", update);
    await expect(
      oppgaveRouter.createCaller(ctx).hmsGjenapne({ id: LUKKET_HMS.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("sjekkliste.hmsGjenapne: tom begrunnelse → BAD_REQUEST, ingen skriving", async () => {
    const update = vi.fn();
    const { ctx, transaction } = lagCtx("checklist", update);
    await expect(
      sjekklisteRouter.createCaller(ctx).hmsGjenapne({ id: LUKKET_HMS.id, kommentar: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Begrunnelse er påkrevd for denne handlingen" });
    expect(update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
