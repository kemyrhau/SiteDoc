import { describe, it, expect } from "vitest";
import { FS3_MAL } from "./seed-bibliotek";

/**
 * FS3 «Legging og gjenfylling i grøft» — ELLEVE felt, omkoding av tidligere «FE1 – Ledningsgrøfter»
 * (ordre FS3 2026-09-19, gatet av Kenneth). Legging og gjenfylling hører til FS3, ikke FE (finnes
 * ikke i normen). Kapittel FS finnes (fra FS2); tomt kildekapittel FE slettes av omkodings-SQL-en.
 * Grøfteløpet er FD2 (graving) → FS3 (legging).
 *
 * INGEN tallfelt (MAL-METODE §1): fundament, sidefylling og gjenfylling besvares med samsvar (kravene
 * i alternativ + hjelpetekst), målt verdi i kommentaren. Ledningsfall og tetthets-/trykkprøving er
 * flyttet ut (Del U).
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FS3 ikke bærer de elleve feltene.
 *
 * MAL-METODE §7b / ordre §6: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse (FE1, «FS3 » som postkode, «Tabell F», «figur F», «NS-EN»,
 * «NS 3420», «NS 3458», «NS 3065»). Tallkrav (±30 mm, 150 mm, 50 mm, 60/100/200 kg, 0,3 m osv.) er
 * FAKTA og tillatt. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FE1|FS3 |Tabell F|figur F|NS-EN|NS 3420|NS 3458|NS 3065/.test(s);
}

describe("FS3 – 11 felt (omkoding av FE1, legging og gjenfylling i grøft)", () => {
  it("er malen for FS3 i kapittel FS", () => {
    expect(FS3_MAL.referanse).toBe("FS3");
    expect(FS3_MAL.kapittelKode).toBe("FS");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(FS3_MAL.felter).toHaveLength(11);
    expect(FS3_MAL.felter.map((f) => f.label)).toEqual([
      "Innhold i grøfta",
      "Grøftebunnen er godkjent",
      "Masser",
      "Fundament",
      "Sidefylling og beskyttelseslag",
      "Komprimering ved ledningen",
      "Innmåling før gjenfylling",
      "Beskyttelse og skille",
      "Markeringsbånd",
      "Gjenfylling",
      "Grøfta er ferdig gjenfylt og klar for overlevering",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 3 trafikklys, INGEN tallfelt)", () => {
    expect(FS3_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(FS3_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 6, ETTER 2)", () => {
    expect(FS3_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
      "UNDER",
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
    expect(FS3_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§6: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FS3_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FE1 c2: mål fall")).toBe(true);
    expect(bærerNormkode("iht. Tabell F7")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("masser iht. NS 3458")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1610")).toBe(true);
    // Våre egne tallkrav er tillatt:
    expect(bærerNormkode("overkant innenfor ±30 mm")).toBe(false);
    expect(bærerNormkode("plastrør 60 kg, over DN 1000: 200 kg")).toBe(false);
  });
});
