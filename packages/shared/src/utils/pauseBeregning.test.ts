import { describe, it, expect } from "vitest";
import {
  tilFraAntall,
  effektiveTimerFraSpenn,
  pauseVinduForDag,
  utledArbeidstidFraRader,
} from "./pauseBeregning";

// Grensefiks 2026-07-09: tilFraAntall hoppet tidligere over pausen når raden
// startet nøyaktig ved pausestart eller inne i pausevinduet (`fraMin >=
// pauseFraMin`). Da var den ikke lenger invers av effektiveTimerFraSpenn.
// Pausevindu i alle casene: 11:00–11:30 (pauseFra="11:00", pauseMin=30).
describe("tilFraAntall — grense ved pausevindu", () => {
  it("starter nøyaktig ved pausestart → hele pausen skyves inn (11:00 + 3t → 14:30)", () => {
    expect(tilFraAntall("11:00", 3, "11:00", 30)).toBe("14:30");
  });

  it("starter inne i vinduet → kun resterende pause teller (11:15 + 2t → 13:30)", () => {
    // 11:15–11:30 = 15 min resterende pause; ikke hele 30 min (de første 15 min
    // ligger før raden). Jf. effektive("11:15","13:30",…) = 2.00, ikke 13:45.
    expect(tilFraAntall("11:15", 2, "11:00", 30)).toBe("13:30");
  });

  it("rekker akkurat frem til lunsj → ingen pause (09:00 + 2t → 11:00)", () => {
    expect(tilFraAntall("09:00", 2, "11:00", 30)).toBe("11:00");
  });

  it("starter etter pauseslutt → ingen pause (12:00 + 2t → 14:00)", () => {
    expect(tilFraAntall("12:00", 2, "11:00", 30)).toBe("14:00");
  });
});

// Invers-egenskapen er selve kravet (ikke de faste verdiene over):
// effektiveTimerFraSpenn(fra, tilFraAntall(fra, n, p, m), p, m) === n.
describe("tilFraAntall ↔ effektiveTimerFraSpenn — invers", () => {
  const p = "11:00";
  const m = 30;
  const caser: Array<[string, number]> = [
    ["11:00", 3],
    ["11:15", 2],
    ["09:00", 2],
    ["12:00", 2],
  ];

  for (const [fra, n] of caser) {
    it(`effektive(${fra}, tilFraAntall(${fra}, ${n})) === ${n}`, () => {
      const til = tilFraAntall(fra, n, p, m);
      expect(effektiveTimerFraSpenn(fra, til, p, m)).toBe(n);
    });
  }
});

// V20/PK5 — pausevinduet følger pauseReferanse (spec-test 6: ankomst-firma skal
// IKKE bruke fastStart-vinduet, men regne fra første rad-fraTid).
describe("pauseVinduForDag — pauseReferanse", () => {
  const rader = [{ fraTid: "08:00" }, { fraTid: "12:30" }];

  it("fastStart → firmaets starttid + pauseEtterTimer (07:00 + 4t = 11:00)", () => {
    expect(
      pauseVinduForDag(rader, {
        startTid: "07:00",
        pauseEtterTimer: 4,
        pauseReferanse: "fastStart",
      }),
    ).toBe("11:00");
  });

  it("ankomst → første rad-fraTid + pauseEtterTimer (08:00 + 4t = 12:00), IKKE 11:00", () => {
    expect(
      pauseVinduForDag(rader, {
        startTid: "07:00",
        pauseEtterTimer: 4,
        pauseReferanse: "ankomst",
      }),
    ).toBe("12:00");
  });

  it("ankomst uten rader → faller tilbake til firmaets starttid", () => {
    expect(
      pauseVinduForDag([], {
        startTid: "07:00",
        pauseEtterTimer: 4,
        pauseReferanse: "ankomst",
      }),
    ).toBe("11:00");
  });

  it("ankomst velger TIDLIGSTE fraTid uansett rekkefølge", () => {
    expect(
      pauseVinduForDag([{ fraTid: "12:30" }, { fraTid: "06:30" }], {
        startTid: "07:00",
        pauseEtterTimer: 4,
        pauseReferanse: "ankomst",
      }),
    ).toBe("10:30");
  });
});

// V20/PK7 — «Arbeidstid i dag» utledet av radene.
describe("utledArbeidstidFraRader", () => {
  it("to rader → ramme fra tidligste fra til seneste til, Σ pause og Σ netto", () => {
    expect(
      utledArbeidstidFraRader([
        { fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5 },
        { fraTid: "15:00", tilTid: "16:00", pauseMin: 0, timer: 1 },
      ]),
    ).toEqual({
      startTid: "07:00",
      sluttTid: "16:00",
      sumPauseMin: 30,
      nettoTimer: 8.5,
    });
  });

  it("rad uten tider teller kun i nettoTimer (ingen tidsramme)", () => {
    expect(
      utledArbeidstidFraRader([{ fraTid: null, tilTid: null, timer: 2 }]),
    ).toEqual({
      startTid: null,
      sluttTid: null,
      sumPauseMin: 0,
      nettoTimer: 2,
    });
  });

  it("tom input → null-ramme, 0 timer", () => {
    expect(utledArbeidstidFraRader([])).toEqual({
      startTid: null,
      sluttTid: null,
      sumPauseMin: 0,
      nettoTimer: 0,
    });
  });
});
