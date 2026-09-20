import { describe, it, expect } from "vitest";
import { FH1_MAL } from "./seed-bibliotek";

/**
 * FH1 «Sprengning i dagen» — TOLV felt, omkoding av tidligere «FC1 – Sprengning» (ordre FH1
 * 2026-09-19, gatet av Kenneth). Sprengning hører til FH «Uttak av berg», ikke FC (finnes ikke i
 * normen). Nytt kapittel FH; tomt kildekapittel FC slettes av omkodings-SQL-en.
 *
 * INGEN tallfelt (MAL-METODE §1): endelig flate og profil besvares med toleranseklassen fra
 * beskrivelsen (samsvar), ikke tallfelt. Grenseverdier (vibrasjon/støy/støv) står i beskrivelsen.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis FH1 ikke bærer de tolv feltene.
 *
 * MAL-METODE §7b / ordre §6: SiteDocs egne krav. Testen låser at INGEN hjelpetekst eller alternativ
 * bærer normkode/standard-referanse (FC1, «FH1 » som postkode, «Tabell F», «figur F», «NS-EN»,
 * «NS 3420», «NS 8141», «NS 5815»). Tallkrav (100 mm, 2 %, 0,15/0,5 m, 1,5/2,0 m, 3 år) er FAKTA og
 * tillatt. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
 */

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /FC1|FH1 |Tabell F|figur F|NS-EN|NS 3420|NS 8141|NS 5815/.test(s);
}

describe("FH1 – 12 felt (omkoding av FC1, sprengning i dagen)", () => {
  it("er malen for FH1 i nytt kapittel FH", () => {
    expect(FH1_MAL.referanse).toBe("FH1");
    expect(FH1_MAL.kapittelKode).toBe("FH");
  });

  it("har nøyaktig tolv datafelt i riktig rekkefølge", () => {
    expect(FH1_MAL.felter).toHaveLength(12);
    expect(FH1_MAL.felter.map((f) => f.label)).toEqual([
      "Sprengningsplan og risikovurdering er skriftlige",
      "Salveplan",
      "Varsling, sperring og dekking",
      "Vibrasjonsmåling",
      "Boring i endelig flate",
      "Redusert ladning i endelig flate",
      "Vibrasjon, støy og støv",
      "Skutt ut nok i bunnen",
      "Endelig flate",
      "Avstand fra skjæring til konstruksjon",
      "Udetonert sprengstoff",
      "Salverapport er skriftlig",
    ]);
  });

  it("har korrekte felttyper (9 enkeltvalg, 3 trafikklys, INGEN tallfelt)", () => {
    expect(FH1_MAL.felter.map((f) => f.type)).toEqual([
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
    ]);
    expect(FH1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 4, UNDER 2, ETTER 6)", () => {
    expect(FH1_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
      "ETTER",
      "ETTER",
      "ETTER",
      "ETTER",
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-F:2024)", () => {
    expect(FH1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-F:2024");
  });

  it("§7b/§6: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    FH1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("FC1 c1: les av rystelse")).toBe(true);
    expect(bærerNormkode("iht. Tabell F5")).toBe(true);
    expect(bærerNormkode("grenseverdi NS 8141")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-F")).toBe(true);
    // Våre egne tallkrav er tillatt:
    expect(bærerNormkode("innenfor 100 mm og retning innenfor 2 %")).toBe(false);
    expect(bærerNormkode("enkeltknøler på høyst 0,15 m")).toBe(false);
  });
});
