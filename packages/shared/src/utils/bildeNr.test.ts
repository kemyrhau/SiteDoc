import { describe, it, expect } from "vitest";
import { nesteBildeNr, nummererRepeaterBilder } from "./bildeNr";

type V = { type: string; bildeNr?: number };
type Rad = Record<string, { vedlegg: V[] }>;

describe("nesteBildeNr", () => {
  it("gir 1 for tomt dokument", () => {
    expect(nesteBildeNr({})).toBe(1);
  });

  it("teller bilder på tvers av topp-nivå-felt", () => {
    const fv = {
      a: { verdi: null, vedlegg: [{ type: "bilde", bildeNr: 1 }] },
      b: { verdi: null, vedlegg: [{ type: "bilde", bildeNr: 2 }] },
    };
    expect(nesteBildeNr(fv)).toBe(3);
  });

  it("ignorerer fil-vedlegg (kun bilder telles)", () => {
    const fv = {
      a: {
        verdi: null,
        vedlegg: [
          { type: "bilde", bildeNr: 1 },
          { type: "fil" },
        ],
      },
    };
    expect(nesteBildeNr(fv)).toBe(2);
  });

  it("teller bilder inne i repeater-rader", () => {
    const fv = {
      topp: { verdi: null, vedlegg: [{ type: "bilde", bildeNr: 1 }] },
      rep: {
        verdi: [
          { barn1: { vedlegg: [{ type: "bilde", bildeNr: 2 }] } },
          { barn1: { vedlegg: [{ type: "bilde", bildeNr: 3 }] } },
        ],
      },
    };
    expect(nesteBildeNr(fv)).toBe(4);
  });

  it("er kollisjonsfri når et bilde mangler nummer (bruker antall)", () => {
    const fv = {
      a: {
        verdi: null,
        vedlegg: [{ type: "bilde", bildeNr: 1 }, { type: "bilde" }],
      },
    };
    // maks=1, antall=2 → neste=3 (ikke 2, som ville kollidere)
    expect(nesteBildeNr(fv)).toBe(3);
  });
});

describe("nummererRepeaterBilder", () => {
  it("returnerer samme referanse når ingen bilder mangler nummer", () => {
    const rader: Rad[] = [{ barn1: { vedlegg: [{ type: "bilde", bildeNr: 1 }] } }];
    expect(nummererRepeaterBilder(rader, 5)).toBe(rader);
  });

  it("tildeler startNr til bilde som mangler nummer", () => {
    const rader: Rad[] = [{ barn1: { vedlegg: [{ type: "bilde" }] } }];
    const ut = nummererRepeaterBilder(rader, 7);
    expect(ut).not.toBe(rader);
    expect(ut[0]!.barn1!.vedlegg[0]!.bildeNr).toBe(7);
  });

  it("nummererer flere manglende sekvensielt og lar fil-vedlegg være", () => {
    const rader: Rad[] = [
      { b: { vedlegg: [{ type: "bilde" }, { type: "fil" }] } },
      { b: { vedlegg: [{ type: "bilde" }] } },
    ];
    const ut = nummererRepeaterBilder(rader, 3);
    expect(ut[0]!.b!.vedlegg[0]!.bildeNr).toBe(3);
    expect(ut[0]!.b!.vedlegg[1]!.bildeNr).toBeUndefined();
    expect(ut[1]!.b!.vedlegg[0]!.bildeNr).toBe(4);
  });

  it("bevarer allerede tildelte numre", () => {
    const rader: Rad[] = [
      { b: { vedlegg: [{ type: "bilde", bildeNr: 2 }, { type: "bilde" }] } },
    ];
    const ut = nummererRepeaterBilder(rader, 3);
    expect(ut[0]!.b!.vedlegg[0]!.bildeNr).toBe(2);
    expect(ut[0]!.b!.vedlegg[1]!.bildeNr).toBe(3);
  });
});
