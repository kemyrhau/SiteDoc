import { describe, it, expect } from "vitest";
import { filtrerSynligeArkivObjekter } from "./synlighet";
import type { RapportObjekt } from "@sitedoc/pdf";

function obj(o: Partial<RapportObjekt> & { id: string; type: string }): RapportObjekt {
  return { label: o.id, required: false, config: {}, sortOrder: 0, parentId: null, ...o } as RapportObjekt;
}

describe("filtrerSynligeArkivObjekter", () => {
  it("mal uten betingede felt er byte-likt uendret (ingenting filtreres)", () => {
    const alle = [
      obj({ id: "h1", type: "heading", sortOrder: 0 }),
      obj({ id: "f1", type: "text_field", sortOrder: 1 }),
      obj({ id: "f2", type: "list_single", sortOrder: 2 }),
    ];
    const r = filtrerSynligeArkivObjekter(alle, () => undefined);
    expect(r.objekter).toEqual(alle);
    expect(r.noeUtelatt).toBe(false);
  });

  it("aldri-vist barn (forelder-svar matcher ikke) utelates; noeUtelatt=true", () => {
    const alle = [
      obj({ id: "p", type: "list_single", sortOrder: 0, config: { conditionActive: true, conditionValues: ["ja"] } }),
      obj({ id: "b", type: "text_field", sortOrder: 1, parentId: "p" }),
    ];
    const r = filtrerSynligeArkivObjekter(alle, (id) => (id === "p" ? "nei" : undefined));
    expect(r.objekter.map((o) => o.id)).toEqual(["p"]);
    expect(r.noeUtelatt).toBe(true);
  });

  it("vist barn (forelder-svar matcher) blir stående — svar-verdien påvirker ikke synlighet", () => {
    const alle = [
      obj({ id: "p", type: "list_single", sortOrder: 0, config: { conditionActive: true, conditionValues: ["ja"] } }),
      obj({ id: "b", type: "list_single", sortOrder: 1, parentId: "p" }),
    ];
    // Barnet er besvart «ikke_aktuelt» — en fagvurdering. Skal STÅ.
    const r = filtrerSynligeArkivObjekter(alle, (id) => (id === "p" ? "ja" : "ikke_aktuelt"));
    expect(r.objekter.map((o) => o.id)).toEqual(["p", "b"]);
    expect(r.noeUtelatt).toBe(false);
  });

  it("overskrift som mistet ALT innhold til filtreringen faller bort", () => {
    // Container «p» styrer to betingede barn som begge er søsken under overskriften «h»
    // (h + b1 + b2 er alle barn av p). Forelder-svar matcher ikke → b1+b2 utelates → h tom.
    const alle = [
      obj({ id: "p", type: "list_single", sortOrder: 0, config: { conditionActive: true, conditionValues: ["ja"] } }),
      obj({ id: "h", type: "heading", sortOrder: 1, parentId: "p" }),
      obj({ id: "b1", type: "text_field", sortOrder: 2, parentId: "p" }),
      obj({ id: "b2", type: "text_field", sortOrder: 3, parentId: "p" }),
    ];
    const r = filtrerSynligeArkivObjekter(alle, (id) => (id === "p" ? "nei" : undefined));
    // Alle tre barna borte (b1,b2 aldri vist; h ble tom) — bare forelderen står.
    expect(r.objekter.map((o) => o.id)).toEqual(["p"]);
    expect(r.noeUtelatt).toBe(true);
  });

  it("overskrift beholdes når minst ett felt under fortsatt er synlig", () => {
    const alle = [
      obj({ id: "p", type: "list_single", sortOrder: 0, config: { conditionActive: true, conditionValues: ["ja"] } }),
      obj({ id: "h", type: "heading", sortOrder: 1, parentId: "p" }),
      obj({ id: "b1", type: "text_field", sortOrder: 2, parentId: "p", config: { conditionOwnValues: ["nei"] } }),
      obj({ id: "b2", type: "text_field", sortOrder: 3, parentId: "p" }),
    ];
    // Forelder=ja: b1 har eget sett ["nei"] → skjult; b2 arver ["ja"] → vist. h beholdes (b2 står).
    const r = filtrerSynligeArkivObjekter(alle, (id) => (id === "p" ? "ja" : undefined));
    expect(r.objekter.map((o) => o.id)).toEqual(["p", "h", "b2"]);
    expect(r.noeUtelatt).toBe(true);
  });

  it("overskrift som ALLTID var tom står uendret (ikke en filtrerings-følge)", () => {
    // Ingen betingede felt; en avsluttende overskrift uten felt under. Byte-likt.
    const alle = [
      obj({ id: "f1", type: "text_field", sortOrder: 0 }),
      obj({ id: "h", type: "heading", sortOrder: 1 }),
    ];
    const r = filtrerSynligeArkivObjekter(alle, () => undefined);
    expect(r.objekter.map((o) => o.id)).toEqual(["f1", "h"]);
    expect(r.noeUtelatt).toBe(false);
  });

  it("repeater-barn røres aldri (alltid synlige), uansett forelder-svar", () => {
    const alle = [
      obj({ id: "rep", type: "repeater", sortOrder: 0 }),
      obj({ id: "kol", type: "text_field", sortOrder: 1, parentId: "rep" }),
    ];
    const r = filtrerSynligeArkivObjekter(alle, () => undefined);
    expect(r.objekter.map((o) => o.id)).toEqual(["rep", "kol"]);
    expect(r.noeUtelatt).toBe(false);
  });
});
