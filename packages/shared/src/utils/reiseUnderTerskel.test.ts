import { describe, it, expect } from "vitest";
import { reiseUnderTerskel } from "./reiseUnderTerskel";

// A3 (plan § 4.17 del D, B55). Rød på develop: modulen fantes ikke.
const regelKm = { enhet: "km", terskelMin: 30, terskelM: 30000, underType: "arbeidstid", overType: "reisetid", kategori: "reisetid", grensepunktTreff: false };
const regelMin = { ...regelKm, enhet: "minutter", terskelM: null };

describe("reiseUnderTerskel", () => {
  it("reiselinje der regelen sa arbeidstid og arbeideren førte reisetid → merke med målt avstand og terskel (km)", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" }, reiseAvstandM: 22000 }))
      .toEqual({ enhet: "km", maalt: 22, terskel: 30 });
  });

  it("minutter: kjøretiden mot terskelMin", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelMin, regelKategori: "arbeidstid" }, reiseKjoretidMin: 18 }))
      .toEqual({ enhet: "minutter", maalt: 18, terskel: 30 });
  });

  it("uten måling på linja: terskelen står, målingen er null", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" } }))
      .toEqual({ enhet: "km", maalt: null, terskel: 30 });
  });

  it("negativkontroll: reise ført etter regelen (ingen regelKategori) får ikke merke", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: regelKm, reiseAvstandM: 22000 })).toBeNull();
  });

  it("negativkontroll: over terskel førte arbeidstid (regelKategori «reisetid») får ikke merke", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "reisetid" } })).toBeNull();
  });

  it("negativkontroll: ikke reiselinje (ført som arbeidstid) og eldre rader uten snapshot får ikke merke", () => {
    expect(reiseUnderTerskel({ erReise: false, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" } })).toBeNull();
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: null })).toBeNull();
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: "x" })).toBeNull();
  });
});
