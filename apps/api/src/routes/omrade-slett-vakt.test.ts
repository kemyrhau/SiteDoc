import { describe, it, expect, vi } from "vitest";

/**
 * Test B (vakten) — slettevakt på `omrade.slett` (Kenneth-vedtak 2026-09-23: «blokkér hvis
 * feltet inneholder data fra før, og bare admin»). Et område kan refereres to veier:
 *   - kontrollplanpunkter (ekte FK, `onDelete: SetNull` — schema.prisma:2472). Slett uten vakt
 *     nullstiller `omradeId` på alle punktene, og `@@unique([kontrollplanId, omradeId,
 *     sjekklisteMalId])` fanger ikke NULL-duplikatene (se Test A, integrasjon).
 *   - rapportobjekter (myk JSON-referanse: `Checklist.data`/`Task.data`, verdi = omradeId, ingen FK).
 * Vakten teller begge og NEKTER med tallet i meldingen når > 0.
 *
 * Enhetsnivå: `router.createCaller` med mocket ctx (mocket prisma), samme mønster som
 * `dokumentflyt-slettevern.test.ts`. `verifiserAdmin` mockes → admin-gaten passerer her; den
 * testes for seg (ekte verifiserAdmin) i api-suiten. `$queryRaw` (rapportobjekt-tellingen)
 * mockes til å returnere ett rad-objekt `{ antall }`.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import { omradeRouter } from "./omrade";

const OMRADE = "omr-1";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function lagCtx(
  counts: { kontrollplanPunkt: number; rapportobjekt: number },
  del: ReturnType<typeof vi.fn>,
) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      omrade: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT }),
        delete: del,
      },
      kontrollplanPunkt: { count: vi.fn().mockResolvedValue(counts.kontrollplanPunkt) },
      $queryRaw: vi.fn().mockResolvedValue([{ antall: BigInt(counts.rapportobjekt) }]),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("omrade.slett — slettevakt", () => {
  it("RØD FØRST: område brukt av 4 kontrollplanpunkter → BAD_REQUEST med tallet, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = omradeRouter.createCaller(lagCtx({ kontrollplanPunkt: 4, rapportobjekt: 0 }, del));

    await expect(caller.slett({ id: OMRADE })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Området brukes av 4 kontrollplanpunkter og kan ikke slettes. Gi det nytt navn, eller flytt det som bruker det, først.",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("entall: 1 kontrollplanpunkt → «1 kontrollplanpunkt» (ikke «1 kontrollplanpunkter»)", async () => {
    const del = vi.fn();
    const caller = omradeRouter.createCaller(lagCtx({ kontrollplanPunkt: 1, rapportobjekt: 0 }, del));
    await expect(caller.slett({ id: OMRADE })).rejects.toThrow(
      /Området brukes av 1 kontrollplanpunkt og kan ikke slettes/,
    );
  });

  it("rapportobjekt-referanse (JSON, ingen FK) blokkerer også — navngir rapportobjekter", async () => {
    const del = vi.fn();
    const caller = omradeRouter.createCaller(lagCtx({ kontrollplanPunkt: 0, rapportobjekt: 3 }, del));
    await expect(caller.slett({ id: OMRADE })).rejects.toThrow(
      /Området brukes av 3 rapportobjekter og kan ikke slettes/,
    );
    expect(del).not.toHaveBeenCalled();
  });

  it("begge veier > 0 → meldingen navngir begge tallene", async () => {
    const del = vi.fn();
    const caller = omradeRouter.createCaller(lagCtx({ kontrollplanPunkt: 2, rapportobjekt: 1 }, del));
    await expect(caller.slett({ id: OMRADE })).rejects.toThrow(
      /2 kontrollplanpunkter og 1 rapportobjekt og kan ikke slettes/,
    );
  });

  it("ubrukt område (begge = 0) → slettes fritt (ikke blokkér et tomt område)", async () => {
    const del = vi.fn().mockResolvedValue({ id: OMRADE });
    const caller = omradeRouter.createCaller(lagCtx({ kontrollplanPunkt: 0, rapportobjekt: 0 }, del));

    await caller.slett({ id: OMRADE });
    expect(del).toHaveBeenCalledWith({ where: { id: OMRADE } });
  });
});
