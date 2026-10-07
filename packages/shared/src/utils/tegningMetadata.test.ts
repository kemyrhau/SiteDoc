import { describe, it, expect } from "vitest";
import { finnTegningsnummer, finnTegningstype } from "./tegningMetadata";

// Spec-test 2 + 3 (DoD): rene shared-tester for R3-forhåndsutfylling.
// Gate (§ 6.1): mønsteret må treffe «A-20-101» OG «ARK-P-101», finne et nummer
// MIDT i et filnavn og midt i tittelfelt-tekst, og gi `null` ved to ulike treff.

describe("finnTegningsnummer (spec-test 2)", () => {
  it("entydig treff i filnavn → nummeret", () => {
    expect(finnTegningsnummer(["A-20-101_Plan 1 etg.pdf"])).toBe("A-20-101");
  });

  it("treffer ARK-konvensjonen med bokstav-midtsegment (ARK-P-101)", () => {
    expect(finnTegningsnummer(["ARK-P-101 plan.pdf"])).toBe("ARK-P-101");
  });

  it("nummer MIDT i filnavn (ikke ankret til start)", () => {
    expect(finnTegningsnummer(["20251001_A-20-101.pdf"])).toBe("A-20-101");
  });

  it("nummer i tittelfelt-tekst (egen kilde)", () => {
    expect(
      finnTegningsnummer(["uten_nummer.pdf", "Tittelfelt: A-20-101 Rev A"]),
    ).toBe("A-20-101");
  });

  it("to ULIKE nummer → null (usikkert = tomt)", () => {
    expect(finnTegningsnummer(["A-20-101.pdf", "ARK-P-102"])).toBeNull();
  });

  it("samme nummer i flere kilder → fortsatt entydig", () => {
    expect(finnTegningsnummer(["A-20-101.pdf", "Tittel A-20-101"])).toBe("A-20-101");
  });

  it("ingen nummer → null", () => {
    expect(finnTegningsnummer(["Fasade nord.pdf"])).toBeNull();
  });

  it("tomme/ugyldige kilder → null", () => {
    expect(finnTegningsnummer([null, undefined, ""])).toBeNull();
  });
});

describe("finnTegningstype (spec-test 3)", () => {
  it("ett typeord → typen", () => {
    expect(finnTegningstype(["Plan 2. etasje"])).toBe("plan");
  });

  it("to ulike typer → null", () => {
    expect(finnTegningstype(["Plan og snitt"])).toBeNull();
  });

  it("ordgrense: «detaljert» treffer ikke «detalj»", () => {
    expect(finnTegningstype(["Detaljert beskrivelse"])).toBeNull();
  });

  it("fasade gjenkjennes", () => {
    expect(finnTegningstype(["Fasade nord.pdf"])).toBe("fasade");
  });

  it("samme type i flere kilder → entydig", () => {
    expect(finnTegningstype(["snitt-aa.pdf", "Snitt A-A"])).toBe("snitt");
  });

  it("ingen type → null", () => {
    expect(finnTegningstype(["A-20-101.pdf"])).toBeNull();
  });
});
