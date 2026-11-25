import { describe, it, expect } from "vitest";
import {
  startEtterSluttIJobb,
  finnJobbTid,
  løsReiseKort,
  type KantFlyttRad,
  type ReiseKortInput,
} from "./reiseManuell";
import type { ReiseRegelsett } from "./reise";

// O23 (vedtak-timer-web.md § Reisevinduet pkt 29): «Fra byggeplass», Slutt inne i jobben →
// Start = Slutt − kjøretid, og Slutt inne i egen jobb leses aldri som et kryss over midnatt.
const normal: KantFlyttRad = { id: "n", fraTid: "07:00", tilTid: "15:00", erReise: false, kortId: "K" };
const overtid: KantFlyttRad = { id: "o", fraTid: "15:00", tilTid: "17:30", erReise: false, kortId: "K" };
const grunn = { startTid: "17:30", kjoretidMin: 4, folger: false, kortId: "K", rader: [normal, overtid] };

describe("startEtterSluttIJobb", () => {
  it("Kenneths tilfelle: Slutt 17:00 ≤ Start 17:30, inne i jobben 07:00–17:30 → Start 16:56", () => {
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "17:00" })).toBe("16:56");
  });

  it("Slutt lik jobbens slutt (17:30) → 17:26; Slutt i normalraden (10:00) → 09:56", () => {
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "17:30" })).toBe("17:26");
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "10:00" })).toBe("09:56");
  });

  it("Slutt etter jobben eller på/før jobbens start → Start står", () => {
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "17:40" })).toBeNull();
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "01:00" })).toBeNull();
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "07:00" })).toBeNull();
  });

  it("arbeiderens Slutt etter Start står (Start er hens egen)", () => {
    expect(startEtterSluttIJobb({ ...grunn, startTid: "16:30", sluttTid: "17:00" })).toBeNull();
  });

  it("mellomverdi: Start satt av regelen følger også når Slutt > Start", () => {
    // 17:34 → 16:34 (Start 16:30) → 16:50: Start ender på 16:46, ikke 16:30.
    expect(startEtterSluttIJobb({ ...grunn, sluttTid: "16:34" })).toBe("16:30");
    expect(startEtterSluttIJobb({ ...grunn, startTid: "16:30", sluttTid: "16:50", folger: true })).toBe("16:46");
    // Uten følge-merket står Start.
    expect(startEtterSluttIJobb({ ...grunn, startTid: "16:30", sluttTid: "16:50" })).toBeNull();
  });

  it("uten kjøretid, uten kort eller uten jobb i kortet → Start står", () => {
    expect(startEtterSluttIJobb({ ...grunn, kjoretidMin: null, sluttTid: "17:00" })).toBeNull();
    expect(startEtterSluttIJobb({ ...grunn, kortId: null, sluttTid: "17:00" })).toBeNull();
    expect(startEtterSluttIJobb({ ...grunn, kortId: "annet", sluttTid: "17:00" })).toBeNull();
    const erstattet = { ...overtid, attestertStatus: "erstattet" };
    expect(startEtterSluttIJobb({ ...grunn, rader: [normal, erstattet], sluttTid: "17:00" })).toBeNull();
  });
});

describe("finnJobbTid", () => {
  it("jobbens første start og siste slutt i kortet", () => {
    expect(finnJobbTid({ kortId: "K", rader: [overtid, normal] })).toEqual({ fra: "07:00", til: "17:30" });
    expect(finnJobbTid({ kortId: null, rader: [normal] })).toBeNull();
    expect(finnJobbTid({ kortId: "K", rader: [] })).toBeNull();
  });
});

describe("løsReiseKort — Slutt inne i egen jobb er ikke et kryss over midnatt (pkt 29)", () => {
  const REGEL: ReiseRegelsett = {
    reiseTerskelEnhet: "minutter",
    reiseTerskelMin: 30,
    reiseTerskelM: null,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
  };
  const jobb = { fra: "07:00", til: "17:30" };
  const basis = (o: Partial<ReiseKortInput>): ReiseKortInput => ({
    retning: "retur",
    oppmote: { kilde: "fast", oppmotestedId: "t", periodeId: "p" } as ReiseKortInput["oppmote"],
    dagStart: "07:00",
    dagSlutt: "17:30",
    byggeplassId: "b",
    kjoretidFor: () => 4,
    avstandFor: () => null,
    regel: REGEL,
    grensepunkter: [],
    resolverLonnsartId: null,
    standardLonnsartId: "lr",
    tillatUtenKjoretid: true,
    tillatDeling: { omvendt: "fram", jobb },
    ...o,
  });

  it("uten kjøretid: Slutt 17:00 med Start 17:30 gir 0 timer og ingen deling (ikke 23,5 t)", () => {
    const r = løsReiseKort(basis({ kjoretidFor: () => null, sluttTid: "17:00" }));
    expect(r.deles).toBeUndefined();
    expect(r.timer).toBe(0);
    expect(r).toMatchObject({ fraTid: "17:30", tilTid: "17:00" });
  });

  it("uten oppmøtested (O22): samme — ingen reise på 23,5 t", () => {
    const r = løsReiseKort(basis({ oppmote: { kilde: "ikkeValgt" } as ReiseKortInput["oppmote"], sluttTid: "17:00" }));
    expect(r.utenKjoretid).toBe("utenOppmote");
    expect(r.deles).toBeUndefined();
    expect(r.timer).toBe(0);
  });

  it("med kjøretid, regelen ikke brukt: Slutt 17:00 før Start 17:30 gir 0 timer, ikke deling", () => {
    const r = løsReiseKort(basis({ sluttTid: "17:00" }));
    expect(r.deles).toBeUndefined();
    expect(r.timer).toBe(0);
  });

  it("regresjon pkt 23: Slutt 01:00 (utenfor jobben) krysser midnatt som før", () => {
    const r = løsReiseKort(basis({ sluttTid: "01:00" }));
    expect(r.deles).toBe("fram");
    expect(r.timer).toBe(7.5);
  });

  it("regresjon: uten jobb i kallet krysser Slutt 17:00 midnatt som før (mobil/dagskort)", () => {
    const r = løsReiseKort(basis({ sluttTid: "17:00", tillatDeling: { omvendt: "fram" } }));
    expect(r.deles).toBe("fram");
    expect(r.timer).toBe(23.5);
  });
});
