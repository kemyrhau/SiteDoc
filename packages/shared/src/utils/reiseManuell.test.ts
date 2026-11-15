import { describe, it, expect } from "vitest";
import {
  klassifiserManuellReise,
  manuellReiseManglerArt,
  løsReiseKort,
  løsOverforingKort,
  finnDagsramme,
} from "./reiseManuell";
import type { ReiseRegelsett } from "./reise";

const minutter: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};
const km: ReiseRegelsett = { ...minutter, reiseTerskelEnhet: "km", reiseTerskelM: 7500 };
const bånd = [
  { grenseM: 30000, lonnsartId: "reise-30-60" },
  { grenseM: 60000, lonnsartId: "reise-60" },
  { grenseM: 90000, lonnsartId: null },
];
const basis = {
  grensepunkter: bånd,
  resolverLonnsartId: "reise",
  standardLonnsartId: "ordinaer",
};

describe("klassifiserManuellReise — måles i timer", () => {
  it("under terskel → standard ordinær art, erReise false, ingen kilde/avstand", () => {
    const r = klassifiserManuellReise({ ...basis, regel: minutter, reisetimer: 0.25, avstandM: 40000 });
    expect(r).toMatchObject({
      kategori: "arbeidstid",
      lonnsartId: "ordinaer",
      erReise: false,
      reiseKilde: null,
      reiseAvstandM: null,
      forklaring: { type: "under", enhet: "minutter", terskelMin: 30 },
    });
    expect(r.reiseRegel).toMatchObject({ kategori: "arbeidstid", grensepunktTreff: false });
  });
  it("nøyaktig på terskelen = over → reise-art, kilde manuell", () => {
    const r = klassifiserManuellReise({ ...basis, regel: minutter, reisetimer: 0.5, avstandM: null });
    expect(r).toMatchObject({
      kategori: "reisetid",
      lonnsartId: "reise",
      erReise: true,
      reiseKilde: "manuell",
      reiseAvstandM: null,
      forklaring: { type: "over", enhet: "minutter", terskelMin: 30 },
    });
  });
  it("over terskel med kjent avstand → båndets art", () => {
    const r = klassifiserManuellReise({ ...basis, regel: minutter, reisetimer: 1, avstandM: 45000 });
    expect(r.lonnsartId).toBe("reise-30-60");
    expect(r.reiseAvstandM).toBe(45000);
    expect(r.reiseRegel.grensepunktTreff).toBe(true);
  });
});

describe("klassifiserManuellReise — måles i km", () => {
  it("under terskel → arbeidstid uansett reisetimer", () => {
    const r = klassifiserManuellReise({ ...basis, regel: km, reisetimer: 3, avstandM: 5000 });
    expect(r).toMatchObject({
      erReise: false,
      lonnsartId: "ordinaer",
      reiseAvstandM: null,
      forklaring: { type: "under", enhet: "km", terskelM: 7500 },
    });
  });
  it("over terskel, under laveste bånd → resolverens art", () => {
    const r = klassifiserManuellReise({ ...basis, regel: km, reisetimer: 0.25, avstandM: 12000 });
    expect(r).toMatchObject({
      erReise: true,
      lonnsartId: "reise",
      reiseAvstandM: 12000,
      forklaring: { type: "over", enhet: "km", terskelM: 7500 },
    });
    expect(r.reiseRegel.grensepunktTreff).toBe(false);
  });
  it("båndvalg: høyeste grensepunkt ≤ avstand; hull faller tilbake", () => {
    const art = (avstandM: number) =>
      klassifiserManuellReise({ ...basis, regel: km, reisetimer: 1, avstandM }).lonnsartId;
    expect(art(30000)).toBe("reise-30-60");
    expect(art(59999)).toBe("reise-30-60");
    expect(art(60000)).toBe("reise-60");
    expect(art(95000)).toBe("reise");
  });
  it("ukjent avstand (null eller uoppnåelig) → regel (c): under terskel", () => {
    for (const avstandM of [null, -1]) {
      const r = klassifiserManuellReise({ ...basis, regel: km, reisetimer: 2, avstandM });
      expect(r).toMatchObject({
        kategori: "arbeidstid",
        erReise: false,
        lonnsartId: "ordinaer",
        reiseAvstandM: null,
        forklaring: { type: "ukjentAvstand" },
      });
    }
  });
});

