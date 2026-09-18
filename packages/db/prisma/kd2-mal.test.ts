import { describe, it, expect } from "vitest";
import { KD2_MAL } from "./seed-bibliotek";

/**
 * KD2 «Setting av kantstein» — TI felt, første NYE mal (ikke revisjon) etter den nye
 * design↔mal-Opus-løypen. Kantstein av naturstein (KD2.2) og betong (KD2.3); plasstøpte
 * kanter (KD2.4), stål (KD2.5) og andre materialer (KD2.7) er avgrenset ut, og vishøyde
 * over 300 mm er mur (KM2).
 *
 * Krav mot en flate som varierer (linjeføring, planhet) besvares med samsvar per kravnivå
 * — enkeltvalg, ikke tallfelt (MAL-METODE §1). Én veldefinert måling (største sprang ved
 * fuger) er heltall UTEN maks-grense, slik at et avvik alltid kan registreres.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis KD2 ikke bærer de ti feltene.
 * Låser antall, rekkefølge, felttyper og de tre fasene.
 *
 * MAL-METODE §7b: malen fremstår med SiteDocs egne krav, ikke som standarden. Testen låser
 * at INGEN hjelpetekst bærer tabell-/punktkoder («Tabell K…», «KD2 c…») eller
 * produktstandard-referanser («NS-EN…»). Standarden nevnes kun i beskrivelsen.
 */

describe("KD2 – 10 felt mot NS 3420-K", () => {
  it("er malen for KD2", () => {
    expect(KD2_MAL.referanse).toBe("KD2");
    expect(KD2_MAL.kapittelKode).toBe("KD");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(KD2_MAL.felter).toHaveLength(10);
    expect(KD2_MAL.felter.map((f) => f.label)).toEqual([
      "Kantsteinstype",
      "Montering",
      "Vishøyde iht. beskrivelsen",
      "Minst 100 mm betong under hele steinen",
      "For- og bakstøp pakket, glattet og lagt samtidig med settingen",
      "Linjeføring i høyde og side",
      "Planhet på overside og visflate",
      "Største sprang ved fuger (mm)",
      "Fuger og synlige flater",
      "Krav oppfylt og dokumentasjon levert",
    ]);
  });

  it("har korrekte felttyper (4 valg, 5 trafikklys, 1 heltall)", () => {
    expect(KD2_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "traffic_light",
      "list_single",
      "list_single",
      "integer",
      "traffic_light",
      "traffic_light",
    ]);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (ETTER bærer linjeføring, planhet, sprang, fuger, konklusjon)", () => {
    expect(KD2_MAL.felter.map((f) => f.fase)).toEqual([
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
    ]);
  });

  it("sprang-feltet er heltall i mm uten maks-grense (blokkerer aldri avviksregistrering)", () => {
    const sprang = KD2_MAL.felter[7]!;
    expect(sprang.type).toBe("integer");
    expect(sprang.config?.enhet).toBe("mm");
    expect(sprang.config?.maks).toBeUndefined();
  });

  it("ingen hjelpetekst bærer tabell-/punktkoder eller produktstandard (§7b — egne krav)", () => {
    // «Tabell K…», «KD2 c…»/«KD c…» og «NS-EN…» er standardens referanser — de skal ikke stå
    // i hjelpeteksten. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
    const normkode = /Tabell K|KD\d*\.?\d* ?c\d|KD ?c\d|NS-EN/;
    for (const f of KD2_MAL.felter) {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(help, `Hjelpetekst for «${f.label}» bærer en norm-/produktkode`).not.toMatch(normkode);
    }
  });
});
