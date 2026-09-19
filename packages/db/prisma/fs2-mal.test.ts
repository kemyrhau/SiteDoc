import { describe, it, expect } from "vitest";
import { FS2_MAL } from "./seed-bibliotek";

/**
 * FS2 «Utlegging av masser i lag» — ELLEVE felt, omkoding av tidligere «FD2 – Fylling og
 * komprimering» (ordre FS2 2026-09-19, gatet av Kenneth). Utlegging hører til FS «Utlegging av
 * løsmasser», ikke FD (uttak); omkodingen frigjør samtidig FD2-koden til den nye grøftemalen.
 *
 * INGEN tallfelt (MAL-METODE §1): lagtykkelse, komprimering, høyde og jevnhet besvares med samsvar
 * per kravnivå (enkeltvalg), målt verdi/sted i kommentaren. De gamle desimalfeltene (lagtykkelse cm,
 * komprimeringsgrad %, planhet mm) og «Overflate og drenering» (fall gjelder ikke FS) utgår.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FS2 ikke bærer de elleve feltene.
 * Låser antall, rekkefølge, felttyper og de tre fasene.
 *
 * MAL-METODE §7b / ordre §6: malen fremstår med SiteDocs egne krav. Testen låser at INGEN
 * hjelpetekst eller alternativ bærer normkode/standard-referanse (FD2, «FS1 »/«FS2 » som postkode,
 * «Tabell F», «figur F», «NS-EN», «NS 3420», «NS 3458»). Tallkrav (±100/±20/±15/±10 mm, +150/−0 mm,
 * ±20 %, 2/3) er FAKTA og tillatt. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FD2|FS1 |FS2 |Tabell F|figur F|NS-EN|NS 3420|NS 3458/.test(s);
}

describe("FS2 – 11 felt (omkoding av FD2, utlegging av masser i lag)", () => {
  it("er malen for FS2 i nytt kapittel FS", () => {
    expect(FS2_MAL.referanse).toBe("FS2");
    expect(FS2_MAL.kapittelKode).toBe("FS");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(FS2_MAL.felter).toHaveLength(11);
    expect(FS2_MAL.felter.map((f) => f.label)).toEqual([
      "Type lag",
      "Masser",
      "Underlaget er klart",
      "Lagtykkelse",
      "Komprimering",
      "Kontroll av komprimering",
      "Massene er ikke blandet",
      "Høyde på topp",
      "Jevnhet på 3 m rettholt",
      "Kant på topp og fot",
      "Laget er godkjent før neste lag legges",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 3 trafikklys, INGEN tallfelt)", () => {
    expect(FS2_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(FS2_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 4, ETTER 4)", () => {
    expect(FS2_MAL.felter.map((f) => f.fase)).toEqual([
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
    expect(FS2_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§6: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FS2_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FD2 c1: mål lagtykkelse")).toBe(true);
    expect(bærerNormkode("se FS1 b1")).toBe(true);
    expect(bærerNormkode("iht. Tabell F2")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("komprimering iht. NS 3458")).toBe(true);
    // Våre egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("innenfor ±100 mm")).toBe(false);
    expect(bærerNormkode("maks 2/3 av lagtykkelsen")).toBe(false);
    expect(bærerNormkode("enkeltmålinger kan avvike ±20 %")).toBe(false);
  });
});
