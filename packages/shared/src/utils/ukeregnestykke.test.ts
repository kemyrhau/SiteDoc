import { describe, it, expect } from "vitest";
import {
  beregnUkeregnestykke,
  beregnUkeOvertidsgrunnlag,
  harUkevarsel,
  lesUkeregnestykkeFraSnapshot,
  lesFrossetUkeFraSnapshot,
  ukevarselRader,
  type OvertidRad,
  type UkeAvvikRadInput,
  type UkeregnestykkeDagInput,
} from "./overtidsgrunnlag";

// A4 (plan § 4.17 del B, B85 ja): ukeregnestykket. Én funksjon — serveren regner,
// skjermen viser det serveren sender.

const ord = (timer: number): OvertidRad => ({ timer, overtidsnivaa: null, erReise: false, erFravaer: false });
const ot = (timer: number): OvertidRad => ({ timer, overtidsnivaa: 50, erReise: false, erFravaer: false });
const fravaer = (timer: number): OvertidRad => ({ timer, overtidsnivaa: null, erReise: false, erFravaer: true });
const reise = (timer: number): OvertidRad => ({ timer, overtidsnivaa: null, erReise: true, erFravaer: false });

const UKE = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
const dag = (i: number, ...rader: OvertidRad[]): UkeregnestykkeDagInput => ({ dato: UKE[i]!, dagsnorm: i < 5 ? 7.5 : 0, rader });

/** Planens eksempeluke: man 7,5 · tir 7,5 + 2,5 OT · ons 7,5 egenmelding · tor 6,5 · fre 5. */
const eksempel = () => [dag(0, ord(7.5)), dag(1, ord(7.5), ot(2.5)), dag(2, fravaer(7.5)), dag(3, ord(6.5)), dag(4, ord(5))];

describe("beregnUkeregnestykke (B85)", () => {
  it("eksempeluka: 36,5 av 37,5, godtatt 1,5, 1,0 t av 2,5 t kan trekkes — bare tirsdag", () => {
    const r = beregnUkeregnestykke(eksempel(), 37.5);
    expect(r).toMatchObject({
      ukesum: 36.5, mangler: 1, overDagsnorm: 2.5, godtattOvertid: 1.5, sumOvertid: 2.5, kanTrekkes: 1, overIkkeFort: 0, fravaer: 7.5,
    });
    expect(r.dager.map((d) => d.kanTrekkes)).toEqual([0, 1, 0, 0, 0]);
    expect(harUkevarsel(r)).toBe(true);
  });

  it("uke på eller over norm med overtid: ingenting kan trekkes", () => {
    const r = beregnUkeregnestykke([...eksempel().slice(0, 3), dag(3, ord(7.5)), dag(4, ord(7.5))], 37.5);
    expect(r.mangler).toBe(0);
    expect(r.kanTrekkes).toBe(0);
  });

  it("etter at 1,0 t er gjort om til ordinær tid: «kan trekkes» borte, mangler 1,0 står", () => {
    const d = eksempel();
    d[1] = dag(1, ord(8.5), ot(1.5));
    const r = beregnUkeregnestykke(d, 37.5);
    expect(r).toMatchObject({ mangler: 1, kanTrekkes: 0, godtattOvertid: 1.5 });
    expect(harUkevarsel(r)).toBe(false);
  });

  it("mangler 1,0 med 2,0 over dagsnorm og 2,5 ført: 1,5 kan trekkes", () => {
    // man 9,5 (7,5 + 2,0 OT) · tir 7,5 + 0,5 OT (ført uten å gå over) · ons–fre 7,5/7,5/4,5
    const d = [dag(0, ord(7.5), ot(2)), dag(1, ord(7), ot(0.5)), dag(2, ord(7.5)), dag(3, ord(7.5)), dag(4, ord(4.5))];
    const r = beregnUkeregnestykke(d, 37.5);
    expect(r).toMatchObject({ ukesum: 36.5, mangler: 1, overDagsnorm: 2, godtattOvertid: 1, sumOvertid: 2.5, kanTrekkes: 1.5 });
    // Dagen viser aldri mer enn sin egen førte overtid.
    expect(r.dager.map((x) => x.kanTrekkes)).toEqual([1.5, 0.5, 0, 0, 0]);
  });

  it("reise teller ikke i ukesummen", () => {
    const d = eksempel();
    d[3] = dag(3, ord(6.5), reise(1));
    const r = beregnUkeregnestykke(d, 37.5);
    expect(r.ukesum).toBe(36.5);
    expect(r.reise).toBe(1);
    // Samme for uke-grunnlaget serveren fryser.
    const g = beregnUkeOvertidsgrunnlag(d, 37.5);
    expect(g.ukeTimer).toBe(36.5);
  });

  it("overtid ført lørdag: kan trekkes, og lørdagen bærer tallet", () => {
    const d = [dag(0, ord(7.5)), dag(1, ord(7.5)), dag(2, ord(7.5)), dag(3, ord(7.5)), dag(4, ord(5.5)), dag(5, ot(1.5))];
    const r = beregnUkeregnestykke(d, 37.5);
    expect(r).toMatchObject({ ukesum: 37, mangler: 0.5, kanTrekkes: 1.5 });
    expect(r.dager[5]).toMatchObject({ dato: "2026-11-21", kanTrekkes: 1.5 });
  });

  it("over ukenorm uten ført overtid: overIkkeFort", () => {
    const d = [0, 1, 2, 3, 4].map((i) => dag(i, ord(8)));
    const r = beregnUkeregnestykke(d, 37.5);
    expect(r).toMatchObject({ ukesum: 40, kanTrekkes: 0, overIkkeFort: 2.5 });
    expect(harUkevarsel(r)).toBe(true);
  });
});

