import { describe, it, expect } from "vitest";
import { beregnMalOpprettbarhet } from "./mal";

/**
 * Utilgjengelige maler forklarer seg (2026-09-22): serveren sier HVORFOR en mal ikke er
 * opprettbar, fra SAMME beregning som `opprettbar` — aldri en ny klient-vurdering. Den
 * viktigste testen er den NEGATIVE: en mal brukeren ikke kan opprette skal FORTSATT ikke
 * være opprettbar. Årsaks-teksten er tillegg, ikke tilgang.
 */
describe("beregnMalOpprettbarhet", () => {
  const elektroFlyt = "flyt-elektro";
  const flytFaggruppeNavn = new Map<string, string | null>([[elektroFlyt, "Elektro"]]);

  it("NEGATIV: mal i flyt med eier-faggruppe der brukeren ikke er registrator er IKKE opprettbar, med registrator-årsak", () => {
    const r = beregnMalOpprettbarhet(
      { domain: null, dokumentflytMaler: [{ dokumentflytId: elektroFlyt }] },
      new Set<string>(), // brukeren er registrator i INGEN gyldig flyt
      flytFaggruppeNavn,
    );
    expect(r.opprettbar).toBe(false); // gaten står — dette er selve kravet
    expect(r.opprettbareFlytIder).toEqual([]);
    expect(r.utilgjengeligÅrsak).toEqual({ grunn: "ikkeRegistrator", faggruppe: "Elektro" });
  });

  it("ingen flyt bruker malen → grunn ingenFlyt", () => {
    const r = beregnMalOpprettbarhet(
      { domain: null, dokumentflytMaler: [] },
      new Set<string>(),
      new Map<string, string | null>(),
    );
    expect(r.opprettbar).toBe(false);
    expect(r.utilgjengeligÅrsak).toEqual({ grunn: "ingenFlyt" });
  });

  it("flyt uten eier-faggruppe → grunn ingenFlyt (bestiller kan ikke utledes)", () => {
    const r = beregnMalOpprettbarhet(
      { domain: null, dokumentflytMaler: [{ dokumentflytId: "flyt-uten-fag" }] },
      new Set<string>(),
      new Map<string, string | null>([["flyt-uten-fag", null]]),
    );
    expect(r.opprettbar).toBe(false);
    expect(r.utilgjengeligÅrsak).toEqual({ grunn: "ingenFlyt" });
  });

  it("REGRESJON: mal i brukerens registrator-flyt med eier-faggruppe er opprettbar, uten årsak", () => {
    const r = beregnMalOpprettbarhet(
      { domain: null, dokumentflytMaler: [{ dokumentflytId: elektroFlyt }] },
      new Set<string>([elektroFlyt]),
      flytFaggruppeNavn,
    );
    expect(r.opprettbar).toBe(true);
    expect(r.opprettbareFlytIder).toEqual([elektroFlyt]);
    expect(r.utilgjengeligÅrsak).toBeNull();
  });

  it("HMS-mal er alltid opprettbar (flyt-løs), uten årsak", () => {
    const r = beregnMalOpprettbarhet(
      { domain: "hms", dokumentflytMaler: [] },
      new Set<string>(),
      new Map<string, string | null>(),
    );
    expect(r.opprettbar).toBe(true);
    expect(r.utilgjengeligÅrsak).toBeNull();
  });

  it("flere flyter uten registrator → årsak samler unike faggruppe-navn", () => {
    const r = beregnMalOpprettbarhet(
      { domain: null, dokumentflytMaler: [{ dokumentflytId: "f1" }, { dokumentflytId: "f2" }] },
      new Set<string>(),
      new Map<string, string | null>([
        ["f1", "Elektro"],
        ["f2", "Tømrer"],
      ]),
    );
    expect(r.opprettbar).toBe(false);
    expect(r.utilgjengeligÅrsak).toEqual({ grunn: "ikkeRegistrator", faggruppe: "Elektro, Tømrer" });
  });
});
