import { describe, it, expect } from "vitest";
import { skrivMal } from "./skriv-mal";

/**
 * skriv-mal — lokalt §6a-tekstbevis (ordre malfasit TILLEGG §5). Låser at utskriften bærer
 * metadata + rader i §6a-form: referanse/navn/beskrivelse, og per rad type/label, alternativer
 * (config->'options' som JSON) og hjelpetekst (config->>'helpText'), med heading-rader for fasene.
 */
describe("skriv-mal — lokalt §6a-tekstbevis", () => {
  it("skriver metadata + heading-rader + felt for en K-mal (KD1)", () => {
    const s = skrivMal("KD1");
    expect(s).toContain("referanse   : KD1");
    expect(s).toContain("navn        : KD1 – Belegg av stein og heller");
    expect(s).toContain("beskrivelse : ");
    // Fasene ligger som heading-rader (samme som arkivet).
    expect(s).toContain("label        : Kontroll FØR utførelse");
    expect(s).toContain("label        : Kontroll UNDER utførelse");
    expect(s).toContain("label        : Kontroll ETTER utførelse");
    // Alternativer som JSON-array (= config->'options' i §6a), hjelpetekst som ren tekst.
    expect(s).toContain('alternativer : ["Gangareal","Kjøreareal"]');
    expect(s).toContain("hjelpetekst  : ");
  });

  it("virker for en F-mal (FS3) også", () => {
    const s = skrivMal("FS3");
    expect(s).toContain("referanse   : FS3");
    expect(s).toContain("label        : Innhold i grøfta");
  });

  it("ukjent referanse stopper med klartekst", () => {
    expect(() => skrivMal("XX9")).toThrow(/Ukjent referanse/);
  });
});
