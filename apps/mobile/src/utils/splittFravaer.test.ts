import { describe, it, expect } from "vitest";
import { splittDelVerdier, splittNormtakBrudd } from "./splittFravaer";
import type { NormtakArt } from "./fravaerNormtakMobil";

/**
 * ORDRE (33) SVAR pkt 3 — «Del opp» på en fraværsrad: delene arver `utenProsjekt`,
 * får aldri underprosjekt, og taket (B10) gjelder summen av delene.
 */
const ARTER: Record<string, NormtakArt> = {
  egen: { type: "fravaer", navn: "Egenmelding", fravaerNormtak: true },
  ferieUl: { type: "fravaer", navn: "Ferie u/lønn", fravaerNormtak: false },
  normal: { type: "ordinaer", navn: "Normaltid", fravaerNormtak: null },
};
const finnArt = (id: string | null) => (id ? ARTER[id] ?? null : null);

describe("splittDelVerdier", () => {
  const fravaer = { utenProsjekt: true, byggeplassId: null, kortId: null, externalCostObjectId: null };
  it("fraværsrad delt i to → begge delene utenProsjekt og uten underprosjekt", () => {
    const deler = [
      { lonnsartId: "egen", aktivitetId: "a1", externalCostObjectId: "eco-1", timer: 3 },
      { lonnsartId: "ferieUl", aktivitetId: "a1", externalCostObjectId: "eco-2", timer: 4.5 },
    ].map((d) => splittDelVerdier(fravaer, d));
    for (const v of deler) {
      expect(v.utenProsjekt).toBe(true);
      expect(v.externalCostObjectId).toBeNull();
    }
  });
  it("vakt: prosjektrad beholder delens underprosjekt som før", () => {
    const v = splittDelVerdier(
      { utenProsjekt: false, byggeplassId: null, kortId: null, externalCostObjectId: null },
      { lonnsartId: "normal", aktivitetId: "a1", externalCostObjectId: "eco-1", timer: 2 },
    );
    expect(v.utenProsjekt).toBe(false);
    expect(v.externalCostObjectId).toBe("eco-1");
  });
});

describe("T13 / M18 — «Del opp» beholder byggeplass og kort-id", () => {
  const original = { utenProsjekt: false, byggeplassId: "bp-2", kortId: "k-1", externalCostObjectId: "eco-1" };
  it("del med samme underprosjekt: radens byggeplass og kortId (rød før c1: byggeplass mistet)", () => {
    const v = splittDelVerdier(original, { lonnsartId: "normal", aktivitetId: "a1", externalCostObjectId: "eco-1", timer: 2 });
    expect(v.byggeplassId).toBe("bp-2");
    expect(v.kortId).toBe("k-1");
  });
  it("del med annet underprosjekt: byggeplass beholdes, kort-id utledes på nytt (K2: ett kort = én nøkkel)", () => {
    const v = splittDelVerdier(original, { lonnsartId: "normal", aktivitetId: "a1", externalCostObjectId: "eco-2", timer: 2 });
    expect(v.byggeplassId).toBe("bp-2");
    expect(v.kortId).toBeNull();
  });
  it("fraværsrad: ingen byggeplass, kort-id som originalen («ingen»-kortet)", () => {
    const v = splittDelVerdier(
      { utenProsjekt: true, byggeplassId: null, kortId: "k-fravaer", externalCostObjectId: null },
      { lonnsartId: "egen", aktivitetId: "a1", externalCostObjectId: "eco-9", timer: 2 },
    );
    expect(v.byggeplassId).toBeNull();
    expect(v.kortId).toBe("k-fravaer");
  });
});

describe("splittNormtakBrudd — taket gjelder summen av delene", () => {
  const dagRader = [
    { id: "arb", lonnsartId: "normal", timer: 2, erReise: false },
    { id: "orig", lonnsartId: "ferieUl", timer: 7.5, erReise: false },
  ];
  it("del av art uten tak flyttet til art med tak over resten → brudd", () => {
    const b = splittNormtakBrudd({
      dagsnorm: 7.5,
      dagRader,
      originalId: "orig",
      deler: [
        { lonnsartId: "egen", timer: 6 },
        { lonnsartId: "ferieUl", timer: 1.5 },
      ],
      finnArt,
    });
    expect(b).not.toBeNull();
    // F10: fravær uten tak spiser også normen — tak = 7,5 − 2 arbeid − 1,5 ferie u/lønn.
    expect(b!.data.tak).toBe(4);
  });
  it("delene innenfor taket → intet brudd", () => {
    expect(
      splittNormtakBrudd({
        dagsnorm: 7.5,
        dagRader: dagRader.filter((r) => r.id !== "arb"),
        originalId: "orig",
        deler: [
          { lonnsartId: "egen", timer: 3 },
          { lonnsartId: "ferieUl", timer: 4.5 },
        ],
        finnArt,
      }),
    ).toBeNull();
  });
  it("ukjent norm (U12) → intet brudd", () => {
    expect(
      splittNormtakBrudd({
        dagsnorm: null,
        dagRader,
        originalId: "orig",
        deler: [{ lonnsartId: "egen", timer: 7.5 }],
        finnArt,
      }),
    ).toBeNull();
  });
});
