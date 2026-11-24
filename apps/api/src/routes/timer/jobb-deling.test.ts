import { describe, it, expect } from "vitest";
import { planleggJobbDeling, type JobbTimerRad } from "./jobb-deling";

/**
 * w5 «Del opp» (bilde 8): planleggeren alene. Pausefordelingen er `fordelPauseVedSplitt` i
 * ruteren; her en enkel stand-in som gir hele pausen til delen som inneholder kl. 11:00.
 */
const tilMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const pauseKl11 = (deler: { fraTid: string; tilTid: string }[], pauseMin: number) =>
  deler.map((d) => (tilMin(d.fraTid) <= 660 && 660 < tilMin(d.tilTid) ? pauseMin : 0));

const rad = (id: string, fraTid: string, tilTid: string, timer: number, pauseMin = 0): JobbTimerRad => ({
  id, fraTid, tilTid, timer, pauseMin,
});

describe("planleggJobbDeling", () => {
  it("rader før blir på A, rader etter går til B, raden som krysser deles", () => {
    const plan = planleggJobbDeling(
      [rad("a", "07:00", "09:00", 2), rad("x", "09:00", "13:00", 3.5, 30), rad("b", "13:00", "15:00", 2)],
      "12:00",
      pauseKl11,
    );
    expect(plan).toEqual({
      paaA: ["a"],
      tilB: ["b"],
      delt: [{ id: "x", timerA: 2.5, pauseA: 30, timerB: 1, pauseB: 0 }],
    });
  });

  it("summen av timene er uendret", () => {
    const plan = planleggJobbDeling([rad("x", "07:00", "15:00", 7.5, 30)], "10:15", pauseKl11);
    if ("feil" in plan) throw new Error(plan.feil);
    const d = plan.delt[0]!;
    expect(d.timerA + d.timerB).toBe(7.5);
    expect(d.timerA).toBe(3.25);
  });

  it("klokkeslett på en radgrense deler uten å splitte en rad", () => {
    const plan = planleggJobbDeling([rad("a", "07:00", "11:00", 4), rad("b", "11:00", "15:00", 4)], "11:00", pauseKl11);
    expect(plan).toEqual({ paaA: ["a"], tilB: ["b"], delt: [] });
  });

  it("klokkeslett utenfor jobben avvises", () => {
    expect(planleggJobbDeling([rad("a", "07:00", "11:00", 4)], "06:00", pauseKl11)).toEqual({ feil: "klUtenforJobben" });
    expect(planleggJobbDeling([rad("a", "07:00", "11:00", 4)], "11:00", pauseKl11)).toEqual({ feil: "klUtenforJobben" });
  });

  it("rad uten fra/til avvises", () => {
    expect(planleggJobbDeling([{ id: "a", fraTid: null, tilTid: null, timer: 4, pauseMin: 0 }], "09:00", pauseKl11)).toEqual({
      feil: "manglerKlokkeslett",
    });
  });

  it("en del uten timer avvises (pausen spiser del A)", () => {
    expect(planleggJobbDeling([rad("x", "11:00", "15:00", 3.5, 30)], "11:30", pauseKl11)).toEqual({ feil: "tomDel" });
  });

  it("tom jobb avvises", () => {
    expect(planleggJobbDeling([], "09:00", pauseKl11)).toEqual({ feil: "tomDel" });
  });
});
