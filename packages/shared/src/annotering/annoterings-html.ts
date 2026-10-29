// Delt tegnemotor for bildeannotering (mobil + web). ÉN kilde — ikke kopier.
//
// Mobil laster denne som `WebView source={{ html }}` (RN-WebView-bro:
// window.ReactNativeWebView). Web laster den som `<iframe srcDoc={...}>`
// (iframe-bro: window.parent.postMessage). Broen er derfor TOVEIS og
// selv-detekterende — ÉN implementasjon, ingen to grener som drifter.
//
// Fabric.js lastes fra CDN (cdnjs). Web-appen setter ingen CSP-header
// (next.config.js: kun HSTS + X-Frame-Options), så CDN-en laster i begge
// flater fra nøyaktig samme <script src> — én kilde, ikke to.
//
// Eksport: JPEG q0.92 med hvit bakgrunn (IKKE PNG — PNG q1 av et foto blir
// 3–4 MB; målt 2026-08-26, BACKLOG-772). q0.92 ligger over Chromiums
// 4:4:4-terskel (~0.9); lavere flipper til chroma-subsampling som gjør
// 3px røde streker uleselige.
import { BRO_RN_BETINGELSE, BRO_IFRAME_BETINGELSE } from "./bro";
import {
  FABRIC_CDN_STI,
  ANNOTERING_STREK_FARGE,
  ANNOTERING_KONTRAST_FARGE,
  ANNOTERING_REFERANSE_BREDDE,
  ANNOTERING_BASIS_STREK,
  ANNOTERING_BASIS_FONT,
  ANNOTERING_KONTRAST_FRAKSJON,
  ANNOTERING_TEKST_KANT_FRAKSJON,
  ANNOTERING_PILHODE_FAKTOR,
} from "./lag";
import {
  TEKSTBOKS_MARG,
  TEKSTBOKS_MIN_BREDDE,
  TEKST_TAP_TERSKEL,
  TRYKK_TERSKEL_TOUCH,
  FORM_TREFF_TOLERANSE,
} from "./plassering";

// Flate-anker for bildet i annoteringsflaten (befaring-funn A + orkestrator-SVAR
// dc6b8090, Kenneth 2026-10-21):
//   "senter" — bildet vertikalt sentrert (align-items: center). WEB-STANDARDEN;
//              web har ikke tastaturproblemet og skal stå uendret.
//   "topp"   — bildet forankret ØVERST (align-items: flex-start), rett under
//              overskriftslinja. KUN mobil, der RN reserverer tastaturhøyden og
//              bildet må stå fast rett under overskriften.
export type AnnoteringsAnker = "topp" | "senter";

/**
 * Bygger den delte annoterings-HTML-en. `anker` styrer KUN den vertikale
 * forankringen av bildet i flaten (`#canvas-container align-items`); all
 * tegnelogikk er identisk. Standard er "senter" slik at web (og enhver fremtidig
 * konsument) får dagens sentrerte oppførsel uten å sende noe. Bare mobil sender
 * "topp".
 */