describe("klassifiserManuellReise — kanter", () => {
  it("mangler standard ordinær art under terskel → lonnsartId null (blokkér lagring)", () => {
    const r = klassifiserManuellReise({ ...basis, standardLonnsartId: null, regel: minutter, reisetimer: 0.1, avstandM: null });
    expect(r.lonnsartId).toBeNull();
    expect(r.erReise).toBe(false);
  });
  it("firma med reisetid også under terskel → reise-rad, forklaring sier under", () => {
    const r = klassifiserManuellReise({
      ...basis,
      regel: { ...minutter, reiseUnderTerskelType: "reisetid" },
      reisetimer: 0.1,
      avstandM: null,
    });
    expect(r).toMatchObject({ erReise: true, reiseKilde: "manuell", forklaring: { type: "under" } });
  });
});

// ============================================================================
//  POST 2026-11-15 (13) L2: reise-kortet (Tur/Retur)
// ============================================================================

describe("finnDagsramme", () => {
  it("første fraTid og siste tilTid blant ikke-reise-rader", () => {
    expect(
      finnDagsramme([
        { fraTid: "09:00", tilTid: "11:00", erReise: false },
        { fraTid: "06:00", tilTid: "07:00", erReise: true },
        { fraTid: "07:30", tilTid: "08:30", erReise: false },
        { fraTid: "15:00", tilTid: "18:00", erReise: true },
        { fraTid: "12:00", tilTid: "15:30", erReise: false },
      ]),
    ).toEqual({ dagStart: "07:30", dagSlutt: "15:30" });
  });
  it("ingen arbeidsrad med tid → null", () => {
    expect(finnDagsramme([{ fraTid: null, tilTid: null, erReise: false }])).toEqual({
      dagStart: null,
      dagSlutt: null,
    });
  });
});

describe("løsReiseKort", () => {
  const kort = (over: Partial<Parameters<typeof løsReiseKort>[0]> = {}) =>
    løsReiseKort({
      retning: "tur",
      oppmote: { kilde: "fast", oppmotestedId: "narvik" },
      dagStart: "07:00",
      dagSlutt: "15:00",
      byggeplassId: "bp",
      kjoretidFor: (o, b) => (o === "narvik" && b === "bp" ? 45 : null),
      avstandFor: (o, b) => (o === "narvik" && b === "bp" ? 40000 : null),
      regel: minutter,
      ...basis,
      ...over,
    });

  it("Tur: tilTid = dagStart, fraTid = dagStart − kjøretid", () => {
    const r = kort();
    expect(r).toMatchObject({ fraTid: "06:15", tilTid: "07:00", timer: 0.75, kjoretidMin: 45, sperre: null });
    expect(r.spor?.reiseRetning).toBe("ut");
    expect(r.spor?.reiseOppmotestedId).toBe("narvik");
    expect(r.spor?.reiseKjoretidMin).toBe(45);
  });

  it("Retur: fraTid = dagSlutt, tilTid = dagSlutt + kjøretid", () => {
    const r = kort({ retning: "retur" });
    expect(r).toMatchObject({ fraTid: "15:00", tilTid: "15:45", sperre: null });
    expect(r.spor?.reiseRetning).toBe("retur");
  });

  it("over terskel (45 ≥ 30 min) → reisetid på båndets art", () => {
    const r = kort();
    expect(r.klassifisering?.erReise).toBe(true);
    expect(r.klassifisering?.lonnsartId).toBe("reise-30-60");
  });

  it("under terskel → arbeidstid, ingen retning/oppmøtested på sporet (DB-CHECK)", () => {
    const r = kort({ kjoretidFor: () => 20 });
    expect(r.klassifisering?.erReise).toBe(false);
    expect(r.spor).toMatchObject({ reiseRetning: null, reiseOppmotestedId: null, reiseKilde: null });
    expect(r.sperre).toBeNull();
  });

  it("byggeplass-periode → ingen reise, sperret", () => {
    const r = kort({ oppmote: { kilde: "byggeplass", projectId: "p" } });
    expect(r).toMatchObject({ sperre: "byggeplassPeriode", spor: null, timer: 0 });
  });

  it("manglende matrisecelle → manglerKjoretid (ingen estimat)", () => {
    expect(kort({ kjoretidFor: () => null }).sperre).toBe("manglerKjoretid");
  });

  it("uoppnåelig par (−1) → manglerKjoretid", () => {
    expect(kort({ kjoretidFor: () => -1 }).sperre).toBe("manglerKjoretid");
  });

  it("ikkeValgt → manglerKjoretid (ingen kjøretid uten oppmøtested)", () => {
    expect(kort({ oppmote: { kilde: "ikkeValgt" } }).sperre).toBe("manglerKjoretid");
  });

  it("uten byggeplass → manglerKjoretid", () => {
    expect(kort({ byggeplassId: null }).sperre).toBe("manglerKjoretid");
  });

  it("Tur uten dagStart → manglerDagstid; Retur bruker dagSlutt", () => {
    expect(kort({ dagStart: null }).sperre).toBe("manglerDagstid");
    expect(kort({ dagStart: null, retning: "retur" }).sperre).toBeNull();
    expect(kort({ dagSlutt: null, retning: "retur" }).sperre).toBe("manglerDagstid");
  });

  it("Tur før midnatt → utenforDognet", () => {
    expect(kort({ dagStart: "00:30" }).sperre).toBe("utenforDognet");
    expect(kort({ dagSlutt: "23:30", retning: "retur" }).sperre).toBe("utenforDognet");
  });

  it("manglende art → manglerArt", () => {
    const r = kort({ kjoretidFor: () => 20, standardLonnsartId: null });
    expect(r.sperre).toBe("manglerArt");
  });

  it("uten regelsett → manglerRegel", () => {
    expect(kort({ regel: null }).sperre).toBe("manglerRegel");
  });
});

