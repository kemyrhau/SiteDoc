import { describe, it, expect } from "vitest";
import { forklaringSomVises } from "./sperret-forklaring";

/**
 * Regresjonsvakt for mobil-`KnappMedForklaring`: en sperret knapp må FORKLARE seg —
 * teksten vises når `sperret` er sann, og forsvinner når den er usann (da er knappen
 * aktiv, eller spinneren er signalet). Mobil-harnessen rendrer ikke RN-komponenter,
 * så vi tester den rene regelen komponenten bygger på (jf. `utledFlytbytteVisning`).
 * Fjerner noen `sperret`-vakten, blir denne rød.
 */
describe("forklaringSomVises — sperret knapp forklarer seg", () => {
  it("sperret=true → forklaringsteksten vises", () => {
    expect(forklaringSomVises(true, "Velg et prosjekt først")).toBe("Velg et prosjekt først");
  });

  it("sperret=false → ingen linje", () => {
    expect(forklaringSomVises(false, "Velg et prosjekt først")).toBeNull();
  });
});
