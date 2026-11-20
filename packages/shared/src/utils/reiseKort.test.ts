import { describe, expect, it } from "vitest";
import { jobberFraArbeidsrader, jobbRekkefolge, velgReiseKort, type ReiseKortJobb, type ReiseKortReise } from "./reiseKort";

// web-timeforing-plan.md § 4.11 del A punkt 3 og del H punkt 4.
const jobb = (o: Partial<ReiseKortJobb> & { kortId: string }): ReiseKortJobb => ({
  projectId: "B12",
  ecoId: null,
  byggeplassId: "storgata",
  forsteTid: null,
  eldste: 0,
  ...o,
});
const reise = (o: Partial<ReiseKortReise> = {}): ReiseKortReise => ({
  projectId: "B12",
  ecoId: null,
  byggeplassId: "storgata",
  retning: "ut",
  fraTid: null,
  ...o,
});

describe("velgReiseKort — eksempelet i del A punkt 3 (B12, to jobber)", () => {
  const morgen = jobb({ kortId: "J07", forsteTid: "07:00", eldste: 1 });
  const ettermiddag = jobb({ kortId: "J12", ecoId: "END-002", forsteTid: "12:00", eldste: 2 });
  const jobber = [ettermiddag, morgen];

  it("utreise uten underprosjekt → jobben 07–12", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), jobber)).toBe("J07");
  });
  it("retur uten underprosjekt → jobben 07–12 (eneste uten underprosjekt)", () => {
    expect(velgReiseKort(reise({ retning: "retur" }), jobber)).toBe("J07");
  });
  it("retur på END-002 → jobben 12–16", () => {
    expect(velgReiseKort(reise({ retning: "retur", ecoId: "END-002" }), jobber)).toBe("J12");
  });
  it("utreise på TILL-001 (ingen jobb der) → jobben 07–12", () => {
    expect(velgReiseKort(reise({ retning: "ut", ecoId: "TILL-001" }), jobber)).toBe("J07");
  });
  it("utreise på prosjekt 1050 (ingen jobb der) → null (eget kort)", () => {
    expect(velgReiseKort(reise({ projectId: "1050" }), jobber)).toBeNull();
  });
});

describe("velgReiseKort — retning og rekkefølge", () => {
  const a = jobb({ kortId: "A", forsteTid: "07:00", eldste: 3 });
  const b = jobb({ kortId: "B", forsteTid: "12:00", eldste: 1 });
  const c = jobb({ kortId: "C", forsteTid: null, eldste: 0 });

  it("utreise → første etter klokkeslett, retur → siste", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [b, a])).toBe("A");
    expect(velgReiseKort(reise({ retning: "retur" }), [b, a])).toBe("B");
  });
  it("jobb uten klokkeslett står sist i rekkefølgen (retur havner der)", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [c, b, a])).toBe("A");
    expect(velgReiseKort(reise({ retning: "retur" }), [c, b, a])).toBe("C");
  });
  it("lik starttid → eldste først, så kort-id", () => {
    const x = jobb({ kortId: "X", forsteTid: "07:00", eldste: 5 });
    const y = jobb({ kortId: "Y", forsteTid: "07:00", eldste: 2 });
    expect(velgReiseKort(reise({ retning: "ut" }), [x, y])).toBe("Y");
    const z = jobb({ kortId: "Z", forsteTid: "07:00", eldste: 2 });
    expect(velgReiseKort(reise({ retning: "retur" }), [x, y, z].map((j) => ({ ...j, eldste: 2 })))).toBe("Z");
  });
  it("uten retning: før første arbeid → første, ellers siste", () => {
    expect(velgReiseKort(reise({ retning: null, fraTid: "06:30" }), [a, b])).toBe("A");
    expect(velgReiseKort(reise({ retning: null, fraTid: "16:00" }), [a, b])).toBe("B");
    expect(velgReiseKort(reise({ retning: null, fraTid: "07:00" }), [a, b])).toBe("B");
  });
  it("uten retning og uten klokkeslett → første", () => {
    expect(velgReiseKort(reise({ retning: null, fraTid: null }), [a, b])).toBe("A");
  });
  it("uten retning når ingen kandidat har klokkeslett → første", () => {
    const d = jobb({ kortId: "D", eldste: 2 });
    expect(velgReiseKort(reise({ retning: null, fraTid: "16:00" }), [c, d])).toBe("C");
  });
  it("ukjent retning («mellom») regnes som uten retning", () => {
    expect(velgReiseKort(reise({ retning: "mellom", fraTid: "16:00" }), [a, b])).toBe("B");
  });
  it("ny tidligere jobb flytter utreisen", () => {
    const tidlig = jobb({ kortId: "T", forsteTid: "06:00", eldste: 9 });
    expect(velgReiseKort(reise({ retning: "ut" }), [a, b])).toBe("A");
    expect(velgReiseKort(reise({ retning: "ut" }), [a, b, tidlig])).toBe("T");
  });
  it("slettet jobb → reisen går til en annen jobb; ingen igjen → null", () => {
    expect(velgReiseKort(reise({ retning: "ut" }), [b])).toBe("B");
    expect(velgReiseKort(reise({ retning: "ut" }), [])).toBeNull();
  });
});

