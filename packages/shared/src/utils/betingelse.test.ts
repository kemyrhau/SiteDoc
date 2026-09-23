import { describe, it, expect } from "vitest";
import {
  erBetingelseOppfylt,
  erObjektSynlig,
  settForelderBetingelseVerdier,
  type SynlighetsObjekt,
} from "./betingelse";

// Forelder = ett enkeltvalg med to opsjoner. To søsken under den.
const forelder = { config: { conditionActive: true, conditionValues: ["ubundet", "bundet"] } };

describe("erBetingelseOppfylt — utløsere per barn (2026-09-21)", () => {
  it("🔴 to søsken med hvert sitt utløsersett: vises på HVER SIN forelderverdi", () => {
    const barnA = { config: { conditionOwnValues: ["ubundet"] } };
    const barnB = { config: { conditionOwnValues: ["bundet"] } };

    // Forelder = "ubundet": bare A vises.
    expect(erBetingelseOppfylt(forelder, barnA, "ubundet")).toBe(true);
    expect(erBetingelseOppfylt(forelder, barnB, "ubundet")).toBe(false);

    // Forelder = "bundet": bare B vises.
    expect(erBetingelseOppfylt(forelder, barnA, "bundet")).toBe(false);
    expect(erBetingelseOppfylt(forelder, barnB, "bundet")).toBe(true);
  });

  it("barnets eget sett vinner selv om forelderens sett er bredere", () => {
    const barn = { config: { conditionOwnValues: ["bundet"] } };
    // forelder.conditionValues rommer begge, men barnet vil bare ha "bundet".
    expect(erBetingelseOppfylt(forelder, barn, "ubundet")).toBe(false);
    expect(erBetingelseOppfylt(forelder, barn, "bundet")).toBe(true);
  });
});

describe("erBetingelseOppfylt — bakoverkompatibelt (arver forelderen)", () => {
  it("barn UTEN eget sett arver forelderens conditionValues (dagens oppførsel)", () => {
    const barn = { config: {} };
    expect(erBetingelseOppfylt(forelder, barn, "ubundet")).toBe(true);
    expect(erBetingelseOppfylt(forelder, barn, "bundet")).toBe(true);
    expect(erBetingelseOppfylt(forelder, barn, "annet")).toBe(false);
  });

  it("tomt eget sett ([]) arver forelderen — tomt teller ikke som «eget»", () => {
    const barn = { config: { conditionOwnValues: [] } };
    expect(erBetingelseOppfylt(forelder, barn, "ubundet")).toBe(true);
  });

  it("flervalg-forelder: arv matcher når minst én valgt verdi er i settet", () => {
    const barn = { config: {} };
    expect(erBetingelseOppfylt(forelder, barn, ["annet", "bundet"])).toBe(true);
    expect(erBetingelseOppfylt(forelder, barn, ["annet"])).toBe(false);
  });

  it("flervalg-forelder mot barnets EGET sett", () => {
    const barn = { config: { conditionOwnValues: ["bundet"] } };
    expect(erBetingelseOppfylt(forelder, barn, ["ubundet", "bundet"])).toBe(true);
    expect(erBetingelseOppfylt(forelder, barn, ["ubundet"])).toBe(false);
  });

  it("ingen verdi valgt (null/undefined) → ikke synlig", () => {
    const barn = { config: {} };
    expect(erBetingelseOppfylt(forelder, barn, null)).toBe(false);
    expect(erBetingelseOppfylt(forelder, barn, undefined)).toBe(false);
  });
});

describe("erObjektSynlig — sannhetstabell (fasit for app OG rapport, DoD #2)", () => {
  // Tre: forelder (enkeltvalg) med to søsken — a har EGET sett, b ARVER forelderen —
  // og et barnebarn bb under a. bb har ingen egen betingelse: den er synlig hvis og
  // bare hvis a er synlig (rekursjon oppover — barn av skjult forelder er skjult).
  const tre: SynlighetsObjekt[] = [
    { id: "p", type: "list_single", config: { conditionActive: true, conditionValues: ["b-svar"] } },
    { id: "a", type: "text", parentId: "p", config: { conditionOwnValues: ["a-svar"] } },
    { id: "b", type: "text", parentId: "p", config: {} },
    { id: "bb", type: "text", parentId: "a", config: {} },
  ];
  // Kun forelderen `p` bærer et svar; a/b/bb er ikke verdi-bærende betingelses-foreldre.
  const svarAlternativer = ["a-svar", "b-svar", "annet", null];

  // GENERERT fra koden: kjør erObjektSynlig for hvert felt × hvert svar.
  function byggTabell(): Record<string, Record<string, boolean>> {
    const tabell: Record<string, Record<string, boolean>> = {};
    for (const svar of svarAlternativer) {
      const noekkel = svar === null ? "(ingen)" : svar;
      const hentVerdi = (id: string): unknown => (id === "p" ? svar : undefined);
      tabell[noekkel] = {};
      for (const felt of tre) {
        tabell[noekkel][felt.id] = erObjektSynlig(felt, tre, hentVerdi);
      }
    }
    return tabell;
  }

  it("🔴 hele matrisen: forelder alltid synlig, a på eget svar, b på arvet svar, bb følger a", () => {
    expect(byggTabell()).toEqual({
      // svar        p      a (eget)   b (arv)   bb (barn av a)
      "a-svar":  { p: true, a: true,  b: false, bb: true },
      "b-svar":  { p: true, a: false, b: true,  bb: false },
      "annet":   { p: true, a: false, b: false, bb: false },
      "(ingen)": { p: true, a: false, b: false, bb: false },
    });
  });

  it("barnebarnet er skjult når søskenet det henger under er skjult (rekursjon oppover)", () => {
    const skjult = (id: string): unknown => (id === "p" ? "b-svar" : undefined); // a er skjult
    expect(erObjektSynlig(tre.find((o) => o.id === "a")!, tre, skjult)).toBe(false);
    expect(erObjektSynlig(tre.find((o) => o.id === "bb")!, tre, skjult)).toBe(false);
  });
});

