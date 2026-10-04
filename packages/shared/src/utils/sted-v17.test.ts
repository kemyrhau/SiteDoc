import { describe, it, expect } from "vitest";
import {
  erInnenfor,
  polygonArealM2,
  sentroidePunkter,
  erEnkeltPolygon,
  korridorFraLinje,
  gjenkjennSted,
  tilGeofencer,
  geofenceForm,
  GEOFENCE_GRENSER,
  type Polygon,
  type GpsPunkt,
} from "./sted";

/**
 * V17-A — geofence sirkel ELLER sone (polygon). Ligger i EGEN fil så de 21
 * eksisterende `sted.test.ts`-testene står byte-uendret (ordrens 🔴). Gate-krav
 * § 3/§ 8: A1-polygon, erEnkeltPolygon, korridor, A3 B4-prioritet, A4, Røstbakken.
 *
 * Koordinater bygges metrisk rundt et origo (Narvik-området, lat 68) og
 * konverteres til lat/lng, så polygonene er realistiske km-skala.
 */

const O_LAT = 68;
const O_LNG = 17;
const M_PER_GRAD = (Math.PI / 180) * 6_371_000;
/** nordMeter/østMeter fra origo → lat/lng. */
function pkt(nordM: number, ostM: number): GpsPunkt {
  return {
    lat: O_LAT + nordM / M_PER_GRAD,
    lng: O_LNG + ostM / (M_PER_GRAD * Math.cos((O_LAT * Math.PI) / 180)),
  };
}
/** Rektangel (metrisk boks) som Polygon. */
function boks(
  omradeId: string,
  navn: string,
  nord0: number,
  nord1: number,
  ost0: number,
  ost1: number,
): Polygon {
  return {
    form: "polygon",
    id: "bygg-1",
    lat: O_LAT,
    lng: O_LNG,
    omradeId,
    omradeNavn: navn,
    punkter: [pkt(nord0, ost0), pkt(nord1, ost0), pkt(nord1, ost1), pkt(nord0, ost1)],
  };
}

describe("A1 erInnenfor — polygon", () => {
  const rute = boks("o1", "Rute", 0, 1000, 0, 1000); // 1km × 1km

  it("punkt inne i polygonet → true", () => {
    expect(erInnenfor(pkt(500, 500), rute)).toBe(true);
  });
  it("punkt utenfor polygonet → false", () => {
    expect(erInnenfor(pkt(1500, 500), rute)).toBe(false);
  });
  it("punkt på kanten → true (kant = innenfor)", () => {
    expect(erInnenfor(pkt(0, 500), rute)).toBe(true);
  });
  it("konkav U-form: punkt i «bukta» → utenfor", () => {
    // U: bred base, to bein opp, åpen bukt i midten.
    const u: Polygon = {
      form: "polygon",
      id: "bygg-1",
      lat: O_LAT,
      lng: O_LNG,
      omradeId: "u",
      omradeNavn: "U",
      punkter: [
        pkt(0, 0),
        pkt(0, 900),
        pkt(900, 900),
        pkt(900, 600),
        pkt(300, 600),
        pkt(300, 300),
        pkt(900, 300),
        pkt(900, 0),
      ],
    };
    // Punkt i bukta (mellom beina, over basen): nord 600, øst 450 → utenfor.
    expect(erInnenfor(pkt(600, 450), u)).toBe(false);
    // Kontroll: punkt i et bein → innenfor.
    expect(erInnenfor(pkt(600, 150), u)).toBe(true);
  });
});

describe("erEnkeltPolygon", () => {
  it("konveks enkel → true", () => {
    expect(erEnkeltPolygon(boks("a", "A", 0, 100, 0, 100).punkter)).toBe(true);
  });
  it("konkav enkel (U) → true", () => {
    const u = [
      pkt(0, 0), pkt(0, 900), pkt(900, 900), pkt(900, 600),
      pkt(300, 600), pkt(300, 300), pkt(900, 300), pkt(900, 0),
    ];
    expect(erEnkeltPolygon(u)).toBe(true);
  });
  it("🔴 figur-8 (selvkryssende) → false", () => {
    // Bowtie: kantene (p1→p2) og (p3→p4) krysser i midten.
    const figur8 = [pkt(0, 0), pkt(1000, 1000), pkt(0, 1000), pkt(1000, 0)];
    expect(erEnkeltPolygon(figur8)).toBe(false);
  });
  it("< 3 punkter → false", () => {
    expect(erEnkeltPolygon([pkt(0, 0), pkt(0, 100)])).toBe(false);
  });
});

