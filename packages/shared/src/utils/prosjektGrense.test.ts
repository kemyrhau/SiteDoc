import { describe, it, expect } from "vitest";
import { grenseNaadd, GRATIS_DOKUMENT_GRENSE } from "./prosjektGrense";

describe("grenseNaadd (sjekkliste-/oppgavegrense — prøve-gate)", () => {
  it("standalone under grensen → ikke nådd", () => {
    expect(
      grenseNaadd({ erSitedocAdmin: false, erStandaloneProsjekt: true, antallEksisterende: 9 }),
    ).toBe(false);
  });

  it("standalone på grensen → nådd (blokkeres)", () => {
    expect(
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: true,
        antallEksisterende: GRATIS_DOKUMENT_GRENSE,
      }),
    ).toBe(true);
  });

  it("standalone over grensen → nådd (blokkeres)", () => {
    expect(
      grenseNaadd({ erSitedocAdmin: false, erStandaloneProsjekt: true, antallEksisterende: 25 }),
    ).toBe(true);
  });

  it("firma-tilknyttet på grensen → ikke nådd (grenseløst)", () => {
    expect(
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: false,
        antallEksisterende: GRATIS_DOKUMENT_GRENSE,
      }),
    ).toBe(false);
  });

  it("firma-tilknyttet langt over grensen → ikke nådd (grenseløst)", () => {
    expect(
      grenseNaadd({ erSitedocAdmin: false, erStandaloneProsjekt: false, antallEksisterende: 500 }),
    ).toBe(false);
  });

  it("sitedoc_admin på standalone over grensen → aldri nådd (bypass)", () => {
    expect(
      grenseNaadd({ erSitedocAdmin: true, erStandaloneProsjekt: true, antallEksisterende: 999 }),
    ).toBe(false);
  });

  it("sitedoc_admin på firma-prosjekt → aldri nådd (bypass)", () => {
    expect(
      grenseNaadd({ erSitedocAdmin: true, erStandaloneProsjekt: false, antallEksisterende: 999 }),
    ).toBe(false);
  });
});
