import { describe, it, expect, vi } from "vitest";

/**
 * `rekonverteringStatus` — 2a-mønster (samme form som `mappe.reprosesseringStatus`),
 * utledet av `conversion_status`/`updated_at` på Drawing, UTEN migrering. Denne
 * testen dekker JS-sideregningen (bigint→number, `ferdig`-aritmetikken) — selve
 * SQL-en (FILTER-klausulene, DWG/DXF-opphavs-scopen) verifiseres mot ekte DB i
 * on-test-beviset, slik `reprosesseringStatus` ble gjort (se inbox-orkestrator.md).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dwgKonvertering", () => ({
  konverterDwg: vi.fn(),
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function lagCtx(rad: { totalt: bigint; pagar: bigint; feilet: bigint; mangler_original: bigint }) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([rad]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { userId: "user-1", prisma } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("rekonverteringStatus", () => {
  it("regner ferdig = totalt - pågår - feilet - manglerOriginal", async () => {
    const ctx = lagCtx({ totalt: 10n, pagar: 2n, feilet: 3n, mangler_original: 1n });
    const res = await tegningRouter.createCaller(ctx).rekonverteringStatus({ projectId: PROSJEKT });
    expect(res).toEqual({ totalt: 10, pågår: 2, feilet: 3, manglerOriginal: 1, ferdig: 4 });
  });

  it("tom tabell (ingen DWG/DXF-tegninger i prosjektet) → alle 0", async () => {
    const ctx = lagCtx({ totalt: 0n, pagar: 0n, feilet: 0n, mangler_original: 0n });
    const res = await tegningRouter.createCaller(ctx).rekonverteringStatus({ projectId: PROSJEKT });
    expect(res).toEqual({ totalt: 0, pågår: 0, feilet: 0, manglerOriginal: 0, ferdig: 0 });
  });
});
