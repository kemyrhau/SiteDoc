import { describe, it, expect } from "vitest";
import {
  velgByggeplassKilde,
  antallByggeplasser,
  vedProsjektTrykk,
  vedByggeplassTrykk,
  erByggeplassAvhuket,
  oppdaterBygningMap,
  type ByggeplassValgRad,
} from "./prosjektByggeplassValg";

/** ORDRE 2026-11-15 (18) — delt prosjekt- og byggeplassvelger (mobil + web). */
const A = "prosjekt-a";
const B = "prosjekt-b";
const bp = (id: string): ByggeplassValgRad => ({ id, name: id, number: null });

describe("vedProsjektTrykk — markering vs. valg", () => {
  it("prosjekt med byggeplasser markeres bare (ingen valg)", () => {
    expect(vedProsjektTrykk(A, [bp("b1"), bp("b2")])).toEqual({ type: "marker", prosjektId: A });
  });
  it("prosjekt med 0 byggeplasser velges direkte", () => {
    expect(vedProsjektTrykk(A, [])).toEqual({ type: "velgProsjekt", prosjektId: A });
  });
  it("frakoblet uten katalog velges direkte som før", () => {
    expect(vedProsjektTrykk(A, "ukjent")).toEqual({ type: "velgProsjekt", prosjektId: A });
  });
  it("mens serveren laster: kun markering, aldri stille valg", () => {
    expect(vedProsjektTrykk(A, "laster")).toEqual({ type: "marker", prosjektId: A });
  });
  // Negativkontroll: markering og valg må aldri gi samme handling.
  it("negativkontroll: 1 byggeplass gir ikke velgProsjekt", () => {
    expect(vedProsjektTrykk(A, [bp("b1")]).type).not.toBe("velgProsjekt");
  });
});

describe("vedByggeplassTrykk + oppdaterBygningMap — lagring på riktig prosjekt-id", () => {
  it("valget lagres på det markerte prosjektet, ikke det aktive", () => {
    const valg = vedByggeplassTrykk(B, "b9");
    expect(valg).toEqual({ prosjektId: B, byggeplassId: "b9" });
    const map = oppdaterBygningMap({ [A]: "a1" }, valg.prosjektId, valg.byggeplassId!);
    expect(map).toEqual({ [A]: "a1", [B]: "b9" });
  });
  it("negativkontroll: aktivt prosjekts valg røres ikke", () => {
    const map = oppdaterBygningMap({ [A]: "a1" }, B, "b9");
    expect(map[A]).toBe("a1");
    expect(map[B]).not.toBe("a1");
  });
  it("null gir byggeplassId null (intet valg)", () => {
    expect(vedByggeplassTrykk(B, null)).toEqual({ prosjektId: B, byggeplassId: null });
  });
  it("oppdaterBygningMap muterer ikke forrige map", () => {
    const prev = { [A]: "a1" };
    oppdaterBygningMap(prev, A, "a2");
    expect(prev).toEqual({ [A]: "a1" });
  });
});

describe("velgByggeplassKilde — offline-kilde", () => {
  const server = [bp("s1")];
  const lokale = [bp("l1"), bp("l2")];
  it("på nett og hentet: server", () => {
    expect(velgByggeplassKilde({ erPaaNettet: true, serverData: server, serverLaster: false, lokale })).toBe(server);
  });
  it("frakoblet: lokal katalog (byggeplass_nav_local)", () => {
    expect(velgByggeplassKilde({ erPaaNettet: false, serverData: server, serverLaster: false, lokale })).toBe(lokale);
  });
  it("frakoblet uten katalog: ukjent — ikke «0 byggeplasser»", () => {
    expect(velgByggeplassKilde({ erPaaNettet: false, serverData: undefined, serverLaster: false, lokale: [] })).toBe(
      "ukjent",
    );
  });
  it("på nett, laster, ingen katalog: laster", () => {
    expect(velgByggeplassKilde({ erPaaNettet: true, serverData: undefined, serverLaster: true, lokale: [] })).toBe(
      "laster",
    );
  });
  it("på nett, laster, katalog finnes: lokal katalog i mellomtiden", () => {
    expect(velgByggeplassKilde({ erPaaNettet: true, serverData: undefined, serverLaster: true, lokale })).toBe(lokale);
  });
  it("server med 0 byggeplasser er en kjent tom liste", () => {
    const kilde = velgByggeplassKilde({ erPaaNettet: true, serverData: [], serverLaster: false, lokale });
    expect(kilde).toEqual([]);
    expect(antallByggeplasser(kilde)).toBe(0);
  });
  it("antall er null når ukjent eller laster", () => {
    expect(antallByggeplasser("ukjent")).toBeNull();
    expect(antallByggeplasser("laster")).toBeNull();
  });
});

describe("erByggeplassAvhuket — åpning: aktiv byggeplass avhuket", () => {
  const basis = { valgtProsjektId: A, valgtBygningId: "a1" };
  it("aktiv byggeplass i aktivt prosjekt er avhuket", () => {
    expect(erByggeplassAvhuket({ ...basis, markertProsjektId: A, byggeplassId: "a1" })).toBe(true);
  });
  it("samme byggeplass-id i et annet markert prosjekt er ikke avhuket", () => {
    expect(erByggeplassAvhuket({ ...basis, markertProsjektId: B, byggeplassId: "a1" })).toBe(false);
  });
  // Negativkontroll (TILLEGG (22)): en rad uten byggeplass huker aldri av, heller ikke uten valg.
  it("negativkontroll: rad uten byggeplass-id er aldri avhuket", () => {
    expect(erByggeplassAvhuket({ ...basis, markertProsjektId: A, byggeplassId: null })).toBe(false);
    expect(erByggeplassAvhuket({ ...basis, valgtBygningId: null, markertProsjektId: A, byggeplassId: null })).toBe(false);
  });
});
