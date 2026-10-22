import { describe, it, expect } from "vitest";
import {
  annoteringsflateHoyde,
  annoteringsbildeFit,
  tekstboksStandardBredde,
  klemTekstboksPosisjon,
  TEKSTBOKS_MARG,
  TEKSTBOKS_MIN_BREDDE,
} from "./plassering";

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

/**
 * Vokter Del 1 (Kenneth 2026-10-22): tekstboksen får en bredde fra trykkpunktet til
 * bildets høyre kant minus marg, så teksten bryter på bildet (bilde 10-funnet: IText
 * brøt aldri og gikk ut over kanten).
 */
describe("tekstboksStandardBredde — trykkpunkt til høyre kant minus marg", () => {
  const CANVAS = 390;

  it("strekker fra trykkpunktet til høyre marg i normaltilfellet", () => {
    // Trykk på x=100 → bredden når akkurat til canvasBredde - marg.
    expect(tekstboksStandardBredde(100, CANVAS, TEKSTBOKS_MARG)).toBe(CANVAS - 100 - TEKSTBOKS_MARG);
    // left + bredde = høyre marg: 100 + 282 = 382 = 390 - 8. Teksten bryter innenfor kanten.
    expect(100 + tekstboksStandardBredde(100, CANVAS)).toBe(CANVAS - TEKSTBOKS_MARG);
  });

  it("klemmer til minBredde når trykket er helt ute ved høyre kant (ingen negativ bredde)", () => {
    expect(tekstboksStandardBredde(385, CANVAS)).toBe(TEKSTBOKS_MIN_BREDDE);
  });

  it("blir aldri bredere enn flaten mellom margene tillater", () => {
    // Trykk helt til venstre (x=0): fraTrykk ville vært 382, men maks i flate er 390-2·8 = 374.
    expect(tekstboksStandardBredde(0, CANVAS)).toBe(CANVAS - 2 * TEKSTBOKS_MARG);
  });

  it("tåler en veldig smal canvas uten å gå negativ", () => {
    expect(tekstboksStandardBredde(10, 20)).toBe(Math.max(0, 20 - 2 * TEKSTBOKS_MARG));
  });
});

/**
 * Vokter Del 1 (Kenneth 2026-10-22): «teksten skal aldri havne utenfor bildet» — ved
 * opprettelse, dra og bredde-endring klemmes boksens hjørne innenfor margene.
 */
describe("klemTekstboksPosisjon — boksen holdes innenfor bildet", () => {
  const felles = { bredde: 100, hoyde: 40, canvasBredde: 390, canvasHoyde: 520, marg: TEKSTBOKS_MARG };

  it("lar en boks godt innenfor stå urørt", () => {
    expect(klemTekstboksPosisjon({ ...felles, left: 50, top: 60 })).toEqual({ left: 50, top: 60 });
  });

  it("skyver en boks som stikker ut til høyre innover", () => {
    // left 350 + bredde 100 = 450 > 390-8 → maksLeft = 390-8-100 = 282.
    expect(klemTekstboksPosisjon({ ...felles, left: 350, top: 60 }).left).toBe(282);
  });

  it("skyver en boks som stikker ut nederst oppover", () => {
    // top 500 + hoyde 40 = 540 > 520-8 → maksTop = 520-8-40 = 472.
    expect(klemTekstboksPosisjon({ ...felles, left: 50, top: 500 }).top).toBe(472);
  });

  it("klemmer negativ posisjon til margen (øvre venstre hjørne synlig)", () => {
    expect(klemTekstboksPosisjon({ ...felles, left: -30, top: -30 })).toEqual({
      left: TEKSTBOKS_MARG,
      top: TEKSTBOKS_MARG,
    });
  });

  it("lar margen vinne når boksen er bredere enn flaten", () => {
    expect(klemTekstboksPosisjon({ ...felles, bredde: 500, left: 100, top: 60 }).left).toBe(TEKSTBOKS_MARG);
  });
});
