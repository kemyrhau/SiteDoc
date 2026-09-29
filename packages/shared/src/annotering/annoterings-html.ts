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

export const ANNOTERINGS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow: hidden; touch-action: none; }
  #canvas-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
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
  var objekter = [];

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
    var container = document.getElementById('canvas-container');
    var w = container.clientWidth;
    var h = container.clientHeight;

    canvas = new fabric.Canvas('c', {
      width: w,
      height: h,
      selection: false,
      isDrawingMode: false,
    });

    canvas.freeDrawingBrush.color = STREK_FARGE;
    canvas.freeDrawingBrush.width = strekBredde();

    canvas.on('mouse:down', function(opt) {
      // 'draw' = frihånd (Fabric eier dragen). 'select' = flytt eksisterende
      // objekt (Fabric eier selection/drag) — vi skal IKKE lage en ny form.
      if (aktivtVerktoy === 'draw' || aktivtVerktoy === 'select') return;
      // 'text' = skriv rett på bildet: klikk på tom flate legger en IText og går
      // rett i redigering (ingen modal, ingen meldingsrunde). Klikk på eksisterende
      // objekt lar Fabric håndtere det (velg/rediger tekst ved nytt klikk).
      if (aktivtVerktoy === 'text') {
        if (opt.target) return;
        var tp = canvas.getPointer(opt.e);
        lagTekst(tp.x, tp.y);
        return;
      }
      var pointer = canvas.getPointer(opt.e);
      startPunkt = { x: pointer.x, y: pointer.y };
    });

    // Forhåndsvisning under draget: samme bygger som endelig form, lagt på canvas
    // men IKKE i objekter (angre/eksport rører den ikke). Byttes hver mus-bevegelse
    // og fjernes ved mouse:up. Felles mangel web+mobil — begge fikk den ved at den
    // bor i den delte HTML-en.
    canvas.on('mouse:move', function(opt) {
      if (!startPunkt || aktivtVerktoy === 'draw' || aktivtVerktoy === 'select' || aktivtVerktoy === 'text') return;
      var pointer = canvas.getPointer(opt.e);
      var mdx = pointer.x - startPunkt.x;
      var mdy = pointer.y - startPunkt.y;
      if (Math.sqrt(mdx * mdx + mdy * mdy) < 5) return;
      if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
      var forh = byggForm(aktivtVerktoy, startPunkt, pointer);
      if (forh) { forhandsvisning = forh; canvas.add(forh); canvas.renderAll(); }
    });

    canvas.on('mouse:up', function(opt) {
      if (forhandsvisning) { canvas.remove(forhandsvisning); forhandsvisning = null; }
      if (!startPunkt || aktivtVerktoy === 'draw' || aktivtVerktoy === 'select') return;
      var pointer = canvas.getPointer(opt.e);
      var endPunkt = { x: pointer.x, y: pointer.y };

      var dx = endPunkt.x - startPunkt.x;
      var dy = endPunkt.y - startPunkt.y;
      var avstand = Math.sqrt(dx * dx + dy * dy);

      if (avstand < 5) {
        // Tekst håndteres i mouse:down (IText direkte på canvas) — ingen tap-logikk her.
        startPunkt = null;
        return;
      }

      // Drag-operasjon — tekst skal IKKE trigges her
      var form = byggForm(aktivtVerktoy, startPunkt, endPunkt);
      if (form) { canvas.add(form); objekter.push(form); canvas.renderAll(); }

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
      settFlyttbar(path, aktivtVerktoy === 'select');
    });

    // Avsluttet tekstredigering uten innhold → fjern den tomme IText-en (erstatter den
    // gamle «tom tekst = slett»-logikken som gikk over broen).
    canvas.on('text:editing:exited', function(e) {
      var o = e.target;
      if (o && (!o.text || !o.text.trim())) {
        var idx = objekter.indexOf(o);
        if (idx >= 0) objekter.splice(idx, 1);
        canvas.remove(o);
        canvas.renderAll();
      }
    });

    postTilVert({ type: 'klar' });
  }

  // Alle formene bygges som gruppe [hvit halo (bak), rød strek (foran)]. Den hvite er
  // (strek + 2×kontrastkant) bred, så den stikker en kontrastkant ut på hver side —
  // rødt mot rød murvegg/mørk asfalt forsvinner ellers (Kenneth-funn). Kanten skaleres
  // med canvas som strek og tekst; 2px på 1163px-canvas er usynlig.
  function byggPil(fra, til) {
    var s = strekBredde();
    var k = kontrastKant();
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

  // Tekst skrives DIREKTE på bildet: en fabric.IText legges der brukeren klikker og går
  // rett i redigeringsmodus. Ingen modal, ingen meldingsrunde over broen — brukeren ser
  // teksten slik sluttproduktet blir, mens han skriver. Hvit outline (paintFirst 'stroke')
  // gir samme kontrast som formene. Tom tekst ved avsluttet redigering fjernes (se init).
  function lagTekst(x, y) {
    var tekstObj = new fabric.IText('', {
      left: x,
      top: y,
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
      hasControls: false,
      hasBorders: true,
      borderColor: '#3b82f6',
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    });

    canvas.add(tekstObj);
    objekter.push(tekstObj);
    canvas.setActiveObject(tekstObj);
    tekstObj.enterEditing();
    if (tekstObj.hiddenTextarea) tekstObj.hiddenTextarea.focus();
    canvas.renderAll();
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
    o.setCoords();
  }

  // Gjør ETT gjeninnlastet objekt flyttbart eller låst avhengig av modus. Tekst er
  // alltid flyttbar (som ved tegning). Kalles ved lag-innlasting og ved verktøybytte.
  function settFlyttbar(o, flyttbar) {
    // Tekst (fabric.IText → type 'i-text', eldre lag kan ha 'text') er alltid interaktiv
    // så den kan flyttes og redigeres uansett verktøy.
    if (o.type === 'text' || o.type === 'i-text') return;
    o.set({ selectable: flyttbar, evented: flyttbar });
  }

  window.settBilde = function(bildeUrl, lag) {
    fabric.Image.fromURL(bildeUrl, function(img) {
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
          fabric.util.enlivenObjects(lag.objekter, function(gjenskapte) {
            gjenskapte.forEach(function(o) {
              reskalerObjekt(o, ratio);
              settFlyttbar(o, aktivtVerktoy === 'select');
              canvas.add(o);
              objekter.push(o);
            });
            canvas.renderAll();
          });
        } else {
          canvas.renderAll();
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
    objekter.forEach(function(o) { settFlyttbar(o, iVelg); });
    if (!iVelg) canvas.discardActiveObject();
    canvas.renderAll();
  };

  window.angre = function() {
    if (objekter.length > 0) {
      var siste = objekter.pop();
      canvas.remove(siste);
      canvas.renderAll();
    }
  };

  window.lagre = function() {
    canvas.discardActiveObject();
    canvas.renderAll();
    // Eksporter i originaloppløsning (input er alt ≤1920px komprimert vedlegg, så multiplier
    // over-oppløser ikke). JPEG, IKKE PNG: PNG q1 av et foto blir 3–4 MB (tapsfri re-koding);
    // JPEG q0.92 gir ~1 MB (~4× mindre) — målt 2026-08-26 (BACKLOG-772). Hvit bakgrunn fordi
    // JPEG mangler alpha. q0.92 (over Chromiums 4:4:4-terskel ~0.9): lavere q flipper til
    // chroma-subsampling (4:2:0) som gjør 3px røde streker uleselige (målt strek-feil 105 mot
    // 11 ved 4:4:4). Lesbarhet > filstørrelse (ordren).
    var multiplier = originalBredde > 0 ? (originalBredde / canvas.width) : 1;
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    var dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: multiplier });

    // Annotasjonslaget UT sammen med den utflatede JPEG-en (tre-artefakt-modellen):
    // objektene som DATA (uten bakgrunnsbildet — det er originalen, lagret separat),
    // pluss canvas-dimensjonene og Fabric-versjonen (redigerbarhet + framtidssikring).
    var lag = {
      fabricVersion: fabric.version,
      bredde: canvas.width,
      hoyde: canvas.height,
      objekter: objekter.map(function(o) { return o.toObject(); }),
    };
    postTilVert({ type: 'ferdig', dataUrl: dataUrl, lag: lag });
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
