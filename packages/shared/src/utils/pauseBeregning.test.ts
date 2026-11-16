import { describe, it, expect, vi } from "vitest";
import {
  tilFraAntall,
  effektiveTimerFraSpenn,
  pauseVinduForDag,
  utledArbeidstidFraRader,
  pauseFraForRad,
  avgjorRadPause,
  fastPauseFraFor,
  dagPauseMinForNyttArbeid,
  dagManglerPause,
  forsokInnsending,
  svarPaaPauseSporsmaal,
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

  it("🔴 VILKÅR 1: lagret 07:00–12:15 p0 + ny manuell 13:00–13:20 → p0 og 0,33 t (raden er kortere enn pausen)", () => {
    const r = avgjor([["07:00", "12:15", 0]], "13:00", "13:20");
    expect(r.pauseMin).toBe(0);
    expect(effektiveTimerFraSpenn("13:00", "13:20", r.pauseFra, r.pauseMin)).toBeCloseTo(0.33, 2);
  });

  it("spennkravet: spenn = pausen → p0; spenn > pausen → p30", () => {
    expect(avgjor([["07:00", "12:15", 0]], "13:00", "13:30").pauseMin).toBe(0);
    expect(avgjor([["07:00", "12:15", 0]], "13:00", "13:31").pauseMin).toBe(30);
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

describe("ORDRE 2026-11-14 — reise teller mot 5,5-grensen, pausen bæres av arbeid", () => {
  it("nyReiseTimer teller mot terskelen: 5 t arbeid + 2 t reise → pause", () => {
    expect(
      dagPauseMinForNyttArbeid({ andreRader: [], nyBruttoTimer: 5, nyReiseTimer: 2, standardPauseMin: 30 }),
    ).toBe(30);
    expect(
      dagPauseMinForNyttArbeid({ andreRader: [], nyBruttoTimer: 5, standardPauseMin: 30 }),
    ).toBe(0);
  });

  it("4,5 t arbeid + 1 t reise = 5,5 t (ikke over) → ingen pause", () => {
    expect(
      dagPauseMinForNyttArbeid({ andreRader: [], nyBruttoTimer: 4.5, nyReiseTimer: 1, standardPauseMin: 30 }),
    ).toBe(0);
  });

  it("spennkravet gjelder arbeidet alene — reise gjør ikke en 20-min rad til bærer", () => {
    expect(
      dagPauseMinForNyttArbeid({ andreRader: [], nyBruttoTimer: 20 / 60, nyReiseTimer: 6, standardPauseMin: 30 }),
    ).toBe(0);
  });

  it("lagret reise-rad 06–07 + ny arbeidsrad 07–12 → pause på den nye, etter 4 ARBEIDStimer", () => {
    const res = avgjorRadPause({
      alleRader: [{ id: "r1", fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true }],
      radId: null,
      fraTid: "07:00",
      tilTid: "12:00",
      standardPauseMin: 30,
      pauseEtterTimer: 4,
    });
    // Reisen teller ikke i de 4 arbeidstimene: pausen ligger 11:00, ikke 10:00.
    expect(res).toEqual({ pauseMin: 30, pauseFra: "11:00" });
  });

  it("pauseFraForRad: lagret arbeid før raden teller, reise gjør det ikke", () => {
    const base = { fraTid: "08:00", tilTid: "14:00", pauseEtterTimer: 4, pauseMin: 30 };
    expect(pauseFraForRad({ ...base, andreRader: [{ fraTid: "07:00", tilTid: "08:00" }] })).toBe("11:00");
    expect(
      pauseFraForRad({ ...base, andreRader: [{ fraTid: "07:00", tilTid: "08:00", erReise: true }] }),
    ).toBe("12:00");
  });
});

// Innsendings-spørsmålet (Kenneth 2026-11-14: «still spørsmål, aksepter ved
// bekreftelse»). Brutto = arbeid + reise; spørsmål når > 5,5 t og ingen
// arbeidsrad bærer pausen.
describe("dagManglerPause — spørsmål ved innsending", () => {
  it("07–13 p0 → spørsmål", () => {
    expect(dagManglerPause([{ fraTid: "07:00", tilTid: "13:00", pauseMin: 0 }])).toBe(true);
  });
  it("07–13 p30 → ikke spørsmål", () => {
    expect(dagManglerPause([{ fraTid: "07:00", tilTid: "13:00", pauseMin: 30 }])).toBe(false);
  });
  it("07–12 p0 → ikke spørsmål (5 t)", () => {
    expect(dagManglerPause([{ fraTid: "07:00", tilTid: "12:00", pauseMin: 0 }])).toBe(false);
  });
  it("nøyaktig 5,5 t p0 → ikke spørsmål (grensen er «over»)", () => {
    expect(dagManglerPause([{ fraTid: "07:00", tilTid: "12:30", pauseMin: 0 }])).toBe(false);
  });
  it("1 t reise + 5 t arbeid p0 → spørsmål (reise teller)", () => {
    expect(
      dagManglerPause([
        { fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true },
        { fraTid: "07:00", tilTid: "12:00", pauseMin: 0, erReise: false },
      ]),
    ).toBe(true);
  });
  it("pause på en reise-rad teller ikke som bærer → spørsmål", () => {
    expect(
      dagManglerPause([
        { fraTid: "06:00", tilTid: "07:00", pauseMin: 30, erReise: true },
        { fraTid: "07:00", tilTid: "12:00", pauseMin: 0 },
      ]),
    ).toBe(true);
  });
  it("to arbeidsrader, pausen på den andre → ikke spørsmål", () => {
    expect(
      dagManglerPause([
        { fraTid: "07:00", tilTid: "10:00", pauseMin: 0 },
        { fraTid: "10:00", tilTid: "14:00", pauseMin: 30 },
      ]),
    ).toBe(false);
  });
  it("rader uten fra/til teller ikke i brutto", () => {
    expect(dagManglerPause([{ fraTid: null, tilTid: null, pauseMin: 0 }])).toBe(false);
  });
});

describe("forsokInnsending + svarPaaPauseSporsmaal — flyten", () => {
  const utenPause = [{ fraTid: "07:00", tilTid: "13:00", pauseMin: 0 }];
  const medPause = [{ fraTid: "07:00", tilTid: "13:00", pauseMin: 30 }];

  it("dag uten pause over 5,5 t → spørsmål, send kalles ikke", () => {
    const send = vi.fn();
    const spor = vi.fn();
    forsokInnsending(utenPause, { send, spor });
    expect(spor).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
  it("dag med pause → send direkte, ingen spørsmål", () => {
    const send = vi.fn();
    const spor = vi.fn();
    forsokInnsending(medPause, { send, spor });
    expect(send).toHaveBeenCalledTimes(1);
    expect(spor).not.toHaveBeenCalled();
  });
  it("bekreft → send kalles", () => {
    const send = vi.fn();
    svarPaaPauseSporsmaal("bekreft", send);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("avbryt → send kalles ikke", () => {
    const send = vi.fn();
    svarPaaPauseSporsmaal("avbryt", send);
    expect(send).not.toHaveBeenCalled();
  });
});
