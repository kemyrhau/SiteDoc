import { describe, it, expect } from "vitest";
import { GEOFENCE_GRENSER } from "@sitedoc/shared";
import { erUpresisSirkel } from "../geofenceUpresis";

/*
 * V17-B spec § 8.6 — en auto-sirkel større enn GEOFENCE_UPRESIS_RADIUS_M SKAL merkes
 * «upresis». Testen feiler rød om terskelen flyttes eller sone-unntaket ryker.
 */
const GRENSE = GEOFENCE_GRENSER.upresisRadiusM; // 1500

describe("erUpresisSirkel (B-7)", () => {
  it("🔴 sirkel over grensen er upresis (auto-sirkel 3000 m)", () => {
    expect(erUpresisSirkel({ radiusM: 3000, geofenceKilde: "tegning" })).toBe(true);
  });

  it("sirkel akkurat på grensen er IKKE upresis (streng >)", () => {
    expect(erUpresisSirkel({ radiusM: GRENSE, geofenceKilde: "tegning" })).toBe(false);
  });

  it("liten sirkel er ikke upresis", () => {
    expect(erUpresisSirkel({ radiusM: 150, geofenceKilde: "geokodet" })).toBe(false);
  });

  it("sone-byggeplass er aldri upresis (radius irrelevant, B9) — selv med stor radius", () => {
    expect(erUpresisSirkel({ radiusM: 9999, geofenceKilde: "soner" })).toBe(false);
  });

  it("uten radius er ikke upresis", () => {
    expect(erUpresisSirkel({ radiusM: null, geofenceKilde: "manuell" })).toBe(false);
  });
});
