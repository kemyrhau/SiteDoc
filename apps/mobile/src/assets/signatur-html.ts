export const SIGNATUR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; overflow: hidden; touch-action: none; }
  canvas { display: block; width: 100%; height: 100%; border-bottom: 2px solid #e5e7eb; }
  .linje { position: absolute; bottom: 40px; left: 20px; right: 20px; height: 1px; background: #d1d5db; pointer-events: none; }
  .hint { position: absolute; bottom: 20px; left: 20px; font-size: 12px; color: #9ca3af; font-family: Arial; pointer-events: none; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="linje"></div>
<div class="hint">Signer her</div>
<script>
(function() {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var tegner = false;
  var stier = [];
  var gjeldendeSti = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    tegneAlt();
  }

  function tegneAlt() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var i = 0; i < stier.length; i++) {
      tegnSti(stier[i]);
    }
    if (gjeldendeSti.length > 1) {
      tegnSti(gjeldendeSti);
    }
  }

  function tegnSti(sti) {
    if (sti.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(sti[0].x, sti[0].y);
    for (var i = 1; i < sti.length; i++) {
      ctx.lineTo(sti[i].x, sti[i].y);
    }
    ctx.stroke();
  }

  function hentPos(e) {
    var rect = canvas.getBoundingClientRect();
    var touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    tegner = true;
    gjeldendeSti = [hentPos(e)];
  });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!tegner) return;
    gjeldendeSti.push(hentPos(e));
    tegneAlt();
  });

  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    tegner = false;
    if (gjeldendeSti.length > 1) {
      stier.push(gjeldendeSti);
    }
    gjeldendeSti = [];
  });

  canvas.addEventListener('mousedown', function(e) {
    tegner = true;
    gjeldendeSti = [hentPos(e)];
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!tegner) return;
    gjeldendeSti.push(hentPos(e));
    tegneAlt();
  });

  canvas.addEventListener('mouseup', function() {
    tegner = false;
    if (gjeldendeSti.length > 1) {
      stier.push(gjeldendeSti);
    }
    gjeldendeSti = [];
  });

  window.t\\u00F8mCanvas = function() {
    stier = [];
    gjeldendeSti = [];
    tegneAlt();
  };

  window.lagreSignatur = function() {
    var dataUrl = canvas.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signatur', dataUrl: dataUrl }));
  };

  resize();
  window.addEventListener('resize', resize);
})();
</script>
</body>
</html>`;
