import { describe, it, expect } from "vitest";
import { formaterAktorRolle } from "./rolleEtikett";

describe("formaterAktorRolle — de tre formene", () => {
  it("1. kjent enum → norsk etikett (matcher dokumentflyt.*-i18n)", () => {
    expect(formaterAktorRolle("registrator")).toBe("Registrator");
    expect(formaterAktorRolle("bestiller")).toBe("Bestiller");
    expect(formaterAktorRolle("utforer")).toBe("Utfører");
    expect(formaterAktorRolle("godkjenner")).toBe("Godkjenner");
  });

  it("2. posisjonsetikett («Ledd N av M») → vises som-det-er", () => {
    expect(formaterAktorRolle("Ledd 2 av 4")).toBe("Ledd 2 av 4");
    expect(formaterAktorRolle("Ledd 1 av 3")).toBe("Ledd 1 av 3");
    expect(formaterAktorRolle("Ledd 10 av 12")).toBe("Ledd 10 av 12");
  });

  it("3. tom/ukjent → «—» (forventet: mange prod-rader har sender_rolle = null)", () => {
    expect(formaterAktorRolle(null)).toBe("—");
    expect(formaterAktorRolle(undefined)).toBe("—");
    expect(formaterAktorRolle("")).toBe("—");
    expect(formaterAktorRolle("   ")).toBe("—");
    // Ukjent ikke-enum, ikke posisjonsetikett (f.eks. en fjernet type / korrupt verdi):
    expect(formaterAktorRolle("kontrollør")).toBe("—");
    expect(formaterAktorRolle("Ledd to av fire")).toBe("—"); // ikke-numerisk → ikke posisjonsetikett
  });
});
