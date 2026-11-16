import { describe, it, expect } from "vitest";
import { utledKortId } from "@sitedoc/shared";
import { normaliserKortIder, type LokalKortRad } from "./kortIdNormalisering";

/**
 * Fraværskortet og kort-id (prosjektkort-kortid-spec § 11.2): en rad med
 * `uten_prosjekt` får fraværskortets id (prosjektledd «ingen»), aldri id-en til
 * sedelens prosjektkort — selv om raden (feilaktig) bærer prosjekt. Ett
 * fraværskort pr. dag: to fraværsrader deler id (regel 3).
 */
const sedel = { userId: "u1", dato: "2026-11-16", projectId: "p1", byggeplass: { id: "b1", projectId: "p1" } };
const rad = (id: string, over: Partial<LokalKortRad> = {}): LokalKortRad => ({
  id,
  type: "timer",
  kortId: null,
  projectId: "p1",
  byggeplassId: null,
  ecoId: null,
  erReise: false,
  ...over,
});
const fravaerId = utledKortId({
  userId: "u1",
  dato: "2026-11-16",
  nokkel: { projectId: null, byggeplassId: null, ecoId: null },
});

describe("normaliserKortIder — fraværskortet", () => {
  it("fraværsrad får fraværskortets id, arbeidsrad sedelens prosjektkort", () => {
    const ny = normaliserKortIder(sedel, [
      rad("arb"),
      rad("frav", { projectId: null, utenProsjekt: true }),
    ]);
    expect(ny.get("frav")).toBe(fravaerId);
    expect(ny.get("arb")).not.toBe(fravaerId);
  });

  it("fraværsrad med prosjekt og byggeplass satt følger flagget, ikke prosjektet", () => {
    const ny = normaliserKortIder(sedel, [rad("frav", { utenProsjekt: true, byggeplassId: "b1", ecoId: "e1" })]);
    expect(ny.get("frav")).toBe(fravaerId);
  });

  it("to fraværsrader samme dag deler kort (ett fraværskort pr. dag)", () => {
    const ny = normaliserKortIder(sedel, [
      rad("f1", { projectId: null, utenProsjekt: true }),
      rad("f2", { projectId: null, utenProsjekt: true }),
    ]);
    expect(ny.get("f1")).toBe(fravaerId);
    expect(ny.get("f2")).toBe(fravaerId);
  });

  it("arbeidsrad med fraværskortets id flyttes ut (nøkkelen stemmer ikke)", () => {
    const ny = normaliserKortIder(sedel, [
      rad("f1", { projectId: null, utenProsjekt: true, kortId: fravaerId }),
      rad("arb", { kortId: fravaerId }),
    ]);
    expect(ny.has("f1")).toBe(false); // uendret
    expect(ny.get("arb")).not.toBe(fravaerId);
  });
});
