import { describe, it, expect } from "vitest";
import {
  løsReiseKort,
  løsOverforingKort,
  delVedMidnatt,
  lesMidnattDel,
  finnReiseSomEnderPaaKontor,
  midnattPartnerDato,
} from "./reiseManuell";
import { pauseVinduForDag, utledArbeidstidFraRader } from "./pauseBeregning";
import type { ReiseRegelsett } from "./reise";

// O19 (vedtak-timer-web.md § Reisevinduet pkt 23–25): reise over midnatt deles ved 24:00 på web.
// Mobil sender ikke `tillatDeling` og sperrer som før.

const minutter: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};

const kort = (over: Partial<Parameters<typeof løsReiseKort>[0]> = {}) =>
  løsReiseKort({
    retning: "tur",
    oppmote: { kilde: "fast", oppmotestedId: "narvik" },
    dagStart: "07:00",
    dagSlutt: "15:00",
    byggeplassId: "bp",
    kjoretidFor: () => 233,
    avstandFor: () => 250000,
    regel: minutter,
    grensepunkter: [],
    resolverLonnsartId: "reise",
    standardLonnsartId: "ordinaer",
    ...over,
  });

describe("O19 pkt 23 — løsReiseKort med tillatDeling", () => {
  it("«Fra byggeplass» 21:00 + 233 min → deles fram, hele reisen i timer", () => {
    const r = kort({ retning: "retur", startTid: "21:00", tillatDeling: { omvendt: "fram" } });
    expect(r).toMatchObject({ fraTid: "21:00", tilTid: "00:53", deles: "fram", sperre: null });
    expect(r.timer).toBeCloseTo(233 / 60, 5);
  });

  it("negativkontroll: uten tillatDeling (mobil) → utenforDognet som før", () => {
    const r = kort({ retning: "retur", startTid: "21:00" });
    expect(r.sperre).toBe("utenforDognet");
    expect(r.deles).toBeUndefined();
  });

  it("«Til byggeplass» 02:00 − 233 min → deles bak (22:07 dagen før)", () => {
    const r = kort({ dagStart: "02:00", tillatDeling: { omvendt: "bak" } });
    expect(r).toMatchObject({ fraTid: "22:07", tilTid: "02:00", deles: "bak", sperre: null });
  });

  it("«Til byggeplass» 07:00 − 233 min = 03:07 → ikke delt", () => {
    const r = kort({ tillatDeling: { omvendt: "bak" } });
    expect(r).toMatchObject({ fraTid: "03:07", tilTid: "07:00", sperre: null });
    expect(r.deles).toBeUndefined();
  });

  it("pkt 24: «Til byggeplass» Start 19:00 > Slutt 07:00 → deles bak, 12 timer", () => {
    const r = kort({ startTid: "19:00", sluttTid: "07:00", tillatDeling: { omvendt: "bak" } });
    expect(r).toMatchObject({ fraTid: "19:00", tilTid: "07:00", deles: "bak", timer: 12, sperre: null });
  });

  it("negativkontroll pkt 24: uten tillatDeling → timer 0 (kalleren sperrer slutt før start)", () => {
    const r = kort({ startTid: "19:00", sluttTid: "07:00" });
    expect(r.timer).toBe(0);
    expect(r.deles).toBeUndefined();
  });

  it("negativkontroll pkt 24: rettet Slutt før forslagets Start («Til byggeplass», Start ikke skrevet) → ikke delt", () => {
    const r = kort({ sluttTid: "03:00", tillatDeling: { omvendt: "bak" } });
    expect(r.deles).toBeUndefined();
    expect(r.timer).toBe(0);
  });

  it("Start = Slutt → ikke delt, timer 0", () => {
    const r = kort({ retning: "retur", startTid: "21:00", sluttTid: "21:00", tillatDeling: { omvendt: "fram" } });
    expect(r.timer).toBe(0);
    expect(r.deles).toBeUndefined();
  });

  it("«Fra byggeplass» Slutt før Start (21:00 → 00:53) → deles fram", () => {
    const r = kort({ retning: "retur", startTid: "21:00", sluttTid: "00:53", tillatDeling: { omvendt: "fram" } });
    expect(r).toMatchObject({ deles: "fram", fraTid: "21:00", tilTid: "00:53" });
  });

  it("uten kjøretid (pkt 14): arbeiderens tider deles også", () => {
    const r = kort({
      retning: "retur",
      kjoretidFor: () => null,
      startTid: "22:00",
      sluttTid: "01:00",
      tillatUtenKjoretid: true,
      tillatDeling: { omvendt: "fram" },
    });
    expect(r).toMatchObject({ deles: "fram", timer: 3, utenKjoretid: "mangler" });
  });

  it("«Til annet oppmøtested» (løsOverforingKort) deles fram", () => {
    const r = løsOverforingKort({
      overforing: {
        retning: "ut",
        fra: { type: "kontor", oppmotestedId: "narvik" },
        til: { type: "kontor", oppmotestedId: "tromso" },
        periodeId: null,
      },
      oppmotestedId: "narvik",
      kjoretidMin: 233,
      avstandM: 250000,
      dagStart: "07:00",
      dagSlutt: "15:00",
      regel: minutter,
      grensepunkter: [],
      resolverLonnsartId: "reise",
      standardLonnsartId: "ordinaer",
      startTid: "21:00",
      sluttTid: "00:53",
      tillatDeling: { omvendt: "fram" },
    });
    expect(r).toMatchObject({ deles: "fram", sperre: null });
    expect(r.spor?.reiseRegel.overforing?.til).toEqual({ type: "kontor", oppmotestedId: "tromso" });
  });
});

