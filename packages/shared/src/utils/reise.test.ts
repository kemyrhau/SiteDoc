import { describe, it, expect } from "vitest";
import {
  klassifiserReise,
  estimerReisetidMin,
  REISE_LONNSART_REGEX,
  type ReiseRegelsett,
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

describe("estimerReisetidMin", () => {
  it("0 avstand → 0 min", () => {
    expect(estimerReisetidMin(0)).toBe(0);
  });

  it("50 km ved 50 km/t → 60 min", () => {
    expect(estimerReisetidMin(50_000)).toBe(60);
  });
});
