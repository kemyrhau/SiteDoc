import { describe, it, expect } from "vitest";
import { KM2_MAL } from "./seed-bibliotek";

/**
 * KM2 «Mur av stein i terreng» — TI felt, ny mal (nytt kapittel KM). Ensidige og tosidige
 * murer i terreng — tørrmur, murt mur og ett-skifts mur — av naturstein, betongstein eller
 * imitert stein (KM2.2/KM2.3). Gabioner, stålmurer, avdekning, forblending og plasstøpt
 * betongmur er avgrenset ut.
 *
 * Normen har INGEN utførelseskrav eller toleranser for murer i terreng — malen er en kontroll
 * mot prosjektets beskrivelse (MAL-METODE §1). Derfor ingen tallfelt (kun enkeltvalg og
 * trafikklys) og ingen normtall i hjelpetekstene.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis KM2 ikke bærer de ti feltene.
 * Låser antall, rekkefølge, felttyper og de tre fasene.
 *
 * MAL-METODE §7b / ordre §5: malen fremstår med SiteDocs egne krav, ikke som standarden.
 * Testen låser at INGEN hjelpetekst bærer tabell-/punktkoder («Tabell K…», «KM2 c…») eller
 * produktstandard-referanser («NS-EN…»), OG at ingen hjelpetekst bærer et normtall (tall med
 * mm/cm/%). Ett smalt unntak (design 2026-09-18, alternativ b): definisjonen «300 mm» i felt 1
 * — grensen mur/kant (jf. KD2), ikke et utførelseskrav. Standarden nevnes kun i beskrivelsen.
 */

/**
 * §5-vakt: er hjelpeteksten ren for normkoder og normtall? ETT smalt unntak — den eksakte
 * strengen «300 mm» (mur/kant-grensen) er tillatt KUN i felt 1. «301 mm» i felt 1 og «300 mm»
 * i et hvilket som helst annet felt skal fanges (returnerer false).
 */
function hjelpetekstRen(help: string, erFelt1: boolean): boolean {
  if (/Tabell K|KM ?\d*\.?\d* ?c\d|KM ?c\d|NS-EN/.test(help)) return false;
  const tall = help.match(/\d+(?:[.,]\d+)?\s?(?:mm|cm|%)/g) ?? [];
  return erFelt1 ? tall.every((t) => t === "300 mm") : tall.length === 0;
}

describe("KM2 – 10 felt mot NS 3420-K (kontroll mot beskrivelsen)", () => {
  it("er malen for KM2 i nytt kapittel KM", () => {
    expect(KM2_MAL.referanse).toBe("KM2");
    expect(KM2_MAL.kapittelKode).toBe("KM");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(KM2_MAL.felter).toHaveLength(10);
    expect(KM2_MAL.felter.map((f) => f.label)).toEqual([
      "Murtype",
      "Materiale",
      "Fundament, filterlag og drenering på plass",
      "Helning og tverrsnitt iht. beskrivelsen",
      "Bindere, forankring eller armering",
      "Kjernefyll",
      "Drenshull",
      "Ligge- og stussfuger iht. beskrivelsen",
      "Linjeføring, mønster og toleranser iht. beskrivelsen",
      "Krav oppfylt og dokumentasjon levert",
    ]);
  });

  it("har korrekte felttyper (5 enkeltvalg, 5 trafikklys, INGEN tallfelt)", () => {
    expect(KM2_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "traffic_light",
    ]);
    // Ingen tallfelt (normen har ingen toleranser for murer i terreng).
    expect(KM2_MAL.felter.some((f) => f.type === "integer" || f.type === "decimal")).toBe(false);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (FØR 3, UNDER 4, ETTER 3)", () => {
    expect(KM2_MAL.felter.map((f) => f.fase)).toEqual([
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

  it("ingen hjelpetekst bærer normkoder eller normtall (§7b/§5) — unntak: «300 mm» i felt 1", () => {
    KM2_MAL.felter.forEach((f, i) => {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(hjelpetekstRen(help, i === 0), `Hjelpetekst for «${f.label}» bryter §5-vakten`).toBe(true);
    });
  });

  it("§5-unntaket er smalt: kun «300 mm» i felt 1, ikke «301 mm» og ikke i andre felt", () => {
    expect(hjelpetekstRen("vishøyde over 300 mm", true)).toBe(true); // felt 1: definisjonen tillatt
    expect(hjelpetekstRen("vishøyde over 301 mm", true)).toBe(false); // felt 1: nær-variant → rød
    expect(hjelpetekstRen("noe 300 mm her", false)).toBe(false); // annet felt: 300 mm → rød
    expect(hjelpetekstRen("fall 2 %", false)).toBe(false); // andre normtall → rød
    expect(hjelpetekstRen("ingen tall her", false)).toBe(true); // ren tekst → grønn
    // Normkode fanges uansett felt:
    expect(hjelpetekstRen("se Tabell K11", true)).toBe(false);
    expect(hjelpetekstRen("iht. NS-EN 1338", false)).toBe(false);
  });
});
