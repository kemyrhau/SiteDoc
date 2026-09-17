import { describe, it, expect } from "vitest";
import { utledFlytbytteVisning } from "./flytbytte-visning";

/**
 * Bundet flyt på mobil (bundet-flyt-mobil 2026-09-17). Beviser at serversperren speiles i UI:
 * en BUNDET flyt skjuler «Bytt flyt» og viser fotnoten i stedet — uavhengig av rettigheten
 * `kanFlytte`. Denne testen FEILER hvis `!egenFlytBundet`-vakten fjernes (bevist rød i runden).
 */
describe("utledFlytbytteVisning — bundet flyt skjuler «Bytt flyt»", () => {
  it("BUNDET flyt (kanFlytte=true, andre>0): «Bytt flyt» SKJULT, fotnote vist", () => {
    const v = utledFlytbytteVisning({ kanFlytte: true, andreAntall: 2, egenFlytBundet: true });
    // Dette er hele funksjonen: knappen skal IKKE finnes for en bundet flyt.
    expect(v.harFlytBytte).toBe(false);
    expect(v.visBundetFotnote).toBe(true);
  });

  it("FRI flyt (kanFlytte=true, andre>0): «Bytt flyt» vist, ingen fotnote", () => {
    const v = utledFlytbytteVisning({ kanFlytte: true, andreAntall: 2, egenFlytBundet: false });
    expect(v.harFlytBytte).toBe(true);
    expect(v.visBundetFotnote).toBe(false);
  });

  it("bundet er EGENSKAP, ikke rettighet: kanFlytte=false → verken knapp eller fotnote", () => {
    // Bundet men ingen flytte-rettighet i utgangspunktet: da ville «Bytt flyt» aldri vist,
    // og fotnoten skal heller ikke dukke opp av seg selv (den erstatter en knapp som ville stått).
    const v = utledFlytbytteVisning({ kanFlytte: false, andreAntall: 2, egenFlytBundet: true });
    expect(v.harFlytBytte).toBe(false);
    expect(v.visBundetFotnote).toBe(false);
  });

  it("ingen andre flyter: verken knapp eller fotnote uansett bundet", () => {
    const v = utledFlytbytteVisning({ kanFlytte: true, andreAntall: 0, egenFlytBundet: true });
    expect(v.harFlytBytte).toBe(false);
    expect(v.visBundetFotnote).toBe(false);
  });
});
