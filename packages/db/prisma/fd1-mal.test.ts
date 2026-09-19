import { describe, it, expect } from "vitest";
import { FD1_MAL } from "./seed-bibliotek";

/**
 * FD1 «Graving av byggegrop» — ELLEVE felt, omkoding av tidligere «FB2 – Graving» (ordre FD1
 * 2026-09-19, gatet av Kenneth). Graving hører til FD (uttak av løsmasser), ikke FB (markrydding);
 * FB2-koden fantes ikke i normen. Grøft er skilt ut til egen mal (FD2 grøft, senere ordre).
 *
 * INGEN tallfelt (MAL-METODE §1): bunn- og sideavvik besvares med samsvar mot toleransen
 * (enkeltvalg per kravnivå), målt verdi/sted i kommentaren — aldri en grense som blokkerer
 * registrering av avvik. Det gamle desimalfeltet «Avvik fra prosjektert profil (mm)» utgår.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FD1 ikke bærer de elleve feltene.
 * Låser antall, rekkefølge, felttyper og de tre fasene.
 *
 * MAL-METODE §7b / ordre §6: malen fremstår med SiteDocs egne krav, ikke som standarden. Testen
 * låser at INGEN hjelpetekst eller alternativ bærer tabell-/punktkoder eller standard-referanser
 * (FB2, «FD1 »/«FD3 » som postkode, «Tabell F», «figur F», «NS-EN», «NS 3420»). Tallkrav (±100 mm,
 * ±150 mm, 1,0/1,5 m) er FAKTA og tillatt — de er våre egne krav, ikke sitert normtekst (§7b).
 * Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FB2|FD1 |FD3 |Tabell F|figur F|NS-EN|NS 3420/.test(s);
}

describe("FD1 – 11 felt (omkoding av FB2, graving av byggegrop)", () => {
  it("er malen for FD1 i kapittel FD", () => {
    expect(FD1_MAL.referanse).toBe("FD1");
    expect(FD1_MAL.kapittelKode).toBe("FD");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(FD1_MAL.felter).toHaveLength(11);
    expect(FD1_MAL.felter.map((f) => f.label)).toEqual([
      "Kabler og ledninger påvist",
      "Grunnforhold",
      "Utstikking etter tegning",
      "Skråning og sikring",
      "Vannhåndtering",
      "Masser holdt adskilt",
      "Eksisterende anlegg og trær som skal stå, er ikke skadet",
      "Bunnhøyde",
      "Sideavvik",
      "Avstand fra skråning til fundament",
      "Bunnen er ren, ikke omrørt og klar for neste arbeid",
    ]);
  });

  it("har korrekte felttyper (7 enkeltvalg, 4 trafikklys, INGEN tallfelt)", () => {
    expect(FD1_MAL.felter.map((f) => f.type)).toEqual([
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
    // Ingen tallfelt: avvik besvares med samsvar, målt verdi i kommentaren (§1).
    expect(FD1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 4, ETTER 4)", () => {
    expect(FD1_MAL.felter.map((f) => f.fase)).toEqual([
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
    expect(FD1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§6: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FD1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FB2 c4: mål avvik")).toBe(true);
    expect(bærerNormkode("se FD3 b1")).toBe(true);
    expect(bærerNormkode("iht. Tabell F1")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("iht. NS-EN 1997")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("Tillatt avvik er ±100 mm")).toBe(false);
    expect(bærerNormkode("minst 1,0 m fra fundamentkanten")).toBe(false);
  });
});
