import { describe, it, expect } from "vitest";
import { ANNOTERINGS_HTML } from "./annoterings-html";
import { FABRIC_VERSJON } from "./lag";

/**
 * Tegnelogikken bor i en HTML-streng (kan ikke enhets-testes med canvas), så disse
 * testene vokter de egenskapene som ER regresjonsfarlige: eksportformatet (JPEG, aldri
 * PNG — målt lærdom 2ef13845/BACKLOG-772), den toveis broen (web+mobil deler HTML-en)
 * og lag-støtten (redigerbar gjenåpning).
 */
describe("ANNOTERINGS_HTML — delt tegnemotor", () => {
  it("TEST 3 — eksporterer JPEG q0.92, ALDRI PNG", () => {
    expect(ANNOTERINGS_HTML).toContain("format: 'jpeg', quality: 0.92");
    expect(ANNOTERINGS_HTML).not.toContain("format: 'png'");
  });

  it("laster nøyaktig den Fabric-versjonen lag-formatet er bundet til (én kilde)", () => {
    expect(ANNOTERINGS_HTML).toContain(`fabric.js/${FABRIC_VERSJON}/fabric.min.js`);
  });

  it("broen er TOVEIS — RN-WebView OG web-iframe fra samme implementasjon", () => {
    expect(ANNOTERINGS_HTML).toContain("window.ReactNativeWebView");
    expect(ANNOTERINGS_HTML).toContain("window.parent.postMessage");
    // mottak lytter på både document (RN Android) og window (iOS + iframe)
    expect(ANNOTERINGS_HTML).toContain("document.addEventListener('message'");
    expect(ANNOTERINGS_HTML).toContain("window.addEventListener('message'");
  });

  it("lag-modellen: sender laget ut ved lagre, laster det inn ved settBilde", () => {
    // hentLag: objektene UT sammen med den utflatede dataUrl-en + versjon + dims
    expect(ANNOTERINGS_HTML).toContain("fabricVersion: fabric.version");
    expect(ANNOTERINGS_HTML).toContain("objekter: objekter.map");
    // settLag: enlivenObjects legger objektene oppå bakgrunnen (uten å tømme canvas)
    expect(ANNOTERINGS_HTML).toContain("enlivenObjects");
  });

  it("Velg/Flytt: select-modus gjør gjeninnlastede objekter flyttbare", () => {
    expect(ANNOTERINGS_HTML).toContain("aktivtVerktoy === 'select'");
    expect(ANNOTERINGS_HTML).toContain("settFlyttbar");
  });

  // FUNN 1/3 — strek/font er proporsjonale (skaleres med canvas), ikke absolutte tall.
  it("strek og font utledes fra canvas-skala, ikke hardkodede piksler", () => {
    // Ingen hardkodet strekbredde/font igjen — alt går via skalert-funksjonene.
    expect(ANNOTERINGS_HTML).toContain("function naaSkala()");
    expect(ANNOTERINGS_HTML).toContain("BASIS_STREK * naaSkala()");
    expect(ANNOTERINGS_HTML).toContain("BASIS_FONT * naaSkala()");
    expect(ANNOTERINGS_HTML).toContain("fontSize: fontStr()");
    // Frihånd-penselen settes proporsjonalt når canvas er dimensjonert.
    expect(ANNOTERINGS_HTML).toContain("canvas.freeDrawingBrush.width = strekBredde()");
    // Referanse-bredden matcher den delte kalibreringen (én kilde, jf. lag.ts).
    expect(ANNOTERINGS_HTML).toContain("REFERANSE_BREDDE = 390");
  });

  // FUNN 4 — hvit kontrastkant på ALLE fire formtyper, ikke bare tekst.
  it("pil, sirkel, firkant OG tekst har hvit kontrastkant", () => {
    expect(ANNOTERINGS_HTML).toContain("KONTRAST_FARGE = '#ffffff'");
    // Tekst: hvit outline (som før, men nå skalert).
    expect(ANNOTERINGS_HTML).toContain("stroke: KONTRAST_FARGE");
    expect(ANNOTERINGS_HTML).toContain("strokeWidth: kontrastKant()");
    // Formene bygges som gruppe [hvit halo, rød strek] — den hvite er bredere (s + 2k).
    expect(ANNOTERINGS_HTML).toContain("linje(KONTRAST_FARGE, s + 2 * k)"); // pil
    expect(ANNOTERINGS_HTML).toContain("ring(KONTRAST_FARGE, s + 2 * k)"); // sirkel
    expect(ANNOTERINGS_HTML).toContain("boks(KONTRAST_FARGE, s + 2 * k)"); // firkant
    // Kanten skaleres også (ikke fast 2px).
    expect(ANNOTERINGS_HTML).toContain("kontrastKant() { return BASIS_KONTRAST * naaSkala()");
  });

  // FUNN 2 — forhåndsvisning under draget (felles for web+mobil via delt HTML).
  it("viser formen live under draget (mouse:move) før den festes ved mouse:up", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.on('mouse:move'");
    expect(ANNOTERINGS_HTML).toContain("forhandsvisning");
    // Samme bygger for forhåndsvisning og endelig form — kan ikke drifte fra hverandre.
    expect(ANNOTERINGS_HTML).toContain("byggForm(aktivtVerktoy, startPunkt, pointer)");
    // Forhåndsvisningen legges IKKE i objekter (angre/eksport rører den ikke).
    expect(ANNOTERINGS_HTML).toContain("canvas.remove(forhandsvisning)");
  });
});
