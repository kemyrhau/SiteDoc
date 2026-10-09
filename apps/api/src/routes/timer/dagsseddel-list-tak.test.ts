import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `dagsseddel.list` — Kontrollør-funn 2026-10-09: taket (200) var stille. `list` returnerer
 * nå { sedler, totalt, grense } så klienten kan si «Viser X av N» i stedet for å skjule at
 * noe ble kuttet (stille tomhet forbudt).
 *
 * Test: 201 sedler i perioden → totalt=201, sedler.length=200 (grensen), grense=200.
 */

const resolverOrgFraInput = vi.fn();
vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn(),
  resolverOrgFraInput: (...a: unknown[]) => resolverOrgFraInput(...a),
  resolverOrgForEgenTimeføring: vi.fn(),
  verifiserAnsattIFirma: vi.fn(),
  erAnsattIFirma: vi.fn(),
}));
vi.mock("../../services/timer", () => ({ krevTimerAktivert: vi.fn(), hentEffektivArbeidstid: vi.fn() }));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { dagsseddelRouter } from "./dagsseddel";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";

const count = vi.fn();
const findMany = vi.fn();

function lagCaller() {
  const ctx = {
    userId: USER,
    prismaTimer: {
      dailySheet: {
        count: (...a: unknown[]) => count(...a),
        findMany: (...a: unknown[]) => findMany(...a),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dagsseddelRouter.createCaller(ctx);
}

describe("dagsseddel.list — ikke stille tak", () => {
  beforeEach(() => {
    resolverOrgFraInput.mockReset();
    count.mockReset();
    findMany.mockReset();
    resolverOrgFraInput.mockResolvedValue(ORG);
  });

  it("201 sedler → totalt=201, sedler kuttet til grense=200", async () => {
    count.mockResolvedValue(201);
    // Server-findMany respekterer `take`; simuler 200 returnerte rader.
    const rader = Array.from({ length: 200 }, (_, i) => ({
      id: `s${i}`,
      dato: new Date("2026-09-01"),
      status: "draft",
      attestertVed: null,
      timer: [],
      tillegg: [],
      maskiner: [],
      aktivitet: null,
    }));
    findMany.mockResolvedValue(rader);

    const svar = (await lagCaller().list({ organizationId: ORG })) as unknown as {
      sedler: unknown[];
      totalt: number;
      grense: number;
    };

    expect(svar.totalt).toBe(201);
    expect(svar.grense).toBe(200);
    expect(svar.sedler).toHaveLength(200);
    // findMany MÅ ha bedt om nøyaktig grensen (ikke ubegrenset).
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });

  it("under grensen → totalt == sedler.length (ingen avkutting)", async () => {
    count.mockResolvedValue(3);
    findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `s${i}`,
        dato: new Date("2026-09-01"),
        status: "draft",
        attestertVed: null,
        timer: [],
        tillegg: [],
        maskiner: [],
        aktivitet: null,
      })),
    );
    const svar = (await lagCaller().list({ organizationId: ORG })) as unknown as {
      sedler: unknown[];
      totalt: number;
    };
    expect(svar.totalt).toBe(3);
    expect(svar.sedler).toHaveLength(3);
  });
});
