import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C2 (LAG 1): adresse i opprett-dialogen geokodes på server. Kjører UTEN DB.
 *
 * Kontrakten:
 *   - NØYAKTIG ett treff → punkt settes (lat/lng), radiusM = 150, geofenceKilde = "geokodet".
 *   - null ELLER flere treff → ingen punkt, byggeplassen opprettes likevel.
 *   - geokoding som feiler → opprettelsen går gjennom (best-effort, aldri blokkerende).
 *   - ingen adresse → sokAdresser kalles ikke, byggeplass uten punkt.
 *
 * `sokAdresser` mockes via en mutbar impl-variabel (ikke en vi.fn-spion): en spion som
 * returnerer/ kaster en avvist verdi lekker state mellom tester under `mockReset` og gir
 * en vitest-false-positive «unhandled rejection». Ren variabel + egen kall-teller unngår det.
 */

let sokKall = 0;
let sokSvar: () => Promise<{ lat: number; lng: number; label: string }[]>;

vi.mock("../services/rute-service", () => ({
  sokAdresser: (adresse: string) => {
    sokKall++;
    void adresse;
    return sokSvar();
  },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/reisetidMatrise", () => ({
  recomputeRadForByggeplass: vi.fn(),
}));
vi.mock("../services/byggeplassGeofence", () => ({
  oppdaterByggeplassGeofence: vi.fn(),
}));

import { byggeplassRouter } from "./byggeplass";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";

function lagCtx(create: ReturnType<typeof vi.fn>) {
  return {
    userId: "user-1",
    prisma: {
      byggeplass: {
        aggregate: vi.fn().mockResolvedValue({ _max: { number: 2 } }),
        create: create,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  sokKall = 0;
  sokSvar = async () => [];
});

describe("byggeplass.opprett — C2 geokoding", () => {
  it("nøyaktig ett treff → punkt + radius 150 + kilde 'geokodet'", async () => {
    sokSvar = async () => [{ lat: 59.91, lng: 10.75, label: "Storgata 1" }];
    const create = vi.fn().mockResolvedValue({ id: "b1" });
    const caller = byggeplassRouter.createCaller(lagCtx(create));

    await caller.opprett({ name: "Plass", projectId: PROSJEKT, address: "Storgata 1" });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        latitude: 59.91,
        longitude: 10.75,
        radiusM: 150,
        geofenceKilde: "geokodet",
      }),
    });
  });

  it("GATE: flere treff → ingen punkt, men byggeplassen opprettes", async () => {
    sokSvar = async () => [
      { lat: 1, lng: 2, label: "A" },
      { lat: 3, lng: 4, label: "B" },
    ];
    const create = vi.fn().mockResolvedValue({ id: "b1" });
    const caller = byggeplassRouter.createCaller(lagCtx(create));

    await caller.opprett({ name: "Plass", projectId: PROSJEKT, address: "Tvetydig" });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]![0].data;
    expect(data.latitude).toBeUndefined();
    expect(data.geofenceKilde).toBeUndefined();
  });

  it("GATE: geokoding som feiler → opprettelsen går gjennom uten punkt", async () => {
    sokSvar = () => {
      throw new Error("Kartverket nede");
    };
    const create = vi.fn().mockResolvedValue({ id: "b1" });
    const caller = byggeplassRouter.createCaller(lagCtx(create));

    await expect(
      caller.opprett({ name: "Plass", projectId: PROSJEKT, address: "Storgata 1" }),
    ).resolves.toBeDefined();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data.latitude).toBeUndefined();
  });

  it("ingen adresse → sokAdresser kalles ikke, ingen punkt", async () => {
    const create = vi.fn().mockResolvedValue({ id: "b1" });
    const caller = byggeplassRouter.createCaller(lagCtx(create));

    await caller.opprett({ name: "Plass", projectId: PROSJEKT });

    expect(sokKall).toBe(0);
    expect(create.mock.calls[0]![0].data.latitude).toBeUndefined();
  });
});
