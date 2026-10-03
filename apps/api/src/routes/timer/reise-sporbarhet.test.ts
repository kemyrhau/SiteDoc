import { describe, it, expect } from "vitest";
import {
  beregnReiseAvvik,
  validerReiseInvarianter,
  REISEAVVIK_MIN_PROSENT,
  REISEAVVIK_MIN_AVSTAND_M,
  REISEAVVIK_MIN_KJORETID_MIN,
  REISE_AVSTAND_MAKS_M,
  type ReiseRadInvariantInput,
} from "./reise-sporbarhet";

/**
 * LAG 2 (C2/C3) — serverens MOTTAK av reise-sporet. Rene regler, testet uten DB.
 * C3 = dobbel terskel (prosent OG absolutt). C2 = invarianter ved eksplisitt erReise.
 */

describe("C3 — beregnReiseAvvik (dobbel terskel)", () => {
  it("konstantene står som spec (10 % · 2000 m · 10 min)", () => {
    expect(REISEAVVIK_MIN_PROSENT).toBe(10);
    expect(REISEAVVIK_MIN_AVSTAND_M).toBe(2000);
    expect(REISEAVVIK_MIN_KJORETID_MIN).toBe(10);
  });

  it("manglende celle → null (kan ikke kontrolleres)", () => {
    expect(
      beregnReiseAvvik({ avstandM: 42000, kjoretidMin: 48 }, null),
    ).toBeNull();
  });

  it("avstand: >10 % men < 2000 m → false", () => {
    // celle 10000 m, rad 11500 m: +15 % men bare 1500 m avvik.
    expect(
      beregnReiseAvvik(
        { avstandM: 11500, kjoretidMin: 10 },
        { avstandM: 10000, kjoretidMin: 10 },
      ),
    ).toBe(false);
  });

  it("avstand: >2000 m men < 10 % → false", () => {
    // celle 50000 m, rad 52500 m: +2500 m men bare +5 %.
    expect(
      beregnReiseAvvik(
        { avstandM: 52500, kjoretidMin: 10 },
        { avstandM: 50000, kjoretidMin: 10 },
      ),
    ).toBe(false);
  });

  it("avstand: >10 % OG >2000 m → true", () => {
    // celle 10000 m, rad 13000 m: +30 % og +3000 m.
    expect(
      beregnReiseAvvik(
        { avstandM: 13000, kjoretidMin: 10 },
        { avstandM: 10000, kjoretidMin: 10 },
      ),
    ).toBe(true);
  });

  it("kjøretid: >10 % men < 10 min → false", () => {
    // celle 60 min, rad 68 min: +13 % men bare +8 min.
    expect(
      beregnReiseAvvik(
        { avstandM: 100, kjoretidMin: 68 },
        { avstandM: 100, kjoretidMin: 60 },
      ),
    ).toBe(false);
  });

  it("kjøretid: >10 min men < 10 % → false", () => {
    // celle 200 min, rad 215 min: +15 min men bare +7,5 %.
    expect(
      beregnReiseAvvik(
        { avstandM: 100, kjoretidMin: 215 },
        { avstandM: 100, kjoretidMin: 200 },
      ),
    ).toBe(false);
  });

  it("kjøretid: >10 % OG >10 min → true", () => {
    // celle 60 min, rad 80 min: +33 % og +20 min.
    expect(
      beregnReiseAvvik(
        { avstandM: 100, kjoretidMin: 80 },
        { avstandM: 100, kjoretidMin: 60 },
      ),
    ).toBe(true);
  });

  it("avvik i ÉN dimensjon er nok → true", () => {
    // avstand ok, kjøretid langt unna.
    expect(
      beregnReiseAvvik(
        { avstandM: 10000, kjoretidMin: 120 },
        { avstandM: 10000, kjoretidMin: 60 },
      ),
    ).toBe(true);
  });

  it("uoppnåelig/manglende rad-tall i en dimensjon → den dimensjonen bidrar ikke", () => {
    expect(
      beregnReiseAvvik(
        { avstandM: null, kjoretidMin: 60 },
        { avstandM: -1, kjoretidMin: 60 },
      ),
    ).toBe(false);
  });
});

