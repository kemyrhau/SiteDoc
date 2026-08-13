import { describe, it, expect } from "vitest";
import {
  beregnTransformasjon,
  gpsTilTegning,
  tegningTilGps,
} from "./georeferanse";
import type { GeoReferanse } from "../types";

/**
 * Georef 2-punkts speilfeil (P0, 2026-08-13).
 *
 * Bug: 2-punkts-grenen fittet en orienterings-BEVARENDE similaritet
 * ([a b; −b a], det = a²+b² > 0). GPS→bilde er alltid orienterings-REVERSERENDE
 * (lat øker nordover, pixel-y nedover), så korrekt transform må ha det < 0.
 * De to kalibreringspunktene traff eksakt (0 m), men alle andre posisjoner ble
 * speilet om linjen P1–P2. Feltverifisert Lakselv lufthavn 2026-08-13.
 */

/** cosLat slik beregnTransformasjon regner den (middelbreddegrad av 2 punkter). */
function cosLatAv(lat1: number, lat2: number): number {
  return Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
}

/**
 * Sann NORD-OPP-referansetransform (fasit): øst → +x, nord → −y (pixel-y ned),
 * isotropisk skala S. Dette er nettopp en refleksjons-similaritet (det = −S² < 0)
 * — det korrekte tilfellet en 2-punkts-kalibrering skal gjenskape.
 */
function nordOpp(
  lat0: number,
  lng0: number,
  cosLat: number,
  S: number,
): (lat: number, lng: number) => { x: number; y: number } {
  return (lat, lng) => ({
    x: S * (lng - lng0) * cosLat + 50,
    y: -S * (lat - lat0) + 50,
  });
}

