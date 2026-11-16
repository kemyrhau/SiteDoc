import { describe, it, expect, vi } from "vitest";

/**
 * ORDRE 29 #13 — kontrollplan.opprettPunkter: hvert punkts område MÅ ligge i planens prosjekt
 * OG på planens byggeplass. Før vakten kunne et område fra en annen byggeplass (eller et annet
 * prosjekt) bli skrevet på punktet. Vakten kjører ekte (tegningVakt mockes ikke); avvisning
 * skjer før importhendelsen og punktene skrives.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/kontrollplanKobling", () => ({
  koblePunktTilSjekkliste: vi.fn(),
}));

import { kontrollplanRouter } from "./kontrollplan";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const BP = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ANNEN_BP = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MAL = "22222222-2222-2222-2222-222222222222";
const FAGGRUPPE = "33333333-3333-3333-3333-333333333333";

function lagCtx(omrade: { projectId: string; byggeplassId: string }) {
  const skriv = vi.fn();
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      kontrollplan: { findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT, byggeplassId: BP }) },
      omrade: { findUnique: vi.fn().mockResolvedValue(omrade) },
      dokumentflyt: { findMany: skriv },
      kontrollplanImport: { create: skriv },
      kontrollplanPunkt: { create: skriv, createMany: skriv },
      $transaction: skriv,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, skriv };
}

const input = {
  kontrollplanId: "plan-1",
  sjekklisteMalId: MAL,
  faggruppeId: FAGGRUPPE,
  punkter: [{ omradeId: "omr-1" }],
};

describe("kontrollplan.opprettPunkter — område-vakt (ORDRE 29 #13)", () => {
  it("område på annen byggeplass i samme prosjekt → BAD_REQUEST, ingen skriving", async () => {
    const { ctx, skriv } = lagCtx({ projectId: PROSJEKT, byggeplassId: ANNEN_BP });
    await expect(kontrollplanRouter.createCaller(ctx).opprettPunkter(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Området hører til en annen byggeplass.",
    });
    expect(skriv).not.toHaveBeenCalled();
  });

  it("område i fremmed prosjekt → BAD_REQUEST, ingen skriving", async () => {
    const { ctx, skriv } = lagCtx({ projectId: FREMMED, byggeplassId: BP });
    await expect(kontrollplanRouter.createCaller(ctx).opprettPunkter(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Området hører til et annet prosjekt.",
    });
    expect(skriv).not.toHaveBeenCalled();
  });

  it("område på planens byggeplass → passerer vakten (ett oppslag pr. unikt område)", async () => {
    const { ctx } = lagCtx({ projectId: PROSJEKT, byggeplassId: BP });
    await kontrollplanRouter
      .createCaller(ctx)
      .opprettPunkter({ ...input, punkter: [{ omradeId: "omr-1" }, { omradeId: "omr-1" }, { omradeId: null }] })
      .catch(() => undefined); // videre skriving er utenfor testen
    expect(ctx.prisma.omrade.findUnique).toHaveBeenCalledTimes(1);
  });
});