describe("C2 — validerReiseInvarianter (eksplisitt erReise)", () => {
  const oppmotesteder = new Set(["kontor-1"]);
  const base: ReiseRadInvariantInput = {
    erReise: true,
    reiseRetning: "ut",
    reiseKilde: "matrise",
    reiseOppmotestedId: "kontor-1",
    reiseKjoretidMin: 48,
    reiseAvstandM: 42000,
    reiseRegel: { kategori: "reisetid" },
  };

  it("gyldig matrise-reise → null (ingen feil)", () => {
    expect(validerReiseInvarianter(base, oppmotesteder)).toBeNull();
  });

  it("🔴 erReise uten reiseKilde → navngitt feil (gate-test e)", () => {
    const feil = validerReiseInvarianter(
      { ...base, reiseKilde: null },
      oppmotesteder,
    );
    expect(feil).toMatch(/kilde/i);
  });

  it("erReise uten retning → feil", () => {
    expect(
      validerReiseInvarianter({ ...base, reiseRetning: null }, oppmotesteder),
    ).toMatch(/retning/i);
  });

  it("matrise uten kjøretid/avstand/regel → feil", () => {
    expect(
      validerReiseInvarianter({ ...base, reiseKjoretidMin: null }, oppmotesteder),
    ).toMatch(/kjøretid/i);
    expect(
      validerReiseInvarianter({ ...base, reiseAvstandM: null }, oppmotesteder),
    ).toMatch(/avstand/i);
    expect(
      validerReiseInvarianter({ ...base, reiseRegel: null }, oppmotesteder),
    ).toMatch(/regel/i);
  });

  it("manuell reise trenger ikke kjøretid/avstand/regel", () => {
    expect(
      validerReiseInvarianter(
        {
          erReise: true,
          reiseRetning: "retur",
          reiseKilde: "manuell",
          reiseOppmotestedId: null,
          reiseKjoretidMin: null,
          reiseAvstandM: null,
          reiseRegel: null,
        },
        oppmotesteder,
      ),
    ).toBeNull();
  });

  it("🔴 (a) B4 valg A: manuell reise UTEN retning → gyldig (retning er informasjon, ikke lønn)", () => {
    // Manuell-UI har ingen retningsvelger. Rød før C2-endringen: retning krevdes
    // for alle erReise-rader. Nå kreves retning KUN for matrise-kilde.
    expect(
      validerReiseInvarianter(
        {
          erReise: true,
          reiseRetning: null,
          reiseKilde: "manuell",
          reiseOppmotestedId: null,
          reiseKjoretidMin: null,
          reiseAvstandM: null,
          reiseRegel: null,
        },
        oppmotesteder,
      ),
    ).toBeNull();
  });

  it("🔴 (b) matrise-reise UTEN retning → avvises fortsatt (retning + tall påkrevd for matrise)", () => {
    expect(
      validerReiseInvarianter(
        { ...base, reiseRetning: null },
        oppmotesteder,
      ),
    ).toMatch(/retning/i);
  });

  it("oppmøtested utenfor firmaet → feil (firma-grense)", () => {
    expect(
      validerReiseInvarianter(
        { ...base, reiseOppmotestedId: "fremmed-kontor" },
        oppmotesteder,
      ),
    ).toMatch(/oppmøtested/i);
  });

  it("avstand over maks → feil", () => {
    expect(
      validerReiseInvarianter(
        { ...base, reiseAvstandM: REISE_AVSTAND_MAKS_M + 1 },
        oppmotesteder,
      ),
    ).toMatch(/overstiger/i);
  });

  it("ikke-reise-rad med reise-felter → feil (stille-tomhet-speil)", () => {
    expect(
      validerReiseInvarianter(
        {
          erReise: false,
          reiseRetning: "ut",
          reiseKilde: null,
          reiseOppmotestedId: null,
          reiseKjoretidMin: null,
          reiseAvstandM: null,
          reiseRegel: null,
        },
        oppmotesteder,
      ),
    ).toMatch(/ikke-reise/i);
  });

  it("ren ikke-reise-rad → null", () => {
    expect(
      validerReiseInvarianter(
        {
          erReise: false,
          reiseRetning: null,
          reiseKilde: null,
          reiseOppmotestedId: null,
          reiseKjoretidMin: null,
          reiseAvstandM: null,
          reiseRegel: null,
        },
        oppmotesteder,
      ),
    ).toBeNull();
  });
});
