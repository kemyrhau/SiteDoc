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
  ANNOTERING_STREK_FARGE,
  ANNOTERING_KONTRAST_FARGE,
  ANNOTERING_REFERANSE_BREDDE,
  ANNOTERING_BASIS_STREK,
  ANNOTERING_BASIS_FONT,
  ANNOTERING_BASIS_KONTRAST,
} from "./lag";

export const ANNOTERINGS_HTML = `<!DOCTYPE html>
<html>
<head>
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
<script>
(function() {
  var canvas;
  var aktivtVerktoy = 'arrow';
  var startPunkt = null;
  var forhandsvisning = null;
  // Farger og basis-tall interpoleres fra @sitedoc/shared lag.ts (én kilde, samme
  // mønster som bro-betingelsene). Kalibrert på referanse-canvas (mobil ~390px):
  // strek/font/kontrastkant skaleres lineært med canvas-bredden så den VISUELLE andelen
  // av bildet er lik på tvers av skjermer. Skala-formelen og skalert*/formKontrastStil/
  // tekstKontrastStil i lag.ts er de testbare tvillingene.
  var STREK_FARGE = '${ANNOTERING_STREK_FARGE}';
  var KONTRAST_FARGE = '${ANNOTERING_KONTRAST_FARGE}';
  var REFERANSE_BREDDE = ${ANNOTERING_REFERANSE_BREDDE};
  var BASIS_STREK = ${ANNOTERING_BASIS_STREK};
  var BASIS_FONT = ${ANNOTERING_BASIS_FONT};
  var BASIS_KONTRAST = ${ANNOTERING_BASIS_KONTRAST};
  var objekter = [];

  function naaSkala() { return (canvas && canvas.width > 0) ? (canvas.width / REFERANSE_BREDDE) : 1; }
  function strekBredde() { return BASIS_STREK * naaSkala(); }
  function fontStr() { return BASIS_FONT * naaSkala(); }
  function kontrastKant() { return BASIS_KONTRAST * naaSkala(); }

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
        if (aktivtVerktoy === 'text') {
          var aktiv = canvas.getActiveObject();
          if (aktiv && aktiv.type === 'text') {
            // Trykk på eksisterende tekst → rediger
            var idx = objekter.indexOf(aktiv);
            postTilVert({
              type: 'redigerTekst',
              tekst: aktiv.text,
              indeks: idx,
            });
          } else if (!aktiv) {
            // Trykk på tom flate → ny tekst
            postTilVert({
              type: 'tekstInput',
              x: startPunkt.x,
              y: startPunkt.y,
            });
          }
        }
        startPunkt = null;
        return;
      }

      // Drag-operasjon — tekst skal IKKE trigges her
      var form = byggForm(aktivtVerktoy, startPunkt, endPunkt);
      if (form) { canvas.add(form); objekter.push(form); canvas.renderAll(); }

      startPunkt = null;
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
    var pilLen = 15 * naaSkala();
    function linje(farge, bredde) {
      return new fabric.Line([fra.x, fra.y, til.x, til.y], {
        stroke: farge, strokeWidth: bredde, selectable: false, evented: false,
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
        left: cx - radius, top: cy - radius, radius: radius,
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
    var x = Math.min(fra.x, til.x);
    var y = Math.min(fra.y, til.y);
    var w = Math.abs(til.x - fra.x);
    var h = Math.abs(til.y - fra.y);
    function boks(farge, bredde) {
      return new fabric.Rect({
        left: x, top: y, width: w, height: h,
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

  // Plasser tekst på canvas etter bruker har skrevet teksten i modal
  window.plasserTekst = function(tekst, x, y) {
    var tekstObj = new fabric.Text(tekst, {
      left: x,
      top: y,
      fontSize: fontStr(),
      fontWeight: 'bold',
      fill: STREK_FARGE,
      fontFamily: 'Arial',
      stroke: KONTRAST_FARGE,
      strokeWidth: kontrastKant(),
      paintFirst: 'stroke',
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
    canvas.renderAll();
  };

  window.oppdaterTekst = function(indeks, tekst) {
    if (indeks >= 0 && indeks < objekter.length && objekter[indeks].type === 'text') {
      if (!tekst) {
        // Tom tekst → slett objektet
        canvas.remove(objekter[indeks]);
        objekter.splice(indeks, 1);
      } else {
        objekter[indeks].set('text', tekst);
      }
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

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
    if (o.type === 'text') return;
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
        case 'plasserTekst': plasserTekst(data.tekst, data.x, data.y); break;
        case 'oppdaterTekst': oppdaterTekst(data.indeks, data.tekst); break;
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
