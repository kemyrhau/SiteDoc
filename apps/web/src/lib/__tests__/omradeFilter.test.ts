import { describe, it, expect } from "vitest";
import { omradeFilterAlternativer, visOmradeFilter } from "../omradeFilter";

/** B-1: område-filteret i web-listene vises bare når lista har områder. */
describe("omradeFilter", () => {
  it("uten områder → ingen alternativer og skjult filter", () => {
    const alt = omradeFilterAlternativer([{ omrade: null }, {}, { omrade: undefined }]);
    expect(alt).toEqual([]);
    expect(visOmradeFilter(alt)).toBe(false);
  });

  it("gammelt API (feltet mangler, dynamiskFilter.omrade udefinert) → skjult filter", () => {
    expect(visOmradeFilter(undefined)).toBe(false);
  });

  it("med områder → unike navn A–Å og synlig filter", () => {
    const alt = omradeFilterAlternativer([
      { omrade: { navn: "Tak" } },
      { omrade: { navn: "Plan 2" } },
      { omrade: { navn: "Tak" } },
      { omrade: null },
    ]);
    expect(alt).toEqual([
      { value: "Plan 2", label: "Plan 2" },
      { value: "Tak", label: "Tak" },
    ]);
    expect(visOmradeFilter(alt)).toBe(true);
  });

  it("ett område holder for å vise filteret", () => {
    expect(visOmradeFilter(omradeFilterAlternativer([{ omrade: { navn: "Tak" } }]))).toBe(true);
  });
});
