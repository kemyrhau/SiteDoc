import { describe, it, expect, vi } from "vitest";

/**
 * Bilde-idempotens (2026-09-08). Opplastingskøen retrier feilede opplastinger, og
 * /upload gir ny fileUrl per forsøk — så uten en stabil nøkkel ble samme foto to
 * `Image`-rader. Fiksen: klientens vedleggId er unik-nøkkel og registreringen
 * upserter på den. Eldre klienter sender ikke vedleggId og beholder den
 * ikke-idempotente create-veien (bevisst fallback).
 *
 * Kontrakten denne låser:
 *   - samme vedleggId to ganger → ÉN rad (upsert)
 *   - manglende vedleggId to ganger → TO rader (dagens create-atferd, bevisst)
 *
 * Drives via router.createCaller med mocket ctx (samme mønster som
 * dokumentflyt-slettevern.test.ts). Den falske prisma-en modellerer Postgres'
 * unik-på-vedlegg_id: upsert finner eksisterende rad på vedleggId, ellers innsetter.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

import { bildeRouter } from "./bilde";

const CHECKLIST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TASK = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

interface FakeImage {
  id: string;
  vedleggId?: string | null;
  [k: string]: unknown;
}

/** In-memory `images`-lager som speiler @unique på vedlegg_id (NULL distinkt). */
function lagCtx() {
  const lager: FakeImage[] = [];
  let idTeller = 0;

  const image = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const rad: FakeImage = { id: `img-${idTeller++}`, ...data };
      lager.push(rad);
      return rad;
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { vedleggId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const funnet = lager.find((r) => r.vedleggId === where.vedleggId);
        if (funnet) {
          Object.assign(funnet, update);
          return funnet;
        }
        const rad: FakeImage = { id: `img-${idTeller++}`, ...create };
        lager.push(rad);
        return rad;
      },
    ),
  };

  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      checklist: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ template: { projectId: PROSJEKT } }),
      },
      task: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ template: { projectId: PROSJEKT } }),
      },
      image,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { ctx, lager };
}

const bildefelter = {
  fileUrl: "/uploads/privat/en-fil.jpg",
  fileName: "IMG_1234.jpg",
  fileSize: 123456,
};

describe("bilde.opprettForSjekkliste — idempotens på vedleggId", () => {
  it("samme vedleggId to ganger → ÉN rad", async () => {
    const { ctx, lager } = lagCtx();
    const caller = bildeRouter.createCaller(ctx);

    await caller.opprettForSjekkliste({
      checklistId: CHECKLIST,
      vedleggId: "vedlegg-1",
      ...bildefelter,
    });
    // Retry: køen laster opp på nytt → NY fileUrl, men samme vedleggId.
    await caller.opprettForSjekkliste({
      checklistId: CHECKLIST,
      vedleggId: "vedlegg-1",
      ...bildefelter,
      fileUrl: "/uploads/privat/samme-foto-nytt-opplastingsnavn.jpg",
    });

    expect(lager).toHaveLength(1);
    expect(ctx.prisma.image.upsert).toHaveBeenCalledTimes(2);
    expect(ctx.prisma.image.create).not.toHaveBeenCalled();
    // Oppdateringen beholder siste opplastnings fileUrl på den ene raden.
    expect(lager[0]!.fileUrl).toBe(
      "/uploads/privat/samme-foto-nytt-opplastingsnavn.jpg",
    );
  });

  it("manglende vedleggId to ganger → TO rader (bevisst dagens create-atferd)", async () => {
    const { ctx, lager } = lagCtx();
    const caller = bildeRouter.createCaller(ctx);

    await caller.opprettForSjekkliste({ checklistId: CHECKLIST, ...bildefelter });
    await caller.opprettForSjekkliste({ checklistId: CHECKLIST, ...bildefelter });

    expect(lager).toHaveLength(2);
    expect(ctx.prisma.image.create).toHaveBeenCalledTimes(2);
    expect(ctx.prisma.image.upsert).not.toHaveBeenCalled();
  });

  it("ulike vedleggId → to rader (ekte forskjellige bilder blandes ikke)", async () => {
    const { ctx, lager } = lagCtx();
    const caller = bildeRouter.createCaller(ctx);

    await caller.opprettForSjekkliste({
      checklistId: CHECKLIST,
      vedleggId: "vedlegg-1",
      ...bildefelter,
    });
    await caller.opprettForSjekkliste({
      checklistId: CHECKLIST,
      vedleggId: "vedlegg-2",
      ...bildefelter,
    });

    expect(lager).toHaveLength(2);
  });
});

describe("bilde.opprettForOppgave — idempotens på vedleggId", () => {
  it("samme vedleggId to ganger → ÉN rad", async () => {
    const { ctx, lager } = lagCtx();
    const caller = bildeRouter.createCaller(ctx);

    await caller.opprettForOppgave({
      taskId: TASK,
      vedleggId: "vedlegg-9",
      ...bildefelter,
    });
    await caller.opprettForOppgave({
      taskId: TASK,
      vedleggId: "vedlegg-9",
      ...bildefelter,
    });

    expect(lager).toHaveLength(1);
    expect(ctx.prisma.image.upsert).toHaveBeenCalledTimes(2);
  });

  it("manglende vedleggId to ganger → TO rader", async () => {
    const { ctx, lager } = lagCtx();
    const caller = bildeRouter.createCaller(ctx);

    await caller.opprettForOppgave({ taskId: TASK, ...bildefelter });
    await caller.opprettForOppgave({ taskId: TASK, ...bildefelter });

    expect(lager).toHaveLength(2);
    expect(ctx.prisma.image.create).toHaveBeenCalledTimes(2);
  });
});
