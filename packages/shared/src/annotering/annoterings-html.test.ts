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

  // Strek/font er proporsjonale og SUB-LINEÆRE (skaleres med kvadratrot av canvas-bredden).
  it("strek og font utledes fra sub-lineær canvas-skala, ikke hardkodede piksler", () => {
    expect(ANNOTERINGS_HTML).toContain("function naaSkala()");
    // Sub-lineær: kvadratrot av bredde-forholdet (funn 2 — lineær ble for tykt).
    expect(ANNOTERINGS_HTML).toContain("Math.sqrt(canvas.width / REFERANSE_BREDDE)");
    expect(ANNOTERINGS_HTML).toContain("BASIS_STREK * naaSkala()");
    expect(ANNOTERINGS_HTML).toContain("BASIS_FONT * naaSkala()");
    // Frihånd-penselen settes proporsjonalt når canvas er dimensjonert.
    expect(ANNOTERINGS_HTML).toContain("canvas.freeDrawingBrush.width = strekBredde()");
    expect(ANNOTERINGS_HTML).toContain("REFERANSE_BREDDE = 390");
  });

  // FUNN 4 (bevart) — hvit kontrastkant på alle formtyper; kanten er nå ANDEL av streken.
  it("pil, sirkel, firkant OG tekst har hvit kontrastkant, som andel av streken", () => {
    expect(ANNOTERINGS_HTML).toContain("KONTRAST_FARGE = '#ffffff'");
    expect(ANNOTERINGS_HTML).toContain("stroke: KONTRAST_FARGE");
    // Formene bygges som gruppe [hvit halo, rød strek] — den hvite er bredere (s + 2k).
    expect(ANNOTERINGS_HTML).toContain("linje(KONTRAST_FARGE, s + 2 * k)"); // pil
    expect(ANNOTERINGS_HTML).toContain("ring(KONTRAST_FARGE, s + 2 * k)"); // sirkel
    expect(ANNOTERINGS_HTML).toContain("boks(KONTRAST_FARGE, s + 2 * k)"); // firkant
    // Kanten er strekbredde × brøk, ikke et fast pikseltillegg (funn 2 — for bredt).
    expect(ANNOTERINGS_HTML).toContain("strekBredde() * KONTRAST_FRAKSJON");
  });

  // FUNN 2 — hvit og rød form KONSENTRISKE: begge lag posisjoneres etter senter.
  it("sirkel og firkant posisjoneres etter senter (konsentrisk uansett strekbredde)", () => {
    // Begge ringene/boksene bygges med senter-origo og samme senter (cx, cy) — ikke
    // hjørnet (left: cx - radius), som ga forskyvning ved ulik strekbredde.
    expect(ANNOTERINGS_HTML).toContain("originX: 'center', originY: 'center'");
    expect(ANNOTERINGS_HTML).toContain("left: cx, top: cy, radius: radius"); // sirkel
    expect(ANNOTERINGS_HTML).toContain("left: cx, top: cy, width: w, height: h"); // firkant
    expect(ANNOTERINGS_HTML).not.toContain("left: cx - radius"); // gammel hjørne-forskyvning borte
  });

  // FUNN 1 — tekst skrives DIREKTE på canvas (IText), ingen modal, ingen meldingsrunde.
  it("tekst legges som IText og går rett i redigering — ingen bro-melding", () => {
    expect(ANNOTERINGS_HTML).toContain("new fabric.IText('',");
    expect(ANNOTERINGS_HTML).toContain("enterEditing()");
    // KRAV c.1: ingen tekstmelding krysser broen lenger.
    expect(ANNOTERINGS_HTML).not.toContain("tekstInput");
    expect(ANNOTERINGS_HTML).not.toContain("redigerTekst");
    // Tom tekst ved avsluttet redigering fjernes på canvas (ikke over broen).
    expect(ANNOTERINGS_HTML).toContain("text:editing:exited");
  });

  // KRAV c.3 (falsk-positiv) — den gamle meldingsveien er BORTE, ikke bare ubrukt.
  it("den gamle tekst-meldingsveien finnes ikke lenger i broen", () => {
    expect(ANNOTERINGS_HTML).not.toContain("plasserTekst");
    expect(ANNOTERINGS_HTML).not.toContain("oppdaterTekst");
  });

  // FUNN 2 (forrige runde, bevart) — forhåndsvisning under draget.
  it("viser formen live under draget (mouse:move) før den festes ved mouse:up", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.on('mouse:move'");
    expect(ANNOTERINGS_HTML).toContain("forhandsvisning");
    expect(ANNOTERINGS_HTML).toContain("byggForm(aktivtVerktoy, startPunkt, pointer)");
    expect(ANNOTERINGS_HTML).toContain("canvas.remove(forhandsvisning)");
  });
});
