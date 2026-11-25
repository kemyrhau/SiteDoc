import { describe, it, expect } from "vitest";
import { finnKantFlytt, type KantFlyttRad } from "./reiseManuell";

// O20 (vedtak-timer-web.md § Reisevinduet pkt 26): «Flytt jobbens start/slutt».
const jobb: KantFlyttRad = { id: "j1", fraTid: "07:00", tilTid: "17:30", erReise: false, kortId: "K", timer: 10 };

describe("finnKantFlytt", () => {
  it("Til-reise 07:00–07:50 flytter jobbens start til 07:50 (10,0 t → 9,17 t)", () => {
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [jobb] })).toEqual({
      radId: "j1",
      kant: "start",
      tid: "07:50",
      radTimer: 9.17,
      jobbFra: "07:50",
      jobbTil: "17:30",
      jobbTimer: 9.17,
    });
  });

  it("Fra-reise 17:00–17:40 flytter jobbens slutt til 17:00", () => {
    const f = finnKantFlytt({ reise: { fraTid: "17:00", tilTid: "17:40" }, retning: "retur", kortId: "K", rader: [jobb] });
    expect(f).toMatchObject({ radId: "j1", kant: "slutt", tid: "17:00", radTimer: 9.5, jobbFra: "07:00", jobbTil: "17:00" });
  });

  it("Til-reise som starter før jobben flytter også starten", () => {
    const f = finnKantFlytt({ reise: { fraTid: "06:30", tilTid: "07:20" }, retning: "ut", kortId: "K", rader: [jobb] });
    expect(f?.tid).toBe("07:20");
  });

  it("reise midt i jobben gir ingen flytting", () => {
    expect(finnKantFlytt({ reise: { fraTid: "10:00", tilTid: "10:30" }, retning: "ut", kortId: "K", rader: [jobb] })).toBeNull();
    expect(finnKantFlytt({ reise: { fraTid: "10:00", tilTid: "10:30" }, retning: "retur", kortId: "K", rader: [jobb] })).toBeNull();
  });

  it("feil retning (Til mot jobbens slutt, Fra mot start) gir ingen flytting", () => {
    expect(finnKantFlytt({ reise: { fraTid: "17:00", tilTid: "17:40" }, retning: "ut", kortId: "K", rader: [jobb] })).toBeNull();
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "retur", kortId: "K", rader: [jobb] })).toBeNull();
  });

  it("reise som dekker hele jobben (0 minutter igjen) gir ingen flytting", () => {
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "17:30" }, retning: "ut", kortId: "K", rader: [jobb] })).toBeNull();
  });

  it("overlapp med et annet kort gir ingen flytting", () => {
    const annet: KantFlyttRad = { id: "a1", fraTid: "06:00", tilTid: "07:10", erReise: false, kortId: "ANNET" };
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [jobb, annet] })).toBeNull();
  });

  it("jobben i et annet kort enn vinduets gir ingen flytting", () => {
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "X", rader: [jobb] })).toBeNull();
  });

  it("reisen overlapper også neste rad i kortet → ingen flytting", () => {
    const forste: KantFlyttRad = { id: "f", fraTid: "07:00", tilTid: "07:30", erReise: false, kortId: "K", timer: 0.5 };
    const neste: KantFlyttRad = { id: "n", fraTid: "07:30", tilTid: "15:00", erReise: false, kortId: "K", timer: 7 };
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [forste, neste] })).toBeNull();
  });

  it("flere rader: tidligste rad flyttes, jobbens sum regnes med alle", () => {
    const normal: KantFlyttRad = { id: "n", fraTid: "07:00", tilTid: "15:00", erReise: false, kortId: "K", timer: 7.5 };
    const overtid: KantFlyttRad = { id: "o", fraTid: "15:00", tilTid: "17:30", erReise: false, kortId: "K", timer: 2.5 };
    const f = finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [overtid, normal] });
    expect(f).toMatchObject({ radId: "n", tid: "07:50", radTimer: 6.67, jobbFra: "07:50", jobbTil: "17:30", jobbTimer: 9.17 });
  });

  it("reise- og arbeidstid-reiserader er ikke jobb", () => {
    const reise: KantFlyttRad = { id: "r", fraTid: "06:00", tilTid: "07:00", erReise: true, kortId: "K" };
    const arbReise: KantFlyttRad = { id: "ar", fraTid: "06:00", tilTid: "07:00", erReise: false, arbeidReise: true, kortId: "K" };
    const f = finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [reise, arbReise, jobb] });
    expect(f?.radId).toBe("j1");
  });

  it("attestert kantrad flyttes ikke; erstattet rad teller ikke", () => {
    expect(
      finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [{ ...jobb, attestertStatus: "attestert" }] }),
    ).toBeNull();
    const erstattet: KantFlyttRad = { id: "e", fraTid: "06:00", tilTid: "08:00", erReise: false, kortId: "K", attestertStatus: "erstattet" };
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:50" }, retning: "ut", kortId: "K", rader: [erstattet, jobb] })?.radId).toBe("j1");
  });

  it("timer som blir 0 eller lavere gir ingen flytting (pausen står)", () => {
    const kort: KantFlyttRad = { id: "k", fraTid: "07:00", tilTid: "08:00", erReise: false, kortId: "K", timer: 0.5 };
    expect(finnKantFlytt({ reise: { fraTid: "07:00", tilTid: "07:40" }, retning: "ut", kortId: "K", rader: [kort] })).toBeNull();
  });
});
