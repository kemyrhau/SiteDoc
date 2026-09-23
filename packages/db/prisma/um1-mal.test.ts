import { describe, it, expect } from "vitest";
import { UM1_MAL } from "./seed-bibliotek";

/**
 * UM1 «Legging av VA-ledninger» — ELLEVE felt, NY mal fra NY standard NS 3420-U (ordre UM1
 * 2026-09-19, gatet av Kenneth). Nytt kapittel UM «Utendørs rørledninger» i en tredje standard
 * NS3420-U — verken standarden eller kapittelet finnes i biblioteket i dag. Dekker legging og
 * skjøting av vann-, avløps- og drensledninger i grøft; prøving (UU1), kummer, ventiler, omfylling
 * (FS3) og innmåling er avgrenset ut.
 *
 * INGEN tallfelt (MAL-METODE §1): plassering, fall og avstand besvares med samsvar mot toleransen
 * (enkeltvalg), målt verdi/sted i kommentaren — toleransene ligger i hjelpeteksten, ikke som felt.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis UM1 ikke bærer de elleve feltene.
 *
 * MAL-METODE §7b / ordre §6: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («UM1 » som postkode, «Tabell U», «figur U», «NS-EN», «NS 3420»,
 * «CEN/TR», «VA/Miljø»). Tallkrav (100 mm, ±30 mm, ±100 mm, 10 %, 2/3/5 ‰) er FAKTA og tillatt.
 * Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /UM1 |Tabell U|figur U|NS-EN|NS 3420|CEN\/TR|VA\/Miljø/.test(s);
}

describe("UM1 – 11 felt (ny mal, legging av VA-ledninger)", () => {
  it("er malen for UM1 i kapittel UM", () => {
    expect(UM1_MAL.referanse).toBe("UM1");
    expect(UM1_MAL.kapittelKode).toBe("UM");
    expect(UM1_MAL.navn).toBe("UM1 – Legging av VA-ledninger");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(UM1_MAL.felter).toHaveLength(11);
    expect(UM1_MAL.felter.map((f) => f.label)).toEqual([
      "Type ledning",
      "Rør og deler kontrollert",
      "Grøftebunn og fundament klare",
      "Skjøting",
      "Sveiselogg for PE",
      "Røret hviler på fundamentet, ingen skolinger",
      "Ledningen holdt ren innvendig",
      "Avstand til kum og andre ledninger",
      "Plassering i høyde og side",
      "Fall",
      "Ledningen er klar for omfylling",
    ]);
  });

  it("har korrekte felttyper (7 enkeltvalg, 4 trafikklys, INGEN tallfelt)", () => {
    expect(UM1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(UM1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 5, ETTER 3)", () => {
    expect(UM1_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "UNDER",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
      "ETTER",
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-U:2019)", () => {
    expect(UM1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-U:2019");
  });

  it("§7b/§6: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    UM1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("UM1 c1: sentrer røret")).toBe(true);
    expect(bærerNormkode("iht. Tabell U1")).toBe(true);
    expect(bærerNormkode("se figur U2")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-U")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1610")).toBe(true);
    expect(bærerNormkode("jf. VA/Miljø-blad")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("Minst 100 mm fra kumvegg")).toBe(false);
    expect(bærerNormkode("Innenfor ±30 mm høyde og ±100 mm side")).toBe(false);
    expect(bærerNormkode("±2 ‰ når fallet er under 10 ‰")).toBe(false);
  });
});
