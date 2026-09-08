import { describe, it, expect } from "vitest";
import { formaterNummer } from "./dokumentnummer";

describe("formaterNummer — mobil kompakt (default, uten format-arg)", () => {
  it("setter sammen prefix og nummer", () => {
    expect(formaterNummer("SJA", 12)).toBe("SJA12");
  });

  it("returnerer null når prefix mangler", () => {
    expect(formaterNummer(null, 12)).toBeNull();
    expect(formaterNummer(undefined, 12)).toBeNull();
    expect(formaterNummer("", 12)).toBeNull();
  });

  it("returnerer null når nummer mangler", () => {
    expect(formaterNummer("SJA", null)).toBeNull();
    expect(formaterNummer("SJA", undefined)).toBeNull();
  });

  it("slipper 0 gjennom (tilsiktet — «SJA0» er gyldig, nummer == null fanger ikke 0)", () => {
    expect(formaterNummer("SJA", 0)).toBe("SJA0");
  });
});

describe("formaterNummer — full form «SJA-012» (web-detaljhode/skriv-ut/PDF-tvilling/papirkurv)", () => {
  const FULL = { separator: "-", pad: 3, manglerPrefiks: "nummer" } as const;

  it("prefiks + skilletegn + padda nummer", () => {
    expect(formaterNummer("SJA", 12, FULL)).toBe("SJA-012");
  });

  it("uten prefiks → bart padda nummer", () => {
    expect(formaterNummer(null, 12, FULL)).toBe("012");
    expect(formaterNummer("", 12, FULL)).toBe("012");
  });

  it("nummer == null → null", () => {
    expect(formaterNummer("SJA", null, FULL)).toBeNull();
  });

  it("0 er gyldig → «SJA-000»", () => {
    expect(formaterNummer("SJA", 0, FULL)).toBe("SJA-000");
  });
});

describe("formaterNummer — listekolonne «012» (prefiks er egen kolonne)", () => {
  const KOLONNE = { pad: 3, visPrefiks: false } as const;

  it("alltid bart padda nummer, selv når prefiks finnes", () => {
    expect(formaterNummer("SJA", 12, KOLONNE)).toBe("012");
    expect(formaterNummer(null, 12, KOLONNE)).toBe("012");
  });

  it("nummer == null → null (kallstedet mapper til «—»)", () => {
    expect(formaterNummer("SJA", null, KOLONNE)).toBeNull();
  });

  it("0 vises som «000» (0 er gyldig, ikke «manglende»)", () => {
    expect(formaterNummer("SJA", 0, KOLONNE)).toBe("000");
  });
});
