import { describe, it, expect } from "vitest";
import { erBetingelseOppfylt, settForelderBetingelseVerdier } from "./betingelse";

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
