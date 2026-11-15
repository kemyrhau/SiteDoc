import { describe, it, expect } from "vitest";
import {
  beregnReiseAvvik,
  validerReiseInvarianter,
  lesOverforingRute,
  overforingKontrollNokkel,
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

describe("L2 6b — overføring (C2 + C3-nøkkel)", () => {
  const oppmotesteder = new Set(["kontor-a", "kontor-b"]);
  const regel = {
    kategori: "reisetid",
    overforing: {
      fra: { type: "kontor", oppmotestedId: "kontor-a" },
      til: { type: "kontor", oppmotestedId: "kontor-b" },
      periodeId: "p-1",
    },
  };
  const base: ReiseRadInvariantInput = {
    erReise: true,
    reiseRetning: "ut",
    reiseKilde: "overforing",
    reiseOppmotestedId: "kontor-a",
    reiseKjoretidMin: 95,
    reiseAvstandM: 110000,
    reiseRegel: regel,
  };

  it("gyldig kontor→kontor-overføring → null", () => {
    expect(validerReiseInvarianter(base, oppmotesteder)).toBeNull();
  });

  it("mangler retning / oppmøtested / kjøretid / rute → navngitt feil", () => {
    expect(validerReiseInvarianter({ ...base, reiseRetning: null }, oppmotesteder)).toMatch(/retning/);
    expect(validerReiseInvarianter({ ...base, reiseOppmotestedId: null }, oppmotesteder)).toMatch(/oppmøtested/);
    expect(validerReiseInvarianter({ ...base, reiseKjoretidMin: null }, oppmotesteder)).toMatch(/kjøretid/);
    expect(validerReiseInvarianter({ ...base, reiseKjoretidMin: -1 }, oppmotesteder)).toMatch(/kjøretid/);
    expect(
      validerReiseInvarianter({ ...base, reiseRegel: { kategori: "reisetid" } }, oppmotesteder),
    ).toMatch(/rute/);
  });

  it("rute-kontor fra annet firma → avvist", () => {
    const fremmed = {
      ...regel,
      overforing: { ...regel.overforing, til: { type: "kontor", oppmotestedId: "kontor-x" } },
    };
    expect(
      validerReiseInvarianter({ ...base, reiseRegel: fremmed }, oppmotesteder),
    ).toMatch(/tilhører firmaet/);
  });

  it("lesOverforingRute avviser byggeplass→byggeplass og ugyldig form", () => {
    expect(
      lesOverforingRute({
        overforing: {
          fra: { type: "byggeplass", projectId: "p1" },
          til: { type: "byggeplass", projectId: "p2" },
        },
      }),
    ).toBeNull();
    expect(lesOverforingRute({ overforing: { fra: { type: "kontor" }, til: null } })).toBeNull();
    expect(lesOverforingRute(null)).toBeNull();
  });

  it("C3-nøkkel: kontor-par normaliseres, samme kontor → null", () => {
    const rute = lesOverforingRute(regel)!;
    expect(overforingKontrollNokkel(rute, null)).toEqual({ type: "kontor", fra: "kontor-a", til: "kontor-b" });
    const motsatt = lesOverforingRute({
      overforing: { fra: regel.overforing.til, til: regel.overforing.fra },
    })!;
    expect(overforingKontrollNokkel(motsatt, null)).toEqual({ type: "kontor", fra: "kontor-a", til: "kontor-b" });
    const samme = lesOverforingRute({
      overforing: { fra: regel.overforing.fra, til: regel.overforing.fra },
    })!;
    expect(overforingKontrollNokkel(samme, null)).toBeNull();
  });

  it("C3-nøkkel: kontor↔byggeplass → matrise-celle med kontor-enden; uten byggeplassId → null", () => {
    const ut = lesOverforingRute({
      overforing: {
        fra: { type: "kontor", oppmotestedId: "kontor-a" },
        til: { type: "byggeplass", projectId: "p1" },
      },
    })!;
    expect(overforingKontrollNokkel(ut, "bp-1")).toEqual({
      type: "matrise",
      oppmotestedId: "kontor-a",
      byggeplassId: "bp-1",
    });
    const retur = lesOverforingRute({
      overforing: {
        fra: { type: "byggeplass", projectId: "p1" },
        til: { type: "kontor", oppmotestedId: "kontor-b" },
      },
    })!;
    expect(overforingKontrollNokkel(retur, "bp-1")).toEqual({
      type: "matrise",
      oppmotestedId: "kontor-b",
      byggeplassId: "bp-1",
    });
    expect(overforingKontrollNokkel(ut, null)).toBeNull();
  });
});
