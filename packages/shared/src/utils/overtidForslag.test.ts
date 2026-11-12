import { describe, it, expect } from "vitest";
import { foreslaOvertidSplitt, type OvertidForslagRad } from "./overtidForslag";

// V21 — overtidsforslag (spec timer-pause-en-kilde-spec.md § 8). Pausevindu i
// alle casene: 11:00–11:30 (pauseFra="11:00", pauseMin=30 på bæreren).
const PAUSE = { pauseFra: "11:00" };

const TIMELONN = {
  id: "timelonn",
  overtidsnivaa: null,
  aktiv: true,
  type: "ordinaer",
  rekkefolge: 1,
};
const OT50 = {
  id: "ot50",
  overtidsnivaa: 50,
  aktiv: true,
  type: "ordinaer",
  rekkefolge: 2,
};
const OT100 = {
  id: "ot100",
  overtidsnivaa: 100,
  aktiv: true,
  type: "ordinaer",
  rekkefolge: 3,
};
const LONNSARTER = [TIMELONN, OT50, OT100];

function rad(
  id: string,
  fraTid: string,
  tilTid: string,
  over: Partial<OvertidForslagRad> = {},
): OvertidForslagRad {
  return {
    id,
    fraTid,
    tilTid,
    pauseMin: 0,
    erReise: false,
    overtidsnivaa: null,
    ...over,
  };
}

describe("foreslaOvertidSplitt", () => {
  it("over norm → riktig splitt (tid + lønnsart); 07–16 m/ pause, norm 7,5 deler kl. 15:00", () => {
    const f = foreslaOvertidSplitt(
      [rad("a", "07:00", "16:00", { pauseMin: 30 })],
      7.5,
      LONNSARTER,
      PAUSE,
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.radId).toBe("a");
    expect(f[0]!.overtidLonnsart.id).toBe("ot50");
    expect(f[0]!.overtidsnivaa).toBe(50);
    expect(f[0]!.overTimer).toBe(1);
    expect(f[0]!.normal).toEqual({
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 7.5,
      pauseMin: 30,
    });
    expect(f[0]!.overtid).toEqual({
      fraTid: "15:00",
      tilTid: "16:00",
      timer: 1,
      pauseMin: 0,
    });
  });

  it("under norm → ingen linje", () => {
    expect(
      foreslaOvertidSplitt(
        [rad("a", "07:00", "14:00", { pauseMin: 30 })],
        7.5,
        LONNSARTER,
        PAUSE,
      ),
    ).toEqual([]);
  });

  it("lik norm → ingen linje", () => {
    expect(
      foreslaOvertidSplitt(
        [rad("a", "07:00", "15:00", { pauseMin: 30 })],
        7.5,
        LONNSARTER,
        PAUSE,
      ),
    ).toEqual([]);
  });

  it("uten overtid-lønnsart → ingen linje", () => {
    expect(
      foreslaOvertidSplitt(
        [rad("a", "07:00", "16:00", { pauseMin: 30 })],
        7.5,
        [TIMELONN, { ...OT50, aktiv: false }],
        PAUSE,
      ),
    ).toEqual([]);
  });

  it("uten dagsnorm → ingen linje", () => {
    expect(
      foreslaOvertidSplitt(
        [rad("a", "07:00", "16:00", { pauseMin: 30 })],
        null,
        LONNSARTER,
        PAUSE,
      ),
    ).toEqual([]);
  });

  it("reise er aldri overtid og teller ikke mot normen", () => {
    // 7,5 t arbeid (= norm) + 2 t reise etterpå → ingen forslag.
    const f = foreslaOvertidSplitt(
      [
        rad("arbeid", "07:00", "15:00", { pauseMin: 30 }),
        rad("reise", "15:00", "17:00", { erReise: true }),
      ],
      7.5,
      LONNSARTER,
      PAUSE,
    );
    expect(f).toEqual([]);
  });

  it("flere rader → splitten faller på riktig rad i kronologisk rekkefølge", () => {
    // Usortert inn. 07–11 (4 t) + 11:30–17:00 (5,5 t) = 9,5 t, norm 7,5.
    // Reise 06–07 først teller ikke. Splitten skal falle på «b» kl. 15:00.
    const f = foreslaOvertidSplitt(
      [
        rad("b", "11:30", "17:00"),
        rad("reise", "06:00", "07:00", { erReise: true }),
        rad("a", "07:00", "11:00"),
      ],
      7.5,
      LONNSARTER,
      PAUSE,
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.radId).toBe("b");
    expect(f[0]!.normal).toEqual({
      fraTid: "11:30",
      tilTid: "15:00",
      timer: 3.5,
      pauseMin: 0,
    });
    expect(f[0]!.overtid).toEqual({
      fraTid: "15:00",
      tilTid: "17:00",
      timer: 2,
      pauseMin: 0,
    });
  });

  it("rad helt etter normen → kun lønnsart byttes (normal: null)", () => {
    const f = foreslaOvertidSplitt(
      [
        rad("a", "07:00", "15:00", { pauseMin: 30 }),
        rad("b", "15:00", "17:00"),
      ],
      7.5,
      LONNSARTER,
      PAUSE,
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.radId).toBe("b");
    expect(f[0]!.normal).toBeNull();
    expect(f[0]!.overTimer).toBe(2);
    expect(f[0]!.overtid).toEqual({
      fraTid: "15:00",
      tilTid: "17:00",
      timer: 2,
      pauseMin: 0,
    });
    expect(f[0]!.overtidLonnsart.id).toBe("ot50");
  });

  it("rad som alt står på overtid teller mot summen, men får ikke forslag", () => {
    const f = foreslaOvertidSplitt(
      [
        rad("a", "07:00", "15:00", { pauseMin: 30 }),
        rad("b", "15:00", "16:00", { overtidsnivaa: 50 }),
        rad("c", "16:00", "17:00"),
      ],
      7.5,
      LONNSARTER,
      PAUSE,
    );
    expect(f.map((x) => x.radId)).toEqual(["c"]);
  });

  it("pausen følger overtid-delen når splitten faller før lunsj", () => {
    // Norm 3 t: 07–16 deles kl. 10:00; pausen 11:00–11:30 ligger i overtid-delen.
    const f = foreslaOvertidSplitt(
      [rad("a", "07:00", "16:00", { pauseMin: 30 })],
      3,
      LONNSARTER,
      PAUSE,
    );
    expect(f[0]!.normal).toEqual({
      fraTid: "07:00",
      tilTid: "10:00",
      timer: 3,
      pauseMin: 0,
    });
    expect(f[0]!.overtid).toEqual({
      fraTid: "10:00",
      tilTid: "16:00",
      timer: 5.5,
      pauseMin: 30,
    });
  });
});
