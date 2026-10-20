import { describe, it, expect } from "vitest";
import { tegningVisningTilstand } from "../tegningRekonverteringVisning";

/**
 * RETUR 2 rekonverter (Kontrollør/Kenneth, feil 2): «Oppdater alle tegninger» viste
 * spinner/tom flate i stedet for den gamle tegningen mens rekonverteringen pågikk — selv
 * om et gyldig gammelt render alt lå på disk. Låser skillet mellom «ingenting å vise»
 * (førstegangskonvertering/revisjon → blokker) og «gammel visning finnes» (rekonvertering
 * → IKKE blokker, kun diskret indikator).
 */
describe("tegningVisningTilstand", () => {
  it("rekonvertering av en ALLEREDE konvertert SVG → ikke blokkerende (feil 2-scenarioet)", () => {
    const t = tegningVisningTilstand({ conversionStatus: "pending", erBilde: true, brukDxfViewer: false });
    expect(t.erDwgKonvertering).toBe(true);
    expect(t.harGyldigGammelVisning).toBe(true);
    expect(t.visBlokkerendeKonvertering).toBe(false);
  });

  it("rekonvertering via dxf-viewer-artefakter (ikke erBilde) → heller ikke blokkerende", () => {
    const t = tegningVisningTilstand({ conversionStatus: "converting", erBilde: false, brukDxfViewer: true });
    expect(t.harGyldigGammelVisning).toBe(true);
    expect(t.visBlokkerendeKonvertering).toBe(false);
  });

  it("førstegangskonvertering — fileType er ennå den rå originalen (ingen fil å vise) → blokkerende", () => {
    const t = tegningVisningTilstand({ conversionStatus: "pending", erBilde: false, brukDxfViewer: false });
    expect(t.harGyldigGammelVisning).toBe(false);
    expect(t.visBlokkerendeKonvertering).toBe(true);
  });

  it("ingen konvertering pågår → aldri blokkerende, uansett om det finnes et render", () => {
    expect(tegningVisningTilstand({ conversionStatus: "done", erBilde: true, brukDxfViewer: false }).visBlokkerendeKonvertering).toBe(false);
    expect(tegningVisningTilstand({ conversionStatus: null, erBilde: false, brukDxfViewer: false }).visBlokkerendeKonvertering).toBe(false);
    expect(tegningVisningTilstand({ conversionStatus: "failed", erBilde: false, brukDxfViewer: false }).visBlokkerendeKonvertering).toBe(false);
  });
});
