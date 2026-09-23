import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { JH2_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * JH2 «Asfaltdekke» v2 — TOLV felt, PILOTEN på betingede felt (forelder/barn) i bibliotekmaler
 * (ordre JH2 v2 2026-09-21, gatet av Kenneth). NY standard NS 3420-J:2008, kapittel JH «Asfaltdekker».
 * Dekker varmprodusert asfaltdekke med behandling av underlaget og avstrøing; kaldasfalt,
 * bitumen-/sementbærelag, oppmerking, humper, kanter, kunstgress/kunststoff og flyplass er ute.
 *
 * INGEN tallfelt (MAL-METODE §1): alt besvares med samsvar (enkeltvalg/trafikklys), verdi i kommentaren.
 *
 * TRE (§3, MAL-METODE §1c): felt 3 «Underlaget består av» er forelder for felt 4 (ubundet) og felt 5
 * (bundet/gammelt); felt 5 er igjen forelder for felt 6 (trafikk på klebet flate). Ni felt vises alltid
 * (1, 2, 3, 7, 8, 9, 10, 11, 12); 4/5 vises etter svaret i felt 3, og 6 bare når det er klebet. Testen
 * LÅSER treet: hvilke felt som er barn, av hvem, og hvilke svar som utløser dem (krav (c) «stille
 * tomhet forbudt» — en kobling kan ikke endres stille).
 *
 * MAL-METODE §7b + §7c: SiteDocs egne krav. De betalte NS-standardene navngis IKKE — testen låser at
 * ingen hjelpetekst/alternativ bærer «JH2 »/«JH1 » (postkode), «Matrise», «NS-EN», «NS 3420» eller
 * «NS 3458». §7c-UNNTAK (Kenneth 2026-09-20): vegvesenets håndbok N200 er gratis og fritt nedlastbar,
 * og KAN navngis (felt 4, 11) — «N200»/«håndbok» er derfor IKKE i vakten. Asfalttyper (Ab, Ska, Ma,
 * Agb, Ag …) er produktbetegnelser og er tillatt. Standarden nevnes ellers kun i beskrivelsen.
 */

// Utløser-strengene MÅ matche alternativene ordrett — treet brytes stille hvis de drifter.
const UBUNDET = "Ubundet lag: grus, forkilt pukk eller knust fjell";
const BUNDET = "Bundet lag: asfaltert grus (Ag), asfaltgrusbetong (Agb) eller annet bitumenstabilisert lag";
const GAMMELT = "Gammelt asfaltdekke";
const KLEBET = "Rengjort og klebet – virksom over hele flaten";

const felt = (label: string): FeltDef => {
  const f = JH2_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke felt «${label}»`);
  return f;
};

/** §7b/§7c-vakt: bærer teksten en normkode/betalt-standard-referanse? (N200/håndbok + produkt tillatt.) */
function bærerNormkode(s: string): boolean {
  return /JH2 |JH1 |Matrise|NS-EN|NS 3420|NS 3458/.test(s);
}

describe("JH2 v2 – 12 felt (pilot betingede felt, ny standard NS 3420-J)", () => {
  it("er malen for JH2 i kapittel JH", () => {
    expect(JH2_MAL.referanse).toBe("JH2");
    expect(JH2_MAL.kapittelKode).toBe("JH");
    expect(JH2_MAL.navn).toBe("JH2 – Asfaltdekke");
  });

  it("har nøyaktig tolv datafelt i riktig rekkefølge", () => {
    expect(JH2_MAL.felter).toHaveLength(12);
    expect(JH2_MAL.felter.map((f) => f.label)).toEqual([
      "Type lag",
      "Asfalttype",
      "Underlaget består av",
      "Planhet og komprimering på underlaget",
      "Rengjøring og klebing",
      "Trafikk på klebet flate",
      "Vær og underlag",
      "Masse og temperatur",
      "Komprimering fullført i tide",
      "Skjøter, kanter og overflate",
      "Jevnhet og høyde",
      "Ferdig dekke godkjent og dokumentert",
    ]);
  });

  it("har korrekte felttyper (11 enkeltvalg, 1 trafikklys, INGEN tallfelt)", () => {
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
      "list_single",
      "traffic_light",
    ]);
    expect(JH2_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 7, UNDER 2, ETTER 3)", () => {
    expect(JH2_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "FØR",
      "UNDER",
      "UNDER",
      "ETTER",
      "ETTER",
      "ETTER",
    ]);
  });

  describe("treet (§3) — hvilke felt er barn, av hvem, utløst av hvilke svar", () => {
    it("felt 3 «Underlaget består av» er forelder (conditionActive, ref=underlag, ikke barn)", () => {
      const f3 = felt("Underlaget består av");
      expect(f3.config?.conditionActive).toBe(true);
      expect(f3.ref).toBe("underlag");
      expect(f3.parentRef).toBeUndefined();
    });

    it("felt 4 «Planhet og komprimering» er barn av underlag, vises kun ved ubundet lag", () => {
      const f4 = felt("Planhet og komprimering på underlaget");
      expect(f4.parentRef).toBe("underlag");
      expect(f4.config?.[BETINGELSE_EGEN_NOKKEL]).toEqual([UBUNDET]);
    });

    it("felt 5 «Rengjøring og klebing» er barn av underlag (bundet/gammelt) OG forelder for felt 6", () => {
      const f5 = felt("Rengjøring og klebing");
      expect(f5.parentRef).toBe("underlag");
      expect(f5.config?.[BETINGELSE_EGEN_NOKKEL]).toEqual([BUNDET, GAMMELT]);
      // Nesting: felt 5 er selv forelder.
      expect(f5.ref).toBe("klebing");
      expect(f5.config?.conditionActive).toBe(true);
    });

    it("felt 6 «Trafikk på klebet flate» er barn av klebing, vises kun når det er klebet", () => {
      const f6 = felt("Trafikk på klebet flate");
      expect(f6.parentRef).toBe("klebing");
      expect(f6.config?.[BETINGELSE_EGEN_NOKKEL]).toEqual([KLEBET]);
    });

    it("de ni alltid-synlige feltene har verken parentRef eller conditionActive", () => {
      const alltid = [
        "Type lag",
        "Asfalttype",
        "Vær og underlag",
        "Masse og temperatur",
        "Komprimering fullført i tide",
        "Skjøter, kanter og overflate",
        "Jevnhet og høyde",
        "Ferdig dekke godkjent og dokumentert",
      ];
      alltid.forEach((label) => {
        const f = felt(label);
        expect(f.parentRef, `«${label}» skal ikke være barn`).toBeUndefined();
        expect(f.config?.conditionActive, `«${label}» skal ikke være forelder`).toBeUndefined();
      });
      // Nøyaktig tre betingede barn + felt 3 som forelder (felt 5 er begge deler).
      expect(JH2_MAL.felter.filter((f) => f.parentRef).map((f) => f.label)).toEqual([
        "Planhet og komprimering på underlaget",
        "Rengjøring og klebing",
        "Trafikk på klebet flate",
      ]);
    });

    it("🔴 utløseren ligger på conditionOwnValues, ALDRI conditionValues på et barn", () => {
      expect(BETINGELSE_EGEN_NOKKEL).toBe("conditionOwnValues");
      JH2_MAL.felter
        .filter((f) => f.parentRef)
        .forEach((barn) => {
          expect(barn.config, `«${barn.label}» skal ikke ha conditionValues`).not.toHaveProperty(
            "conditionValues",
          );
          expect(barn.config?.[BETINGELSE_EGEN_NOKKEL]).toBeDefined();
        });
    });

    it("utløser-strengene finnes ordrett som alternativer på forelderen", () => {
      const f3opts = (felt("Underlaget består av").config?.options as string[]) ?? [];
      expect(f3opts).toContain(UBUNDET);
      expect(f3opts).toContain(BUNDET);
      expect(f3opts).toContain(GAMMELT);
      const f5opts = (felt("Rengjøring og klebing").config?.options as string[]) ?? [];
      expect(f5opts).toContain(KLEBET);
    });
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-J:2008)", () => {
    expect(JH2_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-J:2008");
  });

  it("§7c: håndbok N200 er navngitt i felt 4 og 11 (gratis, fritt nedlastbar)", () => {
    expect((felt("Planhet og komprimering på underlaget").config?.helpText as string) ?? "").toContain("N200");
    expect((felt("Jevnhet og høyde").config?.helpText as string) ?? "").toContain("N200");
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
