import { describe, it, expect } from "vitest";
import {
  maskinKreverTimerad,
  erGyldigTimeradKobling,
  finnMaskinerUtenTimerad,
  velgTimeradForMaskin,
  type KoblingTimerRad,
} from "./maskinKobling";
import { beregnJobbMaskinBrudd } from "./maskinKapasitet";

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
    // w9m: eldre rader uten jobb (kortId null) — bøtte-veien i jobb-regelen.
    const brudd = beregnJobbMaskinBrudd(
      [{ kortId: null, projectId: "p1", externalCostObjectId: null, timer: 4 }],
      [{ kortId: null, projectId: "p1", externalCostObjectId: null, timer: 5, utleieEnhet: "time" }],
      0,
    );
    expect(brudd).toHaveLength(1);
    expect(
      beregnJobbMaskinBrudd(
        [{ kortId: null, projectId: "p1", externalCostObjectId: null, timer: 4 }],
        [{ kortId: null, projectId: "p1", externalCostObjectId: null, timer: 4, utleieEnhet: "time" }],
        0,
      ),
    ).toEqual([]);
  });
});

// w9-tillegget: maskinen kobles selv til en timerad i samme jobb.
describe("velgTimeradForMaskin", () => {
  const rad = (id: string, timer: number, fraTid: string | null, tilTid: string | null, ekstra: Partial<KoblingTimerRad> = {}) => ({
    id, sheetId: "s1", kortId: "k1", projectId: "p1", timer, fraTid, tilTid, erReise: false, attestertStatus: "pending", ...ekstra,
  });
  const maskin = (fraTid: string | null = null, tilTid: string | null = null) => ({ sheetId: "s1", kortId: "k1", fraTid, tilTid });

  it("størst overlapp i fra–til vinner over flest timer", () => {
    const rader = [rad("stor", 6, "07:00", "13:00"), rad("liten", 2, "13:00", "15:00")];
    expect(velgTimeradForMaskin(maskin("13:00", "15:00"), rader)).toBe("liten");
  });

  it("uten fra–til på maskinen → flest timer", () => {
    expect(velgTimeradForMaskin(maskin(), [rad("a", 1, "07:00", "08:00"), rad("b", 7.5, "08:00", "15:30")])).toBe("b");
  });

  it("ingen overlapp → flest timer", () => {
    expect(velgTimeradForMaskin(maskin("18:00", "19:00"), [rad("a", 1, "07:00", "08:00"), rad("b", 3, "08:00", "11:00")])).toBe("b");
  });

  it("likt antall timer → tidligste fra-tid, så rekkefølgen", () => {
    expect(velgTimeradForMaskin(maskin(), [rad("sen", 4, "11:00", "15:00"), rad("tidlig", 4, "07:00", "11:00")])).toBe("tidlig");
    expect(velgTimeradForMaskin(maskin(), [rad("x", 4, null, null), rad("y", 4, null, null)])).toBe("x");
  });

  it("bare rader i samme jobb med arbeid er kandidater (reise, 0 t, erstattet, annen jobb, uten prosjekt, annen sedel)", () => {
    const rader = [
      rad("reise", 8, null, null, { erReise: true }),
      rad("null", 0, null, null),
      rad("erstattet", 8, null, null, { attestertStatus: "erstattet" }),
      rad("annen", 8, null, null, { kortId: "k2" }),
      rad("fravaer", 8, null, null, { projectId: null }),
      rad("annenSedel", 8, null, null, { sheetId: "s2" }),
    ];
    expect(velgTimeradForMaskin(maskin(), rader)).toBeNull();
    expect(velgTimeradForMaskin(maskin(), [...rader, rad("ok", 1, null, null)])).toBe("ok");
  });

  it("jobb uten arbeid → null", () => {
    expect(velgTimeradForMaskin(maskin(), [])).toBeNull();
  });
});
