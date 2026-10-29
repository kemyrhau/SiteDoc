import { describe, it, expect } from "vitest";
import { ingenOrdtreff } from "../ingen-ordtreff";

/**
 * F1a (relay 2026-10-29, Kenneth-hjemmel 29.10): når ingen av treffene har ordtreff — alle er rent
 * semantiske — skal søkesiden si det, så brukeren ikke tror ordet finnes i dokumentene.
 * Rød før: `ingenOrdtreff` fantes ikke; siden viste lista uten forklaring.
 */
describe("F1a — varsel når ingen dokumenter inneholder ordet", () => {
  it("vises når alle treff er rent semantiske", () => {
    expect(ingenOrdtreff([{ metode: "semantisk" }, { metode: "semantisk" }])).toBe(true);
  });

  it("skjules når minst ett treff har ordtreff (tekst eller begge)", () => {
    expect(ingenOrdtreff([{ metode: "semantisk" }, { metode: "tekst" }])).toBe(false);
    expect(ingenOrdtreff([{ metode: "semantisk" }, { metode: "begge" }])).toBe(false);
  });

  it("skjules uten treff — tom liste har egen tilstand", () => {
    expect(ingenOrdtreff([])).toBe(false);
    expect(ingenOrdtreff(undefined)).toBe(false);
  });

  it("skjules når metode mangler (leksikalsk fallback har ingen metode)", () => {
    expect(ingenOrdtreff([{}, { metode: "semantisk" }])).toBe(false);
  });
});
