import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ORDRE 29 — `dagsseddel.sistBrukteMaskiner`: brukerens sist brukte maskiner (nyeste
 * først, unike, N = 5) for maskinvelgeren.
 *
 * `sheetMachine.findMany` er en falsk som faktisk TOLKER where/orderBy/take mot et lite
 * datasett — så en manglende bruker- eller firma-grense gir fremmede maskiner, ikke en
 * grønn test. Negativkontroll: fjernes `userId` eller `organizationId` fra where-leddet,
 * blir «annen bruker / annet firma» rød.
 */

const ansatt = vi.fn();
vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn(),
  resolverOrgFraInput: vi.fn(),
  resolverOrgForEgenTimeføring: vi.fn(),
  verifiserAnsattIFirma: vi.fn(),
  erAnsattIFirma: (...a: unknown[]) => ansatt(...a),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn(),
  hentEffektivArbeidstid: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { dagsseddelRouter } from "./dagsseddel";

const ORG = "11111111-1111-1111-1111-111111111111";
const ANNET_ORG = "33333333-3333-3333-3333-333333333333";

type Rad = { vehicleId: string; createdAt: number; sheet: { userId: string; organizationId: string; dato: string } };
let rader: Rad[] = [];
const rad = (vehicleId: string, dato: string, userId = "u1", organizationId = ORG, createdAt = 0): Rad => ({
  vehicleId,
  createdAt,
  sheet: { userId, organizationId, dato },
});

type Where = { sheet?: { userId?: string; organizationId?: string } };
function findMany({ where, take }: { where: Where; take?: number }) {
  const treff = rader
    .filter(
      (r) =>
        (where.sheet?.userId === undefined || r.sheet.userId === where.sheet.userId) &&
        (where.sheet?.organizationId === undefined || r.sheet.organizationId === where.sheet.organizationId),
    )
    .sort((a, b) => b.sheet.dato.localeCompare(a.sheet.dato) || b.createdAt - a.createdAt)
    .slice(0, take ?? Infinity);
  return Promise.resolve(treff.map((r) => ({ vehicleId: r.vehicleId })));
}

function caller(userId = "u1") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dagsseddelRouter.createCaller({ userId, prismaTimer: { sheetMachine: { findMany } } } as any);
}

describe("ORDRE 29: dagsseddel.sistBrukteMaskiner", () => {
  beforeEach(() => {
    ansatt.mockReset().mockResolvedValue(true);
    rader = [];
  });

  it("nyeste først, unike, maks 5", async () => {
    rader = [
      rad("m1", "2026-11-01"),
      rad("m2", "2026-11-05"),
      rad("m3", "2026-11-04"),
      rad("m2", "2026-11-03"),
      rad("m4", "2026-11-02"),
      rad("m5", "2026-10-30"),
      rad("m6", "2026-10-29"),
      rad("m7", "2026-11-05", "u1", ORG, 5), // samme dag som m2, registrert senere
    ];
    expect(await caller().sistBrukteMaskiner({ organizationId: ORG })).toEqual(["m7", "m2", "m3", "m4", "m1"]);
  });

  it("🔴 annen bruker og annet firma gir tomt", async () => {
    rader = [rad("fremmed-bruker", "2026-11-05", "u2"), rad("fremmed-firma", "2026-11-05", "u1", ANNET_ORG)];
    expect(await caller().sistBrukteMaskiner({ organizationId: ORG })).toEqual([]);
    // Kontroll: eieren selv ser sine.
    expect(await caller("u2").sistBrukteMaskiner({ organizationId: ORG })).toEqual(["fremmed-bruker"]);
    expect(await caller().sistBrukteMaskiner({ organizationId: ANNET_ORG })).toEqual(["fremmed-firma"]);
  });

  it("ikke ansatt i firmaet → tom liste, ingen oppslag", async () => {
    rader = [rad("m1", "2026-11-05")];
    ansatt.mockResolvedValue(false);
    expect(await caller().sistBrukteMaskiner({ organizationId: ORG })).toEqual([]);
    expect(ansatt).toHaveBeenCalledWith("u1", ORG);
  });
});
