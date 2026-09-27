import { describe, it, expect } from "vitest";
import { ukjentTrafikklysVerdi } from "./trafikklysFallback";

/**
 * 🔴 Foreldreløs trafikklys-verdi — mobil (samme feil som web: en verdi utenfor TRAFIKKLYS_VALG
 * gjør at ingen brikke matcher → feltet ser ubesvart ut). Mobilens test-miljø er node-only (ingen
 * react-native render-harness), så beslutningen — «hva skal rendereren vise for denne verdien?» —
 * testes rent, slik de øvrige mobil-testene gjør. `ukjentTrafikklysVerdi` er kilden komponentens
 * fallback-brikke leser: returnerer den rå verdien når den er ukjent, ellers null.
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
