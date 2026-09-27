import { describe, it, expect } from "vitest";
import { ukjentTrafikklysVerdi } from "@sitedoc/shared";

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
