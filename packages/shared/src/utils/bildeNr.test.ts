import { describe, it, expect } from "vitest";
import { nesteBildeNr, nummererRepeaterBilder, leggTilVedleggIRad } from "./bildeNr";

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

describe("batch fra galleri-flervalg (trykk-rekkefølge → sammenhengende nr)", () => {
  // Modellerer hookens leggTilVedlegg: for hvert nytt bilde uten nummer tildeles
  // nesteBildeNr(prev) og vedlegget appendes — sekvensielt i input-rekkefølge.
  // Beviser at en batch på 4 valgte bilder får 1–4 i rekkefølgen de ankommer i.
  it("gir sammenhengende stigende nr i input-rekkefølge for en batch på 4", () => {
    let felt: { verdi: null; vedlegg: V[] } = { verdi: null, vedlegg: [] };
    const batch: V[] = [
      { type: "bilde" },
      { type: "bilde" },
      { type: "bilde" },
      { type: "bilde" },
    ];
    for (const nytt of batch) {
      const nr = nesteBildeNr({ felt });
      felt = { ...felt, vedlegg: [...felt.vedlegg, { ...nytt, bildeNr: nr }] };
    }
    expect(felt.vedlegg.map((v) => v.bildeNr)).toEqual([1, 2, 3, 4]);
  });

  it("fortsetter tellingen for en andre batch etter første (05–08)", () => {
    // Repeater 1 har allerede 4 bilder (01–04); ny batch i et annet felt fortsetter.
    const felt1: { verdi: null; vedlegg: V[] } = {
      verdi: null,
      vedlegg: [1, 2, 3, 4].map((n) => ({ type: "bilde", bildeNr: n })),
    };
    let felt2: { verdi: null; vedlegg: V[] } = { verdi: null, vedlegg: [] };
    for (let i = 0; i < 4; i++) {
      const nr = nesteBildeNr({ f1: felt1, f2: felt2 });
      felt2 = { ...felt2, vedlegg: [...felt2.vedlegg, { type: "bilde", bildeNr: nr }] };
    }
    expect(felt2.vedlegg.map((v) => v.bildeNr)).toEqual([5, 6, 7, 8]);
  });
});

// INTEGRASJON: veien FRA velgBilder og inn — ikke tildelings-funksjonen isolert.
// Bruker den EKTE produksjons-radformen `{ _radId, felter: { [feltId]: { vedlegg } } }`
// (RepeaterObjekt.normaliserRad, radkort.ts:152 leser `rad.felter[b.id]`) og komponerer
// nesteBildeNr + nummererRepeaterBilder NØYAKTIG som hookens oppdaterFelt gjør det:
//   nummererRepeaterBilder(oppd.verdi, nesteBildeNr(prevFeltVerdier))
// De isolerte testene over brukte en FLAT rad `{ feltId: { vedlegg } }` og traff aldri
// `.felter`-wrapperen — derfor passerte de mens produksjon ga null. Det var testhullet.
describe("integrasjon: batch i rik repeater (produksjonsform { _radId, felter })", () => {
  type Rad = { _radId: string; felter: Record<string, { vedlegg: V[] }> };
  type FeltVerdier = Record<string, { verdi: Rad[] }>;

  // FUNKSJONELL append — speiler den FIKSEDE hooken (oppdaterFelt): for hvert nytt
  // bilde appendes vedlegget via leggTilVedleggIRad mot FORRIGE (nummererte) state,
  // deretter renummereres hele verdien. Slik akkumulerer sekvensiell batch uansett
  // render-timing. Dette er veien velgBilder → håndterBilde ×N → onEndreVedlegg → state.
  function batchInn(
    fv: FeltVerdier,
    objektId: string,
    radIdx: number,
    feltId: string,
    antall: number,
  ): FeltVerdier {
    for (let i = 0; i < antall; i++) {
      const rader = leggTilVedleggIRad(fv[objektId]!.verdi, radIdx, feltId, { type: "bilde" });
      const nummerert = nummererRepeaterBilder(rader, nesteBildeNr(fv));
      fv = { ...fv, [objektId]: { ...fv[objektId]!, verdi: nummerert as Rad[] } };
    }
    return fv;
  }

  it("fire bilder valgt i ett grep får 01–04 i en rik repeater-rad", () => {
    let fv: FeltVerdier = {
      rep: { verdi: [{ _radId: "r1", felter: { bilde1: { vedlegg: [] } } }] },
    };
    fv = batchInn(fv, "rep", 0, "bilde1", 4);
    const nr = fv.rep!.verdi[0]!.felter.bilde1!.vedlegg.map((v) => v.bildeNr);
    expect(nr).toEqual([1, 2, 3, 4]);
  });

  it("neste batch i en ny rad fortsetter 05–08", () => {
    let fv: FeltVerdier = {
      rep: {
        verdi: [
          { _radId: "r1", felter: { bilde1: { vedlegg: [] } } },
          { _radId: "r2", felter: { bilde1: { vedlegg: [] } } },
        ],
      },
    };
    fv = batchInn(fv, "rep", 0, "bilde1", 4); // 01–04
    fv = batchInn(fv, "rep", 1, "bilde1", 4); // 05–08
    expect(fv.rep!.verdi[0]!.felter.bilde1!.vedlegg.map((v) => v.bildeNr)).toEqual([1, 2, 3, 4]);
    expect(fv.rep!.verdi[1]!.felter.bilde1!.vedlegg.map((v) => v.bildeNr)).toEqual([5, 6, 7, 8]);
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
