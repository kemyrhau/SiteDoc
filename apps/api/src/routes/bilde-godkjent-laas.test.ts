import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Godkjent-lås på galleri-bilder (RETUR 75282ec4, gate-punkt b, galleri-avklaring).
 * Kenneths vedtak «bare visning på godkjent» gjelder ALLE bilder på en rapport, ikke
 * bare feltvedlegget i `data`-JSON. `bilde.ts`-endepunktene knytter `Image`-rader til en
 * oppgave/sjekkliste, så de skal avvise på terminal status (approved/closed/cancelled):
 *   - opprettForOppgave / opprettForSjekkliste → FORBIDDEN på terminal, OK ellers
 *   - slettMedUrl → FORBIDDEN hvis ETT treff henger på en terminal rapport, sletter ellers
 *
 * Felles vakt: `krevRedigerbarDokumentstatus`. Drives via router.createCaller med mocket
 * ctx (samme mønster som bilde-idempotens.test.ts).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

import { bildeRouter } from "./bilde";

const CHECKLIST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TASK = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const bildefelter = {
  fileUrl: "/uploads/privat/en-fil.jpg",
  fileName: "IMG_1234.jpg",
  fileSize: 123456,
};

/** Ctx der dokument-statusene er parametriserbare. `findMany` modellerer slett-treffet. */
function lagCtx(opts: {
  checklistStatus?: string;
  taskStatus?: string;
  slettTreff?: { checklist?: { status: string } | null; task?: { status: string } | null }[];
}) {
  const deleteMany = vi.fn(async () => ({ count: (opts.slettTreff ?? []).length }));
  const findMany = vi.fn(async () => opts.slettTreff ?? []);

  const ctx = {
    userId: "user-1",
    prisma: {
      checklist: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: opts.checklistStatus,
          template: { projectId: PROSJEKT },
        }),
      },
      task: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: opts.taskStatus,
          template: { projectId: PROSJEKT },
        }),
      },
      image: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "img-1", ...data })),
        upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({ id: "img-1", ...create })),
        findMany,
        deleteMany,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { ctx, deleteMany, findMany };
}

describe("bilde.opprettForSjekkliste — godkjent-lås", () => {
  it("approved → FORBIDDEN, ingen rad opprettes", async () => {
    const { ctx } = lagCtx({ checklistStatus: "approved" });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.opprettForSjekkliste({ checklistId: CHECKLIST, vedleggId: "v1", ...bildefelter }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ctx.prisma.image.upsert).not.toHaveBeenCalled();
    expect(ctx.prisma.image.create).not.toHaveBeenCalled();
  });

  it.each(["closed", "cancelled"])("%s → FORBIDDEN", async (status) => {
    const { ctx } = lagCtx({ checklistStatus: status });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.opprettForSjekkliste({ checklistId: CHECKLIST, vedleggId: "v1", ...bildefelter }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it.each(["draft", "sent", "received", "in_progress"])("%s → opprettes", async (status) => {
    const { ctx } = lagCtx({ checklistStatus: status });
    const caller = bildeRouter.createCaller(ctx);
    await caller.opprettForSjekkliste({ checklistId: CHECKLIST, vedleggId: "v1", ...bildefelter });
    expect(ctx.prisma.image.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("bilde.opprettForOppgave — godkjent-lås", () => {
  it("approved → FORBIDDEN", async () => {
    const { ctx } = lagCtx({ taskStatus: "approved" });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.opprettForOppgave({ taskId: TASK, vedleggId: "v1", ...bildefelter }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ctx.prisma.image.upsert).not.toHaveBeenCalled();
  });

  it("received → opprettes", async () => {
    const { ctx } = lagCtx({ taskStatus: "received" });
    const caller = bildeRouter.createCaller(ctx);
    await caller.opprettForOppgave({ taskId: TASK, vedleggId: "v1", ...bildefelter });
    expect(ctx.prisma.image.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("bilde.slettMedUrl — godkjent-lås", () => {
  it("treff på en approved sjekkliste → FORBIDDEN, ingen sletting", async () => {
    const { ctx, deleteMany } = lagCtx({
      slettTreff: [{ checklist: { status: "approved" }, task: null }],
    });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.slettMedUrl({ fileUrl: "/uploads/privat/en-fil.jpg", projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("treff på en approved oppgave → FORBIDDEN", async () => {
    const { ctx, deleteMany } = lagCtx({
      slettTreff: [{ checklist: null, task: { status: "approved" } }],
    });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.slettMedUrl({ fileUrl: "/uploads/privat/en-fil.jpg", projectId: PROSJEKT }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("ETT av flere treff er terminal → hele kallet avvises (ingen delvis sletting)", async () => {
    const { ctx, deleteMany } = lagCtx({
      slettTreff: [
        { checklist: { status: "received" }, task: null },
        { checklist: { status: "approved" }, task: null },
      ],
    });
    const caller = bildeRouter.createCaller(ctx);
    await expect(
      caller.slettMedUrl({ fileUrl: "/uploads/privat/en-fil.jpg", projectId: PROSJEKT }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("alle treff redigerbare → sletter som før", async () => {
    const { ctx, deleteMany } = lagCtx({
      slettTreff: [{ checklist: { status: "received" }, task: null }],
    });
    const caller = bildeRouter.createCaller(ctx);
    const res = await caller.slettMedUrl({
      fileUrl: "/uploads/privat/en-fil.jpg",
      projectId: PROSJEKT,
    });
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ slettet: 1 });
  });

  it("bilde uten rapport-tilknytning (begge null) → sletter (ikke en rapport-flate)", async () => {
    const { ctx, deleteMany } = lagCtx({
      slettTreff: [{ checklist: null, task: null }],
    });
    const caller = bildeRouter.createCaller(ctx);
    await caller.slettMedUrl({ fileUrl: "/uploads/privat/en-fil.jpg", projectId: PROSJEKT });
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});
