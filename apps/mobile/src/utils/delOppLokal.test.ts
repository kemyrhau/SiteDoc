import { describe, it, expect } from "vitest";
import { beregnDelOppFordeling } from "@sitedoc/shared";
import { planleggDelOppLokalt, synketVareFeil, type LokalKoblet } from "./delOppLokal";

/**
 * Runde 8 mobil (Kenneth 2026-11-28 «A»): fra fordeling til lokale skrivinger. Maskin og ventende
 * vare deles (første del med andel beholder raden), tillegg/utlegg flyttes hele med delens
 * underprosjekt, reise får delens underprosjekt. Synket vare blir på del 1.
 */

const deler = [
  { id: "rad1", ecoId: "eco-a", timer: 6 },
  { id: "rad2", ecoId: "eco-b", timer: 2 },
];
const koblet: LokalKoblet = {
  maskiner: [{ id: "m1", ecoId: "eco-a" }],
  varer: [
    { id: "v-vent", ecoId: "eco-a", synket: false },
    { id: "v-synk", ecoId: "eco-a", synket: true },
  ],
  tillegg: [{ id: "t1", ecoId: "eco-a" }],
  utlegg: [{ id: "u1", ecoId: "eco-a" }],
  reiser: [
    { id: "r-ut", ecoId: "eco-a" },
    { id: "r-hjem", ecoId: "eco-a" },
  ],
};
const delt = beregnDelOppFordeling(
  deler.map((d) => ({ projectId: "P1", timer: d.timer })),
  {
    maskiner: [{ id: "m1", timer: 8 }],
    varer: [
      { id: "v-vent", antall: 10 },
      { id: "v-synk", antall: 4 },
    ],
    tillegg: [{ id: "t1" }],
    utlegg: [{ id: "u1" }],
    reiser: [
      { id: "r-ut", retning: "ut", fraTid: "06:20" },
      { id: "r-hjem", retning: "retur", fraTid: "15:00" },
    ],
  },
  "P1",
  { tillegg: [{ id: "t1", del: 1 }] },
).fordeling;

describe("planleggDelOppLokalt", () => {
  const plan = planleggDelOppLokalt(deler, koblet, delt);

  it("maskin: del 1 beholder raden med sin andel, del 2 får en kopi med sitt underprosjekt", () => {
    expect(plan.maskinOppdater).toEqual([{ id: "m1", sheetTimerId: "rad1", timer: 6, ecoId: "eco-a" }]);
    expect(plan.maskinNye).toEqual([{ kildeId: "m1", sheetTimerId: "rad2", timer: 2, ecoId: "eco-b" }]);
  });

  it("ventende vare deles; synket vare beholder id-en på del 1 og rettes på nett", () => {
    expect(plan.vareOppdater).toEqual([
      { id: "v-vent", sheetTimerId: "rad1", antall: 7.5, ecoId: "eco-a", nett: false },
      { id: "v-synk", sheetTimerId: "rad1", antall: 3, ecoId: "eco-a", nett: true },
    ]);
    expect(plan.vareNye).toEqual([
      { kildeId: "v-vent", sheetTimerId: "rad2", antall: 2.5, ecoId: "eco-b" },
      { kildeId: "v-synk", sheetTimerId: "rad2", antall: 1, ecoId: "eco-b" },
    ]);
  });

  it("tillegg følger valgt del med delens underprosjekt; utlegg går til delen med flest timer", () => {
    expect(plan.tillegg).toEqual([{ id: "t1", sheetTimerId: "rad2", ecoId: "eco-b" }]);
    expect(plan.utlegg).toEqual([{ id: "u1", sheetTimerId: "rad1", ecoId: "eco-a" }]);
  });

  it("reise hjem får siste dels underprosjekt; reise ut er uendret og skrives ikke", () => {
    expect(plan.reiser).toEqual([{ id: "r-hjem", ecoId: "eco-b" }]);
  });

  it("andel 0 på del 1: del 2 beholder raden (ingen tom rad igjen)", () => {
    const p = planleggDelOppLokalt(deler, { ...koblet, varer: [] }, { ...delt, maskiner: [{ id: "m1", timer: [0, 8] }] });
    expect(p.maskinOppdater).toEqual([{ id: "m1", sheetTimerId: "rad2", timer: 8, ecoId: "eco-b" }]);
    expect(p.maskinNye).toEqual([]);
  });
});

describe("synket vare er låst til del 1", () => {
  it("også når del 1 har andel 0 beholder del 1 id-en (vakten «del1» stopper lagringen)", () => {
    const f = { ...delt, varer: [{ id: "v-synk", antall: [0, 4] }] };
    const p = planleggDelOppLokalt(deler, { ...koblet, varer: [koblet.varer[1]!] }, f);
    expect(p.vareOppdater).toEqual([{ id: "v-synk", sheetTimerId: "rad1", antall: 0, ecoId: "eco-a", nett: true }]);
    expect(p.vareNye).toEqual([{ kildeId: "v-synk", sheetTimerId: "rad2", antall: 4, ecoId: "eco-b" }]);
  });
});

describe("synketVareFeil", () => {
  it("uten nett: synket vare flyttet til del 2 avvises", () => {
    expect(synketVareFeil(koblet, delt, false)).toEqual([{ id: "v-synk", type: "offline" }]);
  });
  it("på nett: tillatt så lenge del 1 beholder noe", () => {
    expect(synketVareFeil(koblet, delt, true)).toEqual([]);
    const tom = { ...delt, varer: delt.varer.map((v) => (v.id === "v-synk" ? { id: v.id, antall: [0, 4] } : v)) };
    expect(synketVareFeil(koblet, tom, true)).toEqual([{ id: "v-synk", type: "del1" }]);
  });
  it("ventende vare har ingen slik grense", () => {
    const tom = { ...delt, varer: delt.varer.map((v) => (v.id === "v-vent" ? { id: v.id, antall: [0, 10] } : v)) };
    expect(synketVareFeil({ ...koblet, varer: [koblet.varer[0]!] }, tom, false)).toEqual([]);
  });
});
