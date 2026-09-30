import { describe, it, expect } from "vitest";
import {
  beregnOvertidsgrunnlag,
  lesOvertidsgrunnlagFraSnapshot,
  beregnUkeAvvik,
  avvikRetning,
  type OvertidRad,
  type UkeSedelInput,
} from "./overtidsgrunnlag";

describe("beregnOvertidsgrunnlag", () => {
  it("under norm, alt ordinært → ingen overtid, intet avvik", () => {
    const rader: OvertidRad[] = [{ timer: 6, overtidsnivaa: null }];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.totaltimer).toBe(6);
    expect(g.sumOvertid).toBe(0);
    expect(g.beregnetOvertid).toBe(0);
    expect(g.avvik).toBe(false);
  });

  it("over norm, korrekt tagget overtid → intet avvik", () => {
    // 7,5 normal + 1,5 overtid = 9 t; norm 7,5 → beregnet 1,5 = valgt 1,5
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null },
      { timer: 1.5, overtidsnivaa: 50 },
    ];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.totaltimer).toBe(9);
    expect(g.sumOrdinaert).toBe(7.5);
    expect(g.sumOvertid).toBe(1.5);
    expect(g.beregnetOvertid).toBe(1.5);
    expect(g.avvik).toBe(false);
  });

  it("over norm men alt ført ordinært → beregnet > valgt → AVVIK", () => {
    // 9 t alt ordinært, norm 7,5 → beregnet overtid 1,5, valgt 0
    const rader: OvertidRad[] = [{ timer: 9, overtidsnivaa: null }];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.beregnetOvertid).toBe(1.5);
    expect(g.sumOvertid).toBe(0);
    expect(g.avvik).toBe(true);
  });

  it("overtid ført under norm → valgt > beregnet → AVVIK", () => {
    // 5 t totalt, 2 av dem tagget overtid, norm 7,5 → beregnet 0, valgt 2
    const rader: OvertidRad[] = [
      { timer: 3, overtidsnivaa: null },
      { timer: 2, overtidsnivaa: 50 },
    ];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.beregnetOvertid).toBe(0);
    expect(g.sumOvertid).toBe(2);
    expect(g.avvik).toBe(true);
  });

  it("muterer ALDRI input (lonnsart-data urørt — backstop-invariant)", () => {
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null },
      { timer: 2, overtidsnivaa: 50 },
    ];
    const kopi = JSON.parse(JSON.stringify(rader));
    beregnOvertidsgrunnlag(rader, 7.5);
    expect(rader).toEqual(kopi);
  });

  it("norm 0 → hele arbeidstiden regnes normaltid (ingen beregnet overtid)", () => {
    const rader: OvertidRad[] = [{ timer: 8, overtidsnivaa: null }];
    const g = beregnOvertidsgrunnlag(rader, 0);
    expect(g.beregnetOvertid).toBe(0);
  });
});

describe("lesOvertidsgrunnlagFraSnapshot (gamle snapshot-former)", () => {
  it("gammel snapshot uten overtidsgrunnlag → null (ikke 0)", () => {
    const gammel = {
      lonnsartId: "abc",
      kode: "100",
      navn: "Ordinær",
      attestertVed: "2026-07-01T10:00:00.000Z",
    };
    expect(lesOvertidsgrunnlagFraSnapshot(gammel)).toBeNull();
  });

  it("null / undefined / primitiv → null", () => {
    expect(lesOvertidsgrunnlagFraSnapshot(null)).toBeNull();
    expect(lesOvertidsgrunnlagFraSnapshot(undefined)).toBeNull();
    expect(lesOvertidsgrunnlagFraSnapshot(42)).toBeNull();
    expect(lesOvertidsgrunnlagFraSnapshot("x")).toBeNull();
  });

  it("delvis/ødelagt overtidsgrunnlag (mangler felt) → null", () => {
    const halv = { overtidsgrunnlag: { norm: 37.5, sumOvertid: 2 } };
    expect(lesOvertidsgrunnlagFraSnapshot(halv)).toBeNull();
  });

  it("gyldig nytt snapshot → parses korrekt", () => {
    const nytt = {
      lonnsartId: "abc",
      overtidsgrunnlag: {
        norm: 37.5,
        totaltimer: 40,
        sumOrdinaert: 38,
        sumOvertid: 2,
        beregnetOvertid: 2.5,
        avvik: true,
      },
    };
    expect(lesOvertidsgrunnlagFraSnapshot(nytt)).toEqual({
      norm: 37.5,
      totaltimer: 40,
      sumOrdinaert: 38,
      sumOvertid: 2,
      beregnetOvertid: 2.5,
      avvik: true,
    });
  });

  it("avvik mangler i snapshot → false (ikke krasj)", () => {
    const utenAvvik = {
      overtidsgrunnlag: {
        norm: 37.5,
        totaltimer: 37.5,
        sumOrdinaert: 37.5,
        sumOvertid: 0,
        beregnetOvertid: 0,
      },
    };
    expect(lesOvertidsgrunnlagFraSnapshot(utenAvvik)?.avvik).toBe(false);
  });
});

