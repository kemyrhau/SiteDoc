import { describe, it, expect } from "vitest";
import { foreslaaLokasjon, skalForeslaaLokasjon, visLokasjon } from "./lokasjonForslag";

const geo = (lat1: number, lng1: number, lat2: number, lng2: number) => ({
  point1: { gps: { lat: lat1, lng: lng1 }, pixel: { x: 0, y: 0 } },
  point2: { gps: { lat: lat2, lng: lng2 }, pixel: { x: 100, y: 100 } },
});

const tegninger = [
  { id: "plan1", geoReference: geo(59.0, 10.0, 59.1, 10.1), byggeplassId: "blokkA" },
  { id: "plan2", geoReference: geo(59.05, 10.05, 59.2, 10.2), byggeplass: { id: "blokkB" } },
  { id: "snitt", geoReference: null, byggeplassId: "blokkA" },
];

describe("foreslaaLokasjon — GPS-treff → sist brukte → ingenting", () => {
  it("GPS-treff i én georeferert tegning → den, med byggeplass, kilde gps", () => {
    expect(
      foreslaaLokasjon({ tegninger, gps: { lat: 59.02, lng: 10.02 }, sistBygningId: null, sistTegningId: null }),
    ).toEqual({ tegningId: "plan1", byggeplassId: "blokkA", kilde: "gps" });
  });

  it("flere GPS-treff → sist brukte blant treffene vinner (byggeplass fra relasjonen)", () => {
    expect(
      foreslaaLokasjon({ tegninger, gps: { lat: 59.07, lng: 10.07 }, sistBygningId: "blokkB", sistTegningId: "plan2" }),
    ).toEqual({ tegningId: "plan2", byggeplassId: "blokkB", kilde: "gps" });
  });

  it("ingen GPS-treff → sist brukte byggeplass + tegning, kilde lagret", () => {
    expect(
      foreslaaLokasjon({ tegninger, gps: { lat: 63.4, lng: 10.4 }, sistBygningId: "blokkA", sistTegningId: "snitt" }),
    ).toEqual({ tegningId: "snitt", byggeplassId: "blokkA", kilde: "lagret" });
  });

  it("uten GPS (avslått/feilet) → sist brukte", () => {
    expect(
      foreslaaLokasjon({ tegninger, gps: null, sistBygningId: "blokkA", sistTegningId: "plan1" }),
    ).toEqual({ tegningId: "plan1", byggeplassId: "blokkA", kilde: "lagret" });
  });

  it("verken GPS-treff eller sist brukte → ingen forslag", () => {
    expect(
      foreslaaLokasjon({ tegninger, gps: { lat: 63.4, lng: 10.4 }, sistBygningId: null, sistTegningId: null }),
    ).toBeNull();
  });
});

describe("visLokasjon — showLocation-paritet med web", () => {
  it("false skjuler", () => {
    expect(visLokasjon({ showLocation: false })).toBe(false);
  });
  it("true og undefined (og manglende mal) viser", () => {
    expect(visLokasjon({ showLocation: true })).toBe(true);
    expect(visLokasjon({})).toBe(true);
    expect(visLokasjon(undefined)).toBe(true);
  });
});

describe("skalForeslaaLokasjon — kun utkast uten lokasjon", () => {
  it("utkast uten tegning og uten omfang → forslag", () => {
    expect(skalForeslaaLokasjon({ status: "draft", drawingId: null, lokasjonOmfang: null })).toBe(true);
  });
  it("sendt dokument → aldri forslag", () => {
    expect(skalForeslaaLokasjon({ status: "sent", drawingId: null, lokasjonOmfang: null })).toBe(false);
  });
  it("utkast med tegning → ingen forslag", () => {
    expect(skalForeslaaLokasjon({ status: "draft", drawingId: "plan1", lokasjonOmfang: null })).toBe(false);
  });
  it("utkast med omfang (byggeplass/område) → ingen forslag", () => {
    expect(skalForeslaaLokasjon({ status: "draft", drawingId: null, lokasjonOmfang: "byggeplass" })).toBe(false);
  });
});
