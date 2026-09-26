import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UM11_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UM1.1 «Skjøt på PE-ledning» — NY mal (ordre UM1.1 2026-09-22, gatet av Kenneth), bygget SAMMEN med
 * UM1 v2. Standard NS 3420-U:2019, kapittel UM (fra UM1). Dokumentets enhet er skjøten — én sjekkliste
 * pr. skjøt. 18 felt, INGEN tallfelt (MAL-METODE §1).
 *
 * TO UAVHENGIGE TRÆR (ordre §5):
 *  · «hvaskjotes» (felt 1, FØR) — barn: bendets retning (FØR, «Bend»), anboring/uttak (FØR, «Uttak av
 *    stikkledning»). Samme fase → `forgrening`.
 *  · «skjotetype» (felt 5, FØR) — barn i UNDER (kryss-fase → `barnAv`): sveisegruppen (fem barn under
 *    samme utløserpar Elektromuffesveis+Speilsveis), elektromuffe-paret, speilsveis-paret, klemring og
 *    flens.
 *
 * 🔴 STØRSTE FORGRENING i biblioteket: fem barn under samme utløserpar. Bygget som fem egne `barnAv`,
 * så HVERT barn får sin egen parentRef + utløsersett (ordre §6 — `felt:[a..e]` ville gitt bare a).
 *
 * §7b/§7c: PE/SDR/elektromuffe/speilsveis/buttsveis er produkt-/metodebetegnelser (tillatt); ingen
 * Matrise/NS-EN/NS 3420/NS 416/DS-INF, ingen «UM1.1 »-prefiks i feltnavn, og ALDRI «pæl».
 */

const felt = (label: string): FeltDef => {
  const f = UM11_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];
const SVEIS = ["Elektromuffesveis", "Speilsveis (buttsveis)"];

/** §7b-vakt: normkode/standard-referanse eller feil «pæl»-skrivemåte? */
function forbudt(s: string): boolean {
  return /Matrise|NS-EN|NS 3420|NS 416|DS\/INF|UM1\.1 |\bpæl/i.test(s);
}

describe("UM1.1 – skjøt på PE-ledning, to trær", () => {
  it("er malen for UM1.1 i kapittel UM", () => {
    expect(UM11_MAL.referanse).toBe("UM1.1");
    expect(UM11_MAL.kapittelKode).toBe("UM");
    expect(UM11_MAL.navn).toBe("UM1.1 – Skjøt på PE-ledning");
  });

  it("har 18 felt; 5 alltid synlige, 13 betingede", () => {
    expect(UM11_MAL.felter).toHaveLength(18);
    const alltid = UM11_MAL.felter.filter((f) => !f.parentRef);
    expect(alltid.map((f) => f.label)).toEqual([
      "Hva skjøtes",
      "Rør og deler kontrollert",
      "Skjøtetype",
      "Skjøten merket",
      "Skjøten er dokumentert og klar",
    ]);
    expect(UM11_MAL.felter.filter((f) => f.parentRef)).toHaveLength(13);
  });

  it("INGEN tallfelt (§1)", () => {
    expect(UM11_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("faser: felt 1–5 i FØR, felt 6–16 i UNDER, felt 17–18 i ETTER", () => {
    expect(UM11_MAL.felter.map((f) => f.fase)).toEqual([
      "FØR", "FØR", "FØR", "FØR", "FØR",
      "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER", "UNDER",
      "ETTER", "ETTER",
    ]);
  });

  it("to uavhengige foreldre: hvaskjotes (FØR) og skjotetype (FØR)", () => {
    expect(felt("Hva skjøtes").ref).toBe("hvaskjotes");
    expect(felt("Hva skjøtes").config?.conditionActive).toBe(true);
    expect(felt("Skjøtetype").ref).toBe("skjotetype");
    expect(felt("Skjøtetype").config?.conditionActive).toBe(true);
  });

  it("tre A «hvaskjotes»: bend- og anboringsfeltene henger på felt 1", () => {
    expect(felt("Bendets retning og vinkel").parentRef).toBe("hvaskjotes");
    expect(eget(felt("Bendets retning og vinkel"))).toEqual(["Bend"]);
    expect(felt("Anboring og uttak").parentRef).toBe("hvaskjotes");
    expect(eget(felt("Anboring og uttak"))).toEqual(["Uttak av stikkledning"]);
  });

  it("🔴 sveisegruppen (6–10): FEM egne poster, alle med samme utløserpar", () => {
    const gruppe = [
      "Prosedyre, kalibrering og sertifikat",
      "Forholdene på stedet",
      "Ovalitet og oppspenning",
      "Sveiseparametre ført i skjema",
      "Avkjøling",
    ];
    // Hvert av de fem må ha sin EGEN parentRef + eget utløserpar — ikke bare den første.
    for (const l of gruppe) {
      expect(felt(l).parentRef, l).toBe("skjotetype");
      expect(eget(felt(l)), l).toEqual(SVEIS);
    }
  });

  it("metodespesifikke grupper skilt: elektromuffe (11–12), speilsveis (13–14), klemring (15), flens (16)", () => {
    for (const l of ["Skraping av røroverflaten", "Smelteindikatorer"]) {
      expect(eget(felt(l)), l).toEqual(["Elektromuffesveis"]);
    }
    for (const l of ["Høvling og oppstilling", "Vulsten"]) {
      expect(eget(felt(l)), l).toEqual(["Speilsveis (buttsveis)"]);
    }
    expect(eget(felt("Støttehylse og tiltrekking"))).toEqual(["Klemringsskjøt"]);
    expect(eget(felt("Ettertrekking av flens"))).toEqual(["Flenseskjøt eller løsflens"]);
  });

  it("ingen av de tretten betingede er alltid synlige (alle har parentRef + utløsersett)", () => {
    for (const b of UM11_MAL.felter.filter((f) => f.parentRef)) {
      expect(b.config, b.label).not.toHaveProperty("conditionValues");
      expect(eget(b).length, b.label).toBeGreaterThan(0);
    }
  });

  it("standarden nevnes kun i beskrivelsen (Faglig grunnlag NS 3420-U:2019)", () => {
    expect(UM11_MAL.beskrivelse).toContain("Faglig grunnlag: NS 3420-U:2019");
  });

  it("§7b: ingen normkode, standard-referanse eller «pæl» i felt, hjelpetekst eller alternativ", () => {
    for (const f of UM11_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(forbudt(tekst), `«${f.label}» bryter §7b-vakten`).toBe(false);
    }
  });

  it("§7b-vakten er skarp: fanger «pæl» og normkoder, slipper «pel» og produktbetegnelser", () => {
    expect(forbudt("fundamentert på pæl")).toBe(true);
    expect(forbudt("jf. Matrise UM:2")).toBe(true);
    expect(forbudt("iht. NS-EN 12201")).toBe(true);
    // Tillatt: «pel» (posisjon), produkt-/metodebetegnelser (§7c):
    expect(forbudt("merk skjøten med pelnummer")).toBe(false);
    expect(forbudt("Elektromuffesveis på SDR11 PE-rør")).toBe(false);
    expect(forbudt("Speilsveis (buttsveis)")).toBe(false);
  });
});