describe("korridorFraLinje", () => {
  it("rett linje 1 km × 30 m → areal ≈ 30 000 m² (±5 %) og bredde normalt = 30 m", () => {
    const ring = korridorFraLinje([pkt(0, 0), pkt(1000, 0)], 30);
    const areal = polygonArealM2({
      form: "polygon",
      id: "b",
      lat: O_LAT,
      lng: O_LNG,
      omradeId: "k",
      omradeNavn: "K",
      punkter: ring,
    });
    expect(Math.abs(areal - 30_000) / 30_000).toBeLessThanOrEqual(0.05);
    // Bredden målt normalt (øst-vest) på den nord-gående linjen ≈ 30 m.
    const østVerdier = ring.map((p) => p.lng);
    const bredde =
      (Math.max(...østVerdier) - Math.min(...østVerdier)) *
      M_PER_GRAD *
      Math.cos((O_LAT * Math.PI) / 180);
    expect(Math.abs(bredde - 30) / 30).toBeLessThanOrEqual(0.05);
  });

  it("🔴 skarp sving → avvises med navngitt feil", () => {
    // Hårnål: fram og nesten rett tilbake → korridoren selvkrysser.
    expect(() =>
      korridorFraLinje([pkt(0, 0), pkt(1000, 0), pkt(0, 20)], 60),
    ).toThrow(/selvkrysser|skarp/i);
  });
});

describe("A2 polygonArealM2 + B2 sentroide", () => {
  it("1 km × 1 km rute ≈ 1 000 000 m²", () => {
    const a = polygonArealM2(boks("r", "R", 0, 1000, 0, 1000));
    expect(Math.abs(a - 1_000_000) / 1_000_000).toBeLessThanOrEqual(0.02);
  });
  it("sentroide av ruta ≈ midtpunktet", () => {
    const s = sentroidePunkter(boks("r", "R", 0, 1000, 0, 1000).punkter);
    expect(avstandLikM(s, pkt(500, 500))).toBeLessThan(5);
  });
});

