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

describe("klassifiserReise — skarp terskel", () => {
  const regel: ReiseRegelsett = {
    reiseTerskelMin: 30,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
  };

  it("under terskel → arbeidstid", () => {
    expect(klassifiserReise(29, regel)).toBe("arbeidstid");
  });

  it("nøyaktig terskel → reisetid (≥)", () => {
    expect(klassifiserReise(30, regel)).toBe("reisetid");
  });

  it("over terskel → reisetid", () => {
    expect(klassifiserReise(31, regel)).toBe("reisetid");
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
