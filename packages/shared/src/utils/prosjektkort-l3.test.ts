import { describe, expect, it } from "vitest";
import {
  kortDagsseddelId,
  kortVareforbrukInput,
  slaaSammenVarelinjer,
  visVareforbrukKnapp,
} from "./prosjektkort";

describe("L3 visVareforbrukKnapp", () => {
  it("vises når Varelager er på for kortets prosjekt og sedelen er redigerbar", () => {
    expect(
      visVareforbrukKnapp({ prosjektIderMedVarelager: ["p1"], projectId: "p1", erRedigerbar: true }),
    ).toBe(true);
  });
  it("skjult uten Varelager for prosjektet (eller uten katalog)", () => {
    expect(
      visVareforbrukKnapp({ prosjektIderMedVarelager: ["p2"], projectId: "p1", erRedigerbar: true }),
    ).toBe(false);
    expect(
      visVareforbrukKnapp({ prosjektIderMedVarelager: undefined, projectId: "p1", erRedigerbar: true }),
    ).toBe(false);
  });
  it("skjult på sendt/attestert sedel", () => {
    expect(
      visVareforbrukKnapp({ prosjektIderMedVarelager: ["p1"], projectId: "p1", erRedigerbar: false }),
    ).toBe(false);
  });
});

describe("L3 kortDagsseddelId", () => {
  it("kobler til sedelen når kortet har en timerrad for prosjektet", () => {
    expect(kortDagsseddelId("s1", [{ projectId: "p1" }], "p1")).toBe("s1");
  });
  it("uten timerrad for prosjektet → ingen kobling (API-et ville avvist)", () => {
    expect(kortDagsseddelId("s1", [{ projectId: "p2" }], "p1")).toBeUndefined();
  });
});

describe("L3 kortVareforbrukInput — prosjektlås", () => {
  it("prosjektet er alltid kortets", () => {
    const inp = kortVareforbrukInput({
      kortProsjektId: "p1",
      dato: "2026-11-06",
      vareId: "v1",
      antall: 3,
      byggeplassId: null,
      dagsseddelId: "s1",
    });
    expect(inp).toEqual({
      projectId: "p1",
      dato: "2026-11-06",
      vareId: "v1",
      antall: 3,
      byggeplassId: null,
      dagsseddelId: "s1",
    });
  });
  it("utelater dagsseddelId og id når de mangler", () => {
    const inp = kortVareforbrukInput({
      kortProsjektId: "p1",
      dato: "2026-11-06",
      vareId: "v1",
      antall: 1,
      byggeplassId: "b1",
    });
    expect("dagsseddelId" in inp).toBe(false);
    expect("id" in inp).toBe(false);
  });
  it("ORDRE 36b: kortets underprosjekt sendes med, og utelates uten", () => {
    const basis = { kortProsjektId: "p1", dato: "2026-11-06", vareId: "v1", antall: 1, byggeplassId: null };
    expect(kortVareforbrukInput({ ...basis, externalCostObjectId: "eco1" }).externalCostObjectId).toBe("eco1");
    expect("externalCostObjectId" in kortVareforbrukInput({ ...basis, externalCostObjectId: null })).toBe(false);
    expect("externalCostObjectId" in kortVareforbrukInput(basis)).toBe(false);
  });
});

describe("L3 slaaSammenVarelinjer — ingen dobbelttelling", () => {
  it("lokal linje som alt er synket (samme id) telles én gang", () => {
    const server = [{ id: "a", antall: 2 }];
    const lokale = [{ id: "a", antall: 2 }, { id: "b", antall: 5 }];
    expect(slaaSammenVarelinjer(server, lokale)).toEqual([
      { id: "a", antall: 2 },
      { id: "b", antall: 5 },
    ]);
  });
});
