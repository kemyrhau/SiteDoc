import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-14 (10) B: manuell avstand er firmaets egen verdi og skal ALDRI
 * overskrives eller slettes av beregningen. Kjører UTEN DB.
 *
 * Kontrakten denne låser (testene går røde om vakten fjernes):
 *   - manuelt par hoppes over i upserten (ingen OSRM-verdi skrives over det).
 *   - stale-ryddingen for punktløse byggeplasser unntar manuelle rader.
 *   - flyttet punkt (`plasseringEndret`) → manuelle rader merkes "manuell_endret",
 *     verdien beholdes; uten flagget røres de ikke.
 */

const oppmotestedFindMany = vi.fn();
const byggeplassFindMany = vi.fn();
const matriseDeleteMany = vi.fn();
const matriseUpsert = vi.fn();
const matriseFindMany = vi.fn();
const matriseUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    oppmotested: { findMany: (...a: unknown[]) => oppmotestedFindMany(...a) },
    byggeplass: { findMany: (...a: unknown[]) => byggeplassFindMany(...a) },
    reisetidMatrise: {
      deleteMany: (...a: unknown[]) => matriseDeleteMany(...a),
      upsert: (...a: unknown[]) => matriseUpsert(...a),
      findMany: (...a: unknown[]) => matriseFindMany(...a),
      updateMany: (...a: unknown[]) => matriseUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const hentKjoretidMatrise = vi.fn();
vi.mock("./rute-service", () => ({
  UOPPNAAELIG: -1,
  hentKjoretidMatrise: (...a: unknown[]) => hentKjoretidMatrise(...a),
}));

import { erManuellKilde, koordinatEndret, recomputeMatrise } from "./reisetidMatrise";

const ORG = "org-1";
const K1 = { id: "k1", lat: 59.9, lng: 10.7 };
const K2 = { id: "k2", lat: 59.8, lng: 10.6 };
const B1 = { id: "b1", name: "Plass", projectId: "p1", latitude: 60.0, longitude: 10.5 };
const UTEN = { id: "b2", name: "Uten", projectId: "p1", latitude: null, longitude: null };

function upsertPar(): string[] {
  return matriseUpsert.mock.calls.map((c) => {
    const w = (c[0] as { where: { oppmotestedId_byggeplassId: { oppmotestedId: string; byggeplassId: string } } })
      .where.oppmotestedId_byggeplassId;
    return `${w.oppmotestedId}|${w.byggeplassId}`;
  });
}

beforeEach(() => {
  oppmotestedFindMany.mockReset();
  byggeplassFindMany.mockReset();
  matriseDeleteMany.mockReset();
  matriseUpsert.mockReset().mockReturnValue(Promise.resolve({}));
  matriseFindMany.mockReset().mockResolvedValue([]);
  matriseUpdateMany.mockReset().mockResolvedValue({ count: 0 });
  transaction.mockReset().mockResolvedValue([]);
  hentKjoretidMatrise.mockReset();
});

describe("recomputeMatrise — manuell vakt", () => {
  it("manuelt par overskrives ALDRI; beregnet par oppdateres", async () => {
    oppmotestedFindMany.mockResolvedValue([K1, K2]);
    byggeplassFindMany.mockResolvedValue([B1]);
    matriseFindMany.mockResolvedValue([{ oppmotestedId: "k1", byggeplassId: "b1" }]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[30], [40]], distances: [[5000], [7000]] });

    const res = await recomputeMatrise({ organizationId: ORG });

    expect(upsertPar()).toEqual(["k2|b1"]);
    expect(res.rader).toBe(1);
    // Oppslaget av manuelle par filtrerer på firma + kilde-prefiks.
    expect(matriseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG,
          kilde: { startsWith: "manuell" },
        }),
      }),
    );
  });

  it("stale-ryddingen sletter ikke manuelle rader for punktløs byggeplass", async () => {
    oppmotestedFindMany.mockResolvedValue([K1]);
    byggeplassFindMany.mockResolvedValue([UTEN]);

    await recomputeMatrise({ organizationId: ORG });

    expect(matriseDeleteMany).toHaveBeenCalledTimes(1);
    expect(matriseDeleteMany.mock.calls[0]![0]).toEqual({
      where: {
        organizationId: ORG,
        byggeplassId: { in: ["b2"] },
        NOT: { kilde: { startsWith: "manuell" } },
      },
    });
  });

  it("plasseringEndret → manuelle rader merkes manuell_endret, verdien står", async () => {
    oppmotestedFindMany.mockResolvedValue([K1]);
    byggeplassFindMany.mockResolvedValue([B1]);
    matriseFindMany.mockResolvedValue([{ oppmotestedId: "k1", byggeplassId: "b1" }]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[30]], distances: [[5000]] });

    await recomputeMatrise({ organizationId: ORG, byggeplassId: "b1", plasseringEndret: true });

    expect(matriseUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: ORG, kilde: { startsWith: "manuell" } }),
      data: { kilde: "manuell_endret" },
    });
    expect(upsertPar()).toEqual([]);
  });

  it("uten plasseringEndret røres ikke kilden", async () => {
    oppmotestedFindMany.mockResolvedValue([K1]);
    byggeplassFindMany.mockResolvedValue([B1]);
    matriseFindMany.mockResolvedValue([{ oppmotestedId: "k1", byggeplassId: "b1" }]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[30]], distances: [[5000]] });

    await recomputeMatrise({ organizationId: ORG, byggeplassId: "b1" });

    expect(matriseUpdateMany).not.toHaveBeenCalled();
  });
});

describe("hjelpere", () => {
  it("erManuellKilde dekker begge manuelle varianter", () => {
    expect(erManuellKilde("manuell")).toBe(true);
    expect(erManuellKilde("manuell_endret")).toBe(true);
    expect(erManuellKilde("osrm")).toBe(false);
  });

  it("koordinatEndret", () => {
    expect(koordinatEndret({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(false);
    expect(koordinatEndret({ lat: 1, lng: 2 }, { lat: 1, lng: 3 })).toBe(true);
    expect(koordinatEndret(null, { lat: 1, lng: 2 })).toBe(true);
  });
});
