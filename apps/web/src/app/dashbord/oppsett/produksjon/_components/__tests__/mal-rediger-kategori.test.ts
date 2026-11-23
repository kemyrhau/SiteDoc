import { describe, it, expect } from "vitest";
import { lagretMalKategori } from "../mal-liste-filter";

// HM1 tillegg B: rediger-dialogen viser «HMS» for alle domain hms-maler, men skal ikke
// skrive om en seedet HMS-mal (category oppgave/sjekkliste) til category «hms».
describe("lagretMalKategori (HM1 tillegg B)", () => {
  it("seedet HMS-avvik/RUH beholder category oppgave", () => {
    expect(lagretMalKategori("hms", { category: "oppgave", domain: "hms" }, "avvik")).toBe("oppgave");
    expect(lagretMalKategori("hms", { category: "oppgave", domain: "hms" }, "ruh")).toBe("oppgave");
  });

  it("seedet SJA beholder category sjekkliste", () => {
    expect(lagretMalKategori("hms", { category: "sjekkliste", domain: "hms" }, "sja")).toBe("sjekkliste");
  });

  it("bytte av undertype følger formen serveren krever", () => {
    expect(lagretMalKategori("hms", { category: "oppgave", domain: "hms" }, "sja")).toBe("sjekkliste");
    expect(lagretMalKategori("hms", { category: "sjekkliste", domain: "hms" }, "avvik")).toBe("oppgave");
  });

  it("eldre category hms-mal forblir hms", () => {
    expect(lagretMalKategori("hms", { category: "hms", domain: "hms" }, "avvik")).toBe("hms");
  });

  it("byggmal gjort om til HMS blir hms (uendret regel)", () => {
    expect(lagretMalKategori("hms", { category: "oppgave", domain: "bygg" }, "avvik")).toBe("hms");
  });

  it("valgt oppgave/sjekkliste lagres som valgt", () => {
    expect(lagretMalKategori("oppgave", { category: "oppgave", domain: "hms" }, "avvik")).toBe("oppgave");
    expect(lagretMalKategori("sjekkliste", { category: "oppgave", domain: "bygg" }, "avvik")).toBe("sjekkliste");
  });
});
