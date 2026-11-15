import { describe, it, expect } from "vitest";
import {
  løsOppmote,
  finnFastOppmotested,
  trengerOppmoteValg,
  tilIsoDato,
  finnPeriodeKonflikt,
  type OppmotePeriodeInput,
} from "./oppmote";

// Fasit for POST 2026-11-15 (12) D. Hvert trinn i rekkefølgen har en test som
// blir rød hvis trinnet fjernes (negativkontroll).

const NARVIK = "kontor-narvik";
const RAMSUND = "kontor-ramsund";
const TROMSO = "kontor-tromso";
const E6 = "prosjekt-e6";
const ANNET = "prosjekt-annet";

const fast = (id: string, fra = "2026-01-01", til: string | null = null): OppmotePeriodeInput => ({
  type: "kontor",
  fast: true,
  oppmotestedId: id,
  projectId: null,
  fraDato: fra,
  tilDato: til,
});
const midl = (id: string, fra: string, til: string): OppmotePeriodeInput => ({
  type: "kontor",
  fast: false,
  oppmotestedId: id,
  projectId: null,
  fraDato: fra,
  tilDato: til,
});
const byggeplass = (prosjekt: string, fra: string, til: string | null): OppmotePeriodeInput => ({
  type: "byggeplass",
  fast: false,
  oppmotestedId: null,
  projectId: prosjekt,
  fraDato: fra,
  tilDato: til,
});

describe("løsOppmote — rekkefølgen", () => {
  it("trinn 1: byggeplass-periode på dagens prosjekt → byggeplass (vinner over GPS, midlertidig og fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31"), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, RAMSUND)).toEqual({ kilde: "byggeplass", projectId: E6 });
  });

  it("trinn 1 gjelder bare dagens prosjekt — annet prosjekt faller videre", () => {
    const perioder = [fast(NARVIK), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", ANNET, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 1 gjelder bare innenfor perioden", () => {
    const perioder = [fast(NARVIK), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2027-02-01", E6, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 2: GPS-start på kontor → det kontoret (vinner over midlertidig og fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, RAMSUND)).toEqual({ kilde: "gps", oppmotestedId: RAMSUND });
  });

  it("trinn 3: midlertidig kontor-periode → midlertidig (vinner over fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, null)).toEqual({ kilde: "midlertidig", oppmotestedId: TROMSO });
  });

  it("trinn 3: perioden er inklusiv i begge ender", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-01", null, perioder, null).kilde).toBe("midlertidig");
    expect(løsOppmote("2027-01-31", null, perioder, null).kilde).toBe("midlertidig");
    expect(løsOppmote("2027-02-01", null, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 4: fast kontor → fast", () => {
    expect(løsOppmote("2026-06-01", E6, [fast(NARVIK)], null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 4: fast sted gjelder ikke før fraDato", () => {
    expect(løsOppmote("2025-12-31", E6, [fast(NARVIK)], null)).toEqual({ kilde: "ikkeValgt" });
  });

  it("trinn 5: ingen perioder og ingen GPS → ikkeValgt (aldri gjetting)", () => {
    expect(løsOppmote("2026-06-01", E6, [], null)).toEqual({ kilde: "ikkeValgt" });
  });
});

describe("løsOppmote — Narvik → Ramsund og etterregistrering", () => {
  // Fast Narvik fra 1.1.2026; byttet til fast Ramsund 1.9.2026 (serveren lukker
  // Narvik med tilDato 31.8).
  const perioder = [fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")];

  it("dato etter byttet → Ramsund (fast)", () => {
    expect(løsOppmote("2026-10-01", E6, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: RAMSUND });
  });

  it("etterregistrering i gammel periode → det gamle stedet (Narvik)", () => {
    const r = løsOppmote("2026-08-15", E6, perioder, null);
    expect(r).toMatchObject({ oppmotestedId: NARVIK });
  });

  it("overlappende lukket periode: nyeste fraDato vinner", () => {
    const p = [fast(NARVIK, "2026-01-01", "2026-12-31"), midl(TROMSO, "2026-06-01", "2026-06-30")];
    expect(løsOppmote("2026-06-15", null, p, null)).toEqual({ kilde: "midlertidig", oppmotestedId: TROMSO });
  });
});

describe("hjelpere", () => {
  it("finnFastOppmotested gir gjeldende fast, ikke lukkede", () => {
    expect(finnFastOppmotested([fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")])).toBe(RAMSUND);
    expect(finnFastOppmotested([midl(TROMSO, "2026-12-01", "2027-01-31")])).toBeNull();
  });

  it("trengerOppmoteValg: kun ved ≥ 2 kontorer og aldri hatt fast sted", () => {
    expect(trengerOppmoteValg(2, [])).toBe(true);
    expect(trengerOppmoteValg(1, [])).toBe(false);
    expect(trengerOppmoteValg(0, [])).toBe(false);
    expect(trengerOppmoteValg(3, [fast(NARVIK)])).toBe(false);
    expect(trengerOppmoteValg(3, [byggeplass(E6, "2026-12-01", null)])).toBe(true);
    expect(trengerOppmoteValg(3, [midl(TROMSO, "2026-12-01", "2027-01-31")])).toBe(true);
  });

  it("tilIsoDato normaliserer Date og streng", () => {
    expect(tilIsoDato(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12-01");
    expect(tilIsoDato("2026-12-01T00:00:00.000Z")).toBe("2026-12-01");
  });
});

describe("finnPeriodeKonflikt", () => {
  it("midlertidig mot midlertidig: overlapp avvises, tilstøtende godtas", () => {
    const eks = [midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(finnPeriodeKonflikt(midl(RAMSUND, "2027-01-31", "2027-02-10"), eks)).toBe(eks[0]);
    expect(finnPeriodeKonflikt(midl(RAMSUND, "2027-02-01", "2027-02-10"), eks)).toBeNull();
  });

  it("midlertidig mot fast (også lukket historikk) er lov", () => {
    expect(finnPeriodeKonflikt(midl(TROMSO, "2026-06-01", "2026-06-30"), [fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")])).toBeNull();
  });

  it("byggeplass: samme prosjekt avvises, annet prosjekt godtas", () => {
    const eks = [byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(finnPeriodeKonflikt(byggeplass(E6, "2027-01-15", null), eks)).toBe(eks[0]);
    expect(finnPeriodeKonflikt(byggeplass(ANNET, "2027-01-15", null), eks)).toBeNull();
  });

  it("fast: må starte etter gjeldende fast, og skriver ikke om historikk", () => {
    const apen = fast(RAMSUND, "2026-09-01");
    const lukket = fast(NARVIK, "2026-01-01", "2026-08-31");
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-10-01"), [lukket, apen])).toBeNull();
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-09-01"), [lukket, apen])).toBe(apen);
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-08-01"), [lukket])).toBe(lukket);
  });
});
