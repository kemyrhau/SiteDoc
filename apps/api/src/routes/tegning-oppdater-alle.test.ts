import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * «Oppdater alle tegninger» (2026-10-16, orkestrator-ordre): admin-gatet batch som
 * rekonverterer alle DWG/DXF-hovedtegninger i prosjektet fra lagret original.
 * Tegninger uten original (PDF, eller DWG/DXF fra før revisjonsoriginal 10.10)
 * telles i `manglerOriginal` i stedet for å feile (DoD-krav 5). Fremdrift er
 * utledet av `conversionStatus` (2a-mønster, ingen migrering, ingen in-memory-
 * status) — dekkes av `tegning-rekonverter-status.test.ts`, ikke her.
 */

const h = vi.hoisted(() => ({
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  konverterDwg: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: h.verifiserAdmin,
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dwgKonvertering", () => ({
  // Aldri resolve — vi måler kun hvilke tegninger som ble forsøkt startet.
  konverterDwg: (...a: unknown[]) => {
    h.konverterDwg(...a);
    return new Promise(() => {});
  },
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function lagTegning(
  id: string,
  overstyring: Partial<{
    originalFileUrl: string | null;
    conversionStatus: string | null;
    alderMin: number;
  }> = {},
) {
  return {
    id,
    projectId: PROSJEKT,
    name: `Tegning ${id}`,
    byggeplassId: null,
    originalFileUrl: "originalFileUrl" in overstyring ? overstyring.originalFileUrl! : "/uploads/original.dwg",
    conversionStatus: overstyring.conversionStatus ?? "done",
    updatedAt: new Date(Date.now() - (overstyring.alderMin ?? 0) * 60 * 1000),
  };
}

function lagCtx(tegninger: ReturnType<typeof lagTegning>[]) {
  const updateManyKall: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const prisma = {
    drawing: {
      findMany: vi.fn().mockResolvedValue(tegninger),
      updateMany: vi.fn(async (arg: { where: unknown; data: Record<string, unknown> }) => {
        updateManyKall.push(arg);
        return { count: 0 };
      }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ctx = { userId: "user-1", prisma } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ctx, updateManyKall };
}

describe("oppdaterAlleTegninger", () => {
  beforeEach(() => {
    h.konverterDwg.mockReset();
    h.verifiserAdmin.mockReset().mockResolvedValue(undefined);
  });

  it("ikke-admin avvises før noe leses/skrives", async () => {
    h.verifiserAdmin.mockRejectedValueOnce(new Error("Kun administratorer kan utføre denne handlingen"));
    const { ctx } = lagCtx([lagTegning("t1")]);
    await expect(
      tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT }),
    ).rejects.toThrow();
    expect(ctx.prisma.drawing.findMany).not.toHaveBeenCalled();
  });

  it("skiller manglerOriginal fra startbare, hopper over fersk pågår, starter resten", async () => {
    const tegninger = [
      lagTegning("t-ok-1"),
      lagTegning("t-ok-2"),
      lagTegning("t-mangler-original", { originalFileUrl: null }),
      lagTegning("t-pdf-original", { originalFileUrl: "/uploads/original.pdf" }),
      lagTegning("t-pagar-fersk", { conversionStatus: "converting", alderMin: 1 }),
    ];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    // t-pdf-original har originalFileUrl (ikke null) som ikke er .dwg/.dxf: verken
    // startbar eller manglerOriginal — PDF er utenfor scope, telles ingen steder her.
    expect(res).toEqual({ startet: 2, manglerOriginal: 1 });
    expect(updateManyKall).toHaveLength(1);
    const idsSatt = (updateManyKall[0]!.where as { id: { in: string[] } }).id.in;
    expect(idsSatt.sort()).toEqual(["t-ok-1", "t-ok-2"]);
    expect(updateManyKall[0]!.data).toEqual({ conversionStatus: "pending", conversionError: null });

    // Gi de voidede Semafor-kallene en sjanse til å kjøre (mikrotask-tick).
    await vi.waitFor(() => expect(h.konverterDwg).toHaveBeenCalledTimes(2));
  });

  it("strandet pågår (eldre enn grensen) regnes IKKE som pågår → startes på nytt", async () => {
    const tegninger = [lagTegning("t-strandet", { conversionStatus: "converting", alderMin: 11 })];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    expect(res).toEqual({ startet: 1, manglerOriginal: 0 });
    expect(updateManyKall).toHaveLength(1);
  });

  it("ingen startbare → ingen DB-skriving, startet=0", async () => {
    const tegninger = [lagTegning("t-pagar", { conversionStatus: "pending", alderMin: 1 })];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    expect(res).toEqual({ startet: 0, manglerOriginal: 0 });
    expect(updateManyKall).toHaveLength(0);
  });
});
