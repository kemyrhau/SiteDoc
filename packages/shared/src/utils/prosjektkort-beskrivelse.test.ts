import { describe, expect, it } from "vitest";
import { jobbManglerBeskrivelse, jobberSomManglerBeskrivelse, radGirJobbBeskrivelse, type BeskrivelseRad } from "./prosjektkort";

/** Plan § 8.22 L2 «ikke ferdig»: én beskrivelse pr. jobb, reise/erstattet/fravær teller ikke. */
const rad = (o: Partial<BeskrivelseRad> = {}): BeskrivelseRad => ({
  id: "r1", kortId: "k1", projectId: "p1", erReise: false, attestertStatus: "pending", beskrivelse: null, ...o,
});

describe("jobbManglerBeskrivelse", () => {
  it("sann for tom og blank beskrivelse", () => {
    expect(jobbManglerBeskrivelse([rad()])).toBe(true);
    expect(jobbManglerBeskrivelse([rad({ beskrivelse: "" })])).toBe(true);
    expect(jobbManglerBeskrivelse([rad({ beskrivelse: "  \n " })])).toBe(true);
  });
  it("usann med tekst", () => {
    expect(jobbManglerBeskrivelse([rad({ beskrivelse: "Graving" })])).toBe(false);
  });
  it("én beskrivelse pr. jobb: overtidsraden uten tekst gjør ikke jobben uferdig", () => {
    expect(jobbManglerBeskrivelse([rad({ beskrivelse: "Graving" }), rad({ id: "r2" })])).toBe(false);
  });
  it("erstattede rader og fravær uten prosjekt teller ikke; reise teller bare i kort uten arbeid", () => {
    // O14 pkt 4 (R5): et kort med bare reise mangler beskrivelse til reisen har tekst.
    expect(jobbManglerBeskrivelse([rad({ erReise: true })])).toBe(true);
    expect(jobbManglerBeskrivelse([rad({ erReise: true, beskrivelse: "Kjøring til Narvik" })])).toBe(false);
    expect(jobbManglerBeskrivelse([rad({ erReise: true }), rad({ id: "r2", erReise: true, beskrivelse: "Hjem" })])).toBe(false);
    expect(jobbManglerBeskrivelse([rad({ erReise: true, attestertStatus: "erstattet" })])).toBe(false);
    expect(jobbManglerBeskrivelse([rad({ erReise: true, projectId: null })])).toBe(false);
    expect(jobbManglerBeskrivelse([rad({ attestertStatus: "erstattet" })])).toBe(false);
    expect(jobbManglerBeskrivelse([rad({ projectId: null })])).toBe(false);
    // Reisens tekst gjør ikke arbeidet ferdig.
    expect(jobbManglerBeskrivelse([rad(), rad({ id: "r2", erReise: true, beskrivelse: "Kjøring" })])).toBe(true);
  });
  it("jobb uten rader mangler ingenting", () => {
    expect(jobbManglerBeskrivelse([])).toBe(false);
  });
});

describe("jobberSomManglerBeskrivelse", () => {
  it("grupperer på kort-id i radenes rekkefølge; rad uten kort-id er egen jobb", () => {
    const rader = [
      rad({ id: "a", kortId: "k2" }),
      rad({ id: "b", kortId: "k1", beskrivelse: "Ferdig" }),
      rad({ id: "c", kortId: null }),
      rad({ id: "d", kortId: "k2", beskrivelse: " " }),
      rad({ id: "e", kortId: "k3", erReise: true }),
    ];
    // O14 pkt 4 (R5): k3 har bare reise uten tekst — den mangler også.
    expect(jobberSomManglerBeskrivelse(rader)).toEqual(["k2", "rad:c", "k3"]);
  });
  it("tom når alle jobber har beskrivelse", () => {
    expect(jobberSomManglerBeskrivelse([rad({ beskrivelse: "x" })])).toEqual([]);
  });
});

describe("radGirJobbBeskrivelse (dialogens unntak — samme filter som sperren)", () => {
  it("arbeidsrad med tekst gir beskrivelse; blank gjør ikke", () => {
    expect(radGirJobbBeskrivelse(rad({ beskrivelse: "Graving" }))).toBe(true);
    expect(radGirJobbBeskrivelse(rad({ beskrivelse: "  " }))).toBe(false);
  });
  it("reise, erstattet og rad uten prosjekt gir ikke beskrivelse", () => {
    expect(radGirJobbBeskrivelse(rad({ beskrivelse: "x", erReise: true }))).toBe(false);
    expect(radGirJobbBeskrivelse(rad({ beskrivelse: "x", attestertStatus: "erstattet" }))).toBe(false);
    expect(radGirJobbBeskrivelse(rad({ beskrivelse: "x", projectId: null }))).toBe(false);
  });
});