// ============================================================================
//  Attestantvarsel — beregnUkeAvvik + avvikRetning (ORDRE 2 STEG 3 ledd 2).
//  De seks gate-tilfellene fra ordren. Dekker også den bygde AnsattPivot-badgen
//  retroaktivt (b8a82f3b landet utestet). Norm gis ALLTID som parameter — ingen
//  37,5/40 er hardkodet i logikken; literalene under er testinput (firmaets norm).
// ============================================================================

/** Bygg et sett per-sedel-input med felles ukenorm. */
function uke(
  norm: number,
  rader: Array<{ totaltimer: number; sumOvertid?: number }>,
): UkeSedelInput[] {
  return rader.map((r) => ({
    totaltimer: r.totaltimer,
    ukenorm: norm,
    sumOvertid: r.sumOvertid ?? 0,
  }));
}

describe("beregnUkeAvvik — de seks gate-tilfellene (D2)", () => {
  // Tilfelle 1 (a): uke med overtidsrader og ukesum ≥ norm, men under-ført
  // overtid → varsel «over». (Korrekt ført overtid gir intet avvik — se egen test.)
  it("1: overtidsrader + ukesum ≥ norm, under-ført → varsel (over)", () => {
    const a = beregnUkeAvvik(
      uke(37.5, [
        { totaltimer: 40, sumOvertid: 2 },
        { totaltimer: 2, sumOvertid: 0 },
      ]),
    );
    expect(a.ukesum).toBe(42);
    expect(a.beregnetOvertid).toBe(4.5);
    expect(a.sumOvertid).toBe(2);
    expect(a.avvikTimer).toBe(2.5);
    expect(avvikRetning(a)).toBe("over");
  });

  // Tilfelle 2 (b): ukesum > norm og NULL overtidsrader → varsel «over».
  // 🔴 Motsatt feil — halve poenget med D2. (Vist rødt først.)
  it("2: ukesum > norm, ingen overtid ført → varsel (over)", () => {
    const a = beregnUkeAvvik(uke(37.5, [{ totaltimer: 42, sumOvertid: 0 }]));
    expect(a.beregnetOvertid).toBe(4.5);
    expect(a.sumOvertid).toBe(0);
    expect(avvikRetning(a)).toBe("over");
  });

  // Tilfelle 3: uke under norm uten overtid → INGEN varsel. Falsk-positiv-vakt.
  it("3: under norm, ingen overtid → ingen varsel", () => {
    const a = beregnUkeAvvik(uke(37.5, [{ totaltimer: 30, sumOvertid: 0 }]));
    expect(a.beregnetOvertid).toBe(0);
    expect(a.avvikTimer).toBe(0);
    expect(avvikRetning(a)).toBeNull();
  });

  // Korrekt ført overtid → intet avvik (fabels semantikk: ikke «over norm»).
  it("korrekt ført overtid over norm → ingen varsel", () => {
    const a = beregnUkeAvvik(
      uke(37.5, [
        { totaltimer: 37.5, sumOvertid: 0 },
        { totaltimer: 2.5, sumOvertid: 2.5 },
      ]),
    );
    expect(a.beregnetOvertid).toBe(2.5);
    expect(a.sumOvertid).toBe(2.5);
    expect(avvikRetning(a)).toBeNull();
  });

  // Tilfelle 4: halv-attestert uke. Avviket MÅ regnes på hele ukens grunnlag —
  // et delsett (bare én fane/dag) gir falsk «ført under norm».
  it("4: hele uken → intet avvik; delsett alene → falsk «under»", () => {
    const heleUken = uke(37.5, [
      { totaltimer: 30, sumOvertid: 0 },
      { totaltimer: 10, sumOvertid: 2.5 },
    ]);
    expect(avvikRetning(beregnUkeAvvik(heleUken))).toBeNull(); // 40 t, beregnet 2.5 = ført 2.5
    // Bare dagen med overtid, isolert (feilen den gamle koden gjorde):
    const bareOvertidsdagen = uke(37.5, [{ totaltimer: 10, sumOvertid: 2.5 }]);
    expect(avvikRetning(beregnUkeAvvik(bareOvertidsdagen))).toBe("under");
  });

  // Tilfelle 5: konfigurerbar ukenorm — samme ukesum, ulik norm, ulikt svar.
  it("5: ukenorm er parameter — 40 t ukesum mot 37,5 / 40 / 30", () => {
    const rader = [{ totaltimer: 40, sumOvertid: 0 }];
    expect(beregnUkeAvvik(uke(37.5, rader)).beregnetOvertid).toBe(2.5);
    expect(beregnUkeAvvik(uke(40, rader)).beregnetOvertid).toBe(0);
    expect(beregnUkeAvvik(uke(30, rader)).beregnetOvertid).toBe(10);
    expect(avvikRetning(beregnUkeAvvik(uke(40, rader)))).toBeNull();
    expect(avvikRetning(beregnUkeAvvik(uke(30, rader)))).toBe("over");
  });

  // Tilfelle 6: attestert sedel → tallene kommer fra snapshot, ikke live.
  // avvikRetning leser snapshot-grunnlaget direkte (server velger kilde).
  it("6: attestert → avvikRetning speiler frosset snapshot-grunnlag", () => {
    const frosset = lesOvertidsgrunnlagFraSnapshot({
      overtidsgrunnlag: {
        norm: 37.5,
        totaltimer: 42,
        sumOrdinaert: 42,
        sumOvertid: 0,
        beregnetOvertid: 4.5,
        avvik: true,
      },
    });
    expect(frosset).not.toBeNull();
    expect(avvikRetning(frosset!)).toBe("over");
  });

  it("konsistent med beregnOvertidsgrunnlag for en én-dags uke", () => {
    // Samme kjerne (klassifiserArbeidstid) → samme beregnetOvertid.
    const g = beregnOvertidsgrunnlag(
      [{ timer: 42, overtidsnivaa: null }],
      37.5,
    );
    const a = beregnUkeAvvik(uke(37.5, [{ totaltimer: 42, sumOvertid: 0 }]));
    expect(a.beregnetOvertid).toBe(g.beregnetOvertid);
  });

  it("tom uke → norm 0, intet varsel", () => {
    const a = beregnUkeAvvik([]);
    expect(a.norm).toBe(0);
    expect(avvikRetning(a)).toBeNull();
  });
});

describe("avvikRetning", () => {
  it("norm ≤ 0 → null (ukjent norm gir aldri varsel)", () => {
    expect(avvikRetning({ norm: 0, beregnetOvertid: 5, sumOvertid: 0 })).toBeNull();
  });
  it("innenfor 0,01 t → null (avrundingsstøy varsler ikke)", () => {
    expect(
      avvikRetning({ norm: 37.5, beregnetOvertid: 2.005, sumOvertid: 2 }),
    ).toBeNull();
  });
  it("beregnet > ført → over; ført > beregnet → under", () => {
    expect(avvikRetning({ norm: 37.5, beregnetOvertid: 4, sumOvertid: 1 })).toBe("over");
    expect(avvikRetning({ norm: 37.5, beregnetOvertid: 0, sumOvertid: 3 })).toBe("under");
  });
});
