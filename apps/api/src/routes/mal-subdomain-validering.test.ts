import { describe, it, expect } from "vitest";
import { valideerSubdomainKombinasjon } from "./mal";

/**
 * Kontraktssak-runde 1: `valideerSubdomainKombinasjon` er ÉN eier for lovlige
 * (domain, subdomain, category)-kombinasjoner (LOVLIG_SUBDOMAIN, svar-notat § 3).
 * Neste leser møter regelen der den håndheves, ikke i en schema-kommentar som drifter.
 *
 * Krav (ordre § Krav og tester): kontrakt+oppgave (ok) · kontrakt+sjekkliste (avvist) ·
 * kontrakt+hms (avvist). Pluss at eksisterende HMS-regler (avvik/sja/ruh) er BEVART.
 */
describe("valideerSubdomainKombinasjon — kontraktssak + bevarte HMS-regler", () => {
  it("kontrakt + oppgave + domain=bygg → OK (ingen throw)", () => {
    expect(() => valideerSubdomainKombinasjon("bygg", "kontrakt", "oppgave")).not.toThrow();
  });

  it("kontrakt + sjekkliste → avvist (feil dokument-form)", () => {
    expect(() => valideerSubdomainKombinasjon("bygg", "kontrakt", "sjekkliste")).toThrow(
      /oppgave-format/i,
    );
  });

  it("kontrakt + category=hms → avvist med «kan ikke være HMS»", () => {
    expect(() => valideerSubdomainKombinasjon("bygg", "kontrakt", "hms")).toThrow(
      /kan ikke være HMS/i,
    );
  });

  it("kontrakt + domain=hms → avvist med «kan ikke være HMS» (uansett akse)", () => {
    expect(() => valideerSubdomainKombinasjon("hms", "kontrakt", "oppgave")).toThrow(
      /kan ikke være HMS/i,
    );
  });

  it("kontrakt under domain=kvalitet → avvist (ikke lovlig par)", () => {
    expect(() => valideerSubdomainKombinasjon("kvalitet", "kontrakt", "oppgave")).toThrow(
      /ikke lovlig/i,
    );
  });

  // Bevarte HMS-regler (eksisterende avvik/sja/ruh):
  it("avvik + oppgave + domain=hms → OK", () => {
    expect(() => valideerSubdomainKombinasjon("hms", "avvik", "hms")).not.toThrow();
    expect(() => valideerSubdomainKombinasjon("hms", "avvik", "oppgave")).not.toThrow();
  });

  it("sja + oppgave → avvist (SJA er sjekkliste-format)", () => {
    expect(() => valideerSubdomainKombinasjon("hms", "sja", "oppgave")).toThrow(
      /sjekkliste-format/i,
    );
  });

  it("tomt subdomain → alltid OK (ingen krav)", () => {
    expect(() => valideerSubdomainKombinasjon("bygg", null, "oppgave")).not.toThrow();
    expect(() => valideerSubdomainKombinasjon("bygg", undefined, "sjekkliste")).not.toThrow();
  });
});
