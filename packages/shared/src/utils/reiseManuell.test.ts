import { describe, it, expect } from "vitest";
import { klassifiserManuellReise, velgOppmotested } from "./reiseManuell";
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

describe("velgOppmotested", () => {
  it("ingen oppmøtesteder → ingen", () => {
    expect(velgOppmotested([], "a")).toEqual({ modus: "ingen" });
  });
  it("nøyaktig ett → auto, uavhengig av siste valg", () => {
    expect(velgOppmotested([{ id: "a" }], "x")).toEqual({ modus: "auto", oppmotestedId: "a" });
  });
  it("flere → nedtrekk med siste valg forhåndsvalgt", () => {
    expect(velgOppmotested([{ id: "a" }, { id: "b" }], "b")).toEqual({ modus: "velg", valgtId: "b", ider: ["a", "b"] });
  });
  it("flere uten gyldig siste valg → ingenting valgt", () => {
    expect(velgOppmotested([{ id: "a" }, { id: "b" }], "slettet")).toEqual({ modus: "velg", valgtId: null, ider: ["a", "b"] });
    expect(velgOppmotested([{ id: "a" }, { id: "b" }], null)).toEqual({ modus: "velg", valgtId: null, ider: ["a", "b"] });
  });
});
