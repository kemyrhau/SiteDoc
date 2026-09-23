import { describe, it, expect } from "vitest";
import { FP1_MAL } from "./seed-bibliotek";

/**
 * FP1 «Sikring av berg» — ELLEVE felt, NY mal i NS 3420-F (ordre FP1 2026-09-21, gatet av Kenneth,
 * Runde E). Nytt kapittel FP «Sikring av berg og løsmasser», plassert ETTER FJ (6) og før FS: FP=7.
 * Hører sammen med sprengningsmalen FH1. Dekker rensk, sikringsbolter og bånd/nett; klatrelag,
 * løsmassesikring, fanggjerder, sprøytebetong og injeksjon er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): prøvetrekking og kontroll besvares med samsvar (enkeltvalg/
 * trafikklys), målte verdier i kommentaren/vedlegg.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FP1 ikke bærer de elleve feltene.
 *
 * MAL-METODE §7b / ordre §4: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («FP1 » som postkode, «Tabell F», «figur F», «Matrise», «NS-EN»,
 * «NS 3420», «NS 3576», «NFF»). «B20» er en materialbetegnelse og er tillatt (ordre §4). Egne
 * tallkrav er fakta og er tillatt. Standarden nevnes kun i beskrivelsen.
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? («B20» og egne tallkrav tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FP1 |Tabell F|figur F|Matrise|NS-EN|NS 3420|NS 3576|NFF/.test(s);
}

describe("FP1 – 11 felt (ny mal, sikring av berg)", () => {
  it("er malen for FP1 i kapittel FP", () => {
    expect(FP1_MAL.referanse).toBe("FP1");
    expect(FP1_MAL.kapittelKode).toBe("FP");
    expect(FP1_MAL.navn).toBe("FP1 – Sikring av berg");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(FP1_MAL.felter).toHaveLength(11);
    expect(FP1_MAL.felter.map((f) => f.label)).toEqual([
      "Type sikring",
      "Sikringsplanen foreligger",
      "Materiell kontrollert",
      "Rensk før sikring",
      "Borhull",
      "Innstøping og forankring",
      "Bånd og nett",
      "Prøvetrekking av endeforankrede bolter",
      "Visuell kontroll av fullt innstøpte bolter",
      "Dokumentasjon",
      "Sikringen er godkjent og området frigitt",
    ]);
  });

  it("har korrekte felttyper (7 enkeltvalg, 4 trafikklys, INGEN tallfelt)", () => {
    expect(FP1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
    ]);
    expect(FP1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 4, ETTER 4)", () => {
    expect(FP1_MAL.felter.map((f) => f.fase)).toEqual([
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
    expect(FP1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FP1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper «B20» og egne tallkrav", () => {
    expect(bærerNormkode("FP1 c3: sett bolter")).toBe(true);
    expect(bærerNormkode("iht. Tabell F5")).toBe(true);
    expect(bærerNormkode("se figur F2")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    expect(bærerNormkode("krav i NS 3576")).toBe(true);
    expect(bærerNormkode("NFF sin håndbok")).toBe(true);
    // Tillatt (materialbetegnelse + egne tallkrav):
    expect(bærerNormkode("minst fasthetsklasse B20 med ekspanderende tilsetning")).toBe(false);
    expect(bærerNormkode("minst 10 mm større enn bolten, tiltrukket 50 kN")).toBe(false);
  });
});