describe("O19 — delVedMidnatt", () => {
  it("fram: 21:00–00:53 på 23.11 → 21:00–24:00 23.11 / 00:00–00:53 24.11", () => {
    const d = delVedMidnatt({ dato: "2026-11-23", vei: "fram", fraTid: "21:00", tilTid: "00:53" });
    expect(d).toEqual({
      vei: "fram",
      del1: { dato: "2026-11-23", fraTid: "21:00", tilTid: "24:00", timer: 3 },
      del2: { dato: "2026-11-24", fraTid: "00:00", tilTid: "00:53", timer: 0.8833 },
    });
  });

  it("bak (pkt 24): 19:00–07:00 på 23.11 → 19:00–24:00 22.11 / 00:00–07:00 23.11", () => {
    const d = delVedMidnatt({ dato: "2026-11-23", vei: "bak", fraTid: "19:00", tilTid: "07:00" });
    expect(d?.del1).toEqual({ dato: "2026-11-22", fraTid: "19:00", tilTid: "24:00", timer: 5 });
    expect(d?.del2).toEqual({ dato: "2026-11-23", fraTid: "00:00", tilTid: "07:00", timer: 7 });
  });

  it("månedsskifte: 30.11 fram → 01.12", () => {
    const d = delVedMidnatt({ dato: "2026-11-30", vei: "fram", fraTid: "22:00", tilTid: "01:00" });
    expect(d?.del2.dato).toBe("2026-12-01");
  });

  it("en del på 0 min → null (ingen deling)", () => {
    expect(delVedMidnatt({ dato: "2026-11-23", vei: "fram", fraTid: "21:00", tilTid: "00:00" })).toBeNull();
    expect(delVedMidnatt({ dato: "2026-11-23", vei: "bak", fraTid: "00:00", tilTid: "07:00" })).toBeNull();
  });
});

describe("O19 — lesMidnattDel", () => {
  it("leser merket", () => {
    expect(lesMidnattDel({ kategori: "reisetid", midnatt: { delId: "x", del: 2 } })).toEqual({ delId: "x", del: 2 });
  });
  it("negativkontroll: vanlig reise / ugyldig form → null", () => {
    expect(lesMidnattDel({ kategori: "reisetid" })).toBeNull();
    expect(lesMidnattDel({ midnatt: { delId: "x", del: 3 } })).toBeNull();
    expect(lesMidnattDel(null)).toBeNull();
  });
});

