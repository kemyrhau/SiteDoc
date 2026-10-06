import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UM1_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UM1 «Legging av VA-ledninger» — REVIDERT til v2 med betingede felt (ordre UM1 v2 2026-09-22,
 * gatet av Kenneth). Standard NS 3420-U:2019, kapittel UM. 14 felt, INGEN tallfelt (MAL-METODE §1).
 *
 * TO UAVHENGIGE TRÆR (ordre §2):
 *  · «ledningstype» (felt 1, FØR) — barn: fall (ETTER), filterlag/duk (UNDER), perforering (UNDER),
 *    forankring (UNDER). Kryss-fase → `barnAv` (§1f).
 *  · «skjoting» (felt 8, UNDER) — barn: sveiseskjøt-dokumentasjon (UNDER). Samme fase → `forgrening`.
 *
 * Ni felt vises alltid, fem er betingede. §1c: «sveist» er et SVAR på forankring, ikke en skjult sti.
 * §7b: SiteDocs egne krav — ingen normkode/standard-referanse i hjelpetekst eller alternativ; tallkrav
 * (100 mm, ±30 mm, ±100 mm, 10 %, 2/3/5 ‰, 15°) er fakta og tillatt. Standarden kun i beskrivelsen.
 */

const felt = (label: string): FeltDef => {
  const f = UM1_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];

/** §7b-vakt: bærer teksten en normkode eller standard-referanse? (Tallkrav er tillatt.) */
function bærerNormkode(s: string): boolean {
  return /UM1 |Tabell U|figur U|Matrise|NS-EN|NS 3420|CEN\/TR|VA\/Miljø/.test(s);
}

describe("UM1 v2 – legging av VA-ledninger, to trær", () => {
  it("er malen for UM1 i kapittel UM", () => {
    expect(UM1_MAL.referanse).toBe("UM1");
    expect(UM1_MAL.kapittelKode).toBe("UM");
    expect(UM1_MAL.navn).toBe("UM1 – Legging av VA-ledninger");
  });

  it("har 14 felt; 9 alltid synlige, 5 betingede", () => {
    expect(UM1_MAL.felter).toHaveLength(14);
    const alltid = UM1_MAL.felter.filter((f) => !f.parentRef);
    const betinget = UM1_MAL.felter.filter((f) => f.parentRef);
    expect(alltid).toHaveLength(9);
    expect(betinget).toHaveLength(5);
  });

  it("felt-rekkefølge etter faseSortert (FØR 3, UNDER 8, ETTER 3)", () => {
    expect(UM1_MAL.felter.map((f) => f.label)).toEqual([
      "Type ledning",
      "Rør og deler kontrollert",
      "Grøftebunn og fundament klare",
      "Filterlag og duk rundt ledningen",
      "Perforeringen vendt opp",
      "Forankring av bend",
      "Skjøting",
      "Sveiseskjøter dokumentert",
      "Røret hviler på fundamentet, ingen skolinger",
      "Ledningen holdt ren innvendig",
      "Avstand til kum og andre ledninger",
      "Fall",
      "Plassering i høyde og side",
      "Ledningen er klar for omfylling",
    ]);
    expect(UM1_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR", "FØR", "FØR",
      "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER",
      "ETTER", "ETTER", "ETTER",
    ]);
  });

  it("INGEN tallfelt (§1)", () => {
    expect(UM1_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("to uavhengige foreldre: ledningstype (FØR) og skjoting (UNDER), ulike ref", () => {
    expect(felt("Type ledning").ref).toBe("ledningstype");
    expect(felt("Type ledning").config?.conditionActive).toBe(true);
    expect(felt("Type ledning").fase).toBe("FØR");
    expect(felt("Skjøting").ref).toBe("skjoting");
    expect(felt("Skjøting").config?.conditionActive).toBe(true);
    expect(felt("Skjøting").fase).toBe("UNDER");
  });

  it("tre 1 «ledningstype»: fall har TO utløsere, drensledning har TO barn, forankring har TO utløsere", () => {
    // Fall — to utløsere (selvfall + drensledning), i ETTER (kryss-fase mot forelder i FØR)
    expect(felt("Fall").parentRef).toBe("ledningstype");
    expect(felt("Fall").fase).toBe("ETTER");
    expect(eget(felt("Fall"))).toEqual(["Avløp, selvfall", "Drensledning"]);
    // Drensledning — to barn (filterlag + perforering), begge UNDER
    for (const l of ["Filterlag og duk rundt ledningen", "Perforeringen vendt opp"]) {
      expect(felt(l).parentRef, l).toBe("ledningstype");
      expect(felt(l).fase, l).toBe("UNDER");
      expect(eget(felt(l)), l).toEqual(["Drensledning"]);
    }
    // Forankring — to utløsere (vannledning + trykk), UNDER
    expect(felt("Forankring av bend").parentRef).toBe("ledningstype");
    expect(felt("Forankring av bend").fase).toBe("UNDER");
    expect(eget(felt("Forankring av bend"))).toEqual(["Vannledning", "Avløp, trykk"]);
  });

  it("§1c: «sveist» er et SVAR på forankring, ikke en betingelse", () => {
    const opts = (felt("Forankring av bend").config?.options as string[]) ?? [];
    expect(opts).toContain("Ikke krav – ledningen er sveist, skjøtene er strekkfaste");
  });

  it("tre 2 «skjoting»: sveiseloggen henger på SKJØTEMETODEN, ikke ledningstypen", () => {
    const logg = felt("Sveiseskjøter dokumentert");
    expect(logg.parentRef).toBe("skjoting");
    expect(logg.fase).toBe("UNDER");
    expect(eget(logg)).toEqual(["PE-sveis"]);
    // Ingen barn av skjoting bruker ledningstype-utløsere, og ingen barn av ledningstype er sveis-relatert
    expect(logg.parentRef).not.toBe("ledningstype");
  });

  it("alle barn bruker conditionOwnValues, aldri conditionValues", () => {
    for (const b of UM1_MAL.felter.filter((f) => f.parentRef)) {
      expect(b.config, b.label).not.toHaveProperty("conditionValues");
      expect(eget(b).length, b.label).toBeGreaterThan(0);
    }
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-U:2019)", () => {
    expect(UM1_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-U:2019");
  });

  it("§7b: ingen hjelpetekst eller alternativ bærer normkode eller standard-referanse", () => {
    UM1_MAL.felter.forEach((f) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(bærerNormkode(help), `Hjelpetekst for «${f.label}» bryter §7b-vakten`).toBe(false);
      const options = (f.config?.options as string[] | undefined) ?? [];
      options.forEach((o) => {
        expect(bærerNormkode(o), `Alternativ «${o}» i «${f.label}» bryter §7b-vakten`).toBe(false);
      });
    });
  });

  it("§7b-vakten er skarp: fanger normkoder, slipper våre egne tallkrav", () => {
    expect(bærerNormkode("UM1 c1: sentrer røret")).toBe(true);
    expect(bærerNormkode("iht. Tabell U1")).toBe(true);
    expect(bærerNormkode("jf. Matrise UM:2")).toBe(true);
    expect(bærerNormkode("jf. NS 3420-U")).toBe(true);
    expect(bærerNormkode("Forankring gjelder bend over 15°")).toBe(false);
    expect(bærerNormkode("±2 ‰ når fallet er under 10 ‰")).toBe(false);
  });
});
