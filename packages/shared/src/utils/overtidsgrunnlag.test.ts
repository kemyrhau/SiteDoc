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
    const rader: OvertidRad[] = [{ timer: 6, overtidsnivaa: null, erReise: false, erFravaer: false }];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.totaltimer).toBe(6);
    expect(g.sumOvertid).toBe(0);
    expect(g.beregnetOvertid).toBe(0);
    expect(g.avvik).toBe(false);
  });

  // LAG 2 / V1 (gate-kriterie 1b): reise er ALDRI overtid. Dag A på serveren:
  // 10 t arbeid (7,5 normal + 2,5 OT) + 4 t reise. Reise skal holdes HELT utenfor
  // overtidsgrunnlaget. 🔴 Rød først: før erReise-flagget summerte funksjonen alle
  // rader → reise ville skjøvet totalen og telt som arbeid i overtiden.
  it("🔴 V1: reise-rader holdes utenfor overtidsgrunnlaget (Dag A)", () => {
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null, erReise: false, erFravaer: false },
      { timer: 2.5, overtidsnivaa: 50, erReise: false, erFravaer: false },
      { timer: 4, overtidsnivaa: null, erReise: true, erFravaer: false }, // reise ut+retur
    ];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.arbeidstimer).toBe(10);
    expect(g.reisetimer).toBe(4);
    expect(g.totaltimer).toBe(14); // visning: alle timer
    expect(g.sumOvertid).toBe(2.5); // ført OT, reise ikke med
    expect(g.beregnetOvertid).toBe(2.5); // 10 arbeid − 7,5 norm
    expect(g.avvik).toBe(false);
  });

  it("🔴 V1: en reise-rad feil-tagget med overtidsnivaa teller likevel IKKE som overtid", () => {
    // Selv om en reise-rad skulle bære overtidsnivaa (umulig i praksis), skal V1
    // holde den ute av sumOvertid og arbeidstimer.
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null, erReise: false, erFravaer: false },
      { timer: 3, overtidsnivaa: 50, erReise: true, erFravaer: false },
    ];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.arbeidstimer).toBe(7.5);
    expect(g.reisetimer).toBe(3);
    expect(g.sumOvertid).toBe(0);
    expect(g.beregnetOvertid).toBe(0);
  });

  it("over norm, korrekt tagget overtid → intet avvik", () => {
    // 7,5 normal + 1,5 overtid = 9 t; norm 7,5 → beregnet 1,5 = valgt 1,5
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null, erReise: false, erFravaer: false },
      { timer: 1.5, overtidsnivaa: 50, erReise: false, erFravaer: false },
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
    const rader: OvertidRad[] = [{ timer: 9, overtidsnivaa: null, erReise: false, erFravaer: false }];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.beregnetOvertid).toBe(1.5);
    expect(g.sumOvertid).toBe(0);
    expect(g.avvik).toBe(true);
  });

  it("overtid ført under norm → valgt > beregnet → AVVIK", () => {
    // 5 t totalt, 2 av dem tagget overtid, norm 7,5 → beregnet 0, valgt 2
    const rader: OvertidRad[] = [
      { timer: 3, overtidsnivaa: null, erReise: false, erFravaer: false },
      { timer: 2, overtidsnivaa: 50, erReise: false, erFravaer: false },
    ];
    const g = beregnOvertidsgrunnlag(rader, 7.5);
    expect(g.beregnetOvertid).toBe(0);
    expect(g.sumOvertid).toBe(2);
    expect(g.avvik).toBe(true);
  });

  it("muterer ALDRI input (lonnsart-data urørt — backstop-invariant)", () => {
    const rader: OvertidRad[] = [
      { timer: 7.5, overtidsnivaa: null, erReise: false, erFravaer: false },
      { timer: 2, overtidsnivaa: 50, erReise: false, erFravaer: false },
    ];
    const kopi = JSON.parse(JSON.stringify(rader));
    beregnOvertidsgrunnlag(rader, 7.5);
    expect(rader).toEqual(kopi);
  });

  it("norm 0 → hele arbeidstiden regnes normaltid (ingen beregnet overtid)", () => {
    const rader: OvertidRad[] = [{ timer: 8, overtidsnivaa: null, erReise: false, erFravaer: false }];
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
      // LAG 2: snapshot uten arbeidstimer/reisetimer (pre-lag-2) → arbeidstimer =
      // totaltimer, reisetimer = 0 (ærlig gjengivelse av det som ble attestert).
      arbeidstimer: 40,
      reisetimer: 0,
      // F-F1: snapshot uten fravaerTimer/ukeTimer → 0 / totaltimer.
      fravaerTimer: 0,
      ukeTimer: 40,
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
      [{ timer: 42, overtidsnivaa: null, erReise: false, erFravaer: false }],
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

// ============================================================================
//  Kort-id-spec § 11.10.4 F-F1 (B10): fravær er ikke arbeid. TF8 (dag) + TF16 (uke).
// ============================================================================
import { beregnUkeOvertidsgrunnlag } from "./overtidsgrunnlag";

const arb = (timer: number, overtidsnivaa: number | null = null): OvertidRad => ({
  timer,
  overtidsnivaa,
  erReise: false,
  erFravaer: false,
});
const frav = (timer: number): OvertidRad => ({ timer, overtidsnivaa: null, erReise: false, erFravaer: true });

describe("TF8 F-F1 dag-nivå: fravær holdes utenfor arbeidet", () => {
  it("🔴 7,5 t fravær + 1,5 t arbeid gir ikke avvik (B9)", () => {
    const g = beregnOvertidsgrunnlag([frav(7.5), arb(1.5)], 7.5);
    expect(g.arbeidstimer).toBe(1.5);
    expect(g.fravaerTimer).toBe(7.5);
    expect(g.sumOrdinaert).toBe(1.5);
    expect(g.beregnetOvertid).toBe(0);
    expect(g.avvik).toBe(false);
    expect(g.totaltimer).toBe(9); // visning: alle timer
  });
  it("ukeTimer: fravær fyller dagens norm, aldri mer", () => {
    expect(beregnOvertidsgrunnlag([frav(7.5), arb(1.5)], 7.5).ukeTimer).toBe(7.5);
    expect(beregnOvertidsgrunnlag([frav(7.5)], 7.5).ukeTimer).toBe(7.5);
    expect(beregnOvertidsgrunnlag([arb(9.5, null)], 7.5).ukeTimer).toBe(9.5);
  });
  it("gammel snapshot uten fravaerTimer leses som 0 (det som ble attestert)", () => {
    const g = lesOvertidsgrunnlagFraSnapshot({
      overtidsgrunnlag: { norm: 7.5, totaltimer: 9, sumOrdinaert: 7.5, sumOvertid: 1.5, beregnetOvertid: 1.5 },
    });
    expect(g?.fravaerTimer).toBe(0);
  });
});

describe("TF16 F-F1 uke-nivå: fravær fyller dagens norm i ukesummen", () => {
  const normal = (n: number) => ({ dagsnorm: 7.5, rader: [arb(n)] });
  it("mandag 7,5 egenmelding + fire dager 9,5 med 2 t ført overtid → intet avvik (vakt mot å stryke fravær)", () => {
    const dagMedOt = { dagsnorm: 7.5, rader: [arb(7.5), arb(2, 50)] };
    const g = beregnUkeOvertidsgrunnlag(
      [{ dagsnorm: 7.5, rader: [frav(7.5)] }, dagMedOt, dagMedOt, dagMedOt, dagMedOt],
      37.5,
    );
    expect(g.sumOvertid).toBe(8);
    expect(g.beregnetOvertid).toBe(8);
    expect(g.avvik).toBe(false);
  });
  it("🔴 mandag 7,5 ubetalt + 1,5 arbeid, resten normal → intet avvik", () => {
    const g = beregnUkeOvertidsgrunnlag(
      [{ dagsnorm: 7.5, rader: [frav(7.5), arb(1.5)] }, normal(7.5), normal(7.5), normal(7.5), normal(7.5)],
      37.5,
    );
    expect(g.beregnetOvertid).toBe(0);
    expect(g.avvik).toBe(false);
  });
  it("beregnUkeAvvik bruker ukeTimer når den finnes (badgen)", () => {
    const a = beregnUkeAvvik([
      { totaltimer: 9, ukeTimer: 7.5, ukenorm: 37.5, sumOvertid: 0 },
      { totaltimer: 7.5, ukenorm: 37.5, sumOvertid: 0 },
      { totaltimer: 7.5, ukenorm: 37.5, sumOvertid: 0 },
      { totaltimer: 7.5, ukenorm: 37.5, sumOvertid: 0 },
      { totaltimer: 7.5, ukenorm: 37.5, sumOvertid: 0 },
    ]);
    expect(a.beregnetOvertid).toBe(0);
    expect(a.avvikTimer).toBe(0);
  });
});
