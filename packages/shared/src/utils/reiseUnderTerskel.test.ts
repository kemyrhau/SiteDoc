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

  // Gate A1–A3 vilkår 2: «arbeidstid» fra regelen er ikke det samme som «under terskel».
  it("vilkår 2: km uten avstand → ikke merke (regelen ga arbeidstid fordi avstanden manglet)", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" } })).toBeNull();
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" }, reiseAvstandM: -1 })).toBeNull();
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelMin, regelKategori: "arbeidstid" } })).toBeNull();
  });

  it("vilkår 2: målt over terskelen med regelKategori «arbeidstid» (firma med arbeidstid over terskel) → ikke merke", () => {
    const overArbeidstid = { ...regelKm, overType: "arbeidstid", regelKategori: "arbeidstid" };
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: overArbeidstid, reiseAvstandM: 45000 })).toBeNull();
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: overArbeidstid, reiseAvstandM: 30000 })).toBeNull(); // på terskelen = over
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelMin, overType: "arbeidstid", regelKategori: "arbeidstid" }, reiseKjoretidMin: 40 })).toBeNull();
  });

  it("rå sammenligning: 29 950 m er under 30 000 m selv om begge vises som 30 km", () => {
    expect(reiseUnderTerskel({ erReise: true, reiseRegel: { ...regelKm, regelKategori: "arbeidstid" }, reiseAvstandM: 29950 }))
      .toEqual({ enhet: "km", maalt: 30, terskel: 30 });
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
