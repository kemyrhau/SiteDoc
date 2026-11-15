import { describe, it, expect, vi } from "vitest";

/**
 * ORDRE (21) 2026-11-15 — byggeplassen følger tegningen på sjekkliste, samme regel som oppgave
 * (`velgTaskByggeplass`). Før: `sjekkliste.oppdater` skrev `byggeplassId`/`drawingId`/posisjon
 * rått, så en sjekkliste kunne ligge på byggeplass A med tegning fra B, og en pin fra gammel
 * tegning ble stående på ny tegning.
 *
 * Enhetsnivå: `createCaller` med mocket ctx (mønster fra `byggeplass-vakt-skrivende.test.ts`).
 * Tilgangssjekken mockes til å passere — testen gjelder hva som skrives.
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserDokumentTilgang: vi.fn().mockResolvedValue(undefined),
}));

import { sjekklisteRouter } from "./sjekkliste";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const BP_A = "a1111111-1111-1111-1111-111111111111";
const BP_B = "b2222222-2222-2222-2222-222222222222";
const TEGNING_A = "da111111-1111-1111-1111-111111111111";
const TEGNING_B = "db222222-2222-2222-2222-222222222222";
const PROSJEKT_TEGNING = "dc333333-3333-3333-3333-333333333333";

const TEGNINGENS_BP: Record<string, string | null> = {
  [TEGNING_A]: BP_A,
  [TEGNING_B]: BP_B,
  [PROSJEKT_TEGNING]: null,
};

/** Sjekkliste på byggeplass A med tegning A og en pin. */
function lagCtx(rad: Record<string, unknown> = {}) {
  const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: ID, ...data }));
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      checklist: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: ID,
          status: "draft",
          bestillerFaggruppeId: null,
          utforerFaggruppeId: null,
          byggeplassId: BP_A,
          drawingId: TEGNING_A,
          drawing: { byggeplassId: BP_A },
          positionX: 40,
          positionY: 60,
          lokasjonOmfang: "punkt",
          omradeId: null,
          kontrollplanPunkt: null,
          template: { projectId: PROSJEKT, domain: "kvalitet" },
          ...rad,
        }),
        update,
      },
      drawing: {
        findUnique: vi.fn().mockImplementation(({ where }) =>
          Promise.resolve({ projectId: PROSJEKT, byggeplassId: TEGNINGENS_BP[where.id] ?? null }),
        ),
      },
      byggeplass: { findUnique: vi.fn().mockResolvedValue({ projectId: PROSJEKT }) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, update };
}

const skrevet = (update: ReturnType<typeof vi.fn>) => update.mock.calls[0]![0].data;

describe("ORDRE (21): sjekkliste — byggeplassen følger tegningen", () => {
  it("🔴 tegningsbytte til annen byggeplass flytter byggeplassen og nullstiller punktet", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: ID, drawingId: TEGNING_B });
    const data = skrevet(update);
    expect(data.drawingId).toBe(TEGNING_B);
    expect(data.byggeplassId).toBe(BP_B);
    expect(data.positionX).toBeNull();
    expect(data.positionY).toBeNull();
  });

  it("🔴 byggeplass A + tegning B fra klienten → tegningens byggeplass B vinner", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter
      .createCaller(ctx)
      .oppdater({ id: ID, drawingId: TEGNING_B, byggeplassId: BP_A, positionX: 10, positionY: 20 });
    const data = skrevet(update);
    expect(data.byggeplassId).toBe(BP_B);
    // Ny pin sendt sammen med ny tegning beholdes.
    expect(data.positionX).toBe(10);
    expect(data.positionY).toBe(20);
  });

  it("🔴 bare byggeplassId mens dokumentet har tegning fra annen byggeplass → ignoreres", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: ID, byggeplassId: BP_B });
    const data = skrevet(update);
    expect(data.byggeplassId).toBeUndefined();
    expect(data.drawingId).toBeUndefined();
    expect(data.positionX).toBeUndefined();
  });

  it("samme tegning + ny pin → byggeplass og tegning urørt, pin lagres", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter
      .createCaller(ctx)
      .oppdater({ id: ID, drawingId: TEGNING_A, positionX: 5, positionY: 6 });
    const data = skrevet(update);
    expect(data.byggeplassId).toBeUndefined();
    expect(data.positionX).toBe(5);
  });

  it("uten tegning: direkte byggeplassvalg lagres (byggeplassByttInput, (20b))", async () => {
    const { ctx, update } = lagCtx({ drawingId: null, drawing: null, positionX: null, positionY: null });
    await sjekklisteRouter.createCaller(ctx).oppdater({
      id: ID,
      byggeplassId: BP_B,
      drawingId: null,
      positionX: null,
      positionY: null,
      omradeId: null,
    });
    expect(skrevet(update).byggeplassId).toBe(BP_B);
  });

  it("prosjekt-tegning (uten byggeplass) → klientens valg, ellers dagens byggeplass", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: ID, drawingId: PROSJEKT_TEGNING });
    expect(skrevet(update).byggeplassId).toBeUndefined();
  });

  it("fjern tegning (null) beholder byggeplassen", async () => {
    const { ctx, update } = lagCtx();
    await sjekklisteRouter.createCaller(ctx).oppdater({ id: ID, drawingId: null });
    const data = skrevet(update);
    expect(data.drawingId).toBeNull();
    expect(data.byggeplassId).toBeUndefined();
    expect(data.positionX).toBeNull();
  });
});
