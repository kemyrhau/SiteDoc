import { describe, it, expect } from "vitest";
import {
  klassifiserReise,
  løsReiseLonnsartId,
  grensepunktTraff,
  erReiseLonnsart,
  REISE_LONNSART_REGEX,
  type ReiseRegelsett,
  type ReiseGrensepunkt,
  type ErReiseKontekst,
} from "./reise";

/**
 * Teller aktive lønnsart-navn som matcher reise-regexen — samme logikk som
 * serverens `organisasjon.hentSetting` (delt REISE_LONNSART_REGEX). Testet her
 * så de tre varsel-tilstandene (0 / 1 / ≥2 treff) er låst mot regelen.
 */
function tellReiseTreff(navn: string[]): number {
  return navn.filter((n) => REISE_LONNSART_REGEX.test(n)).length;
}

describe("REISE_LONNSART_REGEX — tvetydighets-telling (varsel-tilstander)", () => {
  it("0 treff → rødt varsel (ingen art tolkes som reise)", () => {
    expect(
      tellReiseTreff(["Timelønn", "Overtid 50 %", "Bilgodtgjørelse", "Kjøring"]),
    ).toBe(0);
  });

  it("1 treff → stille (A.Markussens tilstand)", () => {
    expect(
      tellReiseTreff([
        "Timelønn",
        "Overtid 50 %",
        "Reise/transport til/fra prosjekter",
      ]),
    ).toBe(1);
  });

  it("≥2 treff → amber varsel (tvetydig)", () => {
    expect(
      tellReiseTreff([
        "Timelønn",
        "Reise/transport til prosjekter",
        "Transport av masser",
        "Reise 15–30 km",
      ]),
    ).toBe(3);
  });

  it("matcher uavhengig av store/små bokstaver, og gjenbruk er trygt (ingen g-flagg)", () => {
    expect(REISE_LONNSART_REGEX.test("REISE")).toBe(true);
    expect(REISE_LONNSART_REGEX.test("reise")).toBe(true);
    // Uten g-flagg bærer regexen ingen lastIndex-tilstand mellom kall.
    expect(REISE_LONNSART_REGEX.test("Transport")).toBe(true);
    expect(REISE_LONNSART_REGEX.test("Transport")).toBe(true);
  });
});

describe("klassifiserReise — enhet minutter (skarp terskel)", () => {
  const regel: ReiseRegelsett = {
    reiseTerskelEnhet: "minutter",
    reiseTerskelMin: 30,
    reiseTerskelM: null,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
  };

  it("under terskel → arbeidstid", () => {
    expect(klassifiserReise({ reisetidMin: 29, avstandM: null }, regel)).toBe(
      "arbeidstid",
    );
  });

  it("nøyaktig terskel → reisetid (≥)", () => {
    expect(klassifiserReise({ reisetidMin: 30, avstandM: null }, regel)).toBe(
      "reisetid",
    );
  });

  it("over terskel → reisetid", () => {
    expect(klassifiserReise({ reisetidMin: 31, avstandM: null }, regel)).toBe(
      "reisetid",
    );
  });

  it("ignorerer avstand når enhet er minutter", () => {
    // Stor avstand, men lav tid under terskel → arbeidstid (tiden styrer).
    expect(
      klassifiserReise({ reisetidMin: 10, avstandM: 99_000 }, regel),
    ).toBe("arbeidstid");
  });
});

describe("klassifiserReise — enhet km (skarp terskel på avstand)", () => {
  // 15 km = 15000 m.
  const regel: ReiseRegelsett = {
    reiseTerskelEnhet: "km",
    reiseTerskelMin: 30,
    reiseTerskelM: 15_000,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
  };

  it("under terskel → arbeidstid", () => {
    expect(
      klassifiserReise({ reisetidMin: 999, avstandM: 14_999 }, regel),
    ).toBe("arbeidstid");
  });

  it("nøyaktig terskel → reisetid (≥)", () => {
    expect(
      klassifiserReise({ reisetidMin: 1, avstandM: 15_000 }, regel),
    ).toBe("reisetid");
  });

  it("over terskel → reisetid", () => {
    expect(
      klassifiserReise({ reisetidMin: 1, avstandM: 15_001 }, regel),
    ).toBe("reisetid");
  });

  it("ignorerer tid når enhet er km (avstand styrer)", () => {
    // Lang tid, men kort avstand under terskel → arbeidstid.
    expect(
      klassifiserReise({ reisetidMin: 300, avstandM: 5_000 }, regel),
    ).toBe("arbeidstid");
  });

  it("avstand mangler (null) → konservativt under-type (gate c)", () => {
    expect(
      klassifiserReise({ reisetidMin: 300, avstandM: null }, regel),
    ).toBe("arbeidstid");
  });

  it("avstand uoppnåelig (-1) → konservativt under-type", () => {
    expect(
      klassifiserReise({ reisetidMin: 300, avstandM: -1 }, regel),
    ).toBe("arbeidstid");
  });

  it("terskel ikke satt (reiseTerskelM null) → konservativt under-type", () => {
    const utenTerskel: ReiseRegelsett = { ...regel, reiseTerskelM: null };
    expect(
      klassifiserReise({ reisetidMin: 300, avstandM: 99_000 }, utenTerskel),
    ).toBe("arbeidstid");
  });
});

