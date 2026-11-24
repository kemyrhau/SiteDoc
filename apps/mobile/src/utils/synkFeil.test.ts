import { describe, it, expect } from "vitest";
import { feilmeldingTekst, kodSynkFeil } from "./synkFeil";

/** w9m (plan § 5): synkfeil med i18n-nøkkel i eksisterende `feilmelding`-kolonne. */
const t = (k: string, p?: Record<string, unknown>) => `${k}|${JSON.stringify(p)}`;

describe("synkFeil — koding og visning", () => {
  it("🔴 nøkkel + parametre går gjennom lagring og vises på brukerens språk", () => {
    const lagret = kodSynkFeil(
      {
        feilmelding: "Maskin over arbeid",
        feilNokkel: "timer.maskin.overArbeidAvvist",
        feilParam: { jobb: "P1", maskin: "9", arbeid: "7,5" },
      },
      "Ukjent feil",
    );
    expect(lagret.startsWith("nokkel:")).toBe(true);
    expect(feilmeldingTekst(t, lagret)).toBe(
      `timer.maskin.overArbeidAvvist|${JSON.stringify({ jobb: "P1", maskin: "9", arbeid: "7,5", defaultValue: "Maskin over arbeid" })}`,
    );
  });
  it("ren tekst (eldre server, andre feil) lagres og vises som før", () => {
    expect(kodSynkFeil({ feilmelding: "Låst" }, "Ukjent feil")).toBe("Låst");
    expect(kodSynkFeil({}, "Ukjent feil")).toBe("Ukjent feil");
    expect(feilmeldingTekst(t, "Låst")).toBe("Låst");
    expect(feilmeldingTekst(t, null)).toBeNull();
  });
  it("ødelagt JSON eller manglende nøkkel faller tilbake på teksten", () => {
    expect(feilmeldingTekst(t, "nokkel:{ikke json")).toBe("nokkel:{ikke json");
    expect(feilmeldingTekst(t, 'nokkel:{"m":"Norsk tekst"}')).toBe("Norsk tekst");
  });
});