describe("erObjektSynlig — de tre hook-tilfellene (DoD #4)", () => {
  it("conditionActive = false → barnet er alltid synlig, uansett svar", () => {
    const tre: SynlighetsObjekt[] = [
      { id: "p", type: "list_single", config: { conditionActive: false, conditionValues: ["ja"] } },
      { id: "c", type: "text", parentId: "p", config: {} },
    ];
    const barn = tre[1];
    expect(erObjektSynlig(barn, tre, () => "hva-som-helst")).toBe(true);
    expect(erObjektSynlig(barn, tre, () => null)).toBe(true);
  });

  it("utenfor_krav → barnet vises når tallfelt-forelderen bryter kravet", () => {
    const tre: SynlighetsObjekt[] = [
      { id: "p", type: "decimal", config: { conditionActive: true, conditionType: "utenfor_krav", maks: 10 } },
      { id: "avvik", type: "text", parentId: "p", config: {} },
    ];
    const barn = tre[1];
    // Verdi 15 > maks 10 → utenfor krav → avviksfeltet vises.
    expect(erObjektSynlig(barn, tre, (id) => (id === "p" ? 15 : undefined))).toBe(true);
    // Verdi 5 ≤ maks 10 → innenfor → skjult.
    expect(erObjektSynlig(barn, tre, (id) => (id === "p" ? 5 : undefined))).toBe(false);
  });

  it("barn av skjult forelder er skjult (rekursjon oppover, maks 10 nivåer)", () => {
    const tre: SynlighetsObjekt[] = [
      { id: "p", type: "list_single", config: { conditionActive: true, conditionValues: ["ja"] } },
      { id: "mellom", type: "text", parentId: "p", config: {} },
      { id: "dyp", type: "text", parentId: "mellom", config: {} },
    ];
    const dyp = tre[2];
    // p = "ja" → hele kjeden synlig.
    expect(erObjektSynlig(dyp, tre, (id) => (id === "p" ? "ja" : undefined))).toBe(true);
    // p = "nei" → mellom skjult → dyp skjult.
    expect(erObjektSynlig(dyp, tre, (id) => (id === "p" ? "nei" : undefined))).toBe(false);
  });
});

describe("erObjektSynlig — maler uten betingelser er uendret (DoD #3)", () => {
  it("rot-felt uten parentId er alltid synlige", () => {
    const flat: SynlighetsObjekt[] = [
      { id: "f1", type: "text", config: {} },
      { id: "f2", type: "list_single", config: {} },
      { id: "f3", type: "decimal", parentId: null, config: {} },
    ];
    for (const felt of flat) {
      expect(erObjektSynlig(felt, flat, () => undefined)).toBe(true);
    }
  });

  it("repeater-barn er alltid synlige (ingen betingelseslogikk)", () => {
    const tre: SynlighetsObjekt[] = [
      { id: "rep", type: "repeater", config: {} },
      { id: "rad", type: "text", parentId: "rep", config: {} },
    ];
    expect(erObjektSynlig(tre[1], tre, () => undefined)).toBe(true);
  });

  it("betingelses-forelder finnes ikke i settet → barnet vises (sikkerhets-fallback)", () => {
    const tre: SynlighetsObjekt[] = [{ id: "foreldreløs", type: "text", parentId: "borte", config: {} }];
    expect(erObjektSynlig(tre[0], tre, () => undefined)).toBe(true);
  });
});

describe("settForelderBetingelseVerdier — forelder-redigering rører ikke barnas sett (DoD #4)", () => {
  const objekter = [
    { id: "p", config: { conditionActive: true, conditionValues: ["ubundet"] } },
    { id: "a", parentId: "p", config: { conditionOwnValues: ["ubundet"] } },
    { id: "b", parentId: "p", config: { conditionOwnValues: ["bundet"] } },
  ];

  it("endrer KUN forelderens conditionValues", () => {
    const neste = settForelderBetingelseVerdier(objekter, "p", ["ubundet", "bundet"]);
    expect(neste.find((o) => o.id === "p")!.config.conditionValues).toEqual(["ubundet", "bundet"]);
  });

  it("barnas conditionOwnValues er uendret etter forelder-redigering", () => {
    const neste = settForelderBetingelseVerdier(objekter, "p", ["bundet"]);
    expect(neste.find((o) => o.id === "a")!.config.conditionOwnValues).toEqual(["ubundet"]);
    expect(neste.find((o) => o.id === "b")!.config.conditionOwnValues).toEqual(["bundet"]);
  });

  it("barne-objektene beholder samme referanse (kun forelder får ny)", () => {
    const neste = settForelderBetingelseVerdier(objekter, "p", ["bundet"]);
    expect(neste.find((o) => o.id === "a")).toBe(objekter[1]);
    expect(neste.find((o) => o.id === "b")).toBe(objekter[2]);
    expect(neste.find((o) => o.id === "p")).not.toBe(objekter[0]);
  });
});
