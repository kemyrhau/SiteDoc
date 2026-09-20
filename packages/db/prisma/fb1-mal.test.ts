import { describe, it, expect } from "vitest";
import { FB1_MAL } from "./seed-bibliotek";

/**
 * FB1 «Markrydding og avtaking av vekstjord» — TI felt, NY mal som fyller det tomme kapittelet FB
 * «Markrydding» (ordre FB1 2026-09-20, gatet av Kenneth, Runde C). FB ble tomt etter at FB2 ble
 * omkodet til FD1 (Del F-omkodingen). Dekker det som skjer først på jobben: vegetasjonsrydding,
 * felling, stubbebehandling og avtaking av vekstjord til ranke/depot; rydding under vann, flytting av
 * vegetasjon, transport bort, depotdrift og ugressbehandling er avgrenset ut.
 *
 * INGEN tallfelt (MAL-METODE §1): ryddegrense, masseskille og opplegging besvares med samsvar
 * (enkeltvalg/trafikklys), målt verdi/sted i kommentaren.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FB1 ikke bærer de ti feltene.
 *
 * MAL-METODE §7b / ordre §4: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («FB1 »/«FB2 » som postkode, «Tabell F», «figur F», «NS-EN»,
 * «NS 3420»). Tallkrav (2,0 m, 2 m) er FAKTA og tillatt. Standarden nevnes kun i beskrivelsen.
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FB1 |FB2 |Tabell F|figur F|NS-EN|NS 3420/.test(s);
}

describe("FB1 – 10 felt (ny mal, markrydding og avtaking av vekstjord)", () => {
  it("er malen for FB1 i kapittel FB", () => {
    expect(FB1_MAL.referanse).toBe("FB1");
    expect(FB1_MAL.kapittelKode).toBe("FB");
    expect(FB1_MAL.navn).toBe("FB1 – Markrydding og avtaking av vekstjord");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(FB1_MAL.felter).toHaveLength(10);
    expect(FB1_MAL.felter.map((f) => f.label)).toEqual([
      "Hva ryddes",
      "Fremmede arter",
      "Ryddegrensen er merket",
      "Trær og stubber",
      "Massene holdes adskilt",
      "Vekstjorda tatt av uten innblanding",
      "Opplegging",
      "Behandling av kvist og stubber",
      "Området er ryddet til avtalt grense",
      "Vekstjorddepotet er merket",
    ]);
  });

  it("har korrekte felttyper (7 enkeltvalg, 3 trafikklys, INGEN tallfelt)", () => {
    expect(FB1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
    ]);
    expect(FB1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 5, ETTER 2)", () => {
    expect(FB1_MAL.felter.map((f) => f.fase)).toEqual([
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
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-F:2024)", () => {
    expect(FB1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FB1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FB1 c1: fjern vegetasjon")).toBe(true);
    expect(bærerNormkode("FB2 c2: ta av vekstjord")).toBe(true);
    expect(bærerNormkode("iht. Tabell F1")).toBe(true);
    expect(bærerNormkode("se figur F2")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1610")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("2,0 m utenfor prosjektert skjæringstopp")).toBe(false);
    expect(bærerNormkode("løse hauger eller ranker, høyst 2 m")).toBe(false);
  });
});
