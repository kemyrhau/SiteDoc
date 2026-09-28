import { describe, it, expect } from "vitest";
import { ukjentTrafikklysVerdi, trafikklysOpsjoner } from "@sitedoc/shared";

/**
 * 🔴 Foreldreløs trafikklys-verdi — mobil. Beslutningen bor nå i @sitedoc/shared
 * (`ukjentTrafikklysVerdi`, én kilde for web+mobil); mobilens test-miljø er node-only (ingen
 * react-native render-harness), så dette verifiserer at mobil-pakken konsumerer beslutningen
 * komponentens fallback-brikke leser. Rendringen selv er ikke harness-bar på mobil; PDF og web
 * dekker rendringen med egne flate-tester, og shared eier beslutnings-testen.
 */

describe("ukjentTrafikklysVerdi (mobil-rendererens fallback-beslutning)", () => {
  it("ukjent, ikke-tom streng → den RÅ verdien (rendreres som foreldreløs-brikke)", () => {
    expect(ukjentTrafikklysVerdi("foreldreloes-42")).toBe("foreldreloes-42");
  });
  it("gyldig verdi → null (normal brikke matcher, ingen fallback)", () => {
    expect(ukjentTrafikklysVerdi("green")).toBeNull();
    expect(ukjentTrafikklysVerdi("gray")).toBeNull();
  });
  it("tom/ikke-streng → null (ubesvart er ubesvart, ikke en foreldreløs verdi)", () => {
    expect(ukjentTrafikklysVerdi("")).toBeNull();
    expect(ukjentTrafikklysVerdi(null)).toBeNull();
    expect(ukjentTrafikklysVerdi(undefined)).toBeNull();
    expect(ukjentTrafikklysVerdi(123)).toBeNull();
  });
});

/**
 * Valgbart lyssett — mobil (krav c pkt 1/2). Mobilens test-miljø er node-only (ingen react-native
 * render-harness), så vi verifiserer den DELTE beslutningen mobil-rendreren leser lyssettet fra
 * (`trafikklysOpsjoner`). Selve rendringen dekkes av web + pdf; shared eier lyssett-logikken.
 */
describe("trafikklysOpsjoner (mobil-rendererens lyssett-kilde)", () => {
  it("(c1) egne options → nøyaktig dem, i rekkefølge, med egen etikett", () => {
    const valg = trafikklysOpsjoner([
      { value: "red", label: "Åpent" },
      { value: "green", label: "Lukket" },
    ]);
    expect(valg.map((v) => v.value)).toEqual(["red", "green"]);
    expect(valg.map((v) => v.tekst)).toEqual(["Åpent", "Lukket"]);
    expect(valg.every((v) => v.erI18nNokkel === false)).toBe(true);
  });
  it("(c2) uten options → kanonisk fire-lys sett (i18n-nøkler)", () => {
    const valg = trafikklysOpsjoner(undefined);
    expect(valg.map((v) => v.value)).toEqual(["green", "yellow", "red", "gray"]);
    expect(valg.every((v) => v.erI18nNokkel === true)).toBe(true);
  });
});