export function lagAnnoteringsHtml(opts?: { anker?: AnnoteringsAnker }): string {
  const anker: AnnoteringsAnker = opts?.anker ?? "senter";
  const flateJustering = anker === "topp" ? "flex-start" : "center";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /* Frys-fiks (RETUR 5965e37b): lås visningsporten. WKWebView scroller markøren «synlig»
     når tastaturet vises, men hele lerretet ligger alt OVER tastaturet (RN reserverer
     tastaturhøyden), så enhver scroll dytter bare teksten ut av syne. position:fixed +
     scroll-pin-lytteren (JS) hindrer det. Annoteringen har ingen pan/zoom, så ingenting
     annet trenger å scrolle. */
  html, body { position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
  body { background: #000; touch-action: none; }
  /* Vertikal forankring styres av anker-parameteren:
     - "topp" (mobil): bildet forankres ØVERST, rett under overskriftslinja —
       befaring-funn A (Kenneth 2026-10-21): fast bildeposisjon, aldri sentrert
       bort fra overskriften. RN gir WebView-en fast høyde (reservert tastatur),
       så bildet står stille med og uten tastatur.
     - "senter" (web, standard): bildet vertikalt sentrert — web har ikke
       tastaturproblemet og skal stå uendret. Horisontalt alltid sentrert. */
  #canvas-container { width: 100vw; height: 100vh; display: flex; align-items: ${flateJustering}; justify-content: center; }
  canvas { display: block; }
</style>
</head>
<body>
<div id="canvas-container">
  <canvas id="c"></canvas>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/${FABRIC_CDN_STI}/fabric.min.js"></script>
<script>
(function() {
  var canvas;
  var aktivtVerktoy = 'arrow';
  var startPunkt = null;
  var forhandsvisning = null;
  // Tekstverktøy (befaring-funn C2, Kenneth 2026-10-21): skille et rent TRYKK på en
  // eksisterende tekst (→ rediger, markør på slutten) fra en DRA (→ flytt). Målet og
  // startpunktet huskes fra mouse:down til mouse:up.
  var tekstNedMål = null;
  var tekstNedPunkt = null;
  // Var tekstboksen ALT i redigering da brukeren trykket? Avgjør i mouse:up om vi skal la
  // Fabrics markør-plassering stå (ja) eller åpne redigering på nytt (nei).
  var tekstNedIEditing = false;
  // RETUR 5965e37b (Kenneth 2026-10-22): et TRYKK på en tekst skal åpne redigering i ALLE
  // verktøy, ikke bare Tekst. I et tegne-verktøy armer vi en kandidat ved mouse:down og lar
  // mouse:up skille trykk (< TEKST_TAP_TERSKEL → rediger) fra dra (→ tegn formen som før).
  var tekstTapKandidat = null;
  var tekstTapPunkt = null;
  // Farger og basis-tall interpoleres fra @sitedoc/shared lag.ts (én kilde, samme
  // mønster som bro-betingelsene). Strek/font vokser SUB-LINEÆRT (kvadratrot) med
  // canvas-bredden fra referanse-canvas (mobil ~390px) — lineær ble for tykk på stor
  // web-canvas. Kontrastkanten er en andel av streken, ikke et fast tillegg. Skala-formelen
  // og skalert*/formKontrastStil/formLagBeskrivelse/tekstKontrastStil i lag.ts er tvillingene.
  var STREK_FARGE = '${ANNOTERING_STREK_FARGE}';
  var KONTRAST_FARGE = '${ANNOTERING_KONTRAST_FARGE}';
  var REFERANSE_BREDDE = ${ANNOTERING_REFERANSE_BREDDE};
  var BASIS_STREK = ${ANNOTERING_BASIS_STREK};
  var BASIS_FONT = ${ANNOTERING_BASIS_FONT};
  var KONTRAST_FRAKSJON = ${ANNOTERING_KONTRAST_FRAKSJON};
  var TEKST_KANT_FRAKSJON = ${ANNOTERING_TEKST_KANT_FRAKSJON};
  var PILHODE_FAKTOR = ${ANNOTERING_PILHODE_FAKTOR};
  // Tekstboks-geometri (Del 1, Kenneth 2026-10-22). 🔴 TVILLING av tekstboksStandardBredde/
  // klemTekstboksPosisjon i @sitedoc/shared plassering.ts — de to er enhets-testbare, denne
  // inlinede kopien er det ikke. Endres formelen der, endres den her.
  var TEKSTBOKS_MARG = ${TEKSTBOKS_MARG};
  var TEKSTBOKS_MIN_BREDDE = ${TEKSTBOKS_MIN_BREDDE};
  // Trykk-vs-dra-terskel (canvas-piksler). TVILLING: TEKST_TAP_TERSKEL i plassering.ts.
  var TEKST_TAP_TERSKEL = ${TEKST_TAP_TERSKEL};
  // Touch-terskel (RETUR velg-alle): en finger vingler; musens 10 px gjorde trykk om til dra.
  // TVILLING: TRYKK_TERSKEL_TOUCH / erTouchHendelse / trykkTerskel / erGestBeveget i plassering.ts.
  var TRYKK_TERSKEL_TOUCH = ${TRYKK_TERSKEL_TOUCH};
  function erTouchHendelse(e) {
    if (!e) return false;
    if (typeof e.type === 'string' && e.type.indexOf('touch') === 0) return true;
    return e.pointerType === 'touch';
  }
  function trykkTerskel(erTouch) { return erTouch ? TRYKK_TERSKEL_TOUCH : TEKST_TAP_TERSKEL; }
  var objekter = [];
  // ── Velg alle objekter (Kenneth 2026-10-28) ── trykk på en form velger den, dra på det
  // valgte flytter, dra i håndtak endrer, dra fra en ikke-valgt form tegner, trykk på tomt
  // fjerner valget. Beslutningen er TVILLING av objektTrykkHandling i plassering.ts.
  // Treff mot formens STREK (TVILLING avstandTilForm), toleranse = FORM_TREFF_TOLERANSE.
  var FORM_TREFF_TOLERANSE = ${FORM_TREFF_TOLERANSE};
  // Angre-stakk (TVILLING angreSisteHandling): {lagt-til}, {endret, for}, {erstattet}.
  var historikk = [];
  // Gestens øyeblikksbilde, satt i mouse:down:before og nullstilt i mouse:up.
  var valgtVedStart = null;
  var gestStart = null;
  var gestMaks = 0;
  var gestErTouch = false;
  var gestTraffValgt = false;
  var gestTraffHandtak = false;
  var formKandidat = null;
  var formKandidatPunkt = null;
  var drawKandidat = null;
  var stiIGest = null;
  // Vakt mot at vår egen start av frihånd (intern Fabric-API) kaller mouse:down på nytt.
  var iProgrammatiskNed = false;
  // Tilstand før en flytt/størrelse-endring (fanget i before:transform) for angre.
  var forTilstand = null;
  // Pågående dra i et pil-endepunkt: {gammel, nyFra, nyTil, strek, forh}.
  var pilDra = null;
  // Dev-signal: er WKWebViews tastatur-scroll korrigert minst én gang (frys-funnet)?
  var harMeldtScrollKorrigert = false;

  // Bredden til en ny tekstboks: fra trykkpunktet til høyre kant minus marg, klemt mot
  // minBredde og flatens bredde (TVILLING: tekstboksStandardBredde).
  function tekstboksBredde(trykkX) {
    var cw = canvas ? canvas.width : 0;
    var fraTrykk = cw - trykkX - TEKSTBOKS_MARG;
    var maksIFlate = Math.max(0, cw - 2 * TEKSTBOKS_MARG);
    var onsket = Math.max(TEKSTBOKS_MIN_BREDDE, fraTrykk);
    return Math.max(0, Math.min(onsket, maksIFlate));
  }

  // Klem en tekstboks' hjørne innenfor bildet (TVILLING: klemTekstboksPosisjon). Bruker
  // objektets utflatede bredde/høyde (getScaledWidth/Height) så den aldri havner utenfor.
  function klemTekstboksObjekt(o) {
    if (!canvas) return;
    var marg = TEKSTBOKS_MARG;
    var bredde = o.getScaledWidth ? o.getScaledWidth() : (o.width || 0);
    var hoyde = o.getScaledHeight ? o.getScaledHeight() : (o.height || 0);
    var maksLeft = canvas.width - marg - bredde;
    var maksTop = canvas.height - marg - hoyde;
    var nyLeft = Math.max(marg, Math.min(o.left || 0, maksLeft));
    var nyTop = Math.max(marg, Math.min(o.top || 0, maksTop));
    if (nyLeft !== o.left || nyTop !== o.top) { o.set({ left: nyLeft, top: nyTop }); o.setCoords(); }
  }

  function naaSkala() { return (canvas && canvas.width > 0) ? Math.sqrt(canvas.width / REFERANSE_BREDDE) : 1; }
  function strekBredde() { return BASIS_STREK * naaSkala(); }
  function fontStr() { return BASIS_FONT * naaSkala(); }
  function kontrastKant() { return strekBredde() * KONTRAST_FRAKSJON; }
  function tekstKant() { return fontStr() * TEKST_KANT_FRAKSJON; }

  // Toveis bro: RN-WebView bruker window.ReactNativeWebView.postMessage,
  // web-iframe bruker window.parent.postMessage. Samme kall begge steder.
  // 🔴 TVILLING av postTilVert() i @sitedoc/shared bro.ts — grenvalget er testet
  // der (WebKit/Safari treffer bare parent-grenen). Endres grenene, endres begge.
  function postTilVert(obj) {
    var melding = JSON.stringify(obj);
    if (${BRO_RN_BETINGELSE}) {
      window.ReactNativeWebView.postMessage(melding);
    } else if (${BRO_IFRAME_BETINGELSE}) {
      window.parent.postMessage(melding, '*');
    }
  }

  function init() {
    // Installer tastatur-overstyringen FØR noen tekst kan gå i redigering (se funksjonen).
    installerTekstTastaturFiks();

    var container = document.getElementById('canvas-container');
    var w = container.clientWidth;
    var h = container.clientHeight;

    canvas = new fabric.Canvas('c', {
      width: w,
      height: h,
      selection: false,
      isDrawingMode: false,
    });

    // Befaring-funn C2 (Kenneth 2026-10-21): større treffflate for å plukke/redigere en
    // eksisterende tekst (minst ~44 pt). targetFindTolerance utvider treffsonen rundt
    // objektene med 22 px på hver side (≈44 px total) uten per-piksel-leting.
    canvas.targetFindTolerance = 22;
    canvas.perPixelTargetFind = false;

    canvas.freeDrawingBrush.color = STREK_FARGE;
    canvas.freeDrawingBrush.width = strekBredde();

    // Velg alle objekter: øyeblikksbilde av gesten FØR Fabric rører valget (Fabric fjerner
    // valget i sin egen mouse:down når trykket ikke treffer det valgte objektet).
    canvas.on('mouse:down:before', function(opt) {
      if (iProgrammatiskNed) return;
      valgtVedStart = canvas.getActiveObject() || null;
      var bp = canvas.getPointer(opt.e);
      gestStart = { x: bp.x, y: bp.y };
      gestMaks = 0;
      gestErTouch = erTouchHendelse(opt.e);
      gestTraffValgt = false;
      gestTraffHandtak = false;
      formKandidat = null;
      formKandidatPunkt = null;
      drawKandidat = null;
      stiIGest = null;
    });

    canvas.on('mouse:down', function(opt) {
      if (iProgrammatiskNed) return;
      // Reserve hvis mouse:down:before ikke fyrte (gesten må ha et startpunkt for trykk vs. dra).
      if (!gestStart) {
        var gs = canvas.getPointer(opt.e);
        gestStart = { x: gs.x, y: gs.y };
        gestMaks = 0;
        gestErTouch = erTouchHendelse(opt.e);
      }
      // 'select' = web-«Flytt» (Fabric eier valg/flytt/marquee) — vi skal IKKE lage en ny form.
      if (aktivtVerktoy === 'select') return;
      // Gesten startet på det VALGTE objektet (kroppen eller et håndtak): Fabric eier draget
      // (flytt / endre størrelse / pil-endepunkt). En valgt TEKST går videre til tekst-logikken
      // under (dra fra redigering = flytt, Del 1), unntatt i Frihånd der det ikke finnes en.
      if (valgtVedStart && opt.target === valgtVedStart && opt.transform &&
          (!erTekstObj(valgtVedStart) || aktivtVerktoy === 'draw')) {
        gestTraffValgt = true;
        gestTraffHandtak = !!opt.transform.corner;
        forberedTransform(opt.transform);
        return;
      }
      // Frihånd: Fabric tegner selv (isDrawingMode). Vi husker hva gesten startet på, så
      // mouse:up kan gjøre et TRYKK om til velg/rediger (og fjerne et ev. mikrostrøk).
      if (aktivtVerktoy === 'draw') {
        var pdr = canvas.getPointer(opt.e);
        drawKandidat = finnTreff(pdr, true);
        // Noe var valgt → tegnemodus var av under nedtrykket. Start frihånd i SAMME gest via
        // Fabrics interne _onMouseDownInDrawingMode. Mangler den, fjerner første dra bare
        // valget (godtatt fallback).
        if (valgtVedStart && !canvas._isCurrentlyDrawing && typeof canvas._onMouseDownInDrawingMode === 'function') {
          canvas.isDrawingMode = true;
          iProgrammatiskNed = true;
          try { canvas._onMouseDownInDrawingMode(opt.e); } finally { iProgrammatiskNed = false; }
        }
        return;
      }
      // 'text' = skriv rett på bildet. Regel (Kenneth 2026-09-30): et klikk oppretter
      // ALLTID tekst — UNNTATT når det treffer en eksisterende TEKST, som da åpnes for
      // redigering (Fabric eier klikket). Å velge en pil/sirkel/firkant hører til Flytt,
      // ikke tekstverktøyet; et treff på en form skal derfor lage NY tekst oppå den, ikke
      // plukke den opp. Før døde klikket stille på ethvert opt.target (rammeboksen dekker
      // mer enn den synlige streken → man traff noe uten å kunne vite det). Tekst er
      // 'textbox' (ny) eller 'i-text'/'text' (eldre lag) — samme skille som settFlyttbar.
      if (aktivtVerktoy === 'text') {
        var mål = opt.target;
        if (mål && (mål.type === 'text' || mål.type === 'i-text' || mål.type === 'textbox')) {
          // Del 1 (Kenneth 2026-10-22): husk målet, nedpunktet og om det ALT redigerte, så
          // mouse:up kan skille rent trykk (→ rediger) fra dra (→ flytt). La Fabric eie
          // klikket — markør-flytting hvis det redigerte, ellers oppsett av flytt-transform.
          // Vi tvinger IKKE setActiveObject/markør her (det var (a)-/(c)-rotårsaken).
          var tpMål = canvas.getPointer(opt.e);
          tekstNedMål = mål;
          tekstNedPunkt = { x: tpMål.x, y: tpMål.y };
          tekstNedIEditing = !!mål.isEditing;
          return;
        }
        var tp = canvas.getPointer(opt.e);
        // Velg alle objekter (a): trykk på en forms STREK velger formen; et dra derfra lager
        // tekst som før. Avgjøres i mouse:up. Trykk INNE i formen (langt fra streken) lager tekst.
        var tf = finnTreff(tp, false);
        if (tf) {
          formKandidat = tf;
          formKandidatPunkt = { x: tp.x, y: tp.y };
          return;
        }
        // En valgt FORM: trykket fjerner valget (Fabric har alt gjort det) — ingen ny tekst.
        if (valgtVedStart && !erTekstObj(valgtVedStart)) return;
        lagTekst(tp.x, tp.y);
        return;
      }
      // Tegne-verktøy (pil/sirkel/firkant): start en mulig form-drag …
      var pointer = canvas.getPointer(opt.e);
      startPunkt = { x: pointer.x, y: pointer.y };
      // … men arm samtidig et TRYKK-på-tekst (RETUR 5965e37b). Teksten er evented, men ikke
      // selectable i tegne-verktøy (settFlyttbar), så Fabric plukker den ikke opp — vi avgjør
      // trykk vs. dra i mouse:up. TVILLING: skalTekstTapRedigere/erTekstType i plassering.ts.
      var dmål = opt.target;
      if (dmål && (dmål.type === 'text' || dmål.type === 'i-text' || dmål.type === 'textbox')) {
        tekstTapKandidat = dmål;
        tekstTapPunkt = { x: pointer.x, y: pointer.y };
      } else {
        // Velg alle objekter: et trykk på en forms strek velger den (mouse:up); et dra tegner.
        formKandidat = finnTreff(pointer, false);
      }
    });

    // Forhåndsvisning under draget: samme bygger som endelig form, lagt på canvas
    // men IKKE i objekter (angre/eksport rører den ikke). Byttes hver mus-bevegelse
    // og fjernes ved mouse:up. Felles mangel web+mobil — begge fikk den ved at den
    // bor i den delte HTML-en.
    canvas.on('mouse:move', function(opt) {
      // Største avstand fra nedtrykket i gesten — et frihåndsstrøk som ender der det startet
      // er likevel et dra, ikke et trykk.
      if (gestStart) {
        var gp = canvas.getPointer(opt.e);
        var gd = Math.sqrt((gp.x - gestStart.x) * (gp.x - gestStart.x) + (gp.y - gestStart.y) * (gp.y - gestStart.y));
        if (gd > gestMaks) gestMaks = gd;
      }
      // Del 1: begynner brukeren å DRA en tekst som redigerer, avslutt redigeringen så
      // draget flytter boksen (ellers fanger den skjulte textarea-en gesten som tekst-
      // markering — Kenneth: «tekst kan ikke flyttes»). Start flytt-transformen manuelt i
      // samme gest så det føles sømløst; faller tilbake til «neste dra flytter» hvis den
      // interne API-en mangler.
      if (aktivtVerktoy === 'text' && tekstNedMål && tekstNedIEditing) {
        var mp = canvas.getPointer(opt.e);
        if (tekstNedPunkt && Math.sqrt(
          (mp.x - tekstNedPunkt.x) * (mp.x - tekstNedPunkt.x) +
          (mp.y - tekstNedPunkt.y) * (mp.y - tekstNedPunkt.y)) > 6) {
          tekstNedMål.exitEditing();
          tekstNedIEditing = false;
          canvas.setActiveObject(tekstNedMål);
          if (canvas._setupCurrentTransform) {
            canvas._setupCurrentTransform(opt.e, tekstNedMål, true);
          }
        }
      }
      if (!startPunkt || aktivtVerktoy === 'draw' || aktivtVerktoy === 'select' || aktivtVerktoy === 'text') return;
      var pointer = canvas.getPointer(opt.e);
      var mdx = pointer.x - startPunkt.x;
      var mdy = pointer.y - startPunkt.y;
      // Ingen forhåndsvisning for et vinglete fingertrykk (blafring før valget).
      if (Math.sqrt(mdx * mdx + mdy * mdy) < (gestErTouch ? TRYKK_TERSKEL_TOUCH : 5)) return;
      if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
      var forh = byggForm(aktivtVerktoy, startPunkt, pointer);
      if (forh) { forhandsvisning = forh; canvas.add(forh); canvas.renderAll(); }
    });

    canvas.on('mouse:up', function(opt) {
      // Velg alle objekter: les og nullstill gestens øyeblikksbilde.
      // Terskelen følger inndataen: touch 22 px, mus 10 px (TVILLING erGestBeveget).
      var gTerskel = trykkTerskel(gestErTouch);
      var gBeveget = gestMaks >= gTerskel;
      var gErTouch = gestErTouch;
      var gValgt = valgtVedStart;
      var gTraffValgt = gestTraffValgt;
      var gFormKandidat = formKandidat;
      var gFormPunkt = formKandidatPunkt;
      var gDrawKandidat = drawKandidat;
      var gSti = stiIGest;
      gestStart = null; gestMaks = 0; gestErTouch = false; gestTraffValgt = false; gestTraffHandtak = false;
      formKandidat = null; formKandidatPunkt = null; drawKandidat = null; stiIGest = null;
      valgtVedStart = null;
      // Pil-endepunkt: bytt inn den nye pila ETTER at Fabric har avsluttet transformen.
      if (pilDra) setTimeout(fullforPilDra, 0);
      forTilstand = null;
      // Gesten startet på det valgte objektet: Fabric har flyttet/endret (angre: object:modified).
      if (gTraffValgt) return;
      if (aktivtVerktoy === 'select') return;
      if (aktivtVerktoy === 'draw') {
        // Dobbel sikring: et strøk som er større enn terskelen er et dra, uansett målingen over.
        if (gSti && !gBeveget && gSti.getBoundingRect) {
          var sb = gSti.getBoundingRect(true, true);
          if (Math.max(sb.width, sb.height) - (gSti.strokeWidth || 0) >= gTerskel) gBeveget = true;
        }
        var dh = objektTrykkHandling({
          treffType: typeAv(gDrawKandidat), aktivtVerktoy: aktivtVerktoy, beveget: gBeveget,
          traffValgt: false, traffHandtak: false, valgtType: typeAv(gValgt),
        });
        // Et trykk som velger/redigerer/fjerner valg skal ikke etterlate en prikk.
        if (dh !== 'tegn' && gSti) fjernMikrostrok(gSti);
        if (dh === 'rediger-tekst') apneTekstForRedigering(gDrawKandidat, opt.e);
        else if (dh === 'velg') velgObjekt(gDrawKandidat);
        canvas.renderAll();
        return;
      }
      if (aktivtVerktoy === 'text' && gFormKandidat) {
        var th = objektTrykkHandling({
          treffType: 'form', aktivtVerktoy: aktivtVerktoy, beveget: gBeveget,
          traffValgt: false, traffHandtak: false, valgtType: typeAv(gValgt),
        });
        if (th === 'velg') velgObjekt(gFormKandidat);
        else if (gFormPunkt) lagTekst(gFormPunkt.x, gFormPunkt.y);
        return;
      }
      // Befaring-funn C2: tekst som ble trykket/dratt i Tekst-verktøyet. Rent trykk (ingen
      // bevegelse) → åpne for redigering med markøren på SLUTTEN. Dra → Fabric har allerede
      // flyttet objektet, ikke åpne redigering. Målet huskes fra mouse:down.
      if (tekstNedMål) {
        var tMål = tekstNedMål; tekstNedMål = null;
        var varIEditing = tekstNedIEditing; tekstNedIEditing = false;
        var up = canvas.getPointer(opt.e);
        var beveget = tekstNedPunkt && Math.sqrt(
          (up.x - tekstNedPunkt.x) * (up.x - tekstNedPunkt.x) +
          (up.y - tekstNedPunkt.y) * (up.y - tekstNedPunkt.y)) > 5;
        tekstNedPunkt = null;
        if (beveget) {
          // Dra → Fabric har flyttet boksen. Klem den innenfor bildet (aldri utenfor).
          klemTekstboksObjekt(tMål);
          canvas.renderAll();
          return;
        }
        if (varIEditing) {
          // Rent trykk mens teksten ALT redigerte: Fabric plasserte markøren ved trykket
          // (setCursorByClick). IKKE overstyr — å tvinge markøren til slutten var (a)-rotårsaken.
          return;
        }
        // Rent trykk på en tekst som ikke redigerte → åpne redigering, markør DER han trykket.
        apneTekstForRedigering(tMål, opt.e);
        return;
      }
      // RETUR 5965e37b: tekst truffet i et TEGNE-verktøy. Trykk (< TEKST_TAP_TERSKEL) → åpne
      // redigering uansett verktøy; dra → fall gjennom og tegn formen som før. TVILLING:
      // skalTekstTapRedigere i plassering.ts.
      if (tekstTapKandidat) {
        var kTekst = tekstTapKandidat; tekstTapKandidat = null;
        var upK = canvas.getPointer(opt.e);
        var flyttLengde = tekstTapPunkt ? Math.sqrt(
          (upK.x - tekstTapPunkt.x) * (upK.x - tekstTapPunkt.x) +
          (upK.y - tekstTapPunkt.y) * (upK.y - tekstTapPunkt.y)) : 0;
        tekstTapPunkt = null;
        if (flyttLengde < gTerskel) {
          if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
          startPunkt = null;
          apneTekstForRedigering(kTekst, opt.e);
          return;
        }
        // Dra fra en tekst → tegn formen (fall gjennom til form-finaliseringen under).
      }
      // Velg alle objekter: TRYKK på en forms strek → velg formen; dra → tegn ny form.
      if (gFormKandidat) {
        var fh = objektTrykkHandling({
          treffType: 'form', aktivtVerktoy: aktivtVerktoy, beveget: gBeveget,
          traffValgt: false, traffHandtak: false, valgtType: typeAv(gValgt),
        });
        if (fh === 'velg') {
          if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
          startPunkt = null;
          velgObjekt(gFormKandidat);
          return;
        }
      }
      if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
      if (!startPunkt || aktivtVerktoy === 'draw' || aktivtVerktoy === 'select') return;
      var pointer = canvas.getPointer(opt.e);
      var endPunkt = { x: pointer.x, y: pointer.y };

      var dx = endPunkt.x - startPunkt.x;
      var dy = endPunkt.y - startPunkt.y;
      var avstand = Math.sqrt(dx * dx + dy * dy);

      // Et vinglete fingertrykk (under touch-terskelen) er et trykk, ikke en mini-form: på tomt
      // område fjerner det bare valget (regel 4). Mus beholder 5 px-grensen (web uendret).
      if (avstand < 5 || (gErTouch && !gBeveget)) {
        // Tekst håndteres i mouse:down/up (Textbox direkte på canvas) — ingen tap-logikk her.
        startPunkt = null;
        return;
      }

      // Drag-operasjon — tekst skal IKKE trigges her
      var form = byggForm(aktivtVerktoy, startPunkt, endPunkt);
      if (form) { canvas.add(form); objekter.push(form); historikk.push({ type: 'lagt-til', obj: form }); canvas.renderAll(); }

      startPunkt = null;
    });

    // Frihånd: i isDrawingMode legger Fabric selv strøket på lerretet, men IKKE i
    // objekter-arrayet. Uten dette kan strøket verken angres (angre popper objekter),
    // flyttes (settFlyttbar itererer objekter) eller lagres (laget serialiserer objekter)
    // — det brennes bare inn i den flate JPEG-en og er borte ved neste gjenåpning (stille
    // datatap). Samme behandling som formene får ved mouse:up: push + settFlyttbar med
    // gjeldende verktøytilstand (låst i tegnemodus, flyttbar i Velg-modus).
    canvas.on('path:created', function(e) {
      var path = e.path;
      objekter.push(path);
      historikk.push({ type: 'lagt-til', obj: path });
      // Husk strøket i gesten: var det egentlig et TRYKK (velg/rediger), fjerner mouse:up det.
      stiIGest = path;
      settFlyttbar(path, aktivtVerktoy === 'select');
    });

    // Avsluttet tekstredigering uten innhold → fjern den tomme tekstboksen (erstatter den
    // gamle «tom tekst = slett»-logikken som gikk over broen). Dette er IKKE stille
    // tomhet: krav 1 garanterer at hvert tekst-klikk gir en synlig følge (boksen dukker
    // opp med markør ved opprettelse), så brukeren SÅ den. Forsvinner den etterpå, er det
    // fordi den faktisk ble stående tom — en ekte opprydding, ikke et tapt treff. Å beholde
    // en tom boks ville lagt et usynlig objekt i laget (det motsatte problemet).
    canvas.on('text:editing:exited', function(e) {
      var o = e.target;
      if (o && (!o.text || !o.text.trim())) {
        var idx = objekter.indexOf(o);
        if (idx >= 0) objekter.splice(idx, 1);
        canvas.remove(o);
        canvas.renderAll();
      }
    });

    // Del 1: hold tekstbokser innenfor bildet under dra (object:moving) og etter en
    // bredde-endring (object:modified — ml/mr-håndtaket flytter venstre kant). Klemmingen
    // er TVILLING av klemTekstboksPosisjon i plassering.ts.
    function erTekst(o) { return o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text'); }
    canvas.on('object:moving', function(e) { if (erTekst(e.target)) klemTekstboksObjekt(e.target); });
    canvas.on('object:modified', function(e) {
      var mo = e.target;
      // Pil-endepunkt: den gamle pila erstattes (mouse:up) — ikke registrer den som «endret».
      if (pilDra && mo === pilDra.gammel) return;
      if (erTekst(mo)) klemTekstboksObjekt(mo);
      // Angre omfatter flytt og størrelse (punkt 6): tilstanden FØR transformen.
      if (forTilstand && forTilstand.obj === mo) {
        historikk.push({ type: 'endret', obj: mo, for: forTilstand.tilstand });
      }
      forTilstand = null;
    });

    // Velg alle objekter: tilstanden før en transform (angre) + strek konstant ved skalering.
    canvas.on('before:transform', function(e) { if (e && e.transform) forberedTransform(e.transform); });

    // Bare det valgte objektet er Fabric-aktivt (resten låst), og frihånd-modus er av mens
    // noe er valgt — ellers ville Fabric tegne i stedet for å flytte det valgte.
    function etterValgEndring() {
      if (aktivtVerktoy !== 'select') {
        objekter.forEach(function(o) { if (!erTekstObj(o)) settFlyttbar(o, false); });
      }
      oppdaterTegnemodus();
    }
    canvas.on('selection:created', etterValgEndring);
    canvas.on('selection:updated', etterValgEndring);
    canvas.on('selection:cleared', etterValgEndring);

    monterScrollPin();

    postTilVert({ type: 'klar' });
  }

  // Frys-fiks (RETUR 5965e37b): nøytralisér WKWebViews «scroll markøren synlig»-oppførsel når
  // tastaturet vises. Hele lerretet ligger alt over tastaturet (RN reserverer tastaturhøyden),
  // så en scroll ≠ 0 er alltid feil — den dytter teksten ut av syne mens den skjulte textarea-en
  // fortsetter å motta tastetrykk (= «teksten frøs og forsvant, men fortsatte å skrive»). Vi
  // tilbakestiller til (0,0). Annoteringen har ingen pan/zoom, så ingenting legitimt scroller.
  function pinnViewport() {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    var se = document.scrollingElement || document.documentElement;
    if (se && se.scrollTop) se.scrollTop = 0;
    if (!harMeldtScrollKorrigert) {
      harMeldtScrollKorrigert = true;
      // Dev-signal så Kenneths telefontest kan bekrefte at WKWebView forsøkte å scrolle.
      postTilVert({ type: 'scrollKorrigert' });
    }
  }
  function monterScrollPin() {
    window.addEventListener('scroll', pinnViewport, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('scroll', pinnViewport);
      window.visualViewport.addEventListener('resize', pinnViewport);
    }
  }

  // Alle formene bygges som gruppe [hvit halo (bak), rød strek (foran)]. Den hvite er
  // (strek + 2×kontrastkant) bred, så den stikker en kontrastkant ut på hver side —
  // rødt mot rød murvegg/mørk asfalt forsvinner ellers (Kenneth-funn). Kanten skaleres
  // med canvas som strek og tekst; 2px på 1163px-canvas er usynlig.
  // strekOverride: når en eksisterende pil bygges på nytt (endepunkt-dra) beholdes dens
  // egen strek, så tykkelsen ikke endres (gammel pil fra en annen skjermbredde).
  function byggPil(fra, til, strekOverride) {
    var s = strekOverride || strekBredde();
    var k = strekOverride ? strekOverride * KONTRAST_FRAKSJON : kontrastKant();
    var dx = til.x - fra.x;
    var dy = til.y - fra.y;
    var vinkel = Math.atan2(dy, dx);
    // Hodet UTLEDES fra streken (TVILLING skalertPilhode) — forholdet hode:strek er
    // PILHODE_FAKTOR:1 (5:1) konstant, kan ikke drifte når strek-formelen endres.
    var pilLen = s * PILHODE_FAKTOR;
    // Linja stopper der hodet begynner, ikke i spissen — ellers krysser den gjennom det
    // senter-plasserte hodet og haloene overlapper (TVILLING pilLinjeSlutt). Klem tilbaketrekket
    // til pilens egen lengde så en kort pil ikke får negativ lengde; hodet tegnes uansett.
    var len = Math.sqrt(dx * dx + dy * dy);
    var tilbake = len > 0 ? Math.min(pilLen / 2, len) : 0;
    var sluttX = len > 0 ? til.x - (dx / len) * tilbake : til.x;
    var sluttY = len > 0 ? til.y - (dy / len) * tilbake : til.y;
    // 🔴 Ankre begge linjene på linjas SENTER (originX/originY 'center'), ikke hjørnet:
    // uten eksplisitt origo forskyves hvit og rød med halve strekdifferansen (funn 2026-09-29,
    // samme klasse som sirkel/firkant). Punktene uttrykkes relativt til senteret så geometrien
    // er uendret. TVILLING: pilLinjeSenterOrigo i lag.ts.
    var lcx = (fra.x + sluttX) / 2;
    var lcy = (fra.y + sluttY) / 2;
    function linje(farge, bredde) {
      return new fabric.Line([fra.x - lcx, fra.y - lcy, sluttX - lcx, sluttY - lcy], {
        stroke: farge, strokeWidth: bredde,
        left: lcx, top: lcy, originX: 'center', originY: 'center',
        selectable: false, evented: false,
      });
    }
    function hode(farge, str) {
      return new fabric.Triangle({
        left: til.x, top: til.y, originX: 'center', originY: 'center',
        width: str, height: str, fill: farge,
        angle: (vinkel * 180 / Math.PI) + 90, selectable: false, evented: false,
      });
    }
    return new fabric.Group([
      linje(KONTRAST_FARGE, s + 2 * k), hode(KONTRAST_FARGE, pilLen + 2 * k),
      linje(STREK_FARGE, s), hode(STREK_FARGE, pilLen),
    ], { selectable: false, evented: false });
  }

  // 🔴 Posisjonér etter SENTER (originX/originY 'center'), ikke hjørnet. I Fabric er
  // left/top hjørnet av omslutningsboksen INKLUDERT strek — to former med samme hjørne
  // men ulik strokeWidth blir forskjøvet med halve strekdifferansen (funn 2). Med felles
  // senter er hvit og rød konsentriske uansett strekbredde. TVILLING: formLagBeskrivelse.
  function byggSirkel(fra, til) {
    var s = strekBredde();
    var k = kontrastKant();
    var dx = til.x - fra.x;
    var dy = til.y - fra.y;
    var radius = Math.sqrt(dx * dx + dy * dy) / 2;
    var cx = (fra.x + til.x) / 2;
    var cy = (fra.y + til.y) / 2;
    function ring(farge, bredde) {
      return new fabric.Circle({
        originX: 'center', originY: 'center',
        left: cx, top: cy, radius: radius,
        fill: 'transparent', stroke: farge, strokeWidth: bredde,
        selectable: false, evented: false,
      });
    }
    return new fabric.Group([
      ring(KONTRAST_FARGE, s + 2 * k), ring(STREK_FARGE, s),
    ], { selectable: false, evented: false });
  }

  function byggFirkant(fra, til) {
    var s = strekBredde();
    var k = kontrastKant();
    var cx = (fra.x + til.x) / 2;
    var cy = (fra.y + til.y) / 2;
    var w = Math.abs(til.x - fra.x);
    var h = Math.abs(til.y - fra.y);
    function boks(farge, bredde) {
      return new fabric.Rect({
        originX: 'center', originY: 'center',
        left: cx, top: cy, width: w, height: h,
        fill: 'transparent', stroke: farge, strokeWidth: bredde,
        selectable: false, evented: false,
      });
    }
    return new fabric.Group([
      boks(KONTRAST_FARGE, s + 2 * k), boks(STREK_FARGE, s),
    ], { selectable: false, evented: false });
  }

  function byggForm(verktoy, fra, til) {
    switch (verktoy) {
      case 'arrow': return byggPil(fra, til);
      case 'circle': return byggSirkel(fra, til);
      case 'rect': return byggFirkant(fra, til);
      default: return null;
    }
  }

  // Tekst skrives DIREKTE på bildet: en fabric.Textbox legges der brukeren klikker og går
  // rett i redigeringsmodus. Ingen modal, ingen meldingsrunde over broen — brukeren ser
  // teksten slik sluttproduktet blir, mens han skriver. Hvit outline (paintFirst 'stroke')
  // gir samme kontrast som formene. Tom tekst ved avsluttet redigering fjernes (se init).
  // Befaring-funn (Kenneth 2026-10-21, BHO4): stor forbokstav automatisk etter punktum.
  // Fabric lager en skjult <textarea> ved enterEditing() — den driver det native tastaturet.
  // 🔴 RETUR (Kenneth 2026-10-22): å sette autocapitalize ETTER enterEditing virket IKKE.
  // Rotårsak målt i Fabric 5.3.1: initHiddenTextarea() setter autocapitalize='off', og
  // enterEditing() FOKUSERER textarea'en i neste linje (fabric.js:28791–28792). iOS/WebView
  // leser autocapitalize i FOKUS-øyeblikket; å endre attributtet etterpå og re-fokusere et
  // alt-fokusert felt er en no-op og når aldri tastaturet. Vi overstyrer derfor
  // initHiddenTextarea slik at attributtene er riktige FØR Fabric fokuserer. Overstyringen
  // ligger på fabric.IText.prototype og dekker både Textbox (ny tekst, arver fra IText) og
  // gjenåpnet gammel IText. Installeres én gang pr. side.
  function installerTekstTastaturFiks() {
    if (!fabric.IText || fabric.IText.prototype.__sitedocTastaturFiks) return;
    var original = fabric.IText.prototype.initHiddenTextarea;
    fabric.IText.prototype.initHiddenTextarea = function() {
      original.apply(this, arguments);
      if (this.hiddenTextarea) {
        // 'sentences' = stor forbokstav ved start og etter punktum (iOS-verdi).
        this.hiddenTextarea.setAttribute('autocapitalize', 'sentences');
        this.hiddenTextarea.setAttribute('autocorrect', 'on');
        this.hiddenTextarea.setAttribute('spellcheck', 'true');
      }
    };
    fabric.IText.prototype.__sitedocTastaturFiks = true;
  }

  // Sikrer at tastaturet faktisk kommer opp når redigering startes (ny tekst OG
  // trykk-for-å-redigere). Attributtene settes av overstyringen over FØR fokus; her
  // re-fokuseres bare for å vekke tastaturet om det ikke alt er oppe.
  function klargjørTekstTastatur(obj) {
    if (obj && obj.hiddenTextarea) {
      obj.hiddenTextarea.focus();
    }
  }

  // RETUR 5965e37b: ÉN kjent-god vei inn i redigering (gjenoppretter prod 8c741180). Brukes
  // av både Tekst-verktøyets trykk og det verktøy-agnostiske trykket. setCursorByClick
  // (markør der du trykket) var en mistenkt i regresjonen — pakket i try/catch med markør-på-
  // slutten som fallback, så redigering ALLTID åpner selv om markør-plasseringen feiler.
  function apneTekstForRedigering(o, evt) {
    canvas.setActiveObject(o);
    o.enterEditing();
    var plassert = false;
    if (evt && o.setCursorByClick) {
      try { o.setCursorByClick(evt); plassert = true; } catch (e) { plassert = false; }
    }
    if (!plassert) {
      var n = (o.text || '').length;
      if (o.setSelectionStart) { o.setSelectionStart(n); o.setSelectionEnd(n); }
    }
    klargjørTekstTastatur(o);
    canvas.renderAll();
  }

  // Del 1 (Kenneth 2026-10-22): felles oppsett for en tekstboks' interaksjon — KUN
  // bredde-håndtakene (ml/mr) synlige (Kenneth: «endre bredden»), høyde følger teksten
  // (lockScalingY) og ingen rotasjon. Stor treffflate på håndtakene for touch (≥44 pt).
  // Kalles både ved ny tekst OG ved gjenskaping av et lagret textbox-objekt.
  function klargjørTekstboks(o) {
    o.set({
      hasControls: true,
      hasBorders: true,
      borderColor: '#3b82f6',
      cornerColor: '#3b82f6',
      cornerStyle: 'circle',
      cornerSize: 14,
      touchCornerSize: 44,
      transparentCorners: false,
      lockRotation: true,
      lockScalingY: true,
      lockScalingFlip: true,
    });
    // Bare midt-venstre/-høyre (bredde). Fabric Textbox konverterer en ml/mr-dra til
    // ENDRET width (ikke scaleX), så teksten bryter på nytt etter den nye bredden.
    o.setControlsVisibility({
      tl: false, tr: false, bl: false, br: false, mt: false, mb: false, mtr: false,
      ml: true, mr: true,
    });
  }

  function lagTekst(x, y) {
    // Del 1: fabric.Textbox (ikke IText) — har en fast bredde og bryter teksten etter den,
    // så lange setninger holder seg innenfor bildet (bilde 10-funnet). Bredden settes fra
    // trykkpunktet til høyre kant minus marg; hjørnet klemmes innenfor bildet.
    var bredde = tekstboksBredde(x);
    var tekstObj = new fabric.Textbox('', {
      left: x,
      top: y,
      width: bredde,
      fontSize: fontStr(),
      fontWeight: 'bold',
      fill: STREK_FARGE,
      fontFamily: 'Arial',
      stroke: KONTRAST_FARGE,
      strokeWidth: tekstKant(),
      paintFirst: 'stroke',
      editable: true,
      selectable: true,
      evented: true,
    });
    klargjørTekstboks(tekstObj);
    klemTekstboksObjekt(tekstObj);

    canvas.add(tekstObj);
    objekter.push(tekstObj);
    historikk.push({ type: 'lagt-til', obj: tekstObj });
    canvas.setActiveObject(tekstObj);
    tekstObj.enterEditing();
    klargjørTekstTastatur(tekstObj);
    canvas.renderAll();
  }

  // ══ Velg alle objekter (Kenneth 2026-10-28) ═══════════════════════════════════════
  function erTekstObj(o) { return !!o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text'); }
  function typeAv(o) { return !o ? null : (erTekstObj(o) ? 'tekst' : 'form'); }

  // TVILLING av objektTrykkHandling i plassering.ts (testet der).
  function objektTrykkHandling(p) {
    if (p.aktivtVerktoy === 'select') return 'ingen';
    if (p.traffHandtak) return 'endre';
    if (p.traffValgt) return p.beveget ? 'flytt' : 'ingen';
    if (p.beveget) return 'tegn';
    if (p.treffType === 'tekst') return 'rediger-tekst';
    if (p.treffType === 'form') return 'velg';
    if (p.valgtType === 'form') return 'fjern-valg';
    if (p.valgtType === 'tekst' && p.aktivtVerktoy !== 'text') return 'fjern-valg';
    if (p.aktivtVerktoy === 'text' || p.aktivtVerktoy === 'draw') return 'tegn';
    return 'ingen';
  }

  // TVILLING av avstandTilLinjestykke/avstandTilForm i plassering.ts (testet der).
  function avstandTilLinjestykke(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    var qx = a.x + t * dx, qy = a.y + t * dy;
    return Math.sqrt((p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy));
  }
  function lokaltPunkt(p, cx, cy, vinkel) {
    var dx = p.x - cx, dy = p.y - cy;
    if (!vinkel) return { x: dx, y: dy };
    var r = -vinkel * Math.PI / 180;
    return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
  }
  function avstandTilForm(p, g) {
    if (g.type === 'linje') return avstandTilLinjestykke(p, g.fra, g.til);
    if (g.type === 'sti') {
      var pk = g.punkter;
      if (!pk.length) return Infinity;
      if (pk.length === 1) return Math.sqrt((p.x - pk[0].x) * (p.x - pk[0].x) + (p.y - pk[0].y) * (p.y - pk[0].y));
      var min = Infinity;
      for (var i = 1; i < pk.length; i++) min = Math.min(min, avstandTilLinjestykke(p, pk[i - 1], pk[i]));
      return min;
    }
    var q;
    if (g.type === 'ellipse') {
      q = lokaltPunkt(p, g.cx, g.cy, g.vinkel);
      var rx = Math.abs(g.rx), ry = Math.abs(g.ry);
      if (rx === 0 || ry === 0) return avstandTilLinjestykke(q, { x: -rx, y: -ry }, { x: rx, y: ry });
      var d = Math.sqrt(q.x * q.x + q.y * q.y);
      if (d === 0) return Math.min(rx, ry);
      var k = Math.sqrt((q.x / rx) * (q.x / rx) + (q.y / ry) * (q.y / ry));
      return d * Math.abs(1 - 1 / k);
    }
    q = lokaltPunkt(p, g.cx, g.cy, g.vinkel);
    var hx = Math.abs(g.bredde) / 2, hy = Math.abs(g.hoyde) / 2;
    var ax = Math.abs(q.x), ay = Math.abs(q.y);
    if (ax <= hx && ay <= hy) return Math.min(hx - ax, hy - ay);
    var ux = Math.max(ax - hx, 0), uy = Math.max(ay - hy, 0);
    return Math.sqrt(ux * ux + uy * uy);
  }

  // Hvilken form er objektet? Grupper avgjøres av det SISTE barnet (TVILLING formTypeFraBarn):
  // [halo, strek] for sirkel/firkant, [linje, hode, linje, hode] for pil. Gamle prod-grupper
  // har samme struktur.
  function formType(o) {
    if (!o || erTekstObj(o)) return null;
    if (o.type === 'path') return 'sti';
    if (o.type === 'group' && o._objects && o._objects.length) {
      var siste = o._objects[o._objects.length - 1].type;
      if (siste === 'triangle') return 'pil';
      if (siste === 'circle') return 'sirkel';
      if (siste === 'rect') return 'firkant';
    }
    return 'ukjent';
  }

  // Pilens hale og spiss i canvas-koordinater, utledet fra den RØDE linja (barn 2) og det
  // røde hodet (barn 3) gjennom gruppematrisen — virker også på gamle og skalerte piler.
  // null = uventet struktur → pila får fallback-håndtak (flytt + proporsjonal skalering).
  function pilEndepunkter(o) {
    var b = o && o._objects;
    if (!b || b.length !== 4 || b[2].type !== 'line' || b[3].type !== 'triangle') return null;
    if (!b[2].calcLinePoints) return null;
    var m = o.calcTransformMatrix();
    var lc = b[2].getCenterPoint();
    var lp = b[2].calcLinePoints();
    return {
      fra: fabric.util.transformPoint(new fabric.Point(lc.x + lp.x1, lc.y + lp.y1), m),
      til: fabric.util.transformPoint(b[3].getCenterPoint(), m),
    };
  }

  // Den synlige strekbredden til en eksisterende pil (beholdes når den bygges på nytt).
  function pilStrek(g) {
    var l = g._objects && g._objects[2];
    if (!l || !l.strokeWidth) return strekBredde();
    if (l.strokeUniform) return l.strokeWidth;
    return l.strokeWidth * (Math.abs(g.scaleX || 1) + Math.abs(g.scaleY || 1)) / 2;
  }

  // Formens geometri i canvas-koordinater (input til avstandTilForm).
  function formGeometri(o) {
    var ft = formType(o);
    var m = o.calcTransformMatrix();
    if (ft === 'pil') {
      var ep = pilEndepunkter(o);
      if (ep) return { type: 'linje', fra: ep.fra, til: ep.til };
    }
    if (ft === 'sirkel' || ft === 'firkant') {
      var b = o._objects[o._objects.length - 1];
      var c = fabric.util.transformPoint(b.getCenterPoint(), m);
      var sx = Math.abs((o.scaleX || 1) * (b.scaleX || 1));
      var sy = Math.abs((o.scaleY || 1) * (b.scaleY || 1));
      if (ft === 'sirkel') return { type: 'ellipse', cx: c.x, cy: c.y, rx: b.radius * sx, ry: b.radius * sy, vinkel: o.angle || 0 };
      return { type: 'rektangel', cx: c.x, cy: c.y, bredde: b.width * sx, hoyde: b.height * sy, vinkel: o.angle || 0 };
    }
    if (ft === 'sti' && o.path && o.path.length) {
      var off = o.pathOffset || { x: 0, y: 0 };
      var pk = [];
      o.path.forEach(function(cmd) {
        if (cmd.length >= 3) {
          pk.push(fabric.util.transformPoint(new fabric.Point(cmd[cmd.length - 2] - off.x, cmd[cmd.length - 1] - off.y), m));
        }
      });
      return { type: 'sti', punkter: pk };
    }
    var br = o.getBoundingRect(true, true);
    return { type: 'rektangel', cx: br.left + br.width / 2, cy: br.top + br.height / 2, bredde: br.width, hoyde: br.height, vinkel: 0 };
  }

  // Øverste objekt som treffes av trykket. Former treffes på STREKEN (ikke rammeboksen);
  // tekst (bare når medTekst — Frihånd, der Fabric ikke leter etter mål) på rammeboksen.
  function finnTreff(p, medTekst) {
    var t = FORM_TREFF_TOLERANSE;
    for (var i = objekter.length - 1; i >= 0; i--) {
      var o = objekter[i];
      if (erTekstObj(o)) {
        if (!medTekst) continue;
        var tb = o.getBoundingRect(true, true);
        if (p.x >= tb.left - t && p.x <= tb.left + tb.width + t && p.y >= tb.top - t && p.y <= tb.top + tb.height + t) return o;
        continue;
      }
      if (avstandTilForm(p, formGeometri(o)) <= t) return o;
    }
    return null;
  }

  // Frihånd-modus bare når ingenting er valgt — ellers ville Fabric tegne i stedet for å
  // flytte/endre det valgte objektet.
  function oppdaterTegnemodus() {
    if (!canvas) return;
    canvas.isDrawingMode = (aktivtVerktoy === 'draw' && !canvas.getActiveObject());
  }

  // Endepunkt-håndtak på pila: dra en ende → pila bygges på nytt med byggPil (hodet beholder
  // formen, streken tykkelsen). Mens draget pågår vises en forhåndsvisning og den gamle skjules.
  function lagPilKontroll(ende) {
    return new fabric.Control({
      actionName: 'pilEnde',
      cursorStyle: 'crosshair',
      positionHandler: function(dim, finalMatrix, o) {
        var pt = null;
        if (pilDra && pilDra.gammel === o) pt = (ende === 'fra') ? pilDra.nyFra : pilDra.nyTil;
        if (!pt) { var ep = pilEndepunkter(o); pt = ep ? ep[ende] : { x: 0, y: 0 }; }
        var vpt = (o.canvas && o.canvas.viewportTransform) || [1, 0, 0, 1, 0, 0];
        return fabric.util.transformPoint(new fabric.Point(pt.x, pt.y), vpt);
      },
      actionHandler: function(eventData, transform, x, y) {
        return dragPilEnde(transform.target, ende, x, y);
      },
      render: fabric.controlsUtils && fabric.controlsUtils.renderCircleControl,
    });
  }
  function dragPilEnde(g, ende, x, y) {
    if (!pilDra || pilDra.gammel !== g) {
      var ep = pilEndepunkter(g);
      if (!ep) return false;
      pilDra = { gammel: g, nyFra: ep.fra, nyTil: ep.til, strek: pilStrek(g), forh: null };
    }
    if (ende === 'fra') pilDra.nyFra = { x: x, y: y }; else pilDra.nyTil = { x: x, y: y };
    if (pilDra.forh) canvas.remove(pilDra.forh);
    pilDra.forh = byggPil(pilDra.nyFra, pilDra.nyTil, pilDra.strek);
    canvas.add(pilDra.forh);
    g.set('opacity', 0);
    return true;
  }
  // Kjøres etter at Fabric har avsluttet transformen (setTimeout fra mouse:up): den nye pila
  // tar den gamles plass i objekter og på lerretet (samme lag-rekkefølge). Angre bytter tilbake.
  function fullforPilDra() {
    var d = pilDra;
    pilDra = null;
    if (!d) return;
    d.gammel.set('opacity', 1);
    if (!d.forh) { canvas.renderAll(); return; }
    var ny = d.forh;
    canvas.remove(ny);
    var idx = objekter.indexOf(d.gammel);
    var ci = canvas.getObjects().indexOf(d.gammel);
    if (idx < 0 || ci < 0) { canvas.renderAll(); return; }
    canvas.discardActiveObject();
    canvas.remove(d.gammel);
    canvas.insertAt(ny, ci);
    objekter[idx] = ny;
    historikk.push({ type: 'erstattet', gammel: d.gammel, ny: ny });
    velgObjekt(ny);
  }

  // Håndtak på telefon i samme stil som tekstboksen: synlig 14, treffflate 44 (≥ 44 pt), ingen
  // rotasjon. Sirkel/firkant: 8 håndtak (bredde/høyde — sirkel kan bli oval). Frihånd: 4
  // hjørner (proporsjonal). Pil: to endepunkter. I web-«Flytt» (select) beholdes Fabrics
  // standardhåndtak med rotasjon, som før.
  function klargjørForm(o) {
    if (!o || erTekstObj(o)) return;
    var iVelg = aktivtVerktoy === 'select';
    if (Object.prototype.hasOwnProperty.call(o, 'controls')) delete o.controls;
    o.set({
      hasControls: true,
      hasBorders: true,
      borderColor: '#3b82f6',
      cornerColor: '#3b82f6',
      cornerStyle: 'circle',
      cornerSize: 14,
      touchCornerSize: 44,
      transparentCorners: false,
      lockScalingFlip: true,
      lockRotation: !iVelg,
    });
    if (iVelg) {
      o.setControlsVisibility({ tl: true, tr: true, bl: true, br: true, ml: true, mr: true, mt: true, mb: true, mtr: true });
      return;
    }
    var ft = formType(o);
    if (ft === 'pil' && fabric.Control && pilEndepunkter(o)) {
      o.controls = { fra: lagPilKontroll('fra'), til: lagPilKontroll('til') };
      o.set({ hasBorders: false });
      return;
    }
    if (ft === 'pil' || ft === 'sti') {
      o.setControlsVisibility({ tl: true, tr: true, bl: true, br: true, ml: false, mr: false, mt: false, mb: false, mtr: false });
      return;
    }
    o.setControlsVisibility({ tl: true, tr: true, bl: true, br: true, ml: true, mr: true, mt: true, mb: true, mtr: false });
  }

  function velgObjekt(o) {
    if (!o) return;
    klargjørForm(o);
    o.set({ selectable: true, evented: true });
    canvas.setActiveObject(o);
    oppdaterTegnemodus();
    canvas.renderAll();
  }

  // Strek konstant ved skalering (punkt 5): første gang en form skaleres, brettes gjeldende
  // skala inn i strokeWidth og strokeUniform slås på — utseendet er uendret i øyeblikket, og
  // videre skalering endrer ikke streken. Gamle objekter berøres ikke før de skaleres.
  function gjorStrekUniform(o) {
    var s = (Math.abs(o.scaleX || 1) + Math.abs(o.scaleY || 1)) / 2;
    var barn = o._objects || [o];
    barn.forEach(function(b) {
      if (b.strokeUniform || !b.stroke || !b.strokeWidth) return;
      var bs = (b === o) ? 1 : (Math.abs(b.scaleX || 1) + Math.abs(b.scaleY || 1)) / 2;
      b.set({ strokeWidth: b.strokeWidth * s * bs, strokeUniform: true });
    });
    if (o._objects) o.objectCaching = false;
    o.dirty = true;
  }

  var TILSTAND_FELT = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'skewX', 'skewY', 'width', 'height'];
  function tilstandAv(o) {
    var t = {};
    TILSTAND_FELT.forEach(function(f) { t[f] = o[f]; });
    t.barn = (o._objects || [o]).map(function(b) { return { strokeWidth: b.strokeWidth, strokeUniform: !!b.strokeUniform }; });
    return t;
  }
  function settTilstand(o, t) {
    var p = {};
    TILSTAND_FELT.forEach(function(f) { p[f] = t[f]; });
    o.set(p);
    (o._objects || [o]).forEach(function(b, i) {
      var bt = t.barn && t.barn[i];
      if (bt) b.set({ strokeWidth: bt.strokeWidth, strokeUniform: bt.strokeUniform });
    });
    if (erTekstObj(o) && o.initDimensions) o.initDimensions();
    o.dirty = true;
    o.setCoords();
  }

  // Kalles når en transform starter (before:transform, med mouse:down som reserve).
  function forberedTransform(tr) {
    var o = tr && tr.target;
    if (!o) return;
    if (!(forTilstand && forTilstand.obj === o)) forTilstand = { obj: o, tilstand: tilstandAv(o) };
    if (!erTekstObj(o) && typeof tr.action === 'string' && tr.action.indexOf('scale') === 0) gjorStrekUniform(o);
  }

  function fjernFraLerret(o) {
    if (canvas.getActiveObject() === o) canvas.discardActiveObject();
    canvas.remove(o);
  }
  function byttPaaLerret(ut, inn) {
    var ci = canvas.getObjects().indexOf(ut);
    fjernFraLerret(ut);
    inn.set('opacity', 1);
    settFlyttbar(inn, aktivtVerktoy === 'select');
    if (ci >= 0) canvas.insertAt(inn, ci); else canvas.add(inn);
  }
  // Et frihånd-mikrostrøk fra et TRYKK (velg/rediger) skal ikke bli liggende.
  function fjernMikrostrok(sti) {
    var i = objekter.indexOf(sti);
    if (i >= 0) objekter.splice(i, 1);
    var hi = historikk.length - 1;
    if (hi >= 0 && historikk[hi].obj === sti) historikk.pop();
    canvas.remove(sti);
  }

  // Lagre originalt bildestørrelse for eksport i korrekt oppløsning
  var originalBredde = 0;
  var originalHoyde = 0;

  // Reskaler ett serialisert objekt fra sitt lagrede koordinatsystem til gjeldende
  // canvas. 🔴 TVILLING av reskalerLagObjekt() i @sitedoc/shared lag.ts — HTML-strengen
  // kan ikke importere; endres formelen der, endres den her. Den delte er testbar.
  function reskalerObjekt(o, ratio) {
    o.set({
      left: (typeof o.left === 'number' ? o.left : 0) * ratio,
      top: (typeof o.top === 'number' ? o.top : 0) * ratio,
      scaleX: (typeof o.scaleX === 'number' ? o.scaleX : 1) * ratio,
      scaleY: (typeof o.scaleY === 'number' ? o.scaleY : 1) * ratio,
    });
    // strokeUniform (velg alle objekter): streken følger ikke scaleX → gang strokeWidth med
    // ratio, så utseendet blir som før. Objekter uten strokeUniform (alle gamle) er uendret.
    if (o.strokeUniform && typeof o.strokeWidth === 'number') o.set('strokeWidth', o.strokeWidth * ratio);
    if (o._objects) {
      var harUniform = false;
      o._objects.forEach(function(b) {
        if (b.strokeUniform && typeof b.strokeWidth === 'number') { b.set('strokeWidth', b.strokeWidth * ratio); harUniform = true; }
      });
      if (harUniform) o.objectCaching = false;
    }
    o.setCoords();
  }

  // Gjør ETT gjeninnlastet objekt flyttbart eller låst avhengig av modus. Tekst er
  // alltid flyttbar (som ved tegning). Kalles ved lag-innlasting og ved verktøybytte.
  function settFlyttbar(o, flyttbar) {
    // Tekst (fabric.Textbox → 'textbox'; eldre lag 'i-text'/'text') er ALLTID evented, så et
    // trykk åpner redigering uansett verktøy (RETUR 5965e37b). Men Fabric-FLYTTBAR (selectable)
    // bare i Velg og Tekst; i tegne-verktøyene er den ikke selectable, så et dra som starter på
    // en tekst tegner formen i stedet for at Fabric plukker opp teksten. TVILLING:
    // tekstErSelectableIVerktoy i plassering.ts.
    if (o.type === 'text' || o.type === 'i-text' || o.type === 'textbox') {
      o.set({ evented: true, selectable: (aktivtVerktoy === 'select' || aktivtVerktoy === 'text') });
      return;
    }
    // Velg alle objekter: det VALGTE objektet er alltid aktivt (Fabric flytter/endrer det);
    // de andre er låst, så et dra som starter på dem tegner en ny form (regel 3).
    var kan = !!flyttbar || (!!canvas && o === canvas.getActiveObject());
    o.set({ selectable: kan, evented: kan });
  }

  window.settBilde = function(bildeUrl, lag) {
    fabric.Image.fromURL(bildeUrl, function(img, erFeil) {
      // RETUR svart gjenåpning (2026-10-28): et bilde som ikke lar seg dekode (f.eks. et 401-svar
      // sendt som data-URL) ga før et helt svart lerret uten feil. Nå meldes det til verten, som
      // viser en forståelig feil. Et bilde uten mål regnes også som feil (ellers skala = Infinity).
      if (erFeil || !img || !img.width || !img.height) {
        postTilVert({ type: 'bildeFeil' });
        return;
      }
      originalBredde = img.width;
      originalHoyde = img.height;

      var container = document.getElementById('canvas-container');
      var maxW = container.clientWidth;
      var maxH = container.clientHeight;
      var skala = Math.min(maxW / img.width, maxH / img.height);

      // Resize canvas til bildets skalerte dimensjoner (fjerner svarte kanter)
      var visningsBredde = Math.round(img.width * skala);
      var visningsHoyde = Math.round(img.height * skala);
      canvas.setWidth(visningsBredde);
      canvas.setHeight(visningsHoyde);
      // Canvas har nå bildets skalerte bredde → frihånd-penselen skaleres likt
      // strek/tekst (3px på 390px-canvas, ~9px på 1163px-canvas).
      canvas.freeDrawingBrush.width = strekBredde();

      img.set({
        scaleX: skala,
        scaleY: skala,
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      canvas.setBackgroundImage(img, function() {
        // Lag-innlasting (redigerbar annotering): enlivenObjects legger objektene
        // OPPÅ bakgrunnen uten å røre den (loadFromJSON ville tømt canvas). Reskaler
        // fra lagret canvas-bredde til gjeldende — et lag laget på en annen skjerm
        // (mobil↔web) må treffe riktig. Objektene starter låst (matcher default-verktøyet);
        // Velg-verktøyet slår på flytting.
        if (lag && lag.objekter && lag.objekter.length && fabric.util && fabric.util.enlivenObjects) {
          var ratio = lag.bredde > 0 ? (canvas.width / lag.bredde) : 1;
          // Oppfølger RETUR svart gjenåpning (Kontrollør): et lag Fabric ikke kan gjenskape (f.eks.
          // ukjent objekttype → «reading 'fromObject'») kastet før bildeLastet → web sto evig på
          // «Laster bildet …» med Ferdig av. Nå: bildet vises uten objektene og bildeLastet sendes
          // (som før lag-meldingene fantes). Objekter som alt var lagt på, blir stående.
          var lagMeldt = false;
          var meldLastet = function() {
            if (lagMeldt) return;
            lagMeldt = true;
            canvas.renderAll();
            postTilVert({ type: 'bildeLastet' });
          };
          try {
            fabric.util.enlivenObjects(lag.objekter, function(gjenskapte) {
              try {
                gjenskapte.forEach(function(o) {
                  reskalerObjekt(o, ratio);
                  // Del 1: en gjenskapt tekstboks må få kontroll-synlighet og locks på nytt
                  // (toObject() lagrer dem ikke) så bredde-håndtaket virker etter gjenåpning.
                  // Eldre 'i-text'/'text' åpnes uendret (ingen håndtak, som før).
                  if (o.type === 'textbox') klargjørTekstboks(o); else klargjørForm(o);
                  settFlyttbar(o, aktivtVerktoy === 'select');
                  canvas.add(o);
                  objekter.push(o);
                });
              } catch (e) { /* ugyldig objekt i laget: vis det som lot seg gjenskape */ }
              meldLastet();
            });
          } catch (e) {
            meldLastet();
          }
        } else {
          canvas.renderAll();
          postTilVert({ type: 'bildeLastet' });
        }
      });
    });
  };

  window.velgVerktoy = function(verktoy) {
    aktivtVerktoy = verktoy;
    canvas.isDrawingMode = (verktoy === 'draw');
    var iVelg = (verktoy === 'select');
    // Marquee-selection og objekt-flytting kun i Velg-modus; ellers låst så
    // tegne-verktøyene ikke plukker opp et objekt i stedet for å tegne.
    canvas.selection = iVelg;
    objekter.forEach(function(o) { settFlyttbar(o, iVelg); klargjørForm(o); });
    if (!iVelg) canvas.discardActiveObject();
    oppdaterTegnemodus();
    canvas.renderAll();
  };

  // Angre = siste HANDLING (opprettelse, flytt, størrelse, pil-endepunkt). TVILLING av
  // angreSisteHandling i plassering.ts: handlinger på objekter som er borte hoppes over; tom
  // stakk faller tilbake til den gamle oppførselen (fjern siste objekt, også fra lagret lag).
  window.angre = function() {
    while (historikk.length > 0) {
      var h = historikk.pop();
      if (h.type === 'lagt-til') {
        var ai = objekter.indexOf(h.obj);
        if (ai < 0) continue;
        objekter.splice(ai, 1);
        fjernFraLerret(h.obj);
        canvas.renderAll();
        return;
      }
      if (h.type === 'endret') {
        if (objekter.indexOf(h.obj) < 0) continue;
        settTilstand(h.obj, h.for);
        canvas.renderAll();
        return;
      }
      var bi = objekter.indexOf(h.ny);
      if (bi < 0) continue;
      objekter[bi] = h.gammel;
      byttPaaLerret(h.ny, h.gammel);
      canvas.renderAll();
      return;
    }
    if (objekter.length > 0) {
      var siste = objekter.pop();
      fjernFraLerret(siste);
      canvas.renderAll();
    }
  };

  // Eksport-komprimering (frys-fiks, orkestrator-vedtak 2026-10-21): «Ferdig» frøs fordi en
  // q0.92-eksport av et 1920px-bilde ga en base64-melding på 1–2 MB som krysset WebView-broen
  // og ble parset/skrevet SYNKRONT på RN-JS-tråden. Husregelen (CLAUDE.md) er ≤300–400 KB før
  // opplasting — samme mål som bilde.ts. Vi starter på q0.8 og senker trinnvis til ≤400 KB.
  // 🔴 LESBARHET: q under ~0,9 kan flippe JPEG-koderen til chroma-subsampling (4:2:0) som gjør
  // tynne røde streker mindre skarpe (målt 2026-08-26 på Chromium: strek-feil 105 mot 11 ved
  // 4:4:4). Avveiningen er orkestratorens eksplisitte valg (frys/størrelse > maks skarphet);
  // VERIFISERES på Kenneths telefon at røde streker fortsatt er lesbare. Går det ikke, heves
  // START-kvaliteten (én verdi under) mot større fil.
  var MAKS_EKSPORT_BYTES = 400 * 1024;
  var EKSPORT_KVALITETER = [0.8, 0.7, 0.6, 0.5];

  // base64-lengde → omtrentlige byte (4 tegn = 3 byte, minus '='-padding).
  function base64Bytes(dataUrl) {
    var komma = dataUrl.indexOf(',');
    var b64 = komma >= 0 ? dataUrl.substring(komma + 1) : dataUrl;
    if (!b64.length) return 0;
    var padding = b64.charAt(b64.length - 1) === '=' ? (b64.charAt(b64.length - 2) === '=' ? 2 : 1) : 0;
    return Math.floor(b64.length * 3 / 4) - padding;
  }

  window.lagre = function() {
    canvas.discardActiveObject();
    // Hvit bakgrunn fordi JPEG mangler alpha. Settes FØR eksport.
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    // requestAnimationFrame: la WebView tegne ferdig — og RN rekke å vise «Lagrer …» og
    // deaktivere knappen — FØR den SYNKRONE toDataURL som re-renderer hele canvaset i full
    // oppløsning og blokkerer tråden. Uten dette fryser UI-et uten et «jobber»-signal.
    requestAnimationFrame(function() {
      var start = (window.performance && performance.now) ? performance.now() : 0;
      // Eksporter i originaloppløsning (input er alt ≤1920px komprimert vedlegg, så multiplier
      // over-oppløser ikke). JPEG, IKKE PNG: PNG q1 av et foto blir 3–4 MB (BACKLOG-772).
      var multiplier = originalBredde > 0 ? (originalBredde / canvas.width) : 1;
      var dataUrl = '';
      var bytes = 0;
      var kvalitet = 0;
      for (var qi = 0; qi < EKSPORT_KVALITETER.length; qi++) {
        kvalitet = EKSPORT_KVALITETER[qi];
        dataUrl = canvas.toDataURL({ format: 'jpeg', quality: kvalitet, multiplier: multiplier });
        bytes = base64Bytes(dataUrl);
        if (bytes <= MAKS_EKSPORT_BYTES) break;
      }
      var eksportMs = ((window.performance && performance.now) ? performance.now() : 0) - start;

      // Tom-tekst-vakt ved LAGRING (garanti ved konstruksjon): filtrer bort enhver tom
      // IText FØR serialisering. text:editing:exited-ryddingen over holder lerretet rent
      // underveis, men fyrer ALDRI hvis enterEditing() feilet — da blir den tomme boksen
      // stående i objekter og ville ellers serialiseres inn i laget og lagres (usynlig,
      // tom, permanent — stille tomhet i LAGRET data, forbudt i CLAUDE.md). Vakten her er
      // uavhengig av hvorfor redigeringen feilet. Tekst er 'textbox' (ny) eller 'i-text'/'text' (eldre
      // lag) — samme skille som settFlyttbar/mouse:down.
      function erTomTekst(o) {
        return (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') && (!o.text || !o.text.trim());
      }
      // Annotasjonslaget UT sammen med den utflatede JPEG-en (tre-artefakt-modellen):
      // objektene som DATA (uten bakgrunnsbildet — det er originalen, lagret separat),
      // pluss canvas-dimensjonene og Fabric-versjonen (redigerbarhet + framtidssikring).
      var lag = {
        fabricVersion: fabric.version,
        bredde: canvas.width,
        hoyde: canvas.height,
        objekter: objekter.filter(function(o) { return !erTomTekst(o); }).map(function(o) { return o.toObject(); }),
      };
      // bytes/kvalitet/eksportMs følger med så RN kan logge størrelse+tid i dev (orkestrator iv).
      postTilVert({ type: 'ferdig', dataUrl: dataUrl, lag: lag, bytes: bytes, kvalitet: kvalitet, eksportMs: Math.round(eksportMs) });
    });
  };

  function håndterVertMelding(e) {
    try {
      var data = JSON.parse(e.data);
      switch (data.type) {
        case 'settBilde': settBilde(data.bildeUrl, data.lag); break;
        case 'velgVerktoy': velgVerktoy(data.verktoy); break;
        case 'angre': angre(); break;
        case 'lagre': lagre(); break;
      }
    } catch(err) {}
  }

  // document: RN-WebView (Android) · window: RN-WebView (iOS) + web-iframe.
  document.addEventListener('message', håndterVertMelding);
  window.addEventListener('message', håndterVertMelding);

  init();
})();
</script>
</body>
</html>`;
}

// Bakoverkompatibel standard: sentrert flate ("senter"). Web bruker denne direkte
// (uendret oppførsel). Mobil kaller `lagAnnoteringsHtml({ anker: "topp" })`.
export const ANNOTERINGS_HTML = lagAnnoteringsHtml();
