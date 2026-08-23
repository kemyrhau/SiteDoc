import { describe, it, expect } from "vitest";
import { innenforPeriode, effektiveGrenser, erUgyldigIntervall, type Periode } from "../periode";

const d = (s: string) => new Date(`${s}T12:00:00`);

describe("innenforPeriode", () => {
  it("åpen ende når begge grenser er null → alt passerer", () => {
    expect(innenforPeriode(d("2026-01-01"), null, null)).toBe(true);
  });
  it("kun fra → dato >= fra (åpen slutt)", () => {
    const fra = d("2026-08-01");
    expect(innenforPeriode(d("2026-08-01"), fra, null)).toBe(true);
    expect(innenforPeriode(d("2026-07-31"), fra, null)).toBe(false);
    expect(innenforPeriode(d("2027-01-01"), fra, null)).toBe(true);
  });
  it("kun til → dato <= til, HELE til-dagen inklusiv (åpen start)", () => {
    const til = new Date("2026-08-10T00:00:00"); // midnatt
    expect(innenforPeriode(d("2026-08-10"), null, til)).toBe(true); // samme dag, kl 12 → inne
    expect(innenforPeriode(d("2026-08-11"), null, til)).toBe(false);
  });
  it("fra > til → tom (ingen dato passerer begge)", () => {
    expect(innenforPeriode(d("2026-08-05"), d("2026-08-10"), d("2026-08-01"))).toBe(false);
  });
});

describe("effektiveGrenser", () => {
  it("egendefinert bruker periodens egne datoer", () => {
    const p: Periode = { hurtigvalg: "egendefinert", fra: d("2026-01-01"), til: d("2026-02-01") };
    expect(effektiveGrenser(p)).toEqual({ fra: p.fra, til: p.til });
  });
  it("alle → ingen grenser", () => {
    expect(effektiveGrenser({ hurtigvalg: "alle", fra: null, til: null })).toEqual({ fra: null, til: null });
  });
  it("idag/uke/mnd → fra satt, til null (åpen fremover)", () => {
    for (const h of ["idag", "uke", "mnd"] as const) {
      const g = effektiveGrenser({ hurtigvalg: h, fra: null, til: null });
      expect(g.fra).toBeInstanceOf(Date);
      expect(g.til).toBeNull();
    }
  });
});

describe("erUgyldigIntervall", () => {
  it("egendefinert med fra > til → true", () => {
    expect(erUgyldigIntervall({ hurtigvalg: "egendefinert", fra: d("2026-08-10"), til: d("2026-08-01") })).toBe(true);
  });
  it("egendefinert med kun én dato → false (åpen ende er gyldig)", () => {
    expect(erUgyldigIntervall({ hurtigvalg: "egendefinert", fra: d("2026-08-10"), til: null })).toBe(false);
    expect(erUgyldigIntervall({ hurtigvalg: "egendefinert", fra: null, til: d("2026-08-01") })).toBe(false);
  });
  it("ikke-egendefinert → alltid false", () => {
    expect(erUgyldigIntervall({ hurtigvalg: "alle", fra: d("2026-08-10"), til: d("2026-08-01") })).toBe(false);
  });
});
