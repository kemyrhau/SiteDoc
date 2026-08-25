import { describe, it, expect } from "vitest";
import {
  HURTIGVALG_STANDARD,
  PERIODE_NOEKKEL,
  effektiveGrenser,
  innenforPeriode,
  erUgyldigIntervall,
  grenserForHurtigvalg,
  type Periode,
} from "./periode";

// Enekilde for web-PeriodeFilter OG mobil-RN-varianten — testene låser kontrakten begge
// flatene deler, så settet/matematikken ikke kan drifte.

describe("HURTIGVALG_STANDARD + nøkler", () => {
  // Kenneth-vedtak 2026-08-23: ÉTT sett, likt på web og mobil — «3mnd» er med i det delte settet,
  // ikke en per-flate-utvidelse. Ingen `valg`-prop noe sted; drift er umulig ved konstruksjon.
  it("standard-settet er de seks, likt på alle flater", () => {
    expect(HURTIGVALG_STANDARD).toEqual(["idag", "uke", "mnd", "3mnd", "alle", "egendefinert"]);
  });
  it("hvert hurtigvalg har en i18n-nøkkel", () => {
    for (const h of HURTIGVALG_STANDARD) expect(PERIODE_NOEKKEL[h]).toMatch(/^periodeFilter\./);
  });
});

describe("effektiveGrenser", () => {
  it("egendefinert bruker periodens egne datoer", () => {
    const fra = new Date("2026-01-01");
    const til = new Date("2026-02-01");
    expect(effektiveGrenser({ hurtigvalg: "egendefinert", fra, til })).toEqual({ fra, til });
  });
  it("alle → ingen grense", () => {
    expect(effektiveGrenser({ hurtigvalg: "alle", fra: null, til: null })).toEqual({ fra: null, til: null });
  });
  it("idag → fra satt (dagens start), til null", () => {
    const { fra, til } = grenserForHurtigvalg("idag");
    expect(fra).toBeInstanceOf(Date);
    expect(til).toBeNull();
  });
});

describe("innenforPeriode", () => {
  const fra = new Date("2026-03-10T00:00:00");
  const til = new Date("2026-03-12T00:00:00");
  it("til-dagen er inklusiv HELE dagen (til + 1 døgn)", () => {
    expect(innenforPeriode(new Date("2026-03-12T23:30:00"), fra, til)).toBe(true);
  });
  it("dato før fra → ute", () => {
    expect(innenforPeriode(new Date("2026-03-09T12:00:00"), fra, til)).toBe(false);
  });
  it("dato etter til-dagen → ute", () => {
    expect(innenforPeriode(new Date("2026-03-14T00:00:00"), fra, til)).toBe(false);
  });
  it("åpne ender (null) slipper alt gjennom", () => {
    expect(innenforPeriode(new Date("2020-01-01"), null, null)).toBe(true);
  });
});

describe("erUgyldigIntervall", () => {
  it("egendefinert med fra > til → ugyldig", () => {
    const p: Periode = { hurtigvalg: "egendefinert", fra: new Date("2026-05-02"), til: new Date("2026-05-01") };
    expect(erUgyldigIntervall(p)).toBe(true);
  });
  it("fra <= til → gyldig", () => {
    const p: Periode = { hurtigvalg: "egendefinert", fra: new Date("2026-05-01"), til: new Date("2026-05-02") };
    expect(erUgyldigIntervall(p)).toBe(false);
  });
  it("ikke-egendefinert → aldri ugyldig", () => {
    expect(erUgyldigIntervall({ hurtigvalg: "alle", fra: null, til: null })).toBe(false);
  });
});
