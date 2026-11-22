import { describe, expect, it } from "vitest";
import { erGyldigMaskinDeling, foreslaMaskinDeling } from "./maskinDeling";

// O15 pkt 1 (plan § 4.16 «s2.ja»): forslaget for maskintimene i «Del opp».
const forer = (id: string, timer: number, koblet = true) => ({ id, timer, utleieEnhet: "time", koblet });

describe("foreslaMaskinDeling", () => {
  it("Kenneths bilde 20: Volvo 4,5 t, A 3 t arbeid → A 3 · B 1,5", () => {
    expect(foreslaMaskinDeling([forer("v", 4.5)], 3)).toEqual([{ id: "v", timerA: 3, timerB: 1.5 }]);
  });

  it("maskin innenfor A blir hel i A", () => {
    expect(foreslaMaskinDeling([forer("v", 2)], 3)).toEqual([{ id: "v", timerA: 2, timerB: 0 }]);
  });

  it("flere førermaskiner deler arbeidet i A i rekkefølge (summen er høyst A)", () => {
    expect(foreslaMaskinDeling([forer("a", 2), forer("b", 2)], 3)).toEqual([
      { id: "a", timerA: 2, timerB: 0 },
      { id: "b", timerA: 1, timerB: 1 },
    ]);
  });

  it("døgnmaskin og maskin uten timerad blir i A med alle timene (R7)", () => {
    expect(
      foreslaMaskinDeling([{ id: "d", timer: 24, utleieEnhet: "doegn", koblet: true }, forer("u", 4.5, false)], 3),
    ).toEqual([
      { id: "d", timerA: 24, timerB: 0 },
      { id: "u", timerA: 4.5, timerB: 0 },
    ]);
  });
});

describe("erGyldigMaskinDeling", () => {
  it("førermaskin uten timerad tar plass i A før de koblede fordeles (lokal dev: 5 t koblet + 0,5 t, A 3 t)", () => {
    const forslag = foreslaMaskinDeling(
      [
        { id: "koblet", timer: 5, utleieEnhet: "time", koblet: true },
        { id: "ukoblet", timer: 0.5, utleieEnhet: "time", koblet: false },
      ],
      3,
    );
    expect(forslag).toEqual([
      { id: "koblet", timerA: 2.5, timerB: 2.5 },
      { id: "ukoblet", timerA: 0.5, timerB: 0 },
    ]);
  });

  it("A + B må være maskinens timer", () => {
    expect(erGyldigMaskinDeling(4.5, { timerA: 3, timerB: 1.5 })).toBe(true);
    expect(erGyldigMaskinDeling(4.5, { timerA: 3, timerB: 1 })).toBe(false);
    expect(erGyldigMaskinDeling(4.5, { timerA: -1, timerB: 5.5 })).toBe(false);
  });
});