describe("velgReiseKort — underprosjekt og byggeplass (B34 B)", () => {
  it("lik underprosjekt går foran byggeplass", () => {
    const likBp = jobb({ kortId: "BP", ecoId: null, byggeplassId: "x", forsteTid: "07:00" });
    const likEco = jobb({ kortId: "ECO", ecoId: "e1", byggeplassId: "y", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ ecoId: "e1", byggeplassId: "x" }), [likBp, likEco])).toBe("ECO");
  });
  it("lik byggeplass går foran retningen", () => {
    const annen = jobb({ kortId: "ANNEN", byggeplassId: "y", forsteTid: "07:00" });
    const sammeSted = jobb({ kortId: "SAMME", byggeplassId: "x", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ retning: "ut", byggeplassId: "x" }), [annen, sammeSted])).toBe("SAMME");
  });
  it("ingen jobb med lik byggeplass → kandidatene fra underprosjekt-steget står", () => {
    const a = jobb({ kortId: "A", byggeplassId: "y", forsteTid: "07:00" });
    const b = jobb({ kortId: "B", byggeplassId: "z", forsteTid: "12:00" });
    expect(velgReiseKort(reise({ retning: "retur", byggeplassId: "x" }), [a, b])).toBe("B");
  });
  it("reise uten byggeplass (annet kontor) hopper over byggeplass-steget", () => {
    const utenBp = jobb({ kortId: "UTEN", byggeplassId: null, forsteTid: "12:00" });
    const medBp = jobb({ kortId: "MED", byggeplassId: "x", forsteTid: "07:00" });
    // Med byggeplass-steget ville null === null valgt UTEN; uten steget står begge, og utreisen tar første.
    expect(velgReiseKort(reise({ retning: "ut", byggeplassId: null }), [utenBp, medBp])).toBe("MED");
  });
  it("«flytt hele jobben» til annet underprosjekt: plassen regnes på nytt mot de nye jobbene", () => {
    const foer = [jobb({ kortId: "J1", ecoId: "e1", forsteTid: "07:00" }), jobb({ kortId: "J2", ecoId: null, forsteTid: "12:00" })];
    expect(velgReiseKort(reise({ ecoId: "e1", retning: "retur" }), foer)).toBe("J1");
    const etter = [jobb({ kortId: "J1", ecoId: "e2", forsteTid: "07:00" }), foer[1]!];
    expect(velgReiseKort(reise({ ecoId: "e1", retning: "retur" }), etter)).toBe("J2");
  });
  it("regelen endrer aldri reiseraden (bare leser den)", () => {
    const r = Object.freeze(reise({ ecoId: "e1", byggeplassId: "x" }));
    const jobber = Object.freeze([Object.freeze(jobb({ kortId: "A", forsteTid: "07:00" }))]);
    expect(() => velgReiseKort(r, jobber)).not.toThrow();
    expect(r).toEqual(reise({ ecoId: "e1", byggeplassId: "x" }));
  });
});

describe("jobberFraArbeidsrader", () => {
  it("ett kort pr. id, første fra-tid og eldste rad; erstattede og rader uten kort teller ikke", () => {
    const j = jobberFraArbeidsrader([
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "12:00", opprettet: 5 },
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "07:00", opprettet: 9 },
      { kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "05:00", opprettet: 1, attestertStatus: "erstattet" },
      { kortId: null, projectId: "p", ecoId: null, byggeplassId: "b", fraTid: "04:00", opprettet: 0 },
    ]);
    expect(j).toEqual([{ kortId: "K", projectId: "p", ecoId: null, byggeplassId: "b", forsteTid: "07:00", eldste: 5 }]);
  });
  it("kort med bare erstattede rader er ingen jobb", () => {
    expect(
      jobberFraArbeidsrader([{ kortId: "K", projectId: "p", ecoId: null, byggeplassId: null, fraTid: null, opprettet: 1, attestertStatus: "erstattet" }]),
    ).toEqual([]);
  });
});

describe("jobbRekkefolge", () => {
  it("klokkeslett før uten, så eldste, så kort-id", () => {
    const l = [
      { kortId: "c", forsteTid: null, eldste: 0 },
      { kortId: "b", forsteTid: "07:00", eldste: 2 },
      { kortId: "a", forsteTid: "07:00", eldste: 2 },
      { kortId: "d", forsteTid: "06:00", eldste: 9 },
    ].sort(jobbRekkefolge);
    expect(l.map((x) => x.kortId)).toEqual(["d", "a", "b", "c"]);
  });
});
