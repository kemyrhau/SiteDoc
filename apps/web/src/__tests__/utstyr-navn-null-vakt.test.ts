import { describe, expect, it } from "vitest";
import { merkeModell } from "../components/attestering/utstyr-navn";

/**
 * w8 vakt: utstyr uten merke og modell skal aldri vises som «null null» (bilde fra test,
 * SD-20260502-0002, «Maskiner null null»). Tom tekst lar kalleren falle tilbake på internnavnet.
 */
describe("merkeModell — utstyr uten merke og modell", () => {
  it("begge null gir tom tekst, ikke «null null»", () => {
    expect(merkeModell({ merke: null, modell: null })).toBe("");
    expect(merkeModell({ merke: null, modell: null }) || "Gravemaskin 3").toBe("Gravemaskin 3");
  });
  it("én av dem null gir bare den andre", () => {
    expect(merkeModell({ merke: "Volvo", modell: null })).toBe("Volvo");
    expect(merkeModell({ merke: null, modell: "EC220" })).toBe("EC220");
  });
  it("begge satt gir «merke modell»", () => {
    expect(merkeModell({ merke: "Volvo", modell: "EC220" })).toBe("Volvo EC220");
  });
});
