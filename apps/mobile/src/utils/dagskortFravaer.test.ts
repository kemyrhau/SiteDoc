import { describe, it, expect } from "vitest";
import { dagskortStandardProsjekt, delDagskortRader } from "./dagskortFravaer";

// TF10 (dagskort-modus-delen) — F6: rader uten prosjekt vises i gruppen «Fravær», ikke på sedelens prosjekt.
describe("TF10 / F6 — dagskort-modus: fravær uten prosjekt i egen gruppe", () => {
  it("fraværsrader skilles ut; øvrige rader står i samme rekkefølge som før", () => {
    const rader = [
      { id: "a", utenProsjekt: false },
      { id: "f", utenProsjekt: true },
      { id: "b", utenProsjekt: null },
      { id: "c" },
    ];
    const { prosjektRader, fravaerRader } = delDagskortRader(rader);
    expect(prosjektRader.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(fravaerRader.map((r) => r.id)).toEqual(["f"]);
  });

  it("dag uten fravær: uendret (vakt for dagskort-modus)", () => {
    const rader = [{ id: "a", utenProsjekt: false }, { id: "b", utenProsjekt: false }];
    expect(delDagskortRader(rader)).toEqual({ prosjektRader: rader, fravaerRader: [] });
  });

  it("sedel uten prosjekt (startet fra fraværskortet) får ingen tom prosjektgruppe; ellers sedelens prosjekt", () => {
    expect(dagskortStandardProsjekt("")).toEqual([]);
    expect(dagskortStandardProsjekt("p1")).toEqual(["p1"]);
  });
});