/** Signert kryssprodukt (side av linje A→B for punkt A→P). */
function kryss(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

describe("georeferanse — 2-punkts similaritet (speilfeil-fiks)", () => {
  it("nord-opp: et tredje kjent punkt lander riktig, ikke speilet", () => {
    // Syntetisk nord-opp-tegning nær ekvator (cosLat ≈ 1), sentrert i (50,50).
    // P1 sør-vest (20,80), P2 nord-øst (80,20). Tredjepunkt lat=0.2,lng=0 →
    // forventet (20, 50); en speiling om P1–P2-linjen (x+y=100) ville gitt (50,80).
    const cosLat = cosLatAv(0, 0.4);
    const fasit = nordOpp(0.2, 0.2, cosLat, 150);
    const ref: GeoReferanse = {
      point1: { gps: { lat: 0, lng: 0 }, pixel: fasit(0, 0) },
      point2: { gps: { lat: 0.4, lng: 0.4 }, pixel: fasit(0.4, 0.4) },
    };
    const t = beregnTransformasjon(ref);

    const tredje = gpsTilTegning({ lat: 0.2, lng: 0 }, t);
    const forventet = fasit(0.2, 0); // korrekt (ikke-speilet) posisjon ≈ (20, 50)
    expect(tredje.x).toBeCloseTo(forventet.x, 3);
    expect(tredje.y).toBeCloseTo(forventet.y, 3);

    // Kiralitet: korrekt GPS→bilde er orienterings-reverserende → det < 0.
    const { a, b, d, e } = t.affine!;
    expect(a * e - b * d).toBeLessThan(0);

    // Kalibreringspunktene treffes fortsatt eksakt.
    const p1 = gpsTilTegning(ref.point1.gps, t);
    expect(p1.x).toBeCloseTo(ref.point1.pixel.x, 6);
    expect(p1.y).toBeCloseTo(ref.point1.pixel.y, 6);
  });

  it("rundtur: tegningTilGps(gpsTilTegning(p)) ≈ p for flere p", () => {
    const cosLat = cosLatAv(59.9, 60.1);
    const fasit = nordOpp(60, 10.7, cosLat, 3000);
    const ref: GeoReferanse = {
      point1: { gps: { lat: 60.02, lng: 10.72 }, pixel: fasit(60.02, 10.72) },
      point2: { gps: { lat: 59.98, lng: 10.68 }, pixel: fasit(59.98, 10.68) },
    };
    const t = beregnTransformasjon(ref);

    for (const gps of [
      { lat: 60.0, lng: 10.7 },
      { lat: 60.01, lng: 10.71 },
      { lat: 59.99, lng: 10.69 },
      { lat: 60.005, lng: 10.695 },
    ]) {
      const rundt = tegningTilGps(gpsTilTegning(gps, t), t);
      expect(rundt.lat).toBeCloseTo(gps.lat, 9);
      expect(rundt.lng).toBeCloseTo(gps.lng, 9);
    }
  });

  it("reelle Lakselv-data: test-GPS lander på riktig (øst) side, ikke speilet vest", () => {
    // P1/P2 fra felt (2026-08-13). Pixel-koordinater konstrueres fra en sann
    // nord-opp-tegning over de reelle GPS-punktene; fiksen skal gjenskape den
    // (bug-en ville plassert test-punktet speilet om P1–P2-linjen).
    const P1 = { lat: 70.07422, lng: 24.98941 };
    const P2 = { lat: 70.05976, lng: 24.93339 };
    const testGps = { lat: 70.067883, lng: 24.980824 }; // terminalen, ØST for rullebanen
    const cosLat = cosLatAv(P1.lat, P2.lat);
    const lat0 = (P1.lat + P2.lat) / 2;
    const lng0 = (P1.lng + P2.lng) / 2;
    const fasit = nordOpp(lat0, lng0, cosLat, 2000);

    const ref: GeoReferanse = {
      point1: { gps: P1, pixel: fasit(P1.lat, P1.lng) },
      point2: { gps: P2, pixel: fasit(P2.lat, P2.lng) },
    };
    const t = beregnTransformasjon(ref);

    // Fiksen skal reprodusere den sanne (ØST-riktige) posisjonen, ikke speilet.
    const kode = gpsTilTegning(testGps, t);
    const forventet = fasit(testGps.lat, testGps.lng);
    const tol = 0.5; // < 0,5 % av tegningsbredde (0–100)
    expect(Math.abs(kode.x - forventet.x)).toBeLessThan(tol);
    expect(Math.abs(kode.y - forventet.y)).toBeLessThan(tol);

    // Orienterings-reversering: test-punktets side i pixel-rommet er MOTSATT av
    // siden i GPS-rommet (en speilfeil ville gitt SAMME side). Dette er «øst,
    // ikke speilet vest» uttrykt uavhengig av tegningens rotasjon.
    const p1px = ref.point1.pixel;
    const p2px = ref.point2.pixel;
    const sidePix = kryss(p1px.x, p1px.y, p2px.x, p2px.y, kode.x, kode.y);
    const sideGps = kryss(
      P1.lng * cosLat,
      P1.lat,
      P2.lng * cosLat,
      P2.lat,
      testGps.lng * cosLat,
      testGps.lat,
    );
    expect(Math.sign(sidePix)).toBe(-Math.sign(sideGps));

    // det < 0 (kiralitet).
    const { a, b, d, e } = t.affine!;
    expect(a * e - b * d).toBeLessThan(0);
  });

  it("3+-punkts affine-grenen er uendret (regresjonsvern)", () => {
    // Rotert/skalert affine — treffer alle punkter og runder tur eksakt.
    const cosLat = cosLatAv(59.9, 60.1);
    const ref: GeoReferanse = {
      point1: { gps: { lat: 60.0, lng: 10.7 }, pixel: { x: 20, y: 20 } },
      point2: { gps: { lat: 60.0, lng: 10.8 }, pixel: { x: 80, y: 30 } },
      ekstraPunkter: [
        { gps: { lat: 59.95, lng: 10.7 }, pixel: { x: 25, y: 75 } },
      ],
    };
    const t = beregnTransformasjon(ref);
    void cosLat;

    const punkter = [ref.point1, ref.point2, ref.ekstraPunkter![0]!];
    for (const p of punkter) {
      const px = gpsTilTegning(p.gps, t);
      expect(px.x).toBeCloseTo(p.pixel.x, 6);
      expect(px.y).toBeCloseTo(p.pixel.y, 6);
      const back = tegningTilGps(p.pixel, t);
      expect(back.lat).toBeCloseTo(p.gps.lat, 9);
      expect(back.lng).toBeCloseTo(p.gps.lng, 9);
    }
  });
});