describe("O19 pkt 25 — finnReiseSomEnderPaaKontor", () => {
  const kontorreise = {
    fraTid: "03:10",
    tilTid: "07:00",
    erReise: true,
    reiseRegel: {
      overforing: { fra: { type: "kontor", oppmotestedId: "tromso" }, til: { type: "kontor", oppmotestedId: "narvik" } },
    },
  };

  it("kontorreise 03:10–07:00 + ny 03:07–07:00 → Kontor Narvik kl. 07:00", () => {
    expect(finnReiseSomEnderPaaKontor({ fraTid: "03:07", tilTid: "07:00" }, [kontorreise])).toEqual({
      kontorId: "narvik",
      tilTid: "07:00",
    });
  });

  it("negativkontroll 1: ingen overlapp (kontorreisen slutter 06:00)", () => {
    expect(
      finnReiseSomEnderPaaKontor({ fraTid: "06:10", tilTid: "07:00" }, [{ ...kontorreise, tilTid: "06:00" }]),
    ).toBeNull();
  });

  it("negativkontroll 2: overlapp med arbeid, «Til byggeplass» eller «Fra byggeplass» til kontoret", () => {
    const ny = { fraTid: "03:07", tilTid: "07:00" };
    expect(finnReiseSomEnderPaaKontor(ny, [{ fraTid: "06:00", tilTid: "10:00", erReise: false }])).toBeNull();
    expect(finnReiseSomEnderPaaKontor(ny, [{ fraTid: "03:10", tilTid: "07:00", erReise: true, reiseRegel: { kategori: "reisetid" } }])).toBeNull();
    expect(
      finnReiseSomEnderPaaKontor(ny, [
        {
          fraTid: "03:10",
          tilTid: "07:00",
          erReise: true,
          reiseRegel: { overforing: { fra: { type: "byggeplass", byggeplassId: "b" }, til: { type: "kontor", oppmotestedId: "narvik" } } },
        },
      ]),
    ).toBeNull();
  });
});

describe("O19 pkt 23 — 24:00-følger i pauseBeregning", () => {
  const dag = { startTid: "07:00", pauseEtterTimer: 4, pauseReferanse: "ankomst" as const };
  const del2 = { fraTid: "00:00", reiseRegel: { midnatt: { delId: "x", del: 2 } } };

  it("pausevinduet: del 2 (00:00) flytter ikke ankomsten", () => {
    expect(pauseVinduForDag([del2, { fraTid: "07:00" }], dag)).toBe(pauseVinduForDag([{ fraTid: "07:00" }], dag));
  });

  it("negativkontroll: vanlig reise 06:00 flytter fortsatt pausevinduet", () => {
    expect(pauseVinduForDag([{ fraTid: "06:00" }, { fraTid: "07:00" }], dag)).not.toBe(
      pauseVinduForDag([{ fraTid: "07:00" }], dag),
    );
  });

  it("«Arbeidstid i dag»: delte rader strekker ikke rammen", () => {
    const u = utledArbeidstidFraRader([
      { fraTid: "07:00", tilTid: "15:00", timer: 7.5, pauseMin: 30 },
      { fraTid: "21:00", tilTid: "24:00", timer: 3, reiseRegel: { midnatt: { delId: "x", del: 1 } } },
    ]);
    expect(u).toMatchObject({ startTid: "07:00", sluttTid: "15:00" });
  });
});

describe("O19 pkt 23 — midnattPartnerDato (visning)", () => {
  it("del 1 → dagen etter, del 2 → dagen før (også ISO-dato)", () => {
    expect(midnattPartnerDato("2026-11-23", { midnatt: { delId: "x", del: 1 } })).toEqual({ del: 1, dato: "2026-11-24" });
    expect(midnattPartnerDato("2026-12-01T00:00:00.000Z", { midnatt: { delId: "x", del: 2 } })).toEqual({ del: 2, dato: "2026-11-30" });
  });
  it("negativkontroll: vanlig reise → null", () => {
    expect(midnattPartnerDato("2026-11-23", { kategori: "reisetid" })).toBeNull();
  });
});
