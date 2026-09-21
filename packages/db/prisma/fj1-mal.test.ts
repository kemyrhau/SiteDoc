import { describe, it, expect } from "vitest";
import { FJ1_MAL } from "./seed-bibliotek";

/**
 * FJ1 «Vannhåndtering» — TI felt, NY mal i NS 3420-F (ordre FJ1 2026-09-21, gatet av Kenneth,
 * Runde E). Nytt kapittel FJ «Vannhåndtering», plassert MELLOM FH (5) og FS: FJ=6, FP=7, FS flyttet
 * 6→8. Dekker lensing, drenering av bergoverflate, sedimentering/rensing, kontroll av utslipp og
 * siltskjørt; infiltrasjon, tunnellekkasje, plastavfall, grunnvannsbrønner og injeksjon er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): vannmengde, beredskap og grenseverdier besvares med samsvar
 * (enkeltvalg/trafikklys), målt verdi/sted i kommentaren.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FJ1 ikke bærer de ti feltene.
 *
 * MAL-METODE §7b / ordre §4: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («FJ1 »/«FJ8 » som postkode, «Tabell F», «figur F», «Matrise»,
 * «NS-EN», «NS 3420»). Egne tallkrav er fakta og er tillatt. Standarden nevnes kun i beskrivelsen.
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Egne tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FJ1 |FJ8 |Tabell F|figur F|Matrise|NS-EN|NS 3420/.test(s);
}

describe("FJ1 – 10 felt (ny mal, vannhåndtering)", () => {
  it("er malen for FJ1 i kapittel FJ", () => {
    expect(FJ1_MAL.referanse).toBe("FJ1");
    expect(FJ1_MAL.kapittelKode).toBe("FJ");
    expect(FJ1_MAL.navn).toBe("FJ1 – Vannhåndtering");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(FJ1_MAL.felter).toHaveLength(10);
    expect(FJ1_MAL.felter.map((f) => f.label)).toEqual([
      "Hva håndteres",
      "Krav til utslipp",
      "Utstyret er rigget",
      "Vannmengden dokumenteres",
      "Beredskap utenom arbeidstid",
      "Sedimentering og rensing",
      "Kontroll av utslipp",
      "Siltskjørt",
      "Slam levert til godkjent mottak",
      "Nedrigging og dokumentasjon",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 2 trafikklys, INGEN tallfelt)", () => {
    expect(FJ1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(FJ1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 5, ETTER 2)", () => {
    expect(FJ1_MAL.felter.map((f) => f.fase)).toEqual([
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
    expect(FJ1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FJ1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper egen tekst", () => {
    expect(bærerNormkode("FJ1 c1: lens byggegropen")).toBe(true);
    expect(bærerNormkode("FJ8 c2: siltskjørt")).toBe(true);
    expect(bærerNormkode("iht. Tabell F3")).toBe(true);
    expect(bærerNormkode("se figur F1")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    // Egen tekst uten normkode er tillatt:
    expect(bærerNormkode("Typiske målinger er pH og partikkelinnhold.")).toBe(false);
    expect(bærerNormkode("virke i helger, på helligdager og i ferier")).toBe(false);
  });
});
