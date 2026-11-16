import { describe, it, expect } from "vitest";
import {
  fravaerRest,
  forhandsutfyllTimer,
  linjeGrense,
  stegFravaerTimer,
  artNedtonet,
  validerFravaerKort,
  visSomChips,
} from "./fravaerKort";
import type { NormtakArt } from "./fravaerNormtakMobil";

/**
 * ORDRE (33) c2 — fraværskortet (spec § 11.5 U2/U3/U11, § 11.10.4). TF9 (forhåndsutfylling),
 * TF22 (taket i kortet). Regnestykket er shared (`restForFravaerMedTak`); her er bare
 * kortets oppslag.
 */
const ARTER: Record<string, NormtakArt> = {
  egen: { type: "fravaer", navn: "Egenmelding", fravaerNormtak: true },
  barn: { type: "fravaer", navn: "Barns sykdom", fravaerNormtak: true },
  ferieUl: { type: "fravaer", navn: "Ferie u/lønn", fravaerNormtak: false },
  normal: { type: "ordinaer", navn: "Normaltid", fravaerNormtak: null },
};
const finnArt = (id: string | null) => (id ? ARTER[id] ?? null : null);
const arbeid = (timer: number, id = "arb") => ({ id, lonnsartId: "normal", timer, erReise: false });

describe("TF9 — forhåndsutfylling med resten av normen (U3)", () => {
  it("3 t arbeid, norm 7,5 → 4,5 t", () => {
    const rest = fravaerRest({ dagsnorm: 7.5, dagRader: [arbeid(3)], kortLinjer: [], key: null, finnArt });
    expect(forhandsutfyllTimer(rest)).toBe(4.5);
  });
  it("3 t arbeid + 2 t annet fravær → 2,5 t", () => {
    const rest = fravaerRest({
      dagsnorm: 7.5,
      dagRader: [arbeid(3)],
      kortLinjer: [{ key: "l1", lonnsartId: "ferieUl", timer: 2 }],
      key: null,
      finnArt,
    });
    expect(forhandsutfyllTimer(rest)).toBe(2.5);
  });
  it("hel fraværsdag → hele normen; reise teller ikke", () => {
    const rest = fravaerRest({
      dagsnorm: 7.5,
      dagRader: [{ id: "r", lonnsartId: "normal", timer: 1, erReise: true }],
      kortLinjer: [],
      key: null,
      finnArt,
    });
    expect(forhandsutfyllTimer(rest)).toBe(7.5);
  });
  it("ukjent norm eller rest 0 → tomt felt", () => {
    expect(forhandsutfyllTimer(fravaerRest({ dagsnorm: null, dagRader: [], kortLinjer: [], key: null, finnArt }))).toBeNull();
    expect(forhandsutfyllTimer(fravaerRest({ dagsnorm: 7.5, dagRader: [arbeid(8)], kortLinjer: [], key: null, finnArt }))).toBeNull();
  });
});

describe("TF22 — taket i fraværskortet", () => {
  const args = { dagsnorm: 7.5, dagRader: [arbeid(2)], kortLinjer: [{ key: "l1", lonnsartId: "egen", timer: 5.5 }], finnArt };
  it("art med tak → «+» stopper på resten", () => {
    const g = linjeGrense({ ...args, key: "l1", lonnsartId: "egen" });
    expect(g).toBe(5.5);
    expect(stegFravaerTimer(5.5, 1, 0.5, g)).toBe(5.5);
    expect(stegFravaerTimer(5, 1, 0.5, g)).toBe(5.5);
  });
  it("bytte fra art uten tak til art med tak klemmer", () => {
    const g = linjeGrense({ ...args, kortLinjer: [{ key: "l1", lonnsartId: "egen", timer: 7 }], key: "l1", lonnsartId: "egen" });
    expect(stegFravaerTimer(7, 0, 0.5, g)).toBe(5.5);
  });
  it("rest 0 → arter med tak nedtonet, art uten tak ikke", () => {
    const rest = fravaerRest({ dagsnorm: 7.5, dagRader: [arbeid(7.5)], kortLinjer: [], key: null, finnArt });
    expect(artNedtonet(ARTER.egen, rest)).toBe(true);
    expect(artNedtonet(ARTER.ferieUl, rest)).toBe(false);
  });
  it("art uten tak → ingen grense, også når dagen har fravær med tak", () => {
    expect(linjeGrense({ ...args, kortLinjer: [...args.kortLinjer, { key: "l2", lonnsartId: "ferieUl", timer: 1 }], key: "l2", lonnsartId: "ferieUl" })).toBeNull();
    expect(stegFravaerTimer(9, 1, 0.5, null)).toBe(9.5);
  });
  it("ukjent norm → ingen grense", () => {
    expect(linjeGrense({ ...args, dagsnorm: null, key: "l1", lonnsartId: "egen" })).toBeNull();
  });
  it("to linjer med tak deler taket", () => {
    const kort = [
      { key: "l1", lonnsartId: "egen", timer: 3 },
      { key: "l2", lonnsartId: "barn", timer: 1 },
    ];
    expect(linjeGrense({ ...args, kortLinjer: kort, key: "l2", lonnsartId: "barn" })).toBe(2.5);
  });
  it("«−» går aldri under 0", () => {
    expect(stegFravaerTimer(0.25, -1, 0.5, null)).toBe(0);
  });
});

describe("U11/U2 — validering og visning", () => {
  const ok = { linjer: [{ lonnsartId: "egen", timer: 4.5 }], beskrivelse: "Syk fra kl. 10", finnArt };
  it("gyldig kort → null", () => expect(validerFravaerKort(ok)).toBeNull());
  it("beskrivelse påkrevd (F4)", () => expect(validerFravaerKort({ ...ok, beskrivelse: "  " })).toBe("manglerBeskrivelse"));
  it("ingen linjer", () => expect(validerFravaerKort({ ...ok, linjer: [] })).toBe("ingenLinjer"));
  it("linje uten art eller timer", () => {
    expect(validerFravaerKort({ ...ok, linjer: [{ lonnsartId: null, timer: 2 }] })).toBe("manglerArt");
    expect(validerFravaerKort({ ...ok, linjer: [{ lonnsartId: "egen", timer: null }] })).toBe("manglerTimer");
    expect(validerFravaerKort({ ...ok, linjer: [{ lonnsartId: "egen", timer: 0 }] })).toBe("manglerTimer");
  });
  it("TF3: art som ikke er fravær avvises", () => {
    expect(validerFravaerKort({ ...ok, linjer: [{ lonnsartId: "normal", timer: 2 }] })).toBe("ikkeFravaerArt");
  });
  it("chips når inntil seks arter, ellers søkeliste", () => {
    expect(visSomChips(6)).toBe(true);
    expect(visSomChips(7)).toBe(false);
  });
});
