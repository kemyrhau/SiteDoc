import { describe, it, expect } from "vitest";
import { fraKortNokkel, kortNokkel, radProsjektId } from "./prosjektkort";
import { kortIdNokkel } from "./kortId";

/**
 * TF10 (prosjektkort-kortid-spec § 11.2): fraværskortet har ingen prosjekt.
 * Nøkkelen bruker samme plassholder som byggeplass og underprosjekt, og
 * `radProsjektId` er eneste sted sedelens prosjekt arves.
 */
describe("TF10 — kortnøkkel uten prosjekt", () => {
  it("tomt prosjekt gir ingen|ingen|ingen", () => {
    expect(kortNokkel({ projectId: null, byggeplassId: null, ecoId: null })).toBe("ingen|ingen|ingen");
  });

  it("rundtur via fraKortNokkel gir null tilbake", () => {
    const k = { projectId: null, byggeplassId: null, ecoId: null };
    expect(fraKortNokkel(kortNokkel(k))).toEqual(k);
  });

  it("samme streng som kortIdNokkel (K2–K4)", () => {
    const k = { projectId: null, byggeplassId: null, ecoId: null };
    expect(kortNokkel(k)).toBe(kortIdNokkel(k));
  });

  it("prosjektkort er uendret", () => {
    const k = { projectId: "p1", byggeplassId: "b1", ecoId: null };
    expect(kortNokkel(k)).toBe("p1|b1|ingen");
    expect(fraKortNokkel("p1|b1|ingen")).toEqual(k);
  });
});

describe("TF10 — radProsjektId", () => {
  const sedel = { projectId: "sedel-p" };

  it("uten_prosjekt gir null, også når raden eller sedelen har prosjekt", () => {
    expect(radProsjektId({ projectId: null, utenProsjekt: true }, sedel)).toBeNull();
    expect(radProsjektId({ projectId: "p1", utenProsjekt: true }, sedel)).toBeNull();
  });

  it("ellers radens prosjekt, så sedelens (dagens fallback)", () => {
    expect(radProsjektId({ projectId: "p1", utenProsjekt: false }, sedel)).toBe("p1");
    expect(radProsjektId({ projectId: null }, sedel)).toBe("sedel-p");
    expect(radProsjektId({ projectId: null, utenProsjekt: null }, sedel)).toBe("sedel-p");
  });

  it("eldre sedel uten prosjekt («») gir «» — aldri fraværskortets nøkkel", () => {
    expect(radProsjektId({ projectId: null }, { projectId: "" })).toBe("");
    expect(radProsjektId({ projectId: null }, { projectId: null })).toBeNull();
    const k = { projectId: radProsjektId({ projectId: null }, { projectId: "" }), byggeplassId: null, ecoId: null };
    expect(kortNokkel(k)).not.toBe("ingen|ingen|ingen");
    expect(fraKortNokkel(kortNokkel(k)).projectId).toBe("");
  });
});