describe("løsReiseLonnsartId — grensepunkter (determinisme)", () => {
  // A.Markussens skala målt på test 07.09: 7,5–15–30–45–60 km. Fire bånd +
  // tak-hull over 60 km (siste bånds øvre kant uttrykkes med et null-punkt).
  const skala: ReiseGrensepunkt[] = [
    { grenseM: 7_500, lonnsartId: "art-7-15" },
    { grenseM: 15_000, lonnsartId: "art-15-30" },
    { grenseM: 30_000, lonnsartId: "art-30-45" },
    { grenseM: 45_000, lonnsartId: "art-45-60" },
    { grenseM: 60_000, lonnsartId: null }, // over 60 km: ingen art → fallback
  ];

  it("avstand i et bånd → båndets art (deterministisk, ikke tilfeldig av fem)", () => {
    expect(løsReiseLonnsartId(20_000, skala, "fallback")).toBe("art-15-30");
    expect(løsReiseLonnsartId(8_000, skala, "fallback")).toBe("art-7-15");
    expect(løsReiseLonnsartId(50_000, skala, "fallback")).toBe("art-45-60");
  });

  it("nøyaktig på et grensepunkt → det punktet (inklusiv nedre, ≥)", () => {
    expect(løsReiseLonnsartId(15_000, skala, "fallback")).toBe("art-15-30");
    expect(løsReiseLonnsartId(7_500, skala, "fallback")).toBe("art-7-15");
  });

  it("under laveste grense → fallback (ingen bånd dekker kort reise)", () => {
    expect(løsReiseLonnsartId(5_000, skala, "fallback")).toBe("fallback");
    expect(løsReiseLonnsartId(0, skala, "fallback")).toBe("fallback");
  });

  it("over tak-hull (null-punkt) → fallback, ikke feil forrige bånd", () => {
    // 70 km: høyeste punkt ≤ 70000 er 60000 (null) → fallback, IKKE art-45-60.
    expect(løsReiseLonnsartId(70_000, skala, "fallback")).toBe("fallback");
  });

  it("hull mellom bånd (lonnsartId null) → fallback", () => {
    const medHull: ReiseGrensepunkt[] = [
      { grenseM: 7_500, lonnsartId: "A" },
      { grenseM: 15_000, lonnsartId: null }, // hull 15–20 km
      { grenseM: 20_000, lonnsartId: "B" },
    ];
    expect(løsReiseLonnsartId(17_000, medHull, "fallback")).toBe("fallback");
    expect(løsReiseLonnsartId(25_000, medHull, "fallback")).toBe("B");
    expect(løsReiseLonnsartId(10_000, medHull, "fallback")).toBe("A");
  });

  it("rekkefølge-uavhengig (samme svar uansett innkommende sortering)", () => {
    const stokket: ReiseGrensepunkt[] = [
      { grenseM: 30_000, lonnsartId: "art-30-45" },
      { grenseM: 7_500, lonnsartId: "art-7-15" },
      { grenseM: 15_000, lonnsartId: "art-15-30" },
    ];
    expect(løsReiseLonnsartId(20_000, stokket, "fallback")).toBe("art-15-30");
  });

  it("avstand mangler (null) → fallback (konservativt, jf. gate c)", () => {
    expect(løsReiseLonnsartId(null, skala, "fallback")).toBe("fallback");
  });

  it("avstand uoppnåelig (-1) → fallback", () => {
    expect(løsReiseLonnsartId(-1, skala, "fallback")).toBe("fallback");
  });

  it("REGRESJON: firma UTEN bånd → nøyaktig fallback (som i dag, ingenting brekt)", () => {
    expect(løsReiseLonnsartId(20_000, [], "eksplisitt-art")).toBe("eksplisitt-art");
    expect(løsReiseLonnsartId(20_000, [], null)).toBe(null);
    // Selv med avstand null og ingen bånd: uendret fallback.
    expect(løsReiseLonnsartId(null, [], "eksplisitt-art")).toBe("eksplisitt-art");
  });
});

