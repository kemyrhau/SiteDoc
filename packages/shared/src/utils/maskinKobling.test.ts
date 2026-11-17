import { describe, it, expect } from "vitest";
import {
  maskinKreverTimerad,
  erGyldigTimeradKobling,
  finnMaskinerUtenTimerad,
  type KoblingTimerRad,
} from "./maskinKobling";
import { beregnMaskinBrudd } from "./maskinKapasitet";

// T67 (kort-id-spec § 12.7): R24 / H15 = A.
describe("maskinKreverTimerad", () => {
  it("«time» krever timerad, «doegn» krever ikke, ikke satt krever", () => {
    expect(maskinKreverTimerad("time")).toBe(true);
    expect(maskinKreverTimerad("doegn")).toBe(false);
    expect(maskinKreverTimerad(null)).toBe(true);
    expect(maskinKreverTimerad(undefined)).toBe(true);
  });
});

const arbeid = (over: Partial<KoblingTimerRad> = {}): KoblingTimerRad => ({
  id: "t1",
  sheetId: "s1",
  kortId: "k1",
  projectId: "p1",
  timer: 4,
  erReise: false,
  attestertStatus: "pending",
  ...over,
});

const maskin = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  sheetId: "s1",
  kortId: "k1",
  sheetTimerId: "t1" as string | null,
  utleieEnhet: "time" as string | null,
  ...over,
});

describe("finnMaskinerUtenTimerad", () => {
  it("gyldig kobling gir ingenting", () => {
    expect(finnMaskinerUtenTimerad([maskin()], [arbeid()])).toEqual([]);
    expect(erGyldigTimeradKobling(maskin(), [arbeid()])).toBe(true);
  });

  it.each([
    ["koblingen mangler", maskin({ sheetTimerId: null }), [arbeid()]],
    ["peker på reiserad", maskin(), [arbeid({ erReise: true })]],
    ["peker på fravær uten prosjekt", maskin(), [arbeid({ projectId: null })]],
    ["peker på rad med 0 timer", maskin(), [arbeid({ timer: 0 })]],
    ["peker på rad i et annet kort", maskin(), [arbeid({ kortId: "k2" })]],
    ["peker på rad på en annen sedel", maskin(), [arbeid({ sheetId: "s2" })]],
    ["peker på erstattet rad", maskin(), [arbeid({ attestertStatus: "erstattet" })]],
    ["peker på rad som ikke finnes", maskin({ sheetTimerId: "finnes-ikke" }), [arbeid()]],
  ])("time-maskin der %s gis tilbake", (_navn, m, t) => {
    expect(finnMaskinerUtenTimerad([m], t).map((x) => x.id)).toEqual(["m1"]);
  });

  it("maskin uten satt enhet behandles som time (H15)", () => {
    expect(finnMaskinerUtenTimerad([maskin({ utleieEnhet: null, sheetTimerId: null })], [])).toHaveLength(1);
  });

  it("døgn-maskin uten kobling gir ingenting", () => {
    expect(finnMaskinerUtenTimerad([maskin({ utleieEnhet: "doegn", sheetTimerId: null })], [])).toEqual([]);
  });

  it("maskin-taket gir samme svar som før for de samme radene", () => {
    const brudd = beregnMaskinBrudd(
      [{ projectId: "p1", externalCostObjectId: null, timer: 4 }],
      [{ projectId: "p1", externalCostObjectId: null, timer: 5 }],
      0,
    );
    expect(brudd).toHaveLength(1);
    expect(
      beregnMaskinBrudd(
        [{ projectId: "p1", externalCostObjectId: null, timer: 4 }],
        [{ projectId: "p1", externalCostObjectId: null, timer: 4 }],
        0,
      ),
    ).toEqual([]);
  });
});
