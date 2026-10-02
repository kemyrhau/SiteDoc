import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C4 (LAG 1): «Beregn fra tegning» overskriver ALDRI et manuelt satt punkt — heller
 * ikke eksplisitt (kunHvisTom=false). Kartvelgeren overstyrer alltid. Kjører UTEN DB.
 *
 * Kontrakten:
 *   - geofenceKilde = "manuell" → oppdaterByggeplassGeofence returnerer null, INGEN update.
 *   - geofenceKilde = "tegning"/"geokodet"/"ukjent"/null → overskrives (kilde settes "tegning").
 */

const findUnique = vi.fn();
const update = vi.fn();
const drawingFindMany = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    byggeplass: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
    drawing: { findMany: (...a: unknown[]) => drawingFindMany(...a) },
  },
}));

const beregnByggeplassGeofence = vi.fn();
vi.mock("@sitedoc/shared", () => ({
  beregnByggeplassGeofence: (...a: unknown[]) => beregnByggeplassGeofence(...a),
}));

vi.mock("./reisetidMatrise", () => ({
  recomputeRadForByggeplass: vi.fn(),
}));

import { oppdaterByggeplassGeofence } from "./byggeplassGeofence";

const BP = "bp-1";

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({});
  drawingFindMany.mockReset().mockResolvedValue([{ geoReference: { punkter: [] } }]);
  beregnByggeplassGeofence.mockReset().mockReturnValue({ lat: 60, lng: 10, radiusM: 120 });
});

describe("oppdaterByggeplassGeofence — C4 manuell-vern", () => {
  it("RØD FØRST: manuelt punkt fredes mot eksplisitt «Beregn fra tegning» (kunHvisTom=false)", async () => {
    findUnique.mockResolvedValue({ latitude: 59.9, geofenceKilde: "manuell" });

    const res = await oppdaterByggeplassGeofence(BP, false);

    expect(res).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("tegnings-avledet punkt overskrives, og kilden settes 'tegning'", async () => {
    findUnique.mockResolvedValue({ latitude: 59.9, geofenceKilde: "tegning" });

    const res = await oppdaterByggeplassGeofence(BP, false);

    expect(res).toEqual({ lat: 60, lng: 10, radiusM: 120 });
    expect(update).toHaveBeenCalledWith({
      where: { id: BP },
      data: { latitude: 60, longitude: 10, radiusM: 120, geofenceKilde: "tegning" },
    });
  });

  it("ukjent-kilde (backfill) overskrives av tegning", async () => {
    findUnique.mockResolvedValue({ latitude: 59.9, geofenceKilde: "ukjent" });

    await oppdaterByggeplassGeofence(BP, false);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ geofenceKilde: "tegning" }) }),
    );
  });
});
