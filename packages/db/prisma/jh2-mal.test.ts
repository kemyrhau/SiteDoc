import { describe, it, expect } from "vitest";
import { JH2_MAL } from "./seed-bibliotek";

/**
 * JH2 «Asfaltdekke» — ELLEVE felt, NY mal i en FJERDE standard NS 3420-J:2008 (ordre JH2 2026-09-20,
 * gatet av Kenneth, Runde D). Nytt kapittel JH «Asfaltdekker». Dekker varmprodusert asfaltdekke med
 * behandling av underlaget og avstrøing; kaldasfalt, bitumen-/sementbærelag, oppmerking, humper,
 * kanter, kunstgress/kunststoff og flyplass er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): alt besvares med samsvar (enkeltvalg/trafikklys), verdi i kommentaren.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis JH2 ikke bærer de elleve feltene.
 *
 * MAL-METODE §7b + §7c: SiteDocs egne krav. NS-standardene (bak betaling) navngis IKKE — testen låser
 * at ingen hjelpetekst/alternativ bærer «JH2 »/«JH1 » (postkode), «Matrise», «NS-EN», «NS 3420» eller
 * «NS 3458». §7c-UNNTAK (Kenneth 2026-09-20): vegvesenets håndbok N200 er gratis og fritt nedlastbar,
 * og KAN navngis (felt 10) — «N200»/«håndbok» er derfor IKKE i vakten. Asfalttyper (Ab, Ska, Ma …) er
 * produktbetegnelser og er tillatt. Standarden nevnes ellers kun i beskrivelsen.
 */

/** §7b/§7c-vakt: bærer teksten en normkode/betalt-standard-referanse? (N200/håndbok + produkt tillatt.) */
function bærerNormkode(s: string): boolean {
  return /JH2 |JH1 |Matrise|NS-EN|NS 3420|NS 3458/.test(s);
}

describe("JH2 – 11 felt (ny mal, asfaltdekke, ny standard NS 3420-J)", () => {
  it("er malen for JH2 i kapittel JH", () => {
    expect(JH2_MAL.referanse).toBe("JH2");
    expect(JH2_MAL.kapittelKode).toBe("JH");
    expect(JH2_MAL.navn).toBe("JH2 – Asfaltdekke");
  });

  it("har nøyaktig elleve datafelt i riktig rekkefølge", () => {
    expect(JH2_MAL.felter).toHaveLength(11);
    expect(JH2_MAL.felter.map((f) => f.label)).toEqual([
      "Type lag",
      "Underlaget rengjort",
      "Klebing",
      "Vær og underlag",
      "Masse og temperatur",
      "Komprimering fullført i tide",
      "Skjøter og kanter",
      "Trafikk på klebet flate",
      "Overflaten",
      "Jevnhet og høyde",
      "Ferdig dekke godkjent og dokumentert",
    ]);
  });

  it("har korrekte felttyper (10 enkeltvalg, 1 trafikklys, INGEN tallfelt)", () => {
    expect(JH2_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
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
    expect(JH2_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 4, UNDER 4, ETTER 3)", () => {
    expect(JH2_MAL.felter.map((f) => f.fase)).toEqual([
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
    ]);
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-J:2008)", () => {
    expect(JH2_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-J:2008");
  });

  it("§7c: håndbok N200 er navngitt i felt 10 (gratis, fritt nedlastbar)", () => {
    const jevnhet = JH2_MAL.felter.find((f) => f.label === "Jevnhet og høyde");
    expect((jevnhet?.config?.helpText as string | undefined) ?? "").toContain("N200");
  });

  it("§7b/§4: ingen hjelpetekst eller alternativ bærer normkode eller betalt-standard-referanse", () => {
    JH2_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b/§7c-vakten er skarp: fanger betalte normkoder, slipper N200/håndbok + produktbetegnelser", () => {
    expect(bærerNormkode("JH2 c1: legg dekket")).toBe(true);
    expect(bærerNormkode("JH1 klebing")).toBe(true);
    expect(bærerNormkode("iht. Matrise J1")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-J")).toBe(true);
    expect(bærerNormkode("krav i NS 3458")).toBe(true);
    expect(bærerNormkode("NS-EN 13108")).toBe(true);
    // §7c: N200/håndbok er gratis og fritt nedlastbar → tillatt. Produktbetegnelser er fakta.
    expect(bærerNormkode("vegvesenets håndbok N200")).toBe(false);
    expect(bærerNormkode("asfalttype Ab, Ska eller Ma")).toBe(false);
    expect(bærerNormkode("+100 / −0 mm")).toBe(false);
  });
});
