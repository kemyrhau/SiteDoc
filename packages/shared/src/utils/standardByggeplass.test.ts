import { describe, it, expect } from "vitest";
import { velgStandardByggeplass, HELE_PROSJEKTET_VALG } from "./standardByggeplass";

/** ORDRE 2026-11-15 (18) TILLEGG — standardvalg byggeplass (a) sist brukt → (b) GPS → (c) første. */
const liste = ["b1", "b2", "b3"];

describe("velgStandardByggeplass — rekkefølge a→b→c", () => {
  it("(a) sist brukte byggeplass vinner over GPS og første", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: "b3", gpsNaermeste: "b2" })).toBe(
      "b3",
    );
  });
  it("(b) GPS når sist brukt mangler", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: null, gpsNaermeste: "b2" })).toBe(
      "b2",
    );
  });
  it("(c) første byggeplass når verken sist brukt eller GPS finnes", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null })).toBe("b1");
  });
  it("sist brukt som ikke finnes i prosjektet faller til GPS", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: "slettet", gpsNaermeste: "b2" })).toBe(
      "b2",
    );
  });
  it("GPS-treff utenfor prosjektet faller til første", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null, gpsNaermeste: "annet-prosjekt" })).toBe("b1");
  });
  // Negativkontroll: standarden er aldri «Hele prosjektet» uten at brukeren har valgt det.
  it("negativkontroll: uten lagret valg blir det aldri «Hele prosjektet»", () => {
    const valg = velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: null, gpsNaermeste: null });
    expect(valg).not.toBe(HELE_PROSJEKTET_VALG);
    expect(valg).not.toBeNull();
  });
  it("negativkontroll: GPS overstyrer ikke sist brukt", () => {
    expect(
      velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: "b1", gpsNaermeste: "b2" }),
    ).not.toBe("b2");
  });
});

describe("velgStandardByggeplass — lagrede valg røres ikke", () => {
  it("lagret byggeplass står, også mot sist brukt og GPS", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: "b2", sistBrukt: "b3", gpsNaermeste: "b1" })).toBe(
      "b2",
    );
  });
  it("eksplisitt «Hele prosjektet» huskes", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: HELE_PROSJEKTET_VALG, gpsNaermeste: "b1" })).toBe(
      HELE_PROSJEKTET_VALG,
    );
  });
  it("«Hele prosjektet» i brukerminnet (annen enhet) respekteres", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: null, sistBrukt: HELE_PROSJEKTET_VALG })).toBe(
      HELE_PROSJEKTET_VALG,
    );
  });
  it("lagret byggeplass som er slettet faller videre", () => {
    expect(velgStandardByggeplass({ byggeplassIder: liste, lagret: "slettet" })).toBe("b1");
  });
});

describe("velgStandardByggeplass — prosjekt uten byggeplasser", () => {
  it("0 byggeplasser gir null (uendret)", () => {
    expect(velgStandardByggeplass({ byggeplassIder: [], lagret: null, sistBrukt: "b1", gpsNaermeste: "b1" })).toBeNull();
  });
});
