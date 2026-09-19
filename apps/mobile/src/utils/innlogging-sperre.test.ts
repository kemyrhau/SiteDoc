import { describe, it, expect } from "vitest";
import { googleKnappSperret } from "./innlogging-sperre";

/**
 * Regresjonsvakt for «varig grå Google-knapp»: uten et bygget `request` på native
 * må knappen regnes som sperret, slik at `KnappMedForklaring` viser en forklaring i
 * stedet for en død, uforklart knapp. Mobil-harnessen rendrer ikke RN-komponenter,
 * så vi tester den rene regelen skjermen bygger på (jf. `forklaringSomVises`).
 *
 * Fjerner man vakten (lar knappen bare være `disabled` uten `sperret`), blir denne
 * rød: native+ingen-request ville ikke lenger regnes som sperret.
 */
describe("googleKnappSperret — varig grå Google-knapp forklarer seg", () => {
  it("native uten bygget request → sperret (varig grå)", () => {
    expect(googleKnappSperret("ios", false)).toBe(true);
    expect(googleKnappSperret("android", false)).toBe(true);
  });

  it("native med bygget request → ikke sperret (normaltilfellet)", () => {
    expect(googleKnappSperret("ios", true)).toBe(false);
  });

  it("web → aldri sperret av denne grunnen (egen innloggingsvei)", () => {
    expect(googleKnappSperret("web", false)).toBe(false);
    expect(googleKnappSperret("web", true)).toBe(false);
  });
});
