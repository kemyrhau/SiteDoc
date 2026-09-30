import { describe, it, expect } from "vitest";
import { ANNOTERINGS_HTML } from "./annoterings-html";
import { FABRIC_CDN_STI } from "./lag";

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

  it("laster Fabric fra den pinnede CDN-stien (én kilde for stien)", () => {
    expect(ANNOTERINGS_HTML).toContain(`fabric.js/${FABRIC_CDN_STI}/fabric.min.js`);
  });

  it("er selvbeskrivende med UTF-8 — brekker ikke når den serveres som fil", () => {
    // Uten charset faller en fil-servert nettleser til windows-1252 og feildekoder æøå
    // i inline-JS-en (håndterVertMelding + norske strenger) → SyntaxError → settBilde undefined.
    expect(ANNOTERINGS_HTML).toContain(`<meta charset="utf-8">`);
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

  // Pilhodet UTLEDES fra streken (TVILLING skalertPilhode/pilLinjeSlutt i lag.ts), så forholdet
  // hode:strek ikke kan drifte, og linja stoppes før hodet (ellers krysser den gjennom det).
  it("pilhodet er koblet til streken (s * PILHODE_FAKTOR), ikke sin egen skala-formel", () => {
    expect(ANNOTERINGS_HTML).toContain("s * PILHODE_FAKTOR");
    expect(ANNOTERINGS_HTML).not.toContain("15 * naaSkala()"); // gammel, uavhengig skalering
  });

  it("pil-linja trekkes tilbake før hodet, klemt så en kort pil ikke får negativ lengde", () => {
    expect(ANNOTERINGS_HTML).toContain("Math.min(pilLen / 2, len)");
    // linja ender i det tilbaketrukne punktet (sluttX/sluttY), ikke i spissen (til.x/til.y)
    expect(ANNOTERINGS_HTML).toContain("sluttX = len > 0 ? til.x");
  });

  // FUNN 2 (pil) — de to pil-linjene skal være KONSENTRISKE: begge ankres på linjas senter
  // (originX/originY 'center' + felles left/top), ikke hjørnet som forskjøt dem ved ulik strek.
  it("pil-linjene ankres på senter med punkter relativt til senteret (konsentrisk uansett strek)", () => {
    // felles senter (linjas midtpunkt) beregnes én gang og deles av begge linjene
    expect(ANNOTERINGS_HTML).toContain("lcx = (fra.x + sluttX) / 2");
    expect(ANNOTERINGS_HTML).toContain("lcy = (fra.y + sluttY) / 2");
    // punktene er RELATIVE til senteret (geometrien uendret), og linja posisjoneres etter senter
    expect(ANNOTERINGS_HTML).toContain("fabric.Line([fra.x - lcx, fra.y - lcy, sluttX - lcx, sluttY - lcy]");
    expect(ANNOTERINGS_HTML).toContain("left: lcx, top: lcy, originX: 'center', originY: 'center'");
  });

  // KRAV 1 — frihånd må inn i `objekter`, ellers kan strøket ikke angres/flyttes/lagres
  // (stille datatap: brennes bare inn i JPEG-en, borte ved neste gjenåpning).
  it("frihånd (path:created) pushes til objekter og får settFlyttbar med gjeldende verktøy", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.on('path:created'");
    expect(ANNOTERINGS_HTML).toContain("objekter.push(path)");
    expect(ANNOTERINGS_HTML).toContain("settFlyttbar(path, aktivtVerktoy === 'select')");
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

  // KRAV 1 (tekstverktøy 2026-09-30) — et klikk oppretter ALLTID tekst, UNNTATT på en
  // eksisterende tekst (som åpnes for redigering). Treff på pil/sirkel/firkant lager ny
  // tekst; velging hører til Flytt. Den gamle «if (opt.target) return» — som drepte klikket
  // på ETHVERT objekt (også former) — skal være borte.
  it("tekstverktøy: klikk på form lager tekst, kun eksisterende tekst åpner redigering", () => {
    // Skillet er nøyaktig type-testen settFlyttbar bruker (i-text ny, text eldre lag).
    expect(ANNOTERINGS_HTML).toContain(
      "if (mål && (mål.type === 'text' || mål.type === 'i-text')) return;",
    );
    // Den gamle brede vakten som drepte klikket på enhver form er borte.
    expect(ANNOTERINGS_HTML).not.toContain("if (opt.target) return;");
  });

  // FUNN 2 (forrige runde, bevart) — forhåndsvisning under draget.
  it("viser formen live under draget (mouse:move) før den festes ved mouse:up", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.on('mouse:move'");
    expect(ANNOTERINGS_HTML).toContain("forhandsvisning");
    expect(ANNOTERINGS_HTML).toContain("byggForm(aktivtVerktoy, startPunkt, pointer)");
    expect(ANNOTERINGS_HTML).toContain("canvas.remove(forhandsvisning)");
  });
});
