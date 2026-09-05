import { describe, it, expect } from "vitest";
import { avgjørKoalescering, KOALESCER_VINDU_MS, type EndringsloggInnslag, type Loggkandidat } from "./endringslogg";

/**
 * Ren beslutning uten DB — koalescér eller ny rad. Dette er logikken som bar
 * bug-klassen (~18 rader for ett avsnitt). Vinduet + bruker-bruddet gjøres
 * ulovlig å drifte fra her.
 */

const BRUKER = "u1";
const NAA = new Date("2026-09-05T22:00:00.000Z");
const innslag: EndringsloggInnslag = {
  fieldId: "f1",
  fieldLabel: "Verneutstyr",
  oldValue: "\"start\"",
  newValue: "\"slutt\"",
};

const kandidat = (over: Partial<NonNullable<Loggkandidat>>): Loggkandidat => ({
  id: "rad1",
  userId: BRUKER,
  createdAt: new Date(NAA.getTime() - 1000),
  oldValue: "\"opprinnelig\"",
  ...over,
});

describe("avgjørKoalescering", () => {
  it("ingen kandidat → ny rad", () => {
    expect(avgjørKoalescering(null, innslag, BRUKER, NAA)).toEqual({ type: "opprett" });
  });

  it("samme bruker, innenfor vinduet → oppdater eksisterende rad", () => {
    const k = kandidat({});
    expect(avgjørKoalescering(k, innslag, BRUKER, NAA)).toEqual({ type: "oppdater", id: "rad1" });
  });

  it("annen bruker på nyeste rad → ny rad (bruker-brudd)", () => {
    const k = kandidat({ userId: "u2" });
    expect(avgjørKoalescering(k, innslag, BRUKER, NAA)).toEqual({ type: "opprett" });
  });

  it("utenfor vinduet → ny rad", () => {
    const k = kandidat({ createdAt: new Date(NAA.getTime() - KOALESCER_VINDU_MS - 1) });
    expect(avgjørKoalescering(k, innslag, BRUKER, NAA)).toEqual({ type: "opprett" });
  });

  it("nøyaktig på vindusgrensen → ny rad (grensen er eksklusiv)", () => {
    const k = kandidat({ createdAt: new Date(NAA.getTime() - KOALESCER_VINDU_MS) });
    expect(avgjørKoalescering(k, innslag, BRUKER, NAA)).toEqual({ type: "opprett" });
  });

  it("koalescert verdi lik radens opprinnelige «fra» → slett (netto-null)", () => {
    const k = kandidat({ oldValue: "\"opprinnelig\"" });
    const angret: EndringsloggInnslag = { ...innslag, newValue: "\"opprinnelig\"" };
    expect(avgjørKoalescering(k, angret, BRUKER, NAA)).toEqual({ type: "slett", id: "rad1" });
  });

  it("netto-null gjelder radens «fra», ikke innslagets «fra»", () => {
    // Innslagets oldValue er en mellomtilstand; kun radens opprinnelige teller.
    const k = kandidat({ oldValue: "\"A\"" });
    const angret: EndringsloggInnslag = { fieldId: "f1", fieldLabel: "F", oldValue: "\"B\"", newValue: "\"A\"" };
    expect(avgjørKoalescering(k, angret, BRUKER, NAA)).toEqual({ type: "slett", id: "rad1" });
  });
});
