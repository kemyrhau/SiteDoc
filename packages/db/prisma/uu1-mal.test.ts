import { describe, it, expect } from "vitest";
import { UU1_MAL } from "./seed-bibliotek";

/**
 * UU1 «Prøving av VA-ledninger» — ELLEVE felt, NY mal i NS 3420-U (ordre UU1 2026-09-19, gatet av
 * Kenneth). Nytt kapittel UU «Felles arbeider for utendørs rørledningsanlegg» i standard NS3420-U
 * (opprettet av UM1). Prøving gjøres ofte av andre enn dem som legger — malen står på egne ben og
 * bekrefter selv at ledningen er ferdig før prøving. Dekker tetthets- og trykkprøving,
 * kamerainspeksjon, spyling/desinfisering og deformasjon; energibærere, røntgen av sveis, under vann
 * og innmåling (FS3) er avgrenset ut.
 *
 * INGEN tallfelt (MAL-METODE §1): tetthet, trykk og deformasjon besvares med samsvar (bestått/avvik),
 * tall/verdier føres i rapporten.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis UU1 ikke bærer de elleve feltene.
 *
 * MAL-METODE §7b / ordre §5: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («UU1 » som postkode, «Tabell U», «figur U», «NS-EN», «NS 3420»,
 * «VA/Miljø», «Norsk Vann»). Tallkrav (5 %, 8 %, 3 %, 0,2 l, 4 timer, 30 minutter, 24 timer) er FAKTA
 * og tillatt. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /UU1 |Tabell U|figur U|NS-EN|NS 3420|VA\/Miljø|Norsk Vann/.test(s);
}

describe("UU1 – 11 felt (ny mal, prøving av VA-ledninger)", () => {
  it("er malen for UU1 i kapittel UU", () => {
    expect(UU1_MAL.referanse).toBe("UU1");
    expect(UU1_MAL.kapittelKode).toBe("UU");
    expect(UU1_MAL.navn).toBe("UU1 – Prøving av VA-ledninger");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(UU1_MAL.felter).toHaveLength(11);
    expect(UU1_MAL.felter.map((f) => f.label)).toEqual([
      "Hva prøves",
      "Ledningen er gjenfylt og ferdig",
      "Prøvestrekningen er klargjort",
      "Prøvemedium",
      "Tetthetsprøving",
      "Trykkprøving",
      "Deformasjon",
      "Kamerainspeksjon",
      "Spyling",
      "Desinfisering",
      "Prøverapporten er skrevet og signert",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 3 trafikklys, INGEN tallfelt)", () => {
    expect(UU1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "traffic_light",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(UU1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 5, ETTER 3)", () => {
    expect(UU1_MAL.felter.map((f) => f.fase)).toEqual([
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
    expect(UU1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-U:2019");
  });

  it("§7b/§5: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    UU1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("UU1 c1: prøv med luft")).toBe(true);
    expect(bærerNormkode("iht. Tabell U3")).toBe(true);
    expect(bærerNormkode("se figur U4")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-U")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1610")).toBe(true);
    expect(bærerNormkode("jf. VA/Miljø-blad")).toBe(true);
    expect(bærerNormkode("etter Norsk Vann-rapport")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("plastrør høyst 5 % (8 % ved reduserte krav)")).toBe(false);
    expect(bærerNormkode("betongkum står minst 4 timer før prøving")).toBe(false);
    expect(bærerNormkode("under 0,2 liter per m² innvendig flate")).toBe(false);
  });
});
