/**
 * Runde 2 timer («Annet sted», Kenneth 2026-11-26: «hva om jeg sendes til bergen på kurs» → «1. ja»):
 * reise fra oppmøtestedet til et sted arbeideren skriver selv. Ingen byggeplass, ingen
 * kjøretidstabell — arbeideren fører tiden selv. Stedet lagres i `reiseRegel.annetSted`.
 */
import { describe, expect, it } from "vitest";
import { annetStedTekst, løsAnnetStedKort } from "./reiseManuell";
import type { ReiseRegelsett } from "./reise";

const REGEL: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};
const basis = {
  fraOppmotestedId: "tromso",
  sted: "Bergen",
  regel: REGEL,
  grensepunkter: [],
  resolverLonnsartId: "lr",
  standardLonnsartId: "l1",
};

describe("VAKTTEST 2026-11-26 (Kenneth: «alt fungerer såvidt jeg kan se», runde 2) — løsAnnetStedKort", () => {
  it("uten tider: ingen forslag fra dagens arbeid, ingen sperre, ingen kjøretid", () => {
    const r = løsAnnetStedKort(basis);
    expect(r).toMatchObject({ fraTid: null, tilTid: null, timer: 0, sperre: null, kjoretidMin: null, spor: null });
  });

  it("arbeiderens tider: reisetid over terskel, retning ut fra oppmøtestedet, stedet i sporet", () => {
    const r = løsAnnetStedKort({ ...basis, startTid: "06:00", sluttTid: "09:30" });
    expect(r).toMatchObject({ fraTid: "06:00", tilTid: "09:30", timer: 3.5, sperre: null });
    expect(r.spor).toMatchObject({ erReise: true, reiseKilde: "manuell", reiseRetning: "ut", reiseOppmotestedId: "tromso", reiseKjoretidMin: null });
    expect(r.spor!.reiseRegel.annetSted).toEqual({ sted: "Bergen" });
    expect(r.klassifisering?.lonnsartId).toBe("lr");
  });

  it("uten oppmøtested (O22): fører likevel, uten oppmøtested i sporet", () => {
    const r = løsAnnetStedKort({ ...basis, fraOppmotestedId: null, startTid: "06:00", sluttTid: "09:30" });
    expect(r.spor).toMatchObject({ erReise: true, reiseOppmotestedId: null });
    expect(r.spor!.reiseRegel.annetSted).toEqual({ sted: "Bergen" });
  });

  it("O19: Slutt før Start med deling → reisen slutter dagen etter", () => {
    const r = løsAnnetStedKort({ ...basis, startTid: "22:00", sluttTid: "02:00", tillatDeling: { omvendt: "fram" } });
    expect(r).toMatchObject({ fraTid: "22:00", tilTid: "02:00", timer: 4, deles: "fram" });
  });

  it("tomt sted gir intet sted i sporet (kalleren sperrer Lagre)", () => {
    const r = løsAnnetStedKort({ ...basis, sted: "  ", startTid: "06:00", sluttTid: "09:30" });
    expect(r.spor!.reiseRegel.annetSted).toBeUndefined();
  });
});

describe("VAKTTEST 2026-11-26 (Kenneth: «alt fungerer såvidt jeg kan se», runde 2) — annetStedTekst", () => {
  it("leser stedet; alt annet gir null", () => {
    expect(annetStedTekst({ annetSted: { sted: " Bergen " } })).toBe("Bergen");
    expect(annetStedTekst({ annetSted: { sted: "" } })).toBeNull();
    expect(annetStedTekst({ overforing: {} })).toBeNull();
    expect(annetStedTekst(null)).toBeNull();
    expect(annetStedTekst("Bergen")).toBeNull();
  });
});