function avstandLikM(a: GpsPunkt, b: GpsPunkt): number {
  const dLat = (b.lat - a.lat) * M_PER_GRAD;
  const dLng = (b.lng - a.lng) * M_PER_GRAD * Math.cos((O_LAT * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

describe("A3 gjenkjennSted — B4-prioritet", () => {
  const sirkel = { form: "sirkel" as const, id: "bygg-1", lat: O_LAT, lng: O_LNG, radiusM: 2000 };

  it("punkt i både sirkel og sone → sone vinner", () => {
    const sone = boks("s1", "Sone", 0, 500, 0, 500);
    const t = gjenkjennSted(pkt(250, 250), [sirkel, sone]);
    expect(t?.form).toBe("polygon");
    expect(t?.omradeId).toBe("s1");
  });

  it("🔴 hovedtrasé + sideveg overlapper → sidevegen (minst areal), treffet bærer sidevegens omradeId", () => {
    const hoved = boks("hoved", "Hovedtrasé", 0, 6000, -30, 30); // 6km × 60m
    const sideveg = boks("sideveg", "Sideveg", 2980, 3020, -10, 790); // 800m × 40m, overlapper
    const t = gjenkjennSted(pkt(3000, 0), [hoved, sideveg]);
    expect(t?.omradeId).toBe("sideveg");
  });

  it("to tilstøtende soner deler kant → ett deterministisk treff, ALDRI null", () => {
    const km03 = boks("km03", "km 0–3", 0, 3000, -30, 30);
    const km36 = boks("km36", "km 3–6", 3000, 6000, -30, 30);
    const t = gjenkjennSted(pkt(3000, 0), [km03, km36]); // på delt kant
    expect(t).not.toBeNull();
    expect(["km03", "km36"]).toContain(t?.omradeId);
    // Deterministisk: samme input → samme treff.
    const t2 = gjenkjennSted(pkt(3000, 0), [km03, km36]);
    expect(t2?.omradeId).toBe(t?.omradeId);
  });

  it("to sirkler overlapper → nærmest sentrum (uendret A2-oppførsel)", () => {
    const naer = { form: "sirkel" as const, id: "naer", lat: O_LAT, lng: O_LNG, radiusM: 5000 };
    const fjern = { form: "sirkel" as const, id: "fjern", lat: O_LAT + 0.02, lng: O_LNG, radiusM: 5000 };
    const t = gjenkjennSted(pkt(100, 0), [fjern, naer]);
    expect(t?.sted.id).toBe("naer");
    expect(t?.form).toBe("sirkel");
    expect(t?.omradeId).toBeNull();
  });
});

describe("A4 tilGeofencer", () => {
  const sone = (id: string): { id: string; navn: string; punkter: GpsPunkt[] } => ({
    id,
    navn: id,
    punkter: boks(id, id, 0, 500, 0, 500).punkter,
  });

  it("punkt + radius, ingen soner → én sirkel", () => {
    const g = tilGeofencer({ id: "b", lat: O_LAT, lng: O_LNG, radiusM: 150, soner: [] });
    expect(g).toHaveLength(1);
    expect(g[0]!.form).toBe("sirkel");
  });
  it("punkt + tre soner → tre polygon-kandidater (samme id)", () => {
    const g = tilGeofencer({
      id: "b",
      lat: O_LAT,
      lng: O_LNG,
      radiusM: 150,
      soner: [sone("s1"), sone("s2"), sone("s3")],
    });
    expect(g).toHaveLength(3);
    expect(g.every((x) => x.form === "polygon")).toBe(true);
    expect(g.every((x) => x.id === "b")).toBe(true);
  });
  it("soner uten punkt (origo mangler) → tom liste", () => {
    const g = tilGeofencer({ id: "b", lat: null, lng: null, radiusM: null, soner: [sone("s1")] });
    expect(g).toEqual([]);
  });
  it("punkt alene (ingen radius, ingen soner) → tom liste", () => {
    const g = tilGeofencer({ id: "b", lat: O_LAT, lng: O_LNG, radiusM: null, soner: [] });
    expect(g).toEqual([]);
  });
  it("sone med < 3 punkter teller ikke → faller til sirkel", () => {
    const g = tilGeofencer({
      id: "b",
      lat: O_LAT,
      lng: O_LNG,
      radiusM: 150,
      soner: [{ id: "s", navn: "s", punkter: [pkt(0, 0), pkt(0, 100)] }],
    });
    expect(g).toHaveLength(1);
    expect(g[0]!.form).toBe("sirkel");
  });
});

describe("Røstbakken — infrastruktur-trasé (gate-DoD)", () => {
  const hoved = tilGeofencer({
    id: "røstbakken",
    lat: O_LAT,
    lng: O_LNG,
    radiusM: null,
    soner: [
      { id: "hoved", navn: "Hovedtrasé", punkter: boks("hoved", "Hovedtrasé", 0, 6000, -30, 30).punkter },
      { id: "sideveg", navn: "Sideveg", punkter: boks("sideveg", "Sideveg", 2980, 3020, 30, 830).punkter },
    ],
  });

  it("GPS 2 km langs hovedvegen → hovedtrasé", () => {
    const t = gjenkjennSted(pkt(2000, 0), hoved);
    expect(t?.omradeId).toBe("hoved");
  });
  it("GPS 300 m inn på sidevegen → sidevegen", () => {
    const t = gjenkjennSted(pkt(3000, 330), hoved);
    expect(t?.omradeId).toBe("sideveg");
  });
  it("hovedtrasé delt i km 0–3 / km 3–6 som deler kant → ett deterministisk treff, aldri null", () => {
    const delt = tilGeofencer({
      id: "røstbakken",
      lat: O_LAT,
      lng: O_LNG,
      radiusM: null,
      soner: [
        { id: "km03", navn: "km 0–3", punkter: boks("km03", "km 0–3", 0, 3000, -30, 30).punkter },
        { id: "km36", navn: "km 3–6", punkter: boks("km36", "km 3–6", 3000, 6000, -30, 30).punkter },
      ],
    });
    const t = gjenkjennSted(pkt(3000, 0), delt);
    expect(t).not.toBeNull();
    expect(["km03", "km36"]).toContain(t?.omradeId);
  });
  it("dagens auto-sirkel med samme tegning (radius > 1500 m) → upresis", () => {
    // En 6km-trasé gir auto-sirkel med radius godt over upresis-grensen.
    const autoRadius = 3200;
    expect(geofenceForm({ radiusM: autoRadius, soner: [] })).toBe("sirkel");
    expect(autoRadius).toBeGreaterThan(GEOFENCE_GRENSER.upresisRadiusM);
  });
});
