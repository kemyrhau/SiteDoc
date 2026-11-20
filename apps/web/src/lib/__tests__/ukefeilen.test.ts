// Ukefeilen (plan § 8.17) skjer bare øst for UTC. Testen kjører i norsk tid uansett maskin.
process.env.TZ = "Europe/Oslo";

import { describe, expect, it } from "vitest";
import { mandagI, mineTimerIntervall, ukeIntervall } from "../tilbake-adresse";

/** Serverens filter er `[fra, til]` inklusivt på datoen (dagsseddel.list). */
function innenfor(dato: string, { fra, til }: { fra: string; til: string }) {
  return dato >= fra && dato <= til;
}

describe("ukefeilen — prosjektets Timer (plan § 8.17)", () => {
  it("uka 16.–22.11.2026 er mandag–søndag i uka", () => {
    const uke = ukeIntervall(new Date(2026, 10, 16));
    expect(uke).toEqual({ fra: "2026-11-16", til: "2026-11-22" });
    expect(innenfor("2026-11-22", uke)).toBe(true); // søndagen i uka vises
    expect(innenfor("2026-11-15", uke)).toBe(false); // søndagen før vises ikke
  });

  it("sommertid: uka 15.–21.06.2026", () => {
    expect(ukeIntervall(mandagI(new Date(2026, 5, 18)))).toEqual({
      fra: "2026-06-15",
      til: "2026-06-21",
    });
  });

  it("uke over årsskiftet: 28.12.2026–03.01.2027", () => {
    expect(ukeIntervall(new Date(2026, 11, 28))).toEqual({ fra: "2026-12-28", til: "2027-01-03" });
  });
});

describe("ukefeilen — Mine timer", () => {
  const naa = new Date(2026, 10, 20, 9, 30);

  it("«Denne uken» er mandag–søndag i uka", () => {
    expect(mineTimerIntervall("denne_uken", naa, "", "")).toEqual({
      fra: "2026-11-16",
      til: "2026-11-22",
    });
  });

  it("«Denne måneden» starter den 1. og tar med siste dag", () => {
    expect(mineTimerIntervall("denne_maaneden", naa, "", "")).toEqual({
      fra: "2026-11-01",
      til: "2026-11-30",
    });
  });

  it("«Forrige måned» er hele oktober", () => {
    expect(mineTimerIntervall("forrige_maaneden", naa, "", "")).toEqual({
      fra: "2026-10-01",
      til: "2026-10-31",
    });
  });

  it("egendefinert periode går uendret gjennom", () => {
    expect(mineTimerIntervall("egendefinert", naa, "2026-01-01", "2026-01-31")).toEqual({
      fra: "2026-01-01",
      til: "2026-01-31",
    });
  });
});
