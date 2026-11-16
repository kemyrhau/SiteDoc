import { describe, it, expect } from "vitest";
import { ukeAvvikRader, type UkeAvvikRadInput } from "./overtidsgrunnlag";

// T26 (kort-id-spec § 12.7, «Avvik pekes ut» i § 12.2).
let n = 0;
const rad = (over: Partial<UkeAvvikRadInput>): UkeAvvikRadInput => ({
  id: `r${++n}`,
  dato: "2026-11-16",
  fraTid: null,
  createdAt: null,
  timer: 7.5,
  overtidsnivaa: null,
  erReise: false,
  erFravaer: false,
  ...over,
});

describe("ukeAvvikRader", () => {
  it("«ført under norm» gir alle ukas overtidsrader og ingen andre", () => {
    const ord = rad({ timer: 7.5 });
    const ot1 = rad({ timer: 2, overtidsnivaa: 50, dato: "2026-11-17" });
    const ot2 = rad({ timer: 1, overtidsnivaa: 100, dato: "2026-11-18" });
    const reise = rad({ timer: 1, erReise: true, overtidsnivaa: 50 });
    const ids = ukeAvvikRader([ord, ot1, ot2, reise], { norm: 37.5, beregnetOvertid: 0, sumOvertid: 3 });
    expect(ids.sort()).toEqual([ot1.id, ot2.id].sort());
  });

  it("«over norm» gir de ordinære radene etter passert norm, i tidsrekkefølge", () => {
    const dager = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
    const uke = dager.map((d) => rad({ dato: d, timer: 7.5, fraTid: "07:00" }));
    const etter = rad({ dato: "2026-11-20", timer: 2, fraTid: "15:00" });
    const tidlig = rad({ dato: "2026-11-16", timer: 1, fraTid: "05:00" });
    // ukesum 37.5 + 2 + 1 = 40.5 → norm passert av fredagens 07:00-rad (36.0 → 43.5? nei: 38.5) og 15:00-raden.
    const ids = ukeAvvikRader([etter, ...uke, tidlig], { norm: 37.5, beregnetOvertid: 3, sumOvertid: 0 });
    expect(ids).toEqual([uke[4]!.id, etter.id]);
  });

  it("uten avvik: tom liste", () => {
    const ids = ukeAvvikRader([rad({ timer: 40 })], { norm: 37.5, beregnetOvertid: 2.5, sumOvertid: 2.5 });
    expect(ids).toEqual([]);
  });

  it("fravær følger F-F1: fyller bare dagens norm, merkes aldri", () => {
    // Mandag: 4 t arbeid + 7,5 t fravær → fravær teller 3,5 (fyller dagsnormen 7,5).
    const arbeid = rad({ dato: "2026-11-16", timer: 4, fraTid: "07:00" });
    const fravaer = rad({ dato: "2026-11-16", timer: 7.5, erFravaer: true, fraTid: "11:00" });
    const resten = ["2026-11-17", "2026-11-18", "2026-11-19"].map((d) => rad({ dato: d, timer: 7.5, fraTid: "07:00" }));
    const fredag = rad({ dato: "2026-11-20", timer: 9, fraTid: "07:00" });
    // ukesum = 7,5 + 22,5 + 9 = 39 → norm 37,5 passeres på fredag.
    const ids = ukeAvvikRader(
      [arbeid, fravaer, ...resten, fredag],
      { norm: 37.5, beregnetOvertid: 1.5, sumOvertid: 0 },
      () => 7.5,
    );
    expect(ids).toEqual([fredag.id]);
    expect(ids).not.toContain(fravaer.id);
  });
});
