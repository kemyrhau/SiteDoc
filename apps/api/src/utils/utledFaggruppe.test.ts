import { describe, it, expect } from "vitest";
import { utledBestillerUtforer } from "./utledFaggruppe";

/**
 * Rød-først (ordre opprett-uten-modal, § 7): mobil slutter å sende
 * `bestillerFaggruppeId`/`utforerFaggruppeId` når opprett-modalen fjernes.
 * Serveren må da utlede dem fra flyten — bestiller = flytens eier-faggruppe,
 * utfører = flytens utfører-medlem (fallback eier). Speiler L1.5-grenen
 * (`sjekkliste.ts:353-354`). Denne rene helperen er sannheten begge rutene
 * kaller, og låser at utledningen skjer NÅR KLIENTEN IKKE SENDER FELTET.
 */
describe("utledBestillerUtforer — server utleder faggruppe fra flyt", () => {
  it("bestiller = flytens eier-faggruppe; utfører = flytens utfører-medlem", () => {
    const { bestiller, utforer } = utledBestillerUtforer({
      faggruppeId: "eier-fag",
      utforerMedlemmer: [{ faggruppeId: "utforer-fag" }],
    });
    expect(bestiller).toBe("eier-fag");
    expect(utforer).toBe("utforer-fag");
  });

  it("mangler flyten et utfører-medlem, faller utfører tilbake til eier-faggruppen", () => {
    const { bestiller, utforer } = utledBestillerUtforer({
      faggruppeId: "eier-fag",
      utforerMedlemmer: [],
    });
    expect(bestiller).toBe("eier-fag");
    expect(utforer).toBe("eier-fag");
  });

  it("flyt uten eier-faggruppe eller null flyt gir undefined (server kaster da videre)", () => {
    expect(utledBestillerUtforer({ faggruppeId: null, utforerMedlemmer: [] })).toEqual({
      bestiller: undefined,
      utforer: undefined,
    });
    expect(utledBestillerUtforer(null)).toEqual({ bestiller: undefined, utforer: undefined });
  });
});
