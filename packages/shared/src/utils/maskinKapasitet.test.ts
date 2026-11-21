import { describe, it, expect } from "vitest";
import {
  beregnJobbMaskinBrudd,
  nyeEllerOkteBrudd,
  maskinHoyst,
  maskinHoystPerRad,
  overMaskinHoyst,
  doegnOverArbeid,
  jobbArbeidSum,
  maskinForslagFraJobb,
  type JobbArbeidRad,
  type JobbMaskinRad,
} from "./maskinKapasitet";

/**
 * w9 (plan § 4.4, B21 A / B23 B): maskintimer høyst jobbens arbeidstimer.
 * Kenneths eksempel: arbeid 4,5 t, maskin 7,5 t → ikke lov.
 */

const P = "p1";
const arbeid = (kortId: string | null, timer: number, extra: Partial<JobbArbeidRad> = {}): JobbArbeidRad => ({
  kortId,
  projectId: P,
  externalCostObjectId: null,
  timer,
  ...extra,
});
const maskin = (
  kortId: string | null,
  timer: number,
  utleieEnhet: string | null = "time",
  extra: Partial<JobbMaskinRad> = {},
): JobbMaskinRad => ({ kortId, projectId: P, externalCostObjectId: null, timer, utleieEnhet, ...extra });

describe("beregnJobbMaskinBrudd — pr. jobb", () => {
  it("Kenneths eksempel: 4,5 t arbeid, 7,5 t maskin → brudd", () => {
    const b = beregnJobbMaskinBrudd([arbeid("A", 4.5)], [maskin("A", 7.5)]);
    expect(b).toEqual([
      expect.objectContaining({ nokkel: "kort:A", maskinSum: 7.5, arbeidSum: 4.5 }),
    ]);
  });

  it("maskin lik arbeidet er lov", () => {
    expect(beregnJobbMaskinBrudd([arbeid("A", 4.5)], [maskin("A", 4.5)])).toEqual([]);
  });

  it("pausen regnes ikke med for jobber", () => {
    // 4,5 + 30 min = 5,0 var lov i bøtteregelen; nå er det brudd.
    expect(beregnJobbMaskinBrudd([arbeid("A", 4.5)], [maskin("A", 5)], 30)).toHaveLength(1);
  });

  it("to førermaskiner summeres", () => {
    expect(beregnJobbMaskinBrudd([arbeid("A", 4)], [maskin("A", 2), maskin("A", 2.5)])).toHaveLength(1);
    expect(beregnJobbMaskinBrudd([arbeid("A", 4)], [maskin("A", 2), maskin("A", 2)])).toEqual([]);
  });

  it("to jobber i samme bøtte deler ikke tak", () => {
    const b = beregnJobbMaskinBrudd([arbeid("A", 2), arbeid("B", 6)], [maskin("A", 4)]);
    expect(b.map((x) => x.nokkel)).toEqual(["kort:A"]);
  });

  it("reise og erstattede rader teller ikke som arbeid", () => {
    const t = [
      arbeid("A", 2),
      arbeid("A", 3, { erReise: true }),
      arbeid("A", 3, { attestertStatus: "erstattet" }),
    ];
    expect(beregnJobbMaskinBrudd(t, [maskin("A", 2.5)])).toHaveLength(1);
  });

  it("døgn-maskin telles aldri; maskin uten enhet krever fører", () => {
    expect(beregnJobbMaskinBrudd([arbeid("A", 1)], [maskin("A", 24, "doegn")])).toEqual([]);
    expect(beregnJobbMaskinBrudd([arbeid("A", 1)], [maskin("A", 2, null)])).toHaveLength(1);
  });

  it("eldre rader uten jobb: bøtteregelen med pausen", () => {
    expect(beregnJobbMaskinBrudd([arbeid(null, 4.5)], [maskin(null, 5)], 30)).toEqual([]);
    const b = beregnJobbMaskinBrudd([arbeid(null, 4.5)], [maskin(null, 7.5)], 30);
    expect(b).toEqual([expect.objectContaining({ nokkel: "boette:p1|", arbeidSum: 5 })]);
  });

  it("eldre rader uten jobb: døgn-maskiner er tatt ut", () => {
    expect(beregnJobbMaskinBrudd([arbeid(null, 1)], [maskin(null, 24, "doegn")])).toEqual([]);
  });
});

describe("nyeEllerOkteBrudd", () => {
  const foer = beregnJobbMaskinBrudd([arbeid("A", 4.5)], [maskin("A", 7.5)]);

  it("gammelt brudd som står uendret, gis ikke tilbake", () => {
    expect(nyeEllerOkteBrudd(foer, foer)).toEqual([]);
  });

  it("økt overskudd gis tilbake", () => {
    const etter = beregnJobbMaskinBrudd([arbeid("A", 4)], [maskin("A", 7.5)]);
    expect(nyeEllerOkteBrudd(foer, etter)).toHaveLength(1);
  });

  it("senket overskudd (men fortsatt brudd) går gjennom", () => {
    const etter = beregnJobbMaskinBrudd([arbeid("A", 4.5)], [maskin("A", 6)]);
    expect(nyeEllerOkteBrudd(foer, etter)).toEqual([]);
  });

  it("nytt brudd i en annen jobb gis tilbake; den gamle står", () => {
    const etter = beregnJobbMaskinBrudd(
      [arbeid("A", 4.5), arbeid("B", 1)],
      [maskin("A", 7.5), maskin("B", 2)],
    );
    expect(nyeEllerOkteBrudd(foer, etter).map((b) => b.nokkel)).toEqual(["kort:B"]);
  });
});

