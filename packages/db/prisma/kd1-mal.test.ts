import { describe, it, expect } from "vitest";
import { KD1_MAL } from "./seed-bibliotek";

/**
 * KD1 «Utendørs belegg» — TI felt mot NS 3420-K KD1.2–KD1.6 og KD1.74 (Tabell K9–K12).
 *
 * Revisjon 2026-09-18 (design-rollen, gatet av Kenneth): 7→10 felt. Krav mot en flate som
 * varierer (fall, planhet, fugebredde, tykkelse settelag) besvares med samsvar per kravnivå
 * — ikke tallfelt (MAL-METODE §1). Én veldefinert måling (største sprang ved fuger) forblir
 * heltall UTEN maks-grense, slik at et avvik alltid kan registreres. «Asfalt» er fjernet:
 * asfaltdekker hører til IH, ikke KD1.
 *
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis KD1 ikke bærer de ti feltene.
 * Låser antall, rekkefølge, felttyper og de tre fasene.
 *
 * TILLEGG 2026-09-18 (MAL-METODE §7b): malen fremstår med SiteDocs egne krav, ikke som
 * standarden. Testen låser derfor også at INGEN hjelpetekst bærer tabell-/punktkoder fra
 * standarden («Tabell K…», «KD1 c…»). Feltnavn 5 og 6 er omskrevet til egne ord.
 */

describe("KD1 – 10 felt mot NS 3420-K", () => {
  it("er malen for KD1", () => {
    expect(KD1_MAL.referanse).toBe("KD1");
    expect(KD1_MAL.kapittelKode).toBe("KD");
  });

  it("har nøyaktig ti datafelt i riktig rekkefølge", () => {
    expect(KD1_MAL.felter).toHaveLength(10);
    expect(KD1_MAL.felter.map((f) => f.label)).toEqual([
      "Belegningstype",
      "Areal",
      "Settelag",
      "Tykkelse settelag",
      "Fall mot avrenning",
      "Fuger og striper i rette linjer eller jevne buer",
      "Fugebredde",
      "Planhet – svanker/bulninger over 3 m",
      "Største vertikale sprang ved fuger (mm)",
      "Krav oppfylt og dokumentasjon levert",
    ]);
  });

  it("har korrekte felttyper (6 valg, 3 trafikklys, 1 heltall)", () => {
    expect(KD1_MAL.felter.map((f) => f.type)).toEqual([
      "list_single",
      "list_single",
      "list_single",
      "list_single",
      "traffic_light",
      "traffic_light",
      "list_single",
      "list_single",
      "integer",
      "traffic_light",
    ]);
  });

  it("grupperer feltene i FØR/UNDER/ETTER (ETTER bærer fugebredde, planhet, sprang, konklusjon)", () => {
    expect(KD1_MAL.felter.map((f) => f.fase)).toEqual([
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

  it("sprang-feltet er heltall i mm uten maks-grense (blokkerer aldri avviksregistrering)", () => {
    const sprang = KD1_MAL.felter[8]!;
    expect(sprang.type).toBe("integer");
    expect(sprang.config?.enhet).toBe("mm");
    expect(sprang.config?.maks).toBeUndefined();
  });

  it("inneholder ikke «Asfalt» (asfaltdekker hører til IH, ikke KD1)", () => {
    const belegningstype = KD1_MAL.felter[0]!;
    const alternativer = (belegningstype.config?.options as string[]) ?? [];
    expect(alternativer).not.toContain("Asfalt");
    expect(alternativer.some((a) => a.toLowerCase().includes("asfalt"))).toBe(false);
  });

  it("ingen hjelpetekst bærer tabell-/punktkoder fra standarden (§7b — egne krav)", () => {
    // «Tabell K…» og «KD1 c…»/«KD c…»/«KD:1» er standardens interne referanser — de skal
    // ikke stå i hjelpeteksten. Standarden nevnes kun i beskrivelsen («Faglig grunnlag»).
    const normkode = /Tabell K|KD\d*\.?\d* ?c\d|KD ?c\d|KD:\d|Matrise KD/;
    for (const f of KD1_MAL.felter) {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(help, `Hjelpetekst for «${f.label}» bærer en norm-kode`).not.toMatch(normkode);
    }
  });
});
