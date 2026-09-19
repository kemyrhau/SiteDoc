import { describe, it, expect } from "vitest";
import { FD2_MAL } from "./seed-bibliotek";

/**
 * FD2 «Graving av grøft» — TOLV felt, NY mal i eksisterende kapittel FD «Uttak av løsmasser»
 * (ordre FD2 2026-09-19, gatet av Kenneth). Ingen omkoding — FD2-koden ble frigjort da FS2 omkodet
 * den gamle «FD2 – Fylling». Dekker rør-, kabel- og fundamentgrøft + åpne grøfter + grøftekasse;
 * legging/gjenfylling (FS3), spunt, under vann og sprengning er avgrenset ut.
 *
 * INGEN tallfelt (MAL-METODE §1): bunn- og sideavvik besvares med samsvar mot toleransen (enkeltvalg),
 * målt verdi/sted i kommentaren — toleransene per grøftetype ligger i hjelpeteksten, ikke som felt.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FD2 ikke bærer de tolv feltene.
 *
 * MAL-METODE §7b / ordre §5: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse (FD2 som postkode, «Tabell F», «figur F», «NS-EN», «NS 3420»,
 * «NS 3070»). Tallkrav (±50/±100/±150/±200 mm, 0,5 m) er FAKTA og tillatt. Standarden nevnes kun i
 * beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FD2 |Tabell F|figur F|NS-EN|NS 3420|NS 3070/.test(s);
}

describe("FD2 – 12 felt (ny mal, graving av grøft)", () => {
  it("er malen for FD2 i kapittel FD", () => {
    expect(FD2_MAL.referanse).toBe("FD2");
    expect(FD2_MAL.kapittelKode).toBe("FD");
  });

  it("har nøyaktig tolv datafelt i riktig rekkefølge", () => {
    expect(FD2_MAL.felter).toHaveLength(12);
    expect(FD2_MAL.felter.map((f) => f.label)).toEqual([
      "Type grøft",
      "Kabler og ledninger påvist",
      "Grøft i fylling",
      "Utstikking etter tegning",
      "Skråning og avstiving",
      "Vannhåndtering",
      "Avdekkede ledninger og kabler",
      "Grøftebredden er ikke større enn nødvendig",
      "Bunnhøyde",
      "Sideavvik",
      "Bunnen er ren og klar for ledning eller fundament",
      "Grøften er sikret",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 4 trafikklys, INGEN tallfelt)", () => {
    expect(FD2_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
    ]);
    expect(FD2_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 4, UNDER 4, ETTER 4)", () => {
    expect(FD2_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
      "ETTER",
      "ETTER",
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-F:2024)", () => {
    expect(FD2_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§5: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FD2_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FD2 c1: mål avvik")).toBe(true);
    expect(bærerNormkode("iht. Tabell F3")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("rør iht. NS 3070")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1610")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("rørgrøft i jord ±50 mm")).toBe(false);
    expect(bærerNormkode("minst 0,5 m over øverste ledning")).toBe(false);
  });
});
