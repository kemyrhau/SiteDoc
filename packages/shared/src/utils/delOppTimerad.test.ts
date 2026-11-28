import { describe, it, expect } from "vitest";
import { beregnDelOppFordeling, foreslaDelOppFordeling, fullforDelOppFordeling, validerDelOppFordeling, type DelOppKoblet } from "./delOppTimerad";

/** Kenneth 2026-11-28 «Ja, begge»: (a) forholdsmessig, tillegg/utlegg hele på delen med flest timer; (b) reise ut første, hjem siste. */
const P = "p1";
const deler = [
  { projectId: P, fraTid: "07:00", tilTid: "13:00", timer: 6 },
  { projectId: P, fraTid: "13:00", tilTid: "15:00", timer: 2 },
];
const koblet: DelOppKoblet = {
  maskiner: [{ id: "m", timer: 8 }],
  varer: [{ id: "v", antall: 10 }],
  tillegg: [{ id: "t" }],
  utlegg: [{ id: "u" }],
  reiser: [
    { id: "ut", retning: "ut", fraTid: "06:20" },
    { id: "hjem", retning: "retur", fraTid: "15:00" },
    { id: "uten-foer", retning: null, fraTid: "06:00" },
    { id: "uten-etter", retning: null, fraTid: "16:00" },
  ],
};

describe("foreslaDelOppFordeling — Kenneth 2026-11-28 «Ja, begge»", () => {
  it("(a) maskin og vare forholdsmessig etter delenes timer", () => {
    const f = foreslaDelOppFordeling(deler, koblet, P);
    expect(f.maskiner).toEqual([{ id: "m", timer: [6, 2] }]);
    expect(f.varer).toEqual([{ id: "v", antall: [7.5, 2.5] }]);
  });

  it("(a) avrunding: siste del tar resten, summen stemmer", () => {
    const tre = [
      { projectId: P, timer: 1 },
      { projectId: P, timer: 1 },
      { projectId: P, timer: 1 },
    ];
    const f = foreslaDelOppFordeling(tre, { ...koblet, maskiner: [{ id: "m", timer: 1 }] }, P);
    expect(f.maskiner[0]!.timer).toEqual([0.33, 0.33, 0.34]);
  });

  it("(a) tillegg og utlegg hele på delen med flest timer (første ved likhet)", () => {
    expect(foreslaDelOppFordeling(deler, koblet, P).tillegg).toEqual([{ id: "t", del: 0 }]);
    const like = [deler[0]!, { ...deler[1]!, timer: 6 }];
    expect(foreslaDelOppFordeling(like, koblet, P).utlegg).toEqual([{ id: "u", del: 0 }]);
    const andre = [{ ...deler[0]!, timer: 1 }, deler[1]!];
    expect(foreslaDelOppFordeling(andre, koblet, P).tillegg).toEqual([{ id: "t", del: 1 }]);
  });

  it("(b) reise ut → delen som starter først; hjem → delen som slutter sist; uten retning etter tid", () => {
    // Delene i omvendt rekkefølge i lista: regelen leser klokka, ikke plassen.
    const omvendt = [deler[1]!, deler[0]!];
    const f = foreslaDelOppFordeling(omvendt, koblet, P);
    expect(Object.fromEntries(f.reiser.map((r) => [r.id, r.del]))).toEqual({ ut: 1, hjem: 0, "uten-foer": 1, "uten-etter": 0 });
  });

  it("maskin og vare går ikke til en del i et annet prosjekt", () => {
    const blandet = [deler[0]!, { ...deler[1]!, projectId: "p2" }];
    const f = foreslaDelOppFordeling(blandet, koblet, P);
    expect(f.maskiner[0]!.timer).toEqual([8, 0]);
    expect(f.varer[0]!.antall).toEqual([10, 0]);
  });
});

describe("validerDelOppFordeling — summvakten", () => {
  it("forslaget er alltid gyldig", () => {
    expect(validerDelOppFordeling(deler, koblet, P, foreslaDelOppFordeling(deler, koblet, P))).toEqual([]);
  });

  it("feil sum på maskin og vare avvises", () => {
    const f = foreslaDelOppFordeling(deler, koblet, P);
    f.maskiner[0]!.timer = [6, 3];
    f.varer[0]!.antall = [5, 4];
    expect(validerDelOppFordeling(deler, koblet, P, f).map((e) => e.type)).toEqual(["maskinSum", "vareSum"]);
  });

  it("maskin til en del i annet prosjekt, negativt tall, ukjent del og ukjent rad avvises", () => {
    const blandet = [deler[0]!, { ...deler[1]!, projectId: "p2" }];
    const f = foreslaDelOppFordeling(blandet, koblet, P);
    f.maskiner[0]!.timer = [6, 2];
    f.varer[0]!.antall = [11, -1];
    f.tillegg[0]!.del = 2;
    f.utlegg.push({ id: "fremmed", del: 0 });
    expect(validerDelOppFordeling(blandet, koblet, P, f).map((e) => e.type)).toEqual([
      "maskinAnnetProsjekt",
      "negativ",
      "ukjentDel",
      "ukjentRad",
    ]);
  });

  it("manglende rad i fordelingen avvises", () => {
    const f = foreslaDelOppFordeling(deler, koblet, P);
    f.reiser = [];
    expect(validerDelOppFordeling(deler, koblet, P, f).filter((e) => e.type === "mangler")).toHaveLength(4);
  });
});

describe("fullforDelOppFordeling — eldre klient og nye rader", () => {
  it("uten sendt fordeling = forslaget", () => {
    expect(fullforDelOppFordeling(deler, koblet, P, undefined)).toEqual(foreslaDelOppFordeling(deler, koblet, P));
  });

  it("sendt verdi står, manglende rad fylles med forslaget", () => {
    const f = fullforDelOppFordeling(deler, koblet, P, { maskiner: [{ id: "m", timer: [4, 4] }], tillegg: [{ id: "t", del: 1 }] });
    expect(f.maskiner).toEqual([{ id: "m", timer: [4, 4] }]);
    expect(f.tillegg).toEqual([{ id: "t", del: 1 }]);
    expect(f.varer).toEqual([{ id: "v", antall: [7.5, 2.5] }]);
  });
});

describe("beregnDelOppFordeling (vinduet)", () => {
  const deler2 = [
    { projectId: "P1", fraTid: "07:00", tilTid: "13:00", timer: 6 },
    { projectId: "P1", fraTid: "13:00", tilTid: "15:00", timer: 2 },
  ];
  const k = { maskiner: [{ id: "m1", timer: 8 }], varer: [], tillegg: [{ id: "t1" }], utlegg: [], reiser: [] };

  it("valg som passer antallet deler står; summvakten slår til", () => {
    const r = beregnDelOppFordeling(deler2, k, "P1", { maskiner: [{ id: "m1", timer: [7, 2] }] });
    expect(r.fordeling.maskiner).toEqual([{ id: "m1", timer: [7, 2] }]);
    expect(r.feil).toEqual([{ type: "maskinSum", id: "m1", sum: 9, skal: 8 }]);
  });

  it("valg med feil antall deler eller ukjent del faller bort til forslaget", () => {
    const r = beregnDelOppFordeling(deler2, k, "P1", {
      maskiner: [{ id: "m1", timer: [4, 2, 2] }],
      tillegg: [{ id: "t1", del: 2 }],
    });
    expect(r.fordeling.maskiner).toEqual([{ id: "m1", timer: [6, 2] }]);
    expect(r.fordeling.tillegg).toEqual([{ id: "t1", del: 0 }]);
    expect(r.feil).toEqual([]);
  });
});
