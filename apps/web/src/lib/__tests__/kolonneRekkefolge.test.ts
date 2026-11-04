import { describe, it, expect } from "vitest";
import { effektivRekkefolge, flyttKolonne, vekslKolonne } from "../kolonneRekkefolge";

/** Kolonne-rekkefølge i sjekklister og oppgaver: én lagret liste, gamle oppsett i standardrekkefølge. */
const KANONISK = ["prefix", "nr", "status", "tittel", "ansvarlig", "bygning", "frist"];

describe("effektivRekkefolge", () => {
  it("gammelt oppsett (uten flagg, også fra localStorage) vises i standardrekkefølge", () => {
    expect(effektivRekkefolge({ kolonner: ["bygning", "status", "nr", "prefix"] }, KANONISK))
      .toEqual(["prefix", "nr", "status", "bygning"]);
  });

  it("med flagget er lista visningsrekkefølgen", () => {
    expect(effektivRekkefolge({ kolonner: ["prefix", "tittel", "bygning", "ansvarlig"], rekkefolge: true }, KANONISK))
      .toEqual(["prefix", "tittel", "bygning", "ansvarlig"]);
  });

  it("ukjente ider (verdi-kolonner fra maler som ikke er lastet) beholdes sist i gammelt oppsett", () => {
    expect(effektivRekkefolge({ kolonner: ["felt-1", "nr"] }, KANONISK)).toEqual(["nr", "felt-1"]);
  });

  it("duplikater fjernes", () => {
    expect(effektivRekkefolge({ kolonner: ["nr", "nr", "status"], rekkefolge: true }, KANONISK)).toEqual(["nr", "status"]);
  });
});

describe("vekslKolonne", () => {
  it("en kolonne som slås på, havner sist", () => {
    expect(vekslKolonne(["tittel", "nr"], "bygning")).toEqual(["tittel", "nr", "bygning"]);
  });

  it("en kolonne som slås av, fjernes uten å flytte de andre", () => {
    expect(vekslKolonne(["tittel", "bygning", "nr"], "bygning")).toEqual(["tittel", "nr"]);
  });
});

describe("flyttKolonne", () => {
  it("Bygning dras til plassen mellom Tittel og Ansvarlig", () => {
    expect(flyttKolonne(["prefix", "tittel", "ansvarlig", "frist", "bygning"], "bygning", "ansvarlig"))
      .toEqual(["prefix", "tittel", "bygning", "ansvarlig", "frist"]);
  });

  it("flytting mot høyre", () => {
    expect(flyttKolonne(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
  });

  it("ukjent id eller samme plass gir uendret kopi", () => {
    const r = ["a", "b"];
    expect(flyttKolonne(r, "x", "a")).toEqual(r);
    expect(flyttKolonne(r, "a", "a")).toEqual(r);
    expect(flyttKolonne(r, "a", "a")).not.toBe(r);
  });
});
