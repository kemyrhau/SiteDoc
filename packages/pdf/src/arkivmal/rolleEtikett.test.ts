import { describe, it, expect } from "vitest";
import { formaterAktorRolle } from "./rolleEtikett";

describe("formaterAktorRolle — de fire formene", () => {
  it("1. kjent enum → norsk etikett (matcher dokumentflyt.*-i18n)", () => {
    expect(formaterAktorRolle("registrator")).toBe("Registrator");
    expect(formaterAktorRolle("bestiller")).toBe("Bestiller");
    expect(formaterAktorRolle("utforer")).toBe("Utfører");
    expect(formaterAktorRolle("godkjenner")).toBe("Godkjenner");
  });

  it("2. posisjonsetikett («Ledd N av M») → vises rått", () => {
    expect(formaterAktorRolle("Ledd 2 av 4")).toBe("Ledd 2 av 4");
    expect(formaterAktorRolle("Ledd 1 av 3")).toBe("Ledd 1 av 3");
    expect(formaterAktorRolle("Ledd 10 av 12")).toBe("Ledd 10 av 12");
  });

  it("3. tom/null → BLANK (ingen strek; ~⅓ av prod-radene er null)", () => {
    expect(formaterAktorRolle(null)).toBe("");
    expect(formaterAktorRolle(undefined)).toBe("");
    expect(formaterAktorRolle("")).toBe("");
    expect(formaterAktorRolle("   ")).toBe("");
  });

  it("4. ukjent ikke-enum → vis RÅTT (kaster ikke bort det vi vet)", () => {
    // Fjernet/korrupt type — en verdi som «kontrollør» er informasjon, ikke en strek:
    expect(formaterAktorRolle("kontrollør")).toBe("kontrollør");
    // Ikke-numerisk «Ledd» matcher ikke posisjonsetikett-regexen → faller til råform, ikke strek:
    expect(formaterAktorRolle("Ledd to av fire")).toBe("Ledd to av fire");
    expect(formaterAktorRolle("  kontrollør  ")).toBe("kontrollør"); // trimmes, men bevares
  });
});
