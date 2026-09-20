import { describe, it, expect } from "vitest";
import { UP1_MAL } from "./seed-bibliotek";

/**
 * UP1 «Setting av kum i grunnen» — TOLV felt, NY mal i NS 3420-U (ordre UP1 2026-09-20, gatet av
 * Kenneth, Runde C). Nytt kapittel UP «Kummer i grunnen» i standard NS3420-U (fra runde B), plassert
 * FØR UU i normens rekkefølge (UM, UP, UU). Fullfører VA-kjeden: FD2 → UM1 → UP1 → FS3 → UU1. Dekker
 * nedstigningskummer, sandfang og inspeksjonskummer med rammer, justeringsringer, lokk og rister;
 * plasstøpte kummer, pumpestasjoner, overløps-/regulatorkummer, prøving (UU1) og frostsikring er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): plassering, sandvolum, ramme-høyde og lokkhøyde besvares med samsvar
 * (enkeltvalg), målt verdi/sted i kommentaren.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis UP1 ikke bærer de tolv feltene.
 *
 * MAL-METODE §7b / ordre §4: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse («UP1 » som postkode, «Tabell U», «figur U», «NS-EN», «NS 3420»,
 * «NS 3139», «NS 199», «VA/Miljø»). Styrkeklasser (A 15 … F 900) og «T-merket» er produktmerking og
 * er tillatt. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Produktmerking/tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /UP1 |Tabell U|figur U|NS-EN|NS 3420|NS 3139|NS 199|VA\/Miljø/.test(s);
}

describe("UP1 – 12 felt (ny mal, setting av kum i grunnen)", () => {
  it("er malen for UP1 i kapittel UP", () => {
    expect(UP1_MAL.referanse).toBe("UP1");
    expect(UP1_MAL.kapittelKode).toBe("UP");
    expect(UP1_MAL.navn).toBe("UP1 – Setting av kum i grunnen");
  });

  it("har nøyaktig tolv datafelt i riktig rekkefølge", () => {
    expect(UP1_MAL.felter).toHaveLength(12);
    expect(UP1_MAL.felter.map((f) => f.label)).toEqual([
      "Type kum",
      "Kum og deler kontrollert",
      "Grøftebunn og fundament klare",
      "Plassering",
      "Skjøter og gjennomføringer",
      "Renneløp gjennom kummen",
      "Sandvolum og høyde til utløp",
      "Omfylling rundt kummen",
      "Justeringsringer og ramme",
      "Lokk eller rist",
      "Lokkhøyde mot dekket",
      "Kummen er ren, innmålt og klar",
    ]);
  });

  it("har korrekte felttyper (10 enkeltvalg, 2 trafikklys, INGEN tallfelt)", () => {
    expect(UP1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(UP1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 5, ETTER 4)", () => {
    expect(UP1_MAL.felter.map((f) => f.fase)).toEqual([
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
      "ETTER",
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-U:2019)", () => {
    expect(UP1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-U:2019");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    UP1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper produktmerking og våre tallkrav", () => {
    expect(bærerNormkode("UP1 c1: sett kummen")).toBe(true);
    expect(bærerNormkode("iht. Tabell U5")).toBe(true);
    expect(bærerNormkode("se figur U6")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-U")).toBe(true);
    expect(bærerNormkode("lokk iht. NS 3139")).toBe(true);
    expect(bærerNormkode("kum iht. NS 199")).toBe(true);
    expect(bærerNormkode("jf. VA/Miljø-blad")).toBe(true);
    // Produktmerking og egne tallkrav er tillatt (fakta, ikke sitert normtekst):
    expect(bærerNormkode("A 15, B 125, C 250, D 400 eller F 900")).toBe(false);
    expect(bærerNormkode("skal være T-merket")).toBe(false);
    expect(bærerNormkode("Innenfor ±30 mm høyde og ±100 mm side")).toBe(false);
    expect(bærerNormkode("sandvolumet bør ikke være mindre enn 0,8 m³")).toBe(false);
  });
});
