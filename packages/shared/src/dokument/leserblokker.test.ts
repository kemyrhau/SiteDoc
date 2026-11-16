import { describe, it, expect } from "vitest";
import { INGEN_LESERBLOKKER, erProsesseringsfeil } from "./leserblokker";

/** DL-2: markøren for «0 leser-blokker» er ikke en feil i mappelista. */
describe("erProsesseringsfeil", () => {
  it("markøren regnes ikke som feil", () => {
    expect(erProsesseringsfeil(INGEN_LESERBLOKKER)).toBe(false);
  });

  it("ekte feiltekst er feil, tom/null er ikke", () => {
    expect(erProsesseringsfeil("Ugyldig DOCX-fil")).toBe(true);
    expect(erProsesseringsfeil(null)).toBe(false);
    expect(erProsesseringsfeil(undefined)).toBe(false);
    expect(erProsesseringsfeil("")).toBe(false);
  });
});
