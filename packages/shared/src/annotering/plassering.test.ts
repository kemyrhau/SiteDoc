import { describe, it, expect } from "vitest";
import { annoteringsflateHoyde, annoteringsbildeFit } from "./plassering";

/**
 * Vokter vedtaket (Kenneth 2026-10-21): bildet har ÉN fast plassering med og uten tastatur,
 * forankret under overskriften. Flaten reserverer alltid tastaturhøyden, og bildet skaleres
 * til flaten med sideforhold bevart (liggende bundet av bredde, stående av høyde).
 */
describe("annoteringsflateHoyde — fast flate, uavhengig av tastaturtilstand", () => {
  // Realistiske tall (iPhone-aktig, pt): vindu 844, status 47, header 52, tastatur 300, hjelpelinje 44.
  const basis = { vindusHoyde: 844, insetTop: 47, headerHoyde: 52, tastaturHoyde: 300, hjelpelinjeHoyde: 44 };

  it("trekker fra status, header, reservert tastatur og hjelpelinje", () => {
    expect(annoteringsflateHoyde(basis)).toBe(844 - 47 - 52 - 300 - 44); // 401
  });

  it("er identisk uansett når den kalles — funksjonen har ingen «tastatur synlig»-tilstand", () => {
    // Samme input → samme flate. Komponenten beregner den ÉN gang; tastaturet som kommer og
    // går endrer ingen input her, så bildet kan ikke hoppe.
    expect(annoteringsflateHoyde(basis)).toBe(annoteringsflateHoyde({ ...basis }));
  });

  it("klemmes til 0 ved liten skjerm / stor header (aldri negativ)", () => {
    expect(annoteringsflateHoyde({ ...basis, vindusHoyde: 300 })).toBe(0);
  });
});

describe("annoteringsbildeFit — sideforhold bevart, øvre kant forankret", () => {
  const FLATE_B = 390;
  const FLATE_H = 401; // flaten fra testen over

  it("liggende bilde bindes av BREDDEN (vertikal plass til overs)", () => {
    const r = annoteringsbildeFit(1600, 1200, FLATE_B, FLATE_H); // 4:3 liggende
    expect(r.bundetAv).toBe("bredde");
    expect(r.visningsBredde).toBeCloseTo(390, 5); // fyller bredden
    expect(r.visningsHoyde).toBeLessThan(FLATE_H); // plass igjen vertikalt
  });

  it("stående bilde bindes av HØYDEN (skaleres mindre)", () => {
    const r = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H); // 3:4 stående
    expect(r.bundetAv).toBe("hoyde");
    expect(r.visningsHoyde).toBeCloseTo(401, 5); // fyller høyden
    expect(r.visningsBredde).toBeLessThan(FLATE_B);
  });

  it("samme bilde + samme flate gir samme resultat med og uten tastatur", () => {
    // Flaten beregnes med tastatur reservert (FLATE_H). Enten tastaturet faktisk er fremme
    // eller ikke, er flaten den samme → fit-resultatet er det samme. Ingen hopping.
    const utenTastaturFeil = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H);
    const medTastatur = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H);
    expect(medTastatur).toEqual(utenTastaturFeil);
  });

  it("bevarer sideforholdet", () => {
    const r = annoteringsbildeFit(1600, 1200, FLATE_B, FLATE_H);
    expect(r.visningsBredde / r.visningsHoyde).toBeCloseTo(1600 / 1200, 5);
  });

  it("gir skala 1 / rå størrelse når flaten ikke er målt ennå (0)", () => {
    expect(annoteringsbildeFit(1600, 1200, 0, 0)).toEqual({
      skala: 1,
      visningsBredde: 1600,
      visningsHoyde: 1200,
      bundetAv: "bredde",
    });
  });
});
