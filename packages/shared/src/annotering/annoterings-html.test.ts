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
});
