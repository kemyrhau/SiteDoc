import { describe, it, expect } from "vitest";
import { beregnStartutsnittZoom, svgViewBoxForhold } from "../startutsnittZoom";

const MIN = 1; // STANDARD_ZOOM
const MAKS = 50; // MAKS_ZOOM

// Gammel formel (kun bredde, antar kvadratisk): det regresjonstesten slår ned på.
function gammelZoom(bredde: number, høyde: number): number {
  return Math.min(MAKS, Math.max(MIN, 0.98 / Math.max(bredde, høyde)));
}

describe("beregnStartutsnittZoom", () => {
  it("stående tegning med høyt utsnitt: hele utsnittet får plass i høyden (su.h·innerH ≤ ch)", () => {
    const cw = 1000,
      ch = 600,
      forhold = 1.75; // fallplanen etter rotasjon (ih/iw ≈ 1,75)
    const bredde = 0.1,
      høyde = 0.25;

    const z = beregnStartutsnittZoom({ bredde, høyde, cw, ch, forhold, minZoom: MIN, maksZoom: MAKS });

    const innerH = cw * z * forhold;
    expect(høyde * innerH).toBeLessThanOrEqual(ch);

    // Gammel formel sprengte høyden — kontroll på at dette var en ekte feil.
    const innerHGammel = cw * gammelZoom(bredde, høyde) * forhold;
    expect(høyde * innerHGammel).toBeGreaterThan(ch);
  });

  it("liggende tegning (Ålesund) er uendret: bredden er bindende, lik gammel formel", () => {
    const cw = 1000,
      ch = 600,
      forhold = 0.6; // liggende (bredere enn høy)
    const bredde = 0.4,
      høyde = 0.2;

    const z = beregnStartutsnittZoom({ bredde, høyde, cw, ch, forhold, minZoom: MIN, maksZoom: MAKS });
    expect(z).toBeCloseTo(gammelZoom(bredde, høyde), 10);
    expect(z).toBeCloseTo(0.98 / bredde, 10);
  });

  it("ukjent forhold: faller tilbake til bredde-tilpasning (aldri kvadratisk)", () => {
    const z = beregnStartutsnittZoom({ bredde: 0.2, høyde: 0.5, cw: 1000, ch: 600, forhold: null, minZoom: MIN, maksZoom: MAKS });
    expect(z).toBeCloseTo(0.98 / 0.2, 10);
  });

  it("klemmes til [minZoom, maksZoom]", () => {
    // Svært lite utsnitt → bredde-tilpass over MAKS → klemmes ned.
    const stor = beregnStartutsnittZoom({ bredde: 0.001, høyde: 0.001, cw: 1000, ch: 600, forhold: 1, minZoom: MIN, maksZoom: MAKS });
    expect(stor).toBe(MAKS);
    // Helt høyt utsnitt på høy tegning → høyde-tilpass under 1 → klemmes opp til MIN.
    const lite = beregnStartutsnittZoom({ bredde: 1, høyde: 1, cw: 1000, ch: 600, forhold: 2, minZoom: MIN, maksZoom: MAKS });
    expect(lite).toBe(MIN);
  });
});

describe("svgViewBoxForhold", () => {
  it("leser høyde/bredde-forhold fra viewBox", () => {
    expect(svgViewBoxForhold('<svg viewBox="0 0 800 1400">')).toBeCloseTo(1400 / 800, 10);
  });
  it("tåler vilkårlig whitespace og enkle anførselstegn", () => {
    expect(svgViewBoxForhold("<svg  viewBox='0 0 100 50' >")).toBeCloseTo(0.5, 10);
  });
  it("returnerer null uten viewBox eller ved ugyldige verdier", () => {
    expect(svgViewBoxForhold("<svg width='10'>")).toBeNull();
    expect(svgViewBoxForhold('<svg viewBox="0 0 0 100">')).toBeNull();
    expect(svgViewBoxForhold(null)).toBeNull();
  });
});
