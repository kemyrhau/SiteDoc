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
  var STREK_FARGE = '#ef4444';
  var STREK_BREDDE = 3;
  var objekter = [];

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
    canvas.freeDrawingBrush.width = STREK_BREDDE;

    canvas.on('mouse:down', function(opt) {
      if (aktivtVerktoy === 'draw') return;
      var pointer = canvas.getPointer(opt.e);
      startPunkt = { x: pointer.x, y: pointer.y };
    });

    canvas.on('mouse:up', function(opt) {
      if (!startPunkt || aktivtVerktoy === 'draw') return;
      var pointer = canvas.getPointer(opt.e);
      var endPunkt = { x: pointer.x, y: pointer.y };

      var dx = endPunkt.x - startPunkt.x;
      var dy = endPunkt.y - startPunkt.y;
      var avstand = Math.sqrt(dx * dx + dy * dy);

      if (avstand < 5) {
        if (aktivtVerktoy === 'text') {
          leggTilTekst(startPunkt);
        }
        startPunkt = null;
        return;
      }

      switch (aktivtVerktoy) {
        case 'arrow': leggTilPil(startPunkt, endPunkt); break;
        case 'circle': leggTilSirkel(startPunkt, endPunkt); break;
        case 'rect': leggTilFirkant(startPunkt, endPunkt); break;
        case 'text': leggTilTekst(startPunkt); break;
      }

      startPunkt = null;
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'klar' }));
  }

  function leggTilPil(fra, til) {
    var dx = til.x - fra.x;
    var dy = til.y - fra.y;
    var vinkel = Math.atan2(dy, dx);
    var pilLen = 15;

    var linje = new fabric.Line([fra.x, fra.y, til.x, til.y], {
      stroke: STREK_FARGE,
      strokeWidth: STREK_BREDDE,
      selectable: false,
      evented: false,
    });

    var pilHode = new fabric.Triangle({
      left: til.x,
      top: til.y,
      originX: 'center',
      originY: 'center',
      width: pilLen,
      height: pilLen,
      fill: STREK_FARGE,
      angle: (vinkel * 180 / Math.PI) + 90,
      selectable: false,
      evented: false,
    });

    var gruppe = new fabric.Group([linje, pilHode], {
      selectable: false,
      evented: false,
    });

    canvas.add(gruppe);
    objekter.push(gruppe);
  }

  function leggTilSirkel(fra, til) {
    var dx = til.x - fra.x;
    var dy = til.y - fra.y;
    var radius = Math.sqrt(dx * dx + dy * dy) / 2;
    var cx = (fra.x + til.x) / 2;
    var cy = (fra.y + til.y) / 2;

    var sirkel = new fabric.Circle({
      left: cx - radius,
      top: cy - radius,
      radius: radius,
      fill: 'transparent',
      stroke: STREK_FARGE,
      strokeWidth: STREK_BREDDE,
      selectable: false,
      evented: false,
    });

    canvas.add(sirkel);
    objekter.push(sirkel);
  }

  function leggTilFirkant(fra, til) {
    var x = Math.min(fra.x, til.x);
    var y = Math.min(fra.y, til.y);
    var w = Math.abs(til.x - fra.x);
    var h = Math.abs(til.y - fra.y);

    var firkant = new fabric.Rect({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: 'transparent',
      stroke: STREK_FARGE,
      strokeWidth: STREK_BREDDE,
      selectable: false,
      evented: false,
    });

    canvas.add(firkant);
    objekter.push(firkant);
  }

  function leggTilTekst(pos) {
    var tekst = new fabric.IText('Tekst', {
      left: pos.x,
      top: pos.y,
      fontSize: 20,
      fill: STREK_FARGE,
      fontFamily: 'Arial',
      stroke: '#ffffff',
      strokeWidth: 1,
      paintFirst: 'stroke',
      selectable: true,
      editable: true,
    });

    canvas.add(tekst);
    objekter.push(tekst);
    canvas.setActiveObject(tekst);
    tekst.enterEditing();
  }

  window.settBilde = function(bildeUrl) {
    fabric.Image.fromURL(bildeUrl, function(img) {
      var skala = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      img.set({
        scaleX: skala,
        scaleY: skala,
        originX: 'center',
        originY: 'center',
        left: canvas.width / 2,
        top: canvas.height / 2,
        selectable: false,
        evented: false,
      });
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  };

  window.velgVerktoy = function(verktoy) {
    aktivtVerktoy = verktoy;
    canvas.isDrawingMode = (verktoy === 'draw');
    canvas.discardActiveObject();
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
    var dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ferdig', dataUrl: dataUrl }));
  };

  document.addEventListener('message', function(e) {
    try {
      var data = JSON.parse(e.data);
      switch (data.type) {
        case 'settBilde': settBilde(data.bildeUrl); break;
        case 'velgVerktoy': velgVerktoy(data.verktoy); break;
        case 'angre': angre(); break;
        case 'lagre': lagre(); break;
      }
    } catch(err) {}
  });

  window.addEventListener('message', function(e) {
    try {
      var data = JSON.parse(e.data);
      switch (data.type) {
        case 'settBilde': settBilde(data.bildeUrl); break;
        case 'velgVerktoy': velgVerktoy(data.verktoy); break;
        case 'angre': angre(); break;
        case 'lagre': lagre(); break;
      }
    } catch(err) {}
  });

  init();
})();
</script>
</body>
</html>`;
