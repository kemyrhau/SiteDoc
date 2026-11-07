import { describe, it, expect } from "vitest";
import {
  effektivByggeplass,
  forsteKortFor,
  fraKortNokkel,
  fraRuteParam,
  kortNokkel,
  kortNokkelFor,
  kortNokler,
  lagretByggeplassForKort,
  raderPaaKort,
  tilKortMaskinRader,
  tilRuteParam,
  type SedelKortKontekst,
} from "./prosjektkortMobil";

/** ORDRE 36b: kort pr. (prosjekt, effektiv byggeplass, underprosjekt). */
const SEDEL: SedelKortKontekst = { projectId: "pA", byggeplass: { id: "bA1", projectId: "pA" } };
const sortering = {
  byggeplassNavn: (id: string) => ({ bA1: "Blokk B", bA2: "Blokk A", bB1: "Hall" })[id] ?? id,
  ecoNokkel: (id: string) => ({ e1: "10", e2: "2" })[id] ?? id,
};

describe("kortnøkkel", () => {
  it("rundtur nøkkel ↔ valg, null skrives «ingen»", () => {
    const k = { projectId: "pA", byggeplassId: null, ecoId: "e1" };
    expect(kortNokkel(k)).toBe("pA|ingen|e1");
    expect(fraKortNokkel(kortNokkel(k))).toEqual(k);
  });

  it("rute-param: manglende = undefined, «ingen» = null", () => {
    expect(fraRuteParam(undefined)).toBeUndefined();
    expect(fraRuteParam("ingen")).toBeNull();
    expect(fraRuteParam("bA1")).toBe("bA1");
    expect(tilRuteParam(null)).toBe("ingen");
  });

  it("rad uten byggeplass arver sedelens bare innen samme prosjekt", () => {
    expect(effektivByggeplass("pA", null, SEDEL)).toBe("bA1");
    expect(effektivByggeplass("pB", null, SEDEL)).toBeNull();
    expect(effektivByggeplass("pA", "bA2", SEDEL)).toBe("bA2");
  });

  it("rad uten prosjekt havner på sedelens prosjekt med arvet byggeplass", () => {
    expect(kortNokkelFor({ projectId: null }, SEDEL)).toBe("pA|bA1|ingen");
  });

  it("to byggeplasser i samme prosjekt gir to kort, sortert på navn, «Uten» sist", () => {
    const sedelUten: SedelKortKontekst = { projectId: "pA", byggeplass: null };
    const kort = kortNokler(
      sedelUten,
      [[
        { projectId: "pA", byggeplassId: "bA1" },
        { projectId: "pA", byggeplassId: null },
        { projectId: "pA", byggeplassId: "bA2" },
      ]],
      [],
      sortering,
    );
    expect(kort.map(kortNokkel)).toEqual(["pA|bA2|ingen", "pA|bA1|ingen", "pA|ingen|ingen"]);
  });

  it("underprosjekt sorteres på proAdmId (numerisk), «Uten» først", () => {
    const kort = kortNokler(
      SEDEL,
      [[
        { projectId: "pA", externalCostObjectId: "e1" },
        { projectId: "pA", externalCostObjectId: "e2" },
        { projectId: "pA" },
      ]],
      [],
      sortering,
    );
    expect(kort.map((k) => k.ecoId)).toEqual([null, "e2", "e1"]);
  });

  it("prosjektrekkefølge = første forekomst over gruppene, ekstra kort sist", () => {
    const kort = kortNokler(
      SEDEL,
      [[{ projectId: "pB", byggeplassId: "bB1" }], [{ projectId: "pA" }]],
      [{ projectId: "pC", byggeplassId: null, ecoId: null }],
      sortering,
    );
    expect(kort.map((k) => k.projectId)).toEqual(["pB", "pA", "pC"]);
  });

  it("samme kombinasjon fra flere rader gir ett kort (eksisterende kort gjenbrukes)", () => {
    const kort = kortNokler(
      SEDEL,
      [[{ projectId: "pA" }, { projectId: "pA", byggeplassId: "bA1" }]],
      [{ projectId: "pA", byggeplassId: "bA1", ecoId: null }],
      sortering,
    );
    expect(kort).toHaveLength(1);
  });

  it("forsteKortFor: første kort på prosjektet, ellers tomt kort med arvet byggeplass", () => {
    const kort = [
      { projectId: "pB", byggeplassId: "bB1", ecoId: null },
      { projectId: "pA", byggeplassId: "bA2", ecoId: null },
    ];
    expect(forsteKortFor("pA", kort, SEDEL).byggeplassId).toBe("bA2");
    expect(forsteKortFor("pC", kort, SEDEL)).toEqual({ projectId: "pC", byggeplassId: null, ecoId: null });
  });

  it("radLagring: kortets byggeplass = sedelens → null (arv), ellers kortets", () => {
    expect(lagretByggeplassForKort({ projectId: "pA", byggeplassId: "bA1", ecoId: null }, SEDEL)).toBeNull();
    expect(lagretByggeplassForKort({ projectId: "pA", byggeplassId: "bA2", ecoId: null }, SEDEL)).toBe("bA2");
    expect(lagretByggeplassForKort({ projectId: "pB", byggeplassId: null, ecoId: null }, SEDEL)).toBeNull();
  });

  it("raderPaaKort filtrerer på full nøkkel — maskin med egen byggeplass havner på sitt kort", () => {
    const maskin = [
      { id: "m1", projectId: "pA", byggeplassId: null },
      { id: "m2", projectId: "pA", byggeplassId: "bA2" },
      { id: "m3", projectId: "pA", byggeplassId: null, externalCostObjectId: "e1" },
    ];
    const kort = { projectId: "pA", byggeplassId: "bA1", ecoId: null };
    expect(raderPaaKort(maskin, SEDEL, kort).map((m) => m.id)).toEqual(["m1"]);
  });

  it("tilKortMaskinRader beholder radens egen byggeplass", () => {
    expect(tilKortMaskinRader([{ projectId: "pA", byggeplassId: "bA2", timer: 2 }], "pA")[0]!.byggeplassId).toBe("bA2");
  });
});
