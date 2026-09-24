import { describe, it, expect } from "vitest";
import {
  byggBakkerutenett,
  nyBakkeAkkumulator,
  DEFAULT_MALAVSTAND_M,
} from "./bakkeOverflate";

type P = { x: number; y: number; z: number; klasse: number };

describe("byggBakkerutenett — min-Z pr. rute (uklassifisert)", () => {
  it("velger laveste Z i hver rute og merker bakkeMetode='minZ'", () => {
    // To punkter i SAMME 0,15 m-rute (x 0,00 og 0,05) + ett i nabo-rute
    const punkter: P[] = [
      { x: 0.0, y: 0.0, z: 10.0, klasse: 1 }, // høyt (f.eks. gravemaskin)
      { x: 0.05, y: 0.02, z: 2.0, klasse: 1 }, // bakken i samme rute
      { x: 1.0, y: 0.0, z: 3.0, klasse: 1 }, // annen rute
    ];
    const res = byggBakkerutenett(punkter, { harKlassifisering: false });

    expect(res.bakkeMetode).toBe("minZ");
    expect(res.malavstandM).toBe(DEFAULT_MALAVSTAND_M);
    expect(res.punktAntall).toBe(2); // to ruter
    const rute0 = res.rutepunkter.find((p) => p.x < 0.15)!;
    // 🔴 Gravemaskinen (z=10) forkastes, bakken (z=2) beholdes
    expect(rute0.z).toBe(2.0);
  });
});

describe("byggBakkerutenett — klasse 2 (klassifisert)", () => {
  it("bruker KUN klasse 2 og merker bakkeMetode='klasse2'", () => {
    const punkter: P[] = [
      { x: 0.0, y: 0.0, z: 2.0, klasse: 2 }, // bakke
      { x: 0.05, y: 0.0, z: 1.5, klasse: 5 }, // høy vegetasjon UNDER bakkepunktet
      { x: 1.0, y: 0.0, z: 3.0, klasse: 6 }, // bygning — skal ignoreres
    ];
    const res = byggBakkerutenett(punkter, { harKlassifisering: true });

    expect(res.bakkeMetode).toBe("klasse2");
    expect(res.punktAntall).toBe(1); // kun bakkepunktet
    // 🔴 Selv om vegetasjonspunktet har lavere Z (1.5), velges klasse-2-bakken (2.0)
    expect(res.rutepunkter[0]!.z).toBe(2.0);
  });

  it("gir tomt rutenett hvis ingen klasse-2-punkter finnes", () => {
    const punkter: P[] = [{ x: 0, y: 0, z: 1, klasse: 5 }];
    const res = byggBakkerutenett(punkter, { harKlassifisering: true });
    expect(res.punktAntall).toBe(0);
    expect(res.bakkeMetode).toBe("klasse2");
  });
});

describe("byggBakkerutenett — malavstand", () => {
  it("respekterer eksplisitt malavstandM og styrer rute-inndelingen", () => {
    const punkter: P[] = [
      { x: 0.0, y: 0, z: 1, klasse: 1 },
      { x: 0.3, y: 0, z: 1, klasse: 1 },
    ];
    // 0,15 m: to ruter. 1 m: én rute.
    expect(byggBakkerutenett(punkter, { harKlassifisering: false, malavstandM: 0.15 }).punktAntall).toBe(2);
    expect(byggBakkerutenett(punkter, { harKlassifisering: false, malavstandM: 1 }).punktAntall).toBe(1);
  });

  it("avviser malavstandM <= 0", () => {
    expect(() => nyBakkeAkkumulator({ harKlassifisering: false, malavstandM: 0 })).toThrow(/malavstandM/);
    expect(() => nyBakkeAkkumulator({ harKlassifisering: false, malavstandM: -1 })).toThrow(/malavstandM/);
  });
});
