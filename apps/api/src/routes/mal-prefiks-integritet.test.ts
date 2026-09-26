import { describe, it, expect, vi } from "vitest";

/**
 * mal-prefiks-integritet (ordre): to saker i mal.ts.
 *
 * 1. Suffiksering ved prefiks-kollisjon lagde EKTE normkoder: «UM1.1» → «UM1.12», som selv
 *    finnes i NS 3420 Del U. Nå: uniformt skilletegn «-» → «UM1.1-2», som ikke er en normkode.
 * 2. `oppdaterMal` Zod `prefix: z.string().max(20).optional()` manglet `.min(1)` — prefiks
 *    kunne blankes til "". Nå avvises tom/blank.
 *
 * Begge har tester som FEILER hvis fiksen fjernes (verifisert rød-først mot develop).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserAdmin: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOpprettFlytMedlemskap: vi.fn(),
}));

import { finnLedigeMalVerdier, malRouter } from "./mal";

// --- 1. Suffiksering ------------------------------------------------------------------
function prismaMed(prefikser: string[]) {
  return {
    reportTemplate: {
      findMany: vi.fn().mockResolvedValue(
        prefikser.map((p) => ({ name: `Mal ${p}`, prefix: p, category: "sjekkliste" })),
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("finnLedigeMalVerdier — suffiks lager ikke ekte normkoder", () => {
  it("kollisjon på «UM1.1» → «UM1.1-2», IKKE «UM1.12» (ekte Del U-kode)", async () => {
    const res = await finnLedigeMalVerdier(prismaMed(["UM1.1"]), "p1", "sjekkliste", "Navn", "UM1.1");
    expect(res.prefix).toBe("UM1.1-2");
    expect(res.prefix).not.toBe("UM1.12"); // ← ville vært en ekte normkode
  });

  it("dobbel kollisjon («UM1.1» + «UM1.1-2») → «UM1.1-3»", async () => {
    const res = await finnLedigeMalVerdier(
      prismaMed(["UM1.1", "UM1.1-2"]),
      "p1",
      "sjekkliste",
      "Navn",
      "UM1.1",
    );
    expect(res.prefix).toBe("UM1.1-3");
  });

  it("ingen kollisjon → prefiks urørt (punktum bevart)", async () => {
    const res = await finnLedigeMalVerdier(prismaMed([]), "p1", "sjekkliste", "Navn", "UM1.1");
    expect(res.prefix).toBe("UM1.1");
  });
});

// --- 2. oppdaterMal: prefiks kan ikke blankes til "" ----------------------------------
function ctxMock() {
  const prisma = {
    reportTemplate: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        projectId: "p1",
        category: "sjekkliste",
        domain: "bygg",
        subdomain: null,
        name: "M",
        prefix: "OLD",
      }),
      findMany: vi.fn().mockResolvedValue([]), // sjekkMalUnikhet: ingen kollisjon
      update: vi.fn().mockResolvedValue({ id: "m1" }),
    },
    task: { count: vi.fn().mockResolvedValue(0) },
    checklist: { count: vi.fn().mockResolvedValue(0) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      reportTemplate: { update: vi.fn().mockResolvedValue({ id: "m1" }) },
      dokumentflytMal: { deleteMany: vi.fn(), createMany: vi.fn() },
    })),
  };
  return {
    userId: "u1",
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const MAL = "66666666-6666-6666-6666-666666666666";

describe("mal.oppdaterMal — prefiks kan ikke blankes til tom", () => {
  it("gyldig prefiks «KX9» → oppdateres (kontroll: mocken dekker happy path)", async () => {
    await expect(
      malRouter.createCaller(ctxMock()).oppdaterMal({ id: MAL, prefix: "KX9" }),
    ).resolves.toBeDefined();
  });

  it("tom streng «» → avvises av Zod (RØD før .min(1))", async () => {
    await expect(
      malRouter.createCaller(ctxMock()).oppdaterMal({ id: MAL, prefix: "" }),
    ).rejects.toThrow();
  });

  it("bare mellomrom «   » → avvises av regex", async () => {
    await expect(
      malRouter.createCaller(ctxMock()).oppdaterMal({ id: MAL, prefix: "   " }),
    ).rejects.toThrow();
  });
});
