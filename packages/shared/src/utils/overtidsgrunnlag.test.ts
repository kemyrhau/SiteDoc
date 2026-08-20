import { describe, it, expect } from "vitest";
import {
  beregnOvertidsgrunnlag,
  lesOvertidsgrunnlagFraSnapshot,
  type OvertidRad,
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
