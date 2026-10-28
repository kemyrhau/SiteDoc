import { describe, it, expect } from "vitest";
import { ANNOTERINGS_HTML, lagAnnoteringsHtml } from "./annoterings-html";
import { FABRIC_CDN_STI } from "./lag";
import {
  TEKST_TAP_TERSKEL,
  TRYKK_TERSKEL_TOUCH,
  FORM_TREFF_TOLERANSE,
  erTouchHendelse,
  trykkTerskel,
} from "./plassering";

/**
 * Tegnelogikken bor i en HTML-streng (kan ikke enhets-testes med canvas), så disse
 * testene vokter de egenskapene som ER regresjonsfarlige: eksportformatet (JPEG, aldri
 * PNG — målt lærdom 2ef13845/BACKLOG-772), den toveis broen (web+mobil deler HTML-en)
 * og lag-støtten (redigerbar gjenåpning).
 */
describe("ANNOTERINGS_HTML — delt tegnemotor", () => {
  it("TEST 3 — eksporterer JPEG (variabel kvalitet via ladder), ALDRI PNG", () => {
    expect(ANNOTERINGS_HTML).toContain("format: 'jpeg', quality: kvalitet");
    expect(ANNOTERINGS_HTML).not.toContain("format: 'png'");
  });

  // FRYS-FIKS (orkestrator 2026-10-21): «Ferdig» frøs på en stor base64-eksport over broen.
  // Eksporten komprimeres nå trinnvis til husregelens ≤400 KB (CLAUDE.md), og den synkrone
  // toDataURL kjøres i neste rAF så RN rekker å vise «Lagrer …» før tråden blokkeres.
  it("eksport-ladder: starter q0.8 og senker trinnvis til ≤400 KB", () => {
    expect(ANNOTERINGS_HTML).toContain("EKSPORT_KVALITETER = [0.8, 0.7, 0.6, 0.5]");
    expect(ANNOTERINGS_HTML).toContain("MAKS_EKSPORT_BYTES = 400 * 1024");
    expect(ANNOTERINGS_HTML).toContain("if (bytes <= MAKS_EKSPORT_BYTES) break;");
  });

  it("toDataURL kjøres i requestAnimationFrame (UI rekker å tegne «Lagrer …»)", () => {
    expect(ANNOTERINGS_HTML).toContain("requestAnimationFrame(function()");
  });

  it("ferdig-meldingen bærer bytes/kvalitet/eksportMs (dev-logging av størrelse+tid)", () => {
    expect(ANNOTERINGS_HTML).toContain("bytes: bytes, kvalitet: kvalitet, eksportMs:");
  });

  // Befaring (Kenneth 2026-10-21, BHO4): stor forbokstav automatisk etter punktum.
  it("tekst-tastaturet har autocapitalize='sentences' (stor forbokstav etter punktum)", () => {
    expect(ANNOTERINGS_HTML).toContain("setAttribute('autocapitalize', 'sentences')");
  });

  // RETUR (Kenneth 2026-10-22): autocapitalize virket IKKE fordi den ble satt ETTER
  // enterEditing() hadde fokusert textarea'en (iOS leser attributtet ved fokus). Fiksen
  // overstyrer fabric.IText.prototype.initHiddenTextarea så attributtene står FØR Fabric
  // fokuserer. Testen vokter at (a) overstyringen finnes og installeres, og (b) den
  // wrapper den opprinnelige metoden (kaller original før den setter attributtene).
  it("overstyrer initHiddenTextarea så autocapitalize settes FØR Fabric fokuserer", () => {
    expect(ANNOTERINGS_HTML).toContain(
      "fabric.IText.prototype.initHiddenTextarea = function()"
    );
    expect(ANNOTERINGS_HTML).toContain("original.apply(this, arguments)");
    // Installeres én gang, og kalles fra init() før noen tekst kan redigeres.
    expect(ANNOTERINGS_HTML).toContain("installerTekstTastaturFiks()");
    expect(ANNOTERINGS_HTML).toContain("__sitedocTastaturFiks");
    // Attributtet settes PÅ hiddenTextarea INNI overstyringen — altså før enterEditing
    // sin focus()-linje. Rekkefølge-sjekk: override-definisjonen kommer før klargjør-focus.
    const idxOverride = ANNOTERINGS_HTML.indexOf(
      "fabric.IText.prototype.initHiddenTextarea = function()"
    );
    const idxAttr = ANNOTERINGS_HTML.indexOf(
      "setAttribute('autocapitalize', 'sentences')"
    );
    expect(idxOverride).toBeGreaterThan(-1);
    expect(idxAttr).toBeGreaterThan(idxOverride);
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
    // hentLag: objektene UT sammen med den utflatede dataUrl-en + versjon + dims.
    // (Serialiseringen filtrerer nå tom IText først — se egen tom-tekst-vakt-test;
    // her vokter vi bare at objektene faktisk map-es til toObject.)
    expect(ANNOTERINGS_HTML).toContain("fabricVersion: fabric.version");
    expect(ANNOTERINGS_HTML).toContain(".map(function(o) { return o.toObject(); })");
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

  // DEL 1 (Kenneth 2026-10-22) — tekst skrives DIREKTE på canvas som fabric.Textbox
  // (ikke IText): Textbox har en fast bredde og bryter teksten etter den, så lange
  // setninger holder seg innenfor bildet (bilde 10-funnet). Ingen modal, ingen bro-melding.
  it("tekst legges som Textbox med bredde og går rett i redigering — ingen bro-melding", () => {
    expect(ANNOTERINGS_HTML).toContain("new fabric.Textbox('',");
    // Bredden settes fra trykkpunktet (TVILLING tekstboksStandardBredde): canvas.width − x − marg.
    expect(ANNOTERINGS_HTML).toContain("var bredde = tekstboksBredde(x);");
    expect(ANNOTERINGS_HTML).toContain("width: bredde,");
    expect(ANNOTERINGS_HTML).toContain("enterEditing()");
    // IText skal ikke lenger brukes for NY tekst (gamle lag gjenskapes som i-text, men
    // konstruktøren er borte).
    expect(ANNOTERINGS_HTML).not.toContain("new fabric.IText(");
    // KRAV c.1: ingen tekstmelding krysser broen lenger.
    expect(ANNOTERINGS_HTML).not.toContain("tekstInput");
    expect(ANNOTERINGS_HTML).not.toContain("redigerTekst");
    // Tom tekst ved avsluttet redigering fjernes på canvas (ikke over broen).
    expect(ANNOTERINGS_HTML).toContain("text:editing:exited");
  });

  // DEL 1 (d) — bredde-håndtak: kun ml/mr synlige, høyde følger teksten (lockScalingY).
  it("tekstboks har bare bredde-håndtak (ml/mr), låst høyde og rotasjon", () => {
    expect(ANNOTERINGS_HTML).toContain("ml: true, mr: true,");
    expect(ANNOTERINGS_HTML).toContain("tl: false, tr: false, bl: false, br: false, mt: false, mb: false, mtr: false,");
    expect(ANNOTERINGS_HTML).toContain("lockScalingY: true,");
    expect(ANNOTERINGS_HTML).toContain("lockRotation: true,");
    // Stor touch-treffflate på håndtaket (≥44 pt).
    expect(ANNOTERINGS_HTML).toContain("touchCornerSize: 44,");
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
  it("tekstverktøy: klikk på form lager tekst, treff på eksisterende tekst håndteres (ikke dødt klikk)", () => {
    // Skillet dekker nå alle tre tekst-typene (textbox ny, i-text/text eldre lag).
    expect(ANNOTERINGS_HTML).toContain(
      "if (mål && (mål.type === 'text' || mål.type === 'i-text' || mål.type === 'textbox')) {",
    );
    // Den gamle brede vakten som drepte klikket på enhver form er borte.
    expect(ANNOTERINGS_HTML).not.toContain("if (opt.target) return;");
  });

  // DEL 1 (a) — markøren kan flyttes. Rotårsaken var at mouse:up tvang markøren til slutten
  // HVER gang man trykket, også under redigering. Nå: trykk mens teksten ALT redigerer → la
  // Fabric beholde markøren (setCursorByClick); rent trykk på en tekst som ikke redigerte →
  // åpne redigering og sett markøren DER man trykket.
  it("tekstverktøy: markøren tvinges ikke til slutten under redigering", () => {
    // Nedtrykk husker målet OG om det alt redigerte.
    expect(ANNOTERINGS_HTML).toContain("tekstNedMål = mål;");
    expect(ANNOTERINGS_HTML).toContain("tekstNedIEditing = !!mål.isEditing;");
    // Var det alt i redigering → returner uten å røre markøren.
    expect(ANNOTERINGS_HTML).toContain("if (varIEditing) {");
    // Ellers: åpne redigering via den delte hjelperen (markør der man trykket; RETUR 5965e37b
    // flyttet enterEditing + setCursorByClick inn i apneTekstForRedigering).
    expect(ANNOTERINGS_HTML).toContain("apneTekstForRedigering(tMål, opt.e)");
  });

  // DEL 1 (c) — dra flytter teksten. Trykk-vs-dra-skille + klemming innenfor bildet. Starter
  // man å dra en tekst som redigerer, avsluttes redigeringen så gesten blir en flytt.
  it("tekstverktøy: dra flytter teksten og klemmes innenfor bildet", () => {
    expect(ANNOTERINGS_HTML).toContain("var beveget = tekstNedPunkt");
    // Dra → klem posisjonen innenfor bildet (aldri utenfor).
    expect(ANNOTERINGS_HTML).toContain("klemTekstboksObjekt(tMål);");
    // Start av dra på en tekst som redigerer → avslutt redigering.
    expect(ANNOTERINGS_HTML).toContain("tekstNedMål.exitEditing();");
    // Flytt-klemming også live under draget og etter bredde-endring.
    expect(ANNOTERINGS_HTML).toContain("canvas.on('object:moving'");
    expect(ANNOTERINGS_HTML).toContain("canvas.on('object:modified'");
  });

  it("større treffflate for tekst (minst ~44 pt): targetFindTolerance satt", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.targetFindTolerance = 22;");
  });

  // DEL 1 bakoverkompat — gammel i-text åpnes uendret; gjenskapte textbox får håndtak på nytt.
  it("gjenskaper lagrede textbox-objekter med håndtak (toObject lagrer dem ikke)", () => {
    expect(ANNOTERINGS_HTML).toContain("if (o.type === 'textbox') klargjørTekstboks(o);");
  });

  // TOM-TEKST-VAKT ved LAGRING — garanti ved konstruksjon: en tom tekst som ble stående
  // fordi enterEditing() feilet (editing:exited fyrte aldri) skal IKKE serialiseres inn i
  // laget. Filtreres i window.lagre FØR objekter.map(toObject). editing:exited-ryddingen
  // beholdes (holder lerretet rent underveis) — de to utelukker ikke hverandre.
  it("filtrerer bort tom tekst ved lagring, før serialisering", () => {
    // Predikatet dekker alle tre tekst-typene (textbox ny, i-text/text eldre lag) + tom/whitespace.
    expect(ANNOTERINGS_HTML).toContain(
      "return (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') && (!o.text || !o.text.trim());",
    );
    // Filteret ligger PÅ serialiseringen, ikke bare i hendelsen.
    expect(ANNOTERINGS_HTML).toContain("objekter.filter(function(o) { return !erTomTekst(o); }).map(");
    // Hendelses-ryddingen er fortsatt der (utelukker ikke vakten).
    expect(ANNOTERINGS_HTML).toContain("text:editing:exited");
  });

  // BEFARING — flate-anker (SVAR dc6b8090, Kenneth 2026-10-21): web skal stå UENDRET
  // (sentrert); bare mobil forankrer øverst. Standarden er "senter", så web (som bruker
  // ANNOTERINGS_HTML / lagAnnoteringsHtml() uten argument) aldri ved et uhell flyttes til topp.
  it("web-standarden er 'senter' — align-items: center uten argument", () => {
    expect(lagAnnoteringsHtml()).toContain("align-items: center;");
    expect(lagAnnoteringsHtml()).not.toContain("align-items: flex-start;");
    // Eksplisitt "senter" gir samme resultat som default.
    expect(lagAnnoteringsHtml({ anker: "senter" })).toContain("align-items: center;");
    // Den bakoverkompatible konstanten web importerer ER default-en (senter).
    expect(ANNOTERINGS_HTML).toContain("align-items: center;");
    expect(ANNOTERINGS_HTML).not.toContain("align-items: flex-start;");
  });

  it("mobil-ankeret 'topp' gir align-items: flex-start (forankret øverst)", () => {
    expect(lagAnnoteringsHtml({ anker: "topp" })).toContain("align-items: flex-start;");
    expect(lagAnnoteringsHtml({ anker: "topp" })).not.toContain("align-items: center;");
  });

  it("anker endrer KUN forankringen — all tegnelogikk er identisk i begge flater", () => {
    // Fjerner vi align-items-linja fra begge, skal resten av HTML-en være bit-identisk.
    const utenAnker = (html: string) =>
      html.replace(/align-items: (flex-start|center);/, "align-items: X;");
    expect(utenAnker(lagAnnoteringsHtml({ anker: "topp" }))).toBe(
      utenAnker(lagAnnoteringsHtml({ anker: "senter" })),
    );
  });

  // FUNN 2 (forrige runde, bevart) — forhåndsvisning under draget.
  it("viser formen live under draget (mouse:move) før den festes ved mouse:up", () => {
    expect(ANNOTERINGS_HTML).toContain("canvas.on('mouse:move'");
    expect(ANNOTERINGS_HTML).toContain("forhandsvisning");
    expect(ANNOTERINGS_HTML).toContain("byggForm(aktivtVerktoy, startPunkt, pointer)");
    expect(ANNOTERINGS_HTML).toContain("canvas.remove(forhandsvisning)");
  });

  // ── RETUR 5965e37b (Kenneth 2026-10-22, PROD STOPPET): frys + ikke-redigerbar tekst ──
  // Tegnelogikken bor i en streng → vi vokter at fiks-mønstrene FINNES. Beslutnings-logikken
  // (trykk vs. dra, verktøy-agnostisk) er enhets-testet i plassering.test.ts (tvillingen).
  describe("RETUR 5965e37b — frys-pin + verktøy-agnostisk tap-til-rediger", () => {
    it("låser visningsporten (position:fixed) mot WKWebViews tastatur-scroll (frysen)", () => {
      expect(ANNOTERINGS_HTML).toContain("html, body { position: fixed;");
    });

    it("scroll-pinnen tilbakestiller til (0,0) og lytter på visualViewport", () => {
      expect(ANNOTERINGS_HTML).toContain("window.scrollTo(0, 0)");
      expect(ANNOTERINGS_HTML).toContain("window.visualViewport.addEventListener('scroll', pinnViewport)");
      expect(ANNOTERINGS_HTML).toContain("window.visualViewport.addEventListener('resize', pinnViewport)");
      expect(ANNOTERINGS_HTML).toContain("monterScrollPin()");
    });

    it("et trykk på en tekst i et TEGNE-verktøy armer en kandidat (ikke bare Tekst-verktøyet)", () => {
      // Kandidaten armes i mouse:down-grenen etter at startPunkt er satt (tegne-verktøy).
      expect(ANNOTERINGS_HTML).toContain("tekstTapKandidat = dmål;");
    });

    it("mouse:up skiller trykk (< terskel for inndataen → rediger) fra dra (→ tegn formen)", () => {
      // RETUR velg-alle: terskelen følger inndataen (touch 22 / mus 10), se blokken under.
      expect(ANNOTERINGS_HTML).toContain("if (flyttLengde < gTerskel) {");
      // Terskel-konstanten er interpolert fra plassering.ts (tvilling), ikke hardkodet.
      expect(ANNOTERINGS_HTML).toContain(`var TEKST_TAP_TERSKEL = ${TEKST_TAP_TERSKEL};`);
    });

    it("tekst-treff dekker både ny textbox og gammel i-text/text (prod-annotering åpnes)", () => {
      expect(ANNOTERINGS_HTML).toContain(
        "dmål.type === 'text' || dmål.type === 'i-text' || dmål.type === 'textbox'",
      );
    });

    it("ÉN robust enter-editing-vei: setCursorByClick i try/catch med markør-på-slutten fallback", () => {
      expect(ANNOTERINGS_HTML).toContain("function apneTekstForRedigering(o, evt)");
      expect(ANNOTERINGS_HTML).toContain("try { o.setCursorByClick(evt); plassert = true; } catch");
      // Begge trykk-veiene (Tekst-verktøy + verktøy-agnostisk) bruker samme hjelper.
      expect(ANNOTERINGS_HTML).toContain("apneTekstForRedigering(tMål, opt.e)");
      expect(ANNOTERINGS_HTML).toContain("apneTekstForRedigering(kTekst, opt.e)");
    });

    it("tekst er alltid evented, men selectable bare i select/text (dra fra tekst tegner formen)", () => {
      expect(ANNOTERINGS_HTML).toContain(
        "o.set({ evented: true, selectable: (aktivtVerktoy === 'select' || aktivtVerktoy === 'text') });",
      );
    });
  });

  // ── Velg alle objekter (Kenneth 2026-10-28) ── beslutningslogikken er enhets-testet i
  // plassering.test.ts (tvillingene); her vokter vi at HTML-en bruker dem og at koden er gyldig.
  describe("Velg alle objekter — trykk velger, dra på valgt flytter, håndtak endrer", () => {
    it("inline-JS-en er gyldig syntaks (en backtick eller dollar-klamme i en kommentar ville brekke den)", () => {
      const m = ANNOTERINGS_HTML.match(/<script>\n([\s\S]*?)<\/script>/);
      expect(m).not.toBeNull();
      expect(() => new Function(m![1]!)).not.toThrow();
    });

    it("treff-toleransen er interpolert fra plassering.ts (tvilling), ikke hardkodet", () => {
      expect(ANNOTERINGS_HTML).toContain(`var FORM_TREFF_TOLERANSE = ${FORM_TREFF_TOLERANSE};`);
    });

    it("inliner tvillingene objektTrykkHandling og avstandTilForm", () => {
      expect(ANNOTERINGS_HTML).toContain("function objektTrykkHandling(p)");
      expect(ANNOTERINGS_HTML).toContain("function avstandTilForm(p, g)");
      expect(ANNOTERINGS_HTML).toContain("if (p.valgtType === 'form') return 'fjern-valg';");
    });

    it("former treffes på streken via finnTreff/formGeometri (ikke rammeboksen)", () => {
      expect(ANNOTERINGS_HTML).toContain("if (avstandTilForm(p, formGeometri(o)) <= t) return o;");
    });

    it("gesten starter på det valgte objektet → Fabric eier draget (flytt/håndtak)", () => {
      expect(ANNOTERINGS_HTML).toContain("canvas.on('mouse:down:before'");
      expect(ANNOTERINGS_HTML).toContain("if (valgtVedStart && opt.target === valgtVedStart && opt.transform &&");
    });

    it("bare det valgte objektet er aktivt; frihånd-modus av mens noe er valgt", () => {
      expect(ANNOTERINGS_HTML).toContain("var kan = !!flyttbar || (!!canvas && o === canvas.getActiveObject());");
      expect(ANNOTERINGS_HTML).toContain("canvas.isDrawingMode = (aktivtVerktoy === 'draw' && !canvas.getActiveObject());");
      expect(ANNOTERINGS_HTML).toContain("canvas.on('selection:cleared', etterValgEndring);");
    });

    it("håndtak på telefon: synlig 14, treffflate 44, ingen rotasjon utenfor web-«Flytt»", () => {
      expect(ANNOTERINGS_HTML).toContain("function klargjørForm(o)");
      expect(ANNOTERINGS_HTML).toContain("lockRotation: !iVelg,");
      expect(ANNOTERINGS_HTML).toContain(
        "o.setControlsVisibility({ tl: true, tr: true, bl: true, br: true, ml: true, mr: true, mt: true, mb: true, mtr: false });",
      );
    });

    it("pil: to endepunkt-håndtak som bygger pila på nytt med byggPil (og beholder streken)", () => {
      expect(ANNOTERINGS_HTML).toContain("o.controls = { fra: lagPilKontroll('fra'), til: lagPilKontroll('til') };");
      expect(ANNOTERINGS_HTML).toContain("pilDra.forh = byggPil(pilDra.nyFra, pilDra.nyTil, pilDra.strek);");
      expect(ANNOTERINGS_HTML).toContain("historikk.push({ type: 'erstattet', gammel: d.gammel, ny: ny });");
    });

    it("frihånd: trykk fjerner mikrostrøket; dra fra valg starter strøket i samme gest", () => {
      expect(ANNOTERINGS_HTML).toContain("if (dh !== 'tegn' && gSti) fjernMikrostrok(gSti);");
      expect(ANNOTERINGS_HTML).toContain("canvas._onMouseDownInDrawingMode(opt.e)");
    });

    it("strek konstant ved skalering: strokeUniform med gjeldende skala brettet inn", () => {
      expect(ANNOTERINGS_HTML).toContain("b.set({ strokeWidth: b.strokeWidth * s * bs, strokeUniform: true });");
      expect(ANNOTERINGS_HTML).toContain("tr.action.indexOf('scale') === 0) gjorStrekUniform(o);");
    });

    it("reskalering: strokeUniform-objekter får strokeWidth × ratio (tvilling reskalerLagObjekt)", () => {
      expect(ANNOTERINGS_HTML).toContain(
        "if (o.strokeUniform && typeof o.strokeWidth === 'number') o.set('strokeWidth', o.strokeWidth * ratio);",
      );
    });

    it("angre omfatter flytt og størrelse (endret-handling fra before:transform/object:modified)", () => {
      expect(ANNOTERINGS_HTML).toContain("canvas.on('before:transform'");
      expect(ANNOTERINGS_HTML).toContain("historikk.push({ type: 'endret', obj: mo, for: forTilstand.tilstand });");
      expect(ANNOTERINGS_HTML).toContain("settTilstand(h.obj, h.for);");
    });

    it("gjenåpnede former får håndtak (klargjørForm) og web-«Flytt» er beholdt", () => {
      expect(ANNOTERINGS_HTML).toContain("if (o.type === 'textbox') klargjørTekstboks(o); else klargjørForm(o);");
      expect(ANNOTERINGS_HTML).toContain("canvas.selection = iVelg;");
    });
  });

  // ── RETUR velg-alle (Kenneth på telefon 2026-10-28) ── et vinglete fingertrykk ble et dra.
  // Ekte touch-veien (CDP-touch, iPhone 13-skalering) er testet i tests/e2e/annotering/trykk-touch.spec.ts.
  describe("RETUR velg-alle — trykk-terskelen følger inndataen (touch 22 px, mus 10 px)", () => {
    const script = () => ANNOTERINGS_HTML.match(/<script>\n([\s\S]*?)<\/script>/)![1]!;
    const inlineFunksjon = (navn: string) => {
      const m = script().match(new RegExp(`  function ${navn}\\([\\s\\S]*?\\n  }\\n|  function ${navn}\\(.*\\}\\n`));
      expect(m, navn).not.toBeNull();
      return m![0];
    };

    it("touch-terskelen er interpolert fra plassering.ts (tvilling), ikke hardkodet", () => {
      expect(ANNOTERINGS_HTML).toContain(`var TRYKK_TERSKEL_TOUCH = ${TRYKK_TERSKEL_TOUCH};`);
    });

    it("inline erTouchHendelse/trykkTerskel gir samme svar som tvillingene", () => {
      const kilde =
        `var TEKST_TAP_TERSKEL = ${TEKST_TAP_TERSKEL}; var TRYKK_TERSKEL_TOUCH = ${TRYKK_TERSKEL_TOUCH};\n` +
        inlineFunksjon("erTouchHendelse") + inlineFunksjon("trykkTerskel") +
        "return { erTouchHendelse: erTouchHendelse, trykkTerskel: trykkTerskel };";
      const inline = new Function(kilde)() as { erTouchHendelse: typeof erTouchHendelse; trykkTerskel: typeof trykkTerskel };
      const hendelser = [
        { type: "touchstart" }, { type: "touchend" }, { type: "mousedown" }, { type: "pointerdown", pointerType: "touch" },
        { type: "pointerdown", pointerType: "mouse" }, {}, null,
      ];
      for (const e of hendelser) expect(inline.erTouchHendelse(e), JSON.stringify(e)).toBe(erTouchHendelse(e));
      for (const t of [true, false]) expect(inline.trykkTerskel(t)).toBe(trykkTerskel(t));
    });

    it("gesten husker om den kom fra en finger, og mouse:up måler mot terskelen for inndataen", () => {
      expect(ANNOTERINGS_HTML).toContain("gestErTouch = erTouchHendelse(opt.e);");
      expect(ANNOTERINGS_HTML).toContain("var gTerskel = trykkTerskel(gestErTouch);");
      expect(ANNOTERINGS_HTML).toContain("var gBeveget = gestMaks >= gTerskel;");
      expect(ANNOTERINGS_HTML).not.toContain("var gBeveget = gestMaks >= TEKST_TAP_TERSKEL;");
    });

    it("et fingertrykk under terskelen tegner aldri en mini-form (mus beholder 5 px)", () => {
      expect(ANNOTERINGS_HTML).toContain("if (avstand < 5 || (gErTouch && !gBeveget)) {");
    });
  });

  // ── RETUR svart gjenåpning (2026-10-28) ── et bilde som ikke lar seg dekode ga et stille svart
  // lerret. Ekte WebView-vei (RN-bro simulert): tests/e2e/annotering/gjenaapning.spec.ts.
  describe("RETUR svart gjenåpning — HTML-en melder bildeLastet/bildeFeil til verten", () => {
    it("feilet eller tomt bilde → bildeFeil, ingen videre oppsett", () => {
      expect(ANNOTERINGS_HTML).toContain("fabric.Image.fromURL(bildeUrl, function(img, erFeil) {");
      expect(ANNOTERINGS_HTML).toContain("if (erFeil || !img || !img.width || !img.height) {");
      expect(ANNOTERINGS_HTML).toContain("postTilVert({ type: 'bildeFeil' });");
    });

    it("bildeLastet sendes først når bakgrunnen (og ev. lagrede objekter) er lagt på", () => {
      expect(ANNOTERINGS_HTML.match(/postTilVert\(\{ type: 'bildeLastet' \}\);/g)).toHaveLength(2);
      // Oppfølger: et lag Fabric ikke kan gjenskape skal aldri låse flaten på «Laster bildet …».
      expect(ANNOTERINGS_HTML).toContain("} catch (e) {\n            meldLastet();\n          }");
    });
  });
});
