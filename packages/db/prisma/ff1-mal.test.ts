import { describe, it, expect } from "vitest";
import { FF1_MAL } from "./seed-bibliotek";

/**
 * FF1 «Avretting» — TI felt, NY mal i NS 3420-F (ordre FF1 2026-09-20, gatet av Kenneth, Runde D).
 * Nytt kapittel FF «Avretting og rensk», plassert MELLOM FD og FH (sortering 4 — ledig, ingen søster
 * må flyttes). Dekker avretting med/uten tilføring og ved fjerning + kontroll av underlaget; under
 * vann, arrondering og rensk av berg er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): høyde, planhet og fall besvares med samsvar (enkeltvalg), målt
 * verdi/sted i kommentaren.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FF1 ikke bærer de ti feltene.
 *
 * MAL-METODE §7b / ordre §4: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («FF1 » som postkode, «Tabell F», «figur F», «NS-EN», «NS 3420»,
 * «NS 3458»). Egne tallkrav (±10 mm, 3 m) er fakta og er tillatt. Standarden nevnes kun i beskrivelsen.
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Egne tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FF1 |Tabell F|figur F|NS-EN|NS 3420|NS 3458/.test(s);
}

describe("FF1 – 10 felt (ny mal, avretting)", () => {
  it("er malen for FF1 i kapittel FF", () => {
    expect(FF1_MAL.referanse).toBe("FF1");
    expect(FF1_MAL.kapittelKode).toBe("FF");
    expect(FF1_MAL.navn).toBe("FF1 – Avretting");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(FF1_MAL.felter).toHaveLength(10);
    expect(FF1_MAL.felter.map((f) => f.label)).toEqual([
      "Hva avrettes",
      "Underlaget kontrollert",
      "Metode",
      "Masser til avretting",
      "Overskuddsmasser fjernet",
      "Etterkomprimering",
      "Høyde",
      "Planhet",
      "Fall og avrenning",
      "Flaten er godkjent for neste lag",
    ]);
  });

  it("har korrekte felttyper (8 enkeltvalg, 2 trafikklys, INGEN tallfelt)", () => {
    expect(FF1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(FF1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 3, ETTER 4)", () => {
    expect(FF1_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
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
    expect(FF1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FF1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper egne tallkrav", () => {
    expect(bærerNormkode("FF1 c1: avrett flaten")).toBe(true);
    expect(bærerNormkode("iht. Tabell F3")).toBe(true);
    expect(bærerNormkode("se figur F1")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("krav i NS 3458")).toBe(true);
    // Egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("±10 mm, ±20 mm eller ±50 mm")).toBe(false);
    expect(bærerNormkode("to punkter som ligger 3 m fra hverandre")).toBe(false);
  });
});