describe("ukevarselRader", () => {
  let n = 0;
  const rad = (dato: string, timer: number, over: Partial<UkeAvvikRadInput> = {}): UkeAvvikRadInput => ({
    id: `r${++n}`, dato, fraTid: "07:00", createdAt: null, timer, overtidsnivaa: null, erReise: false, erFravaer: false, ...over,
  });

  it("kan trekkes: peker ut overtidslinja ført lørdag, aldri reise", () => {
    const rader = [rad(UKE[4]!, 5.5), rad(UKE[5]!, 1.5, { overtidsnivaa: 50 }), rad(UKE[5]!, 1, { erReise: true, overtidsnivaa: 50 })];
    expect(ukevarselRader(rader, { ukenorm: 37.5, kanTrekkes: 1.5, overIkkeFort: 0 })).toEqual([rader[1]!.id]);
  });

  it("uten ukevarsel: tom liste", () => {
    expect(ukevarselRader([rad(UKE[0]!, 7.5, { overtidsnivaa: 50 })], { ukenorm: 37.5, kanTrekkes: 0, overIkkeFort: 0 })).toEqual([]);
  });
});

describe("lesUkeregnestykkeFraSnapshot", () => {
  it("leser det frosne regnestykket, null for snapshots fra før A4", () => {
    const r = beregnUkeregnestykke(eksempel(), 37.5);
    expect(lesUkeregnestykkeFraSnapshot({ overtidsgrunnlag: { ukeregnestykke: r } })).toEqual(r);
    expect(lesUkeregnestykkeFraSnapshot({ overtidsgrunnlag: { ukeTimer: 36.5 } })).toBeNull();
    expect(lesUkeregnestykkeFraSnapshot(null)).toBeNull();
  });
});

describe("lesFrossetUkeFraSnapshot (A4 RETUR vilkår 2)", () => {
  it("leser komplett og dagene som manglet; uten feltet regnes uka som ikke komplett", () => {
    const r = beregnUkeregnestykke(eksempel(), 37.5);
    expect(lesFrossetUkeFraSnapshot({ overtidsgrunnlag: { ukeregnestykke: r, ukeKomplett: true, ukeManglerDager: [] } }))
      .toEqual({ regnestykke: r, komplett: true, manglerDager: [] });
    expect(lesFrossetUkeFraSnapshot({ overtidsgrunnlag: { ukeregnestykke: r, ukeKomplett: false, ukeManglerDager: ["2026-11-19"] } }))
      .toMatchObject({ komplett: false, manglerDager: ["2026-11-19"] });
    expect(lesFrossetUkeFraSnapshot({ overtidsgrunnlag: { ukeregnestykke: r } })).toMatchObject({ komplett: false, manglerDager: [] });
    expect(lesFrossetUkeFraSnapshot({ overtidsgrunnlag: { ukeTimer: 36.5 } })).toBeNull();
  });
});

