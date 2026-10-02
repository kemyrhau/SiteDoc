import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H21/C1 (LAG 1): matrisen skal ALDRI arve prosjektets koordinat for en byggeplass
 * uten eget punkt. Kjører UTEN DB (prisma + rute-service mocket).
 *
 * Kontrakten denne låser:
 *   - byggeplass uten eget punkt → INGEN matriserad beregnes for den (OSRM kalles
 *     kun med byggeplasser som har punkt), og den føres i `manglerPunkt`.
 *   - stale-rydding: eksisterende rader for den punktløse byggeplassen SLETTES
 *     (arv-baserte rader er gale og skal bort ved neste recompute).
 *   - par markert uoppnåelig (-1) telles i `uoppnaaelige`.
 */

const oppmotestedFindMany = vi.fn();
const byggeplassFindMany = vi.fn();
const matriseDeleteMany = vi.fn();
const matriseUpsert = vi.fn();
const transaction = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    oppmotested: { findMany: (...a: unknown[]) => oppmotestedFindMany(...a) },
    byggeplass: { findMany: (...a: unknown[]) => byggeplassFindMany(...a) },
    reisetidMatrise: {
      deleteMany: (...a: unknown[]) => matriseDeleteMany(...a),
      upsert: (...a: unknown[]) => matriseUpsert(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const hentKjoretidMatrise = vi.fn();
vi.mock("./rute-service", () => ({
  UOPPNAAELIG: -1,
  hentKjoretidMatrise: (...a: unknown[]) => hentKjoretidMatrise(...a),
}));

import { recomputeMatrise } from "./reisetidMatrise";

const ORG = "org-1";
const KONTOR = { id: "k1", lat: 59.9, lng: 10.7 };
const MED = { id: "b1", name: "Med punkt", projectId: "p1", latitude: 60.0, longitude: 10.5 };
const UTEN = { id: "b2", name: "Uten punkt", projectId: "p1", latitude: null, longitude: null };

beforeEach(() => {
  oppmotestedFindMany.mockReset();
  byggeplassFindMany.mockReset();
  matriseDeleteMany.mockReset();
  matriseUpsert.mockReset().mockReturnValue(Promise.resolve({}));
  transaction.mockReset().mockResolvedValue([]);
  hentKjoretidMatrise.mockReset();
});

describe("recomputeMatrise — H21/C1: ingen prosjekt-arv", () => {
  it("byggeplass uten eget punkt får INGEN matriserad og føres i manglerPunkt", async () => {
    oppmotestedFindMany.mockResolvedValue([KONTOR]);
    byggeplassFindMany.mockResolvedValue([MED, UTEN]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[30]], distances: [[5000]] });

    const res = await recomputeMatrise({ organizationId: ORG });

    // OSRM kalt KUN med byggeplassen som har eget punkt (ikke prosjekt-arv).
    expect(hentKjoretidMatrise).toHaveBeenCalledTimes(1);
    const [, destinasjoner] = hentKjoretidMatrise.mock.calls[0]!;
    expect(destinasjoner).toEqual([{ lat: 60.0, lng: 10.5 }]);

    // Den punktløse byggeplassen er rapportert, ikke beregnet.
    expect(res.manglerPunkt).toEqual([
      { byggeplassId: "b2", navn: "Uten punkt", projectId: "p1" },
    ]);
    expect(res.rader).toBe(1);
  });

  it("stale-rydding sletter eksisterende rader for den punktløse byggeplassen", async () => {
    oppmotestedFindMany.mockResolvedValue([KONTOR]);
    byggeplassFindMany.mockResolvedValue([MED, UTEN]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[30]], distances: [[5000]] });

    await recomputeMatrise({ organizationId: ORG });

    expect(matriseDeleteMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, byggeplassId: { in: ["b2"] } },
    });
  });

  it("par markert uoppnåelig (-1) telles i uoppnaaelige", async () => {
    oppmotestedFindMany.mockResolvedValue([KONTOR]);
    byggeplassFindMany.mockResolvedValue([MED]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[-1]], distances: [[-1]] });

    const res = await recomputeMatrise({ organizationId: ORG });

    expect(res.uoppnaaelige).toBe(1);
    expect(res.manglerPunkt).toEqual([]);
  });
});