describe("grensepunktTraff — avgjorde et bånd lønnsarten? (L2-B snapshot)", () => {
  const skala: ReiseGrensepunkt[] = [
    { grenseM: 7_500, lonnsartId: "art-7-15" },
    { grenseM: 15_000, lonnsartId: null }, // hull 15–20 km
    { grenseM: 20_000, lonnsartId: "art-20+" },
  ];

  it("treff i et bånd MED art → true (samme grense-lesing som løsReiseLonnsartId)", () => {
    expect(grensepunktTraff(10_000, skala)).toBe(true);
    expect(grensepunktTraff(25_000, skala)).toBe(true);
  });

  it("treff i et hull (lonnsartId null) → false (fallback bestemte, ikke bånd)", () => {
    expect(grensepunktTraff(17_000, skala)).toBe(false);
  });

  it("under laveste grense / ingen bånd / avstand mangler → false", () => {
    expect(grensepunktTraff(5_000, skala)).toBe(false);
    expect(grensepunktTraff(20_000, [])).toBe(false);
    expect(grensepunktTraff(null, skala)).toBe(false);
    expect(grensepunktTraff(-1, skala)).toBe(false);
  });
});

// ===========================================================================
//  erReiseLonnsart (LAG 2) — ÉN regel delt av backfill-SQL + serverens skrivestier.
//  Speiler dagens leser (M3): konfigurert art ∪ grensepunkt-arter, ellers navne-
//  match KUN for firmaer uten konfigurert reiseLonnsartId.
// ===========================================================================
describe("erReiseLonnsart — delt reise-flagg-regel (backfill-speil)", () => {
  const medKonfigurert: ErReiseKontekst = {
    reiseLonnsartId: "reise-art",
    grensepunktLonnsartIds: ["band-25", "band-50"],
  };
  const utenKonfigurert: ErReiseKontekst = {
    reiseLonnsartId: null,
    grensepunktLonnsartIds: ["band-25"],
  };

  it("konfigurert reise-art → true", () => {
    expect(erReiseLonnsart("reise-art", "Hva som helst", medKonfigurert)).toBe(true);
  });

  it("grensepunkt-art (avstandsbånd) → true, uansett navn", () => {
    expect(erReiseLonnsart("band-50", "Tillegg", medKonfigurert)).toBe(true);
    expect(erReiseLonnsart("band-25", "Noe", utenKonfigurert)).toBe(true);
  });

  it("🔴 navne-match IGNORERES når firmaet HAR konfigurert reise-art (unngår falske positive)", () => {
    // «Transporttillegg» matcher regexen, men firmaet har en eksplisitt reise-art
    // → navnet skal ikke fryses som sannhet. Rød først: en naiv regex-only-regel
    // ville satt true her.
    expect(erReiseLonnsart("annen-art", "Transporttillegg", medKonfigurert)).toBe(false);
  });

  it("navne-match brukes KUN når reiseLonnsartId mangler", () => {
    expect(erReiseLonnsart("x", "Reise til prosjekt", utenKonfigurert)).toBe(true);
    expect(erReiseLonnsart("x", "Transport av masser", utenKonfigurert)).toBe(true);
  });

  it("ordinær lønnsart → false (begge kontekster)", () => {
    expect(erReiseLonnsart("ordinaer", "Timelønn", medKonfigurert)).toBe(false);
    expect(erReiseLonnsart("ordinaer", "Timelønn", utenKonfigurert)).toBe(false);
  });

  it("regelen er identisk med leser-regexen (REISE_LONNSART_REGEX)", () => {
    // Navne-grenen SKAL bruke samme regex som dagens leser — ingen ny gjetning.
    for (const navn of ["Reise", "transport", "REISEGODTGJØRELSE"]) {
      expect(erReiseLonnsart("x", navn, utenKonfigurert)).toBe(
        REISE_LONNSART_REGEX.test(navn),
      );
    }
  });
});
