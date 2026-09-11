import { describe, it, expect } from "vitest";
import { faggruppeNavn } from "../sjekkliste-faggruppe";

/**
 * Krav (c) på en klientkrasj: sjekklistesiden rendret hvit side med
 * `TypeError: Cannot read properties of null (reading 'name')` når en
 * faggruppe som var bestiller/utfører ble slettet (schema-relasjon SetNull →
 * feltet blir `null` på eksisterende sjekklister). Denne testen FEILER hvis
 * null-vakten fjernes igjen.
 */
describe("faggruppeNavn — null-vakt for slettet faggruppe", () => {
  it("gir tom streng for null (sorterings-/filterverdi-flate)", () => {
    expect(faggruppeNavn(null)).toBe("");
    expect(faggruppeNavn(undefined)).toBe("");
  });

  it("gir «—» for null når celle-fallback er satt", () => {
    expect(faggruppeNavn(null, "—")).toBe("—");
  });

  it("gir navnet uendret når faggruppen finnes", () => {
    expect(faggruppeNavn({ name: "Tømrer" })).toBe("Tømrer");
    expect(faggruppeNavn({ name: "Tømrer" }, "—")).toBe("Tømrer");
  });

  it("krasjer ikke når lista mapper en blanding av satt og slettet faggruppe", () => {
    // Reproduserer den faktiske krasj-inputen: én rad har mistet faggruppen.
    const rader: { bestillerFaggruppe: { name: string } | null }[] = [
      { bestillerFaggruppe: { name: "Byggherre" } },
      { bestillerFaggruppe: null },
    ];
    expect(() => rader.map((r) => faggruppeNavn(r.bestillerFaggruppe))).not.toThrow();
    // Filter-bygging: null faller ut (som "" via filter(Boolean)) — ikke et eget alternativ.
    const filterVerdier = [...new Set(
      rader.map((r) => faggruppeNavn(r.bestillerFaggruppe)).filter(Boolean),
    )];
    expect(filterVerdier).toEqual(["Byggherre"]);
  });
});
