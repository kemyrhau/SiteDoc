import { describe, it, expect } from "vitest";
import { sekvenserReisekjede, type KjedeKort } from "./reiseKjede";

// Ordre 2026-11-15 (17) P1 + Kenneth-vedtak 2026-11-15: rettet kort er fast
// punkt, beregnede naboer flytter seg, rettede naboer står.

const m = (hhmm: string) => {
  const [t, mm] = hhmm.split(":").map(Number);
  return t! * 60 + mm!;
};
const k = (h: number) => {
  const t = Math.floor(h / 60);
  return `${String(t).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
};
const vis = (kort: KjedeKort[]) => kort.map((x) => `${x.nokkel} ${k(x.fraMin)}–${k(x.tilMin)}`);

/** Overføring Narvik → Tromsø 180 min, reise Tromsø → byggeplass 30 min, arbeid 07–15. */
const dag = (): KjedeKort[] => [
  { nokkel: "overforing-ut", type: "reise", fraMin: m("06:30"), tilMin: m("09:30") },
  { nokkel: "reise-ut", type: "reise", fraMin: m("06:30"), tilMin: m("07:00") },
  { nokkel: "arbeid", type: "arbeid", fraMin: m("07:00"), tilMin: m("15:00") },
  { nokkel: "reise-retur", type: "reise", fraMin: m("15:00"), tilMin: m("15:30") },
  { nokkel: "overforing-retur", type: "reise", fraMin: m("15:00"), tilMin: m("18:00") },
];

describe("sekvenserReisekjede", () => {
  it("uten retting: arbeid står, reisene etter hverandre bakover og framover", () => {
    expect(vis(sekvenserReisekjede(dag()))).toEqual([
      "overforing-ut 03:30–06:30",
      "reise-ut 06:30–07:00",
      "arbeid 07:00–15:00",
      "reise-retur 15:00–15:30",
      "overforing-retur 15:30–18:30",
    ]);
  });

  it("rett midtkort: begge naboer flytter", () => {
    const kort = dag();
    kort[1] = { ...kort[1]!, fraMin: m("07:00"), tilMin: m("07:30"), rettet: true } as KjedeKort;
    expect(vis(sekvenserReisekjede(kort)).slice(0, 3)).toEqual([
      "overforing-ut 04:00–07:00",
      "reise-ut 07:00–07:30",
      "arbeid 07:30–15:00",
    ]);
  });

  it("rett midtkort: rettet nabo står", () => {
    const kort = dag();
    kort[0] = { ...kort[0]!, fraMin: m("03:00"), tilMin: m("06:00"), rettet: true } as KjedeKort;
    kort[1] = { ...kort[1]!, fraMin: m("07:00"), tilMin: m("07:30"), rettet: true } as KjedeKort;
    expect(vis(sekvenserReisekjede(kort)).slice(0, 3)).toEqual([
      "overforing-ut 03:00–06:00",
      "reise-ut 07:00–07:30",
      "arbeid 07:30–15:00",
    ]);
  });

  it("forsinkelse: rettet ankomst gir lengre reise, arbeidsstart følger", () => {
    const kort = dag();
    // Beregnet 06:30–07:00; arbeideren var framme 07:20.
    kort[1] = { ...kort[1]!, fraMin: m("06:30"), tilMin: m("07:20"), rettet: true } as KjedeKort;
    const res = sekvenserReisekjede(kort);
    expect(vis(res).slice(0, 3)).toEqual([
      "overforing-ut 03:30–06:30",
      "reise-ut 06:30–07:20",
      "arbeid 07:20–15:00",
    ]);
  });

  it("rettet første kort: kortene etter følger framover til arbeid", () => {
    const kort = dag();
    kort[0] = { ...kort[0]!, fraMin: m("04:00"), tilMin: m("07:00"), rettet: true } as KjedeKort;
    expect(vis(sekvenserReisekjede(kort)).slice(0, 3)).toEqual([
      "overforing-ut 04:00–07:00",
      "reise-ut 07:00–07:30",
      "arbeid 07:30–15:00",
    ]);
  });

  it("rettet arbeidsstart vinner over rettet reise: kortene imellom legges bakover", () => {
    const kort = dag();
    kort[0] = { ...kort[0]!, fraMin: m("03:00"), tilMin: m("06:00"), rettet: true } as KjedeKort;
    kort[2] = { ...kort[2]!, fraMin: m("08:00"), rettetFra: true } as KjedeKort;
    expect(vis(sekvenserReisekjede(kort)).slice(0, 3)).toEqual([
      "overforing-ut 03:00–06:00",
      "reise-ut 07:30–08:00",
      "arbeid 08:00–15:00",
    ]);
  });

  it("retursiden speiler: rettet retur flytter arbeidsslutt og overføringen etter", () => {
    const kort = dag();
    kort[3] = { ...kort[3]!, fraMin: m("14:30"), tilMin: m("15:10"), rettet: true } as KjedeKort;
    expect(vis(sekvenserReisekjede(kort)).slice(2)).toEqual([
      "arbeid 07:00–14:30",
      "reise-retur 14:30–15:10",
      "overforing-retur 15:10–18:10",
    ]);
  });

  it("uten arbeidskort: uendret", () => {
    const kort = dag().filter((x) => x.type !== "arbeid");
    expect(sekvenserReisekjede(kort)).toEqual(kort);
  });
});
