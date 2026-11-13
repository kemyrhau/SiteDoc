import { describe, it, expect } from "vitest";
import {
  tilFraAntall,
  effektiveTimerFraSpenn,
  pauseVinduForDag,
  utledArbeidstidFraRader,
  pauseFraForRad,
  avgjorRadPause,
  fastPauseFraFor,
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

/**
 * ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer» — Kenneth: «Morgen
 * 07:00–10:00 og kveld 16:00–19:00 gir 0 pause og 3,0 t. -> dette kan ikke være
 * rett -> dette er totalt 6 timer arbeid -> her er det krav om 0,5 timer pause»
 * · «Ja, etter 4 arbeidstimer».
 */
describe("ORDRE 2026-11-13 — pause etter arbeidstimer (avgjorRadPause/pauseFraForRad)", () => {
  const avgjor = (
    andre: Array<[string, string, number]>,
    fra: string,
    til: string,
    pauseEtterTimer = 4,
    fastPauseFra: string | null = null,
  ) =>
    avgjorRadPause({
      alleRader: andre.map(([f, t, pm], i) => ({ id: `r${i}`, fraTid: f, tilTid: t, pauseMin: pm })),
      radId: null,
      fraTid: fra,
      tilTid: til,
      standardPauseMin: 30,
      pauseEtterTimer,
      fastPauseFra,
    });

  it("🔴 07–10 + 16–19 → kveld pause 30 fra 17:00 (gapet er ingen pause)", () => {
    expect(avgjor([["07:00", "10:00", 0]], "16:00", "19:00")).toEqual({
      pauseMin: 30,
      pauseFra: "17:00",
    });
  });

  it("🔴 07–15 p30 + 16:45–22:45 → kveld pause 0 (én pause pr. dag)", () => {
    expect(avgjor([["07:00", "15:00", 30]], "16:45", "22:45").pauseMin).toBe(0);
  });

  it("🔴 07:00–13:10 alene → pause 30 kl. 11:00", () => {
    expect(avgjor([], "07:00", "13:10")).toEqual({ pauseMin: 30, pauseFra: "11:00" });
  });

  it("🔴 3 t + 2 t → pause 0", () => {
    expect(avgjor([["07:00", "10:00", 0]], "16:00", "18:00").pauseMin).toBe(0);
  });

  it("🔴 firmagrense 2 t → pausen i den nye morgenraden kl. 09:00 (ikke fast 4)", () => {
    expect(avgjor([], "07:00", "13:10", 2)).toEqual({ pauseMin: 30, pauseFra: "09:00" });
  });

  it("🔴 lagret morgen 5 t p0 + ny kveld 2 t → pausen på kvelden, fra radstart", () => {
    expect(avgjor([["07:00", "12:00", 0]], "16:00", "18:00")).toEqual({
      pauseMin: 30,
      pauseFra: "16:00",
    });
  });

  it("pausepunktet klemmes inn i raden (grensen faller etter til − pause)", () => {
    expect(
      pauseFraForRad({
        fraTid: "16:00",
        tilTid: "17:00",
        andreRader: [],
        pauseEtterTimer: 4,
        pauseMin: 30,
      }),
    ).toBe("16:30");
  });

  it("fastStart: fast klokkeslett inne i raden vinner, ellers arbeidstimene", () => {
    const fast = fastPauseFraFor({ startTid: "07:00", pauseEtterTimer: 4, pauseReferanse: "fastStart" });
    expect(fast).toBe("11:00");
    expect(fastPauseFraFor({ startTid: "07:00", pauseEtterTimer: 4, pauseReferanse: "ankomst" })).toBeNull();
    expect(avgjor([], "08:00", "15:00", 4, fast).pauseFra).toBe("11:00");
    expect(avgjor([["07:00", "10:00", 0]], "16:00", "19:00", 4, fast).pauseFra).toBe("17:00");
  });
});