describe("maskinHoyst", () => {
  it("arbeid minus de andre førermaskinene", () => {
    expect(maskinHoyst({ arbeidSum: 4.5, andreForerMaskiner: 1.5, utleieEnhet: "time" })).toBe(3);
  });
  it("aldri under 0", () => {
    expect(maskinHoyst({ arbeidSum: 2, andreForerMaskiner: 3, utleieEnhet: null })).toBe(0);
  });
  it("døgn-maskin: ingen grense", () => {
    expect(maskinHoyst({ arbeidSum: 2, andreForerMaskiner: 0, utleieEnhet: "doegn" })).toBeNull();
  });
  it("overMaskinHoyst", () => {
    expect(overMaskinHoyst(4.5, 4.5)).toBe(false);
    expect(overMaskinHoyst(4.51, 4.5)).toBe(true);
    expect(overMaskinHoyst(99, null)).toBe(false);
  });
});

describe("doegnOverArbeid — varsel pr. maskin (S2)", () => {
  it("én døgn-maskin over arbeidet gir varsel", () => {
    const v = doegnOverArbeid([arbeid("A", 4.5)], [maskin("A", 7.5, "doegn", { id: "m1" })]);
    expect(v).toEqual([expect.objectContaining({ maskinId: "m1", maskinTimer: 7.5, arbeidSum: 4.5 })]);
  });
  it("to døgn-maskiner hver under arbeidet gir ikke varsel (summen telles ikke)", () => {
    const v = doegnOverArbeid([arbeid("A", 8)], [maskin("A", 8, "doegn"), maskin("A", 8, "doegn")]);
    expect(v).toEqual([]);
  });
  it("førermaskiner gir aldri varsel her", () => {
    expect(doegnOverArbeid([arbeid("A", 1)], [maskin("A", 8)])).toEqual([]);
  });
});

describe("jobbArbeidSum", () => {
  it("kort: bare radene med samme kort", () => {
    expect(
      jobbArbeidSum([arbeid("A", 2), arbeid("B", 3)], { kortId: "A", projectId: P, externalCostObjectId: null }),
    ).toBe(2);
  });
});

describe("maskinHoystPerRad (w9 2c)", () => {
  const t = (kortId: string | null, timer: number, erReise = false): JobbArbeidRad => ({
    kortId, projectId: "p", externalCostObjectId: null, timer, erReise,
  });
  const m = (kortId: string | null, timer: number, utleieEnhet: string | null = "time"): JobbMaskinRad => ({
    kortId, projectId: "p", externalCostObjectId: null, timer, utleieEnhet,
  });
  it("Ola: arbeid 4,5 → høyst 4,5 for eneste førermaskin", () => {
    expect(maskinHoystPerRad([t("k1", 4.5)], [m("k1", 7.5)])).toEqual([4.5]);
  });
  it("trekker fra de andre førermaskinene på samme jobb, ikke døgn eller annen jobb", () => {
    expect(
      maskinHoystPerRad([t("k1", 6), t("k2", 3)], [m("k1", 2), m("k1", 1), m("k1", 9, "doegn"), m("k2", 1)]),
    ).toEqual([5, 4, null, 3]);
  });
  it("aldri under 0; reise teller ikke", () => {
    expect(maskinHoystPerRad([t("k1", 1), t("k1", 5, true)], [m("k1", 1), m("k1", 3)])).toEqual([0, 0]);
  });
  it("rad uten jobb: bøtta med pause", () => {
    expect(maskinHoystPerRad([t(null, 4)], [m(null, 1)], 30)).toEqual([4.5]);
  });
});

describe("O5 — maskinForslagFraJobb (§ 8.22, «+ Maskin» trekker fra ført maskintid)", () => {
  const jobb = { kortId: "k1", projectId: P, externalCostObjectId: null };
  const m = (timer: number, utleieEnhet: string | null, kortId: string | null = "k1"): JobbMaskinRad => ({
    kortId,
    projectId: P,
    externalCostObjectId: null,
    timer,
    utleieEnhet,
  });

  it("ingen maskin ført: forslaget er jobbens arbeid", () => {
    expect(maskinForslagFraJobb([arbeid("k1", 6)], [], jobb)).toBe(6);
  });

  it("Kenneths eksempel: jobb 6 t, Volvo 3 t → maskin nr. 2 får 3 t", () => {
    expect(maskinForslagFraJobb([arbeid("k1", 6)], [m(3, null)], jobb)).toBe(3);
  });

  it("to maskiner ført, også døgn-maskin, trekkes fra; andre jobber teller ikke", () => {
    const maskiner = [m(3, null), m(1.5, "doegn"), m(4, null, "k2")];
    expect(maskinForslagFraJobb([arbeid("k1", 6), arbeid("k2", 4)], maskiner, jobb)).toBe(1.5);
  });

  it("aldri under 0", () => {
    expect(maskinForslagFraJobb([arbeid("k1", 6)], [m(4, null), m(5, "doegn")], jobb)).toBe(0);
  });

  it("desimaler rundes til 2 (7,5 − 2,3 = 5,2)", () => {
    expect(maskinForslagFraJobb([arbeid("k1", 7.5)], [m(2.3, null)], jobb)).toBe(5.2);
  });
});