describe("løsOverforingKort — POST (13) L2 TILLEGG", () => {
  const ov = {
    retning: "ut" as const,
    fra: { type: "kontor" as const, oppmotestedId: "narvik" },
    til: { type: "kontor" as const, oppmotestedId: "tromso" },
    periodeId: "p1",
  };
  const kort = (over: Partial<Parameters<typeof løsOverforingKort>[0]> = {}) =>
    løsOverforingKort({
      overforing: ov,
      oppmotestedId: "narvik",
      kjoretidMin: 180,
      avstandM: 250000,
      dagStart: "07:00",
      dagSlutt: "15:00",
      regel: minutter,
      ...basis,
      ...over,
    });

  it("ut: før dagstart, reiseKilde overforing, rute + periode i regel-snapshoten", () => {
    const r = kort();
    expect(r).toMatchObject({ fraTid: "04:00", tilTid: "07:00", timer: 3, sperre: null });
    expect(r.spor).toMatchObject({
      erReise: true,
      reiseKilde: "overforing",
      reiseRetning: "ut",
      reiseOppmotestedId: "narvik",
      reiseKjoretidMin: 180,
    });
    expect(r.spor?.reiseRegel.overforing).toEqual({ fra: ov.fra, til: ov.til, periodeId: "p1" });
  });

  it("retur: etter dagslutt", () => {
    const r = kort({ overforing: { ...ov, retning: "retur", fra: ov.til, til: ov.fra } });
    expect(r).toMatchObject({ fraTid: "15:00", tilTid: "18:00" });
    expect(r.spor?.reiseRetning).toBe("retur");
  });

  it("under terskel → ordinær rad uten reise-felter, ruten står i snapshoten", () => {
    const r = kort({ kjoretidMin: 20 });
    expect(r.spor).toMatchObject({
      erReise: false,
      reiseKilde: null,
      reiseRetning: null,
      reiseOppmotestedId: null,
      reiseKjoretidMin: null,
    });
    expect(r.spor?.reiseRegel.overforing?.periodeId).toBe("p1");
  });

  it("ukjent eller uoppnåelig kjøretid → manglerKjoretid", () => {
    expect(kort({ kjoretidMin: null }).sperre).toBe("manglerKjoretid");
    expect(kort({ kjoretidMin: -1 }).sperre).toBe("manglerKjoretid");
  });

  it("uten dagstid → manglerDagstid", () => {
    expect(kort({ dagStart: null }).sperre).toBe("manglerDagstid");
  });
});
