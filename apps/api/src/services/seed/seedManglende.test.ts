import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Idempotens-kontrakt for seedManglendeKatalog (2026-08-10) — deterministisk,
 * mocket prismaTimer. Beviser at:
 *  - tom katalog → oppretter 5 utleggskategorier for RIKTIG org (hoppet=false)
 *  - eksisterende katalog (count>0) → hopper, createMany kalles ALDRI
 *    (rører aldri eksisterende data — hele poenget når Kenneth kjører mot prod)
 *
 * Den underliggende seedExpenseCategories er dessuten allerede kjørt end-to-end
 * mot sitedoc_test under U3-E2E (aktiverNivaa1 → seedet 5, verifisert via
 * expenseCategory.list). Live før/etter-bevis mot sitedoc_test kjøres etter deploy.
 */

// vi.hoisted: mock-funksjonene må eksistere før vi.mock-factoryen (hoistet).
const { count, createMany } = vi.hoisted(() => ({
  count: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("@sitedoc/db-timer", () => ({
  prismaTimer: { expenseCategory: { count, createMany } },
}));
vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("@sitedoc/shared", () => ({ generateProjectNumber: () => "SD-TEST-0001" }));

import { seedManglendeKatalog } from "./index";

describe("seedManglendeKatalog — idempotent expense-seed", () => {
  beforeEach(() => {
    count.mockReset();
    createMany.mockReset();
  });

  it("tom katalog → oppretter 5 kategorier for riktig org, hoppet=false", async () => {
    count.mockResolvedValue(0);
    createMany.mockResolvedValue({ count: 5 });

    const r = await seedManglendeKatalog("org-1");

    expect(r.expenseCategories).toEqual({ opprettet: 5, hoppet: false });
    expect(createMany).toHaveBeenCalledOnce();
    const arg = createMany.mock.calls[0]![0] as {
      data: Array<{ organizationId: string; navn: string }>;
    };
    expect(arg.data).toHaveLength(5);
    expect(arg.data.every((d) => d.organizationId === "org-1")).toBe(true);
    expect(arg.data.map((d) => d.navn)).toEqual([
      "Drivstoff",
      "Parkering",
      "Diett",
      "Verktøy",
      "Annet",
    ]);
  });

  it("eksisterende katalog → hopper, createMany aldri kalt (data urørt)", async () => {
    count.mockResolvedValue(3);

    const r = await seedManglendeKatalog("org-1");

    expect(r.expenseCategories).toEqual({ opprettet: 0, hoppet: true });
    expect(createMany).not.toHaveBeenCalled();
  });
});
