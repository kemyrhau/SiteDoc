import type { Markør, Omrade, GpsMarkør } from "./TegningsVisning";

/**
 * Bygg HTML som rendrer tegningen + alle markører i SAMME koordinatsystem.
 * Markører posisjoneres med CSS-prosent (identisk med web UI og PDF).
 * visualViewport.scale brukes for å holde markørene visuelt like store ved zoom.
 */
export function byggHtml(
  tegningUrl: string,
  markører: Markør[],
  omrader: Omrade[],
  gpsMarkør: GpsMarkør | null,
  trykkOppsett: "ingen" | "enkel" | "avansert",
  rotasjonDelta: number = 0,
  startutsnitt: { x: number; y: number; w: number; h: number } | null = null,
  svgInline: boolean = false,
): string {
  const markørData = JSON.stringify(markører.map((m) => ({
    id: m.id, x: m.x, y: m.y, farge: m.farge || "#ef4444", label: m.label || "",
    fylt: m.fylt !== false, kantFarge: m.kantFarge || "#ffffff",
  })));
  const omradeData = JSON.stringify(
    omrader
      .filter((o) => Array.isArray(o.polygon) && o.polygon.length >= 3)
      .map((o) => ({
        id: o.id,
        navn: o.navn || "",
        farge: o.farge || "#3b82f6",
        punkter: o.polygon.map((p) => `${p.x},${p.y}`).join(" "),
        // Etikett-anker: polygonets tyngdepunkt (enkelt snitt).
        cx: o.polygon.reduce((s, p) => s + p.x, 0) / o.polygon.length,
        cy: o.polygon.reduce((s, p) => s + p.y, 0) / o.polygon.length,
      })),
  );
  const gpsData = gpsMarkør ? JSON.stringify({ x: gpsMarkør.x, y: gpsMarkør.y }) : "null";
  const startutsnittData = startutsnitt ? JSON.stringify(startutsnitt) : "null";
  const tegningUrlJson = JSON.stringify(tegningUrl);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=50,user-scalable=yes">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  /* 🔴 RETUR 1 § 2: slå av iOS sin bilde-/tekstmeny og native bilde-dra, ellers
     kaprer den langt trykk (bildemeny) OG måletrykk (dra-gest → pointermove). */
  html, body, #container, #tegning, #maleLag, .male-dot, .male-label {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-user-drag: none;
  }
  body { background:#1a1a1a; }
  /* RETUR 2: brukeroverstyring roterer HELE containeren (bilde + markører sammen), på
     toppen av den inn-bakte auto-rotasjonen. 0 = ingen ekstra rotasjon. */
  #container { position:relative; ${rotasjonDelta ? `transform:rotate(${rotasjonDelta}deg); transform-origin:center center;` : ""} }
  #tegning { display:block; width:100%; height:auto; pointer-events:none; }
  .pin { position:absolute; z-index:10; pointer-events:auto; }
  .pin-dot { width:16px;height:16px;border-radius:50%;border:2px solid #fff;transform:translate(-50%,-50%);transform-origin:center; }
  #omradeSvg { position:absolute; inset:0; width:100%; height:100%; z-index:5; pointer-events:none; }
  .omrade-navn { position:absolute; z-index:6; transform:translate(-50%,-50%);transform-origin:center; font:700 8px sans-serif; color:#1f2937; background:rgba(255,255,255,0.75); border-radius:3px; padding:0 3px; white-space:nowrap; pointer-events:none; }
  .pin-label {
    position:absolute; top:10px; left:50%; transform:translateX(-50%);transform-origin:center top;
    font:700 8px sans-serif; color:#1f2937;
    background:rgba(255,255,255,0.85); border-radius:3px;
    padding:1px 3px; white-space:nowrap;
  }
  .gps { position:absolute; z-index:20; }
  .gps-outer {
    width:24px;height:24px;border-radius:50%;
    background:rgba(59,130,246,0.25);
    display:flex;align-items:center;justify-content:center;
    transform:translate(-50%,-50%);transform-origin:center;
    animation:pulse 2s ease-in-out infinite;
  }
  .gps-inner { width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid #fff;box-shadow:0 0 6px rgba(59,130,246,0.5); }
  @keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.3)} }
</style></head><body>
<div id="container" oncontextmenu="return false">
  ${svgInline
    ? `<div id="tegning" oncontextmenu="return false"></div>`
    : `<img id="tegning" src="${tegningUrl}" draggable="false" oncontextmenu="return false" />`}
</div>
<script>
var markører = ${markørData};
var omrader = ${omradeData};
var gpsPos = ${gpsData};
var startutsnitt = ${startutsnittData};
var SVG_INLINE = ${svgInline ? "true" : "false"};
var TEGNING_URL = ${tegningUrlJson};
var currentZoom = 1;

// Hold markører visuelt like store ved pinch-zoom
function oppdaterZoom() {
  var z = window.visualViewport ? window.visualViewport.scale : 1;
  if (Math.abs(z - currentZoom) < 0.01) return;
  currentZoom = z;
  var inv = 1 / z;
  document.querySelectorAll('.pin-dot').forEach(function(el) {
    el.style.transform = 'translate(-50%,-50%) scale(' + inv + ')';
  });
  document.querySelectorAll('.pin-label').forEach(function(el) {
    el.style.transform = 'translateX(-50%) scale(' + inv + ')';
  });
  document.querySelectorAll('.omrade-navn').forEach(function(el) {
    el.style.transform = 'translate(-50%,-50%) scale(' + inv + ')';
  });
  document.querySelectorAll('.gps-outer').forEach(function(el) {
    el.style.transform = 'translate(-50%,-50%) scale(' + inv + ')';
    el.style.animation = 'none';
  });
  document.querySelectorAll('.male-dot,.male-label,.male-sum').forEach(function(el) {
    el.style.transform = 'translate(-50%,-50%) scale(' + inv + ')';
  });
  // 🔴 RETUR 2 § 1: fast strektykkelse på SKJERMEN (~2 pt) uansett zoom.
  // vector-effect:non-scaling-stroke nøytraliserer bare SVG-viewBox-skaleringen,
  // IKKE nettleserens pinch-zoom (visualViewport.scale) — så streken må skaleres
  // med 1/zoom akkurat som punkter og etiketter.
  document.querySelectorAll('.male-stroke').forEach(function(el) {
    el.setAttribute('stroke-width', (2 * inv).toFixed(3));
  });
}
// C2 (L6): dempet strek på inline ezdxf-SVG. Oppdateres KUN når pinch STOPPER (settle),
// ikke pr. frame — måling viste at CSS-recalc pr. frame på alle noder gir ~8–40 fps, mens
// én recalc ved settle er 1 ms. Under aktiv pinch skalerer streken visuelt med tegningen
// (som <img>), så snapper den til dempet bredde i hvile (det brukeren ser når han stopper).
// Formelen SPEILER beregnStrekVars i @sitedoc/shared/strek-skalering.ts (k=0,5, gulv 0,5px,
// tak 4px) — kan ikke importeres inn i WebView-JS, så den er inlinet (render.py↔dxfTilSvg-mønster).
// Effektiv skala = layout displayScale × pinch (visualViewport.scale); getBoundingClientRect
// gir LAYOUT-px (uendret av pinch), så pinch legges til via z.
var STREK_K = 0.5, STREK_MIN_PX = 0.5, STREK_MAKS_PX = 4;
// RETUR 2: inline-SVG-en er enten C1 (dempet --lw-strek) eller en gammel ezdxf uten C1
// som får egen-behandling (konstant ~EGEN_STREK_PX på skjermen, som web). Settes ved fetch.
var SVG_ER_C1 = false;
var EGEN_STREK_PX = 1.5;
function oppdaterStrek() {
  if (!SVG_INLINE) return;
  var el = document.getElementById('tegning');
  var svg = el ? el.querySelector('svg') : null;
  if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return;
  var vbW = svg.viewBox.baseVal.width;
  var renderedW = svg.getBoundingClientRect().width;
  if (!vbW || !renderedW) return;
  var z = window.visualViewport ? window.visualViewport.scale : 1;
  var ds = (renderedW / vbW) * z;
  if (SVG_ER_C1) {
    var lwBase = parseFloat(svg.getAttribute('data-lw-base')) || 1;
    svg.style.setProperty('--strek-skala', String(Math.pow(Math.max(z, 1e-6), STREK_K - 1)));
    svg.style.setProperty('--strek-min', (STREK_MIN_PX / ds) + 'px');
    svg.style.setProperty('--strek-maks-k', String(STREK_MAKS_PX / (lwBase * ds)));
  } else {
    // Egen-behandling: rå (173-enhets) strek skal aldri vises. Konstant skjermtykkelse
    // (~EGEN_STREK_PX) via stroke-width i viewBox-enheter = EGEN_STREK_PX / ds.
    svg.style.setProperty('--egen-sw', (EGEN_STREK_PX / ds) + 'px');
  }
}
var strekTimer = null;
function planleggStrek() {
  if (strekTimer) clearTimeout(strekTimer);
  strekTimer = setTimeout(oppdaterStrek, 150);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('scroll', function(){ oppdaterZoom(); planleggStrek(); });
  window.visualViewport.addEventListener('resize', function(){ oppdaterZoom(); planleggStrek(); });
}

function plasser() {
  var img = document.getElementById('tegning');
  var dispW = img.clientWidth;
  var dispH = img.clientHeight;
  if (dispW <= 0 || dispH <= 0) return;

  document.querySelectorAll('.pin,.gps,#omradeSvg,.omrade-navn').forEach(function(e){e.remove()});
  var container = document.getElementById('container');

  // Områder (polygoner) UNDER markørene — SVG-overlay i prosent-koordinater.
  if (omrader.length) {
    var svgNs = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('id', 'omradeSvg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    omrader.forEach(function(o) {
      var poly = document.createElementNS(svgNs, 'polygon');
      poly.setAttribute('points', o.punkter);
      poly.setAttribute('fill', o.farge);
      poly.setAttribute('fill-opacity', '0.15');
      poly.setAttribute('stroke', o.farge);
      poly.setAttribute('stroke-width', '0.4');
      poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
    });
    container.appendChild(svg);
    // Områdenavn ved tyngdepunktet.
    omrader.forEach(function(o) {
      if (!o.navn) return;
      var nl = document.createElement('div');
      nl.className = 'omrade-navn';
      nl.style.left = o.cx + '%';
      nl.style.top = o.cy + '%';
      nl.textContent = o.navn;
      container.appendChild(nl);
    });
  }

  // Plasser med CSS-prosent — identisk med web UI og PDF
  markører.forEach(function(m) {
    var div = document.createElement('div');
    div.className = 'pin';
    div.style.left = m.x + '%';
    div.style.top = m.y + '%';
    var bg = m.fylt ? m.farge : '#ffffff';
    div.innerHTML = '<div class="pin-dot" style="background:' + bg + ';border-color:' + m.kantFarge + '"></div>' +
      (m.label ? '<div class="pin-label">' + m.label + '</div>' : '');
    div.onclick = function(e) {
      e.stopPropagation();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'markør',id:m.id}));
    };
    container.appendChild(div);
  });

  if (gpsPos) {
    var gps = document.createElement('div');
    gps.className = 'gps';
    gps.style.left = gpsPos.x + '%';
    gps.style.top = gpsPos.y + '%';
    gps.innerHTML = '<div class="gps-outer"><div class="gps-inner"></div></div>';
    container.appendChild(gps);
  }

  oppdaterZoom();
}

var startutsnittApplisert = false;
// L4b: åpne zoomet på startutsnittet (bygget), ikke fit-to-width på rutenettet.
// SPEILER den testede hjelperen tegning-startutsnitt.ts + beregnStartutsnittZoom
// (@sitedoc/shared) — kan ikke importeres inn i WebView-JS-en, så math-en er inlinet
// her. Endres formelen, endres begge steder. Begge akser (reparasjon 2026-10-11):
// z = min(0,98/w, 0,98·ch/(h·cw·forhold)) klemt [1,50] — stående tegninger sprengte
// før høyden (kun bredden ble regnet). forhold = innerH/innerW måles FØR zoom.
// Container-bredden settes til zoom*100 % (markører er prosent-baserte → følger med);
// scroll sentrerer midtpunktet. Kjøres EN gang på load.
function anvendStartutsnitt() {
  if (startutsnittApplisert || !startutsnitt) return;
  var su = startutsnitt;
  if (!(su.w > 0) || !(su.h > 0)) return;
  startutsnittApplisert = true;
  var container = document.getElementById('container');
  var cw = window.innerWidth, ch = window.innerHeight;
  // Innerflatens høyde/bredde-forhold måles på naturlig størrelse (bredden 100 %,
  // høyden følger aspekt) FØR zoom anvendes. Aldri kvadratisk gjetning.
  var baseW = container.offsetWidth, baseH = container.offsetHeight;
  var forhold = (baseW > 0 && baseH > 0) ? baseH / baseW : null;
  var breddeTilpass = 0.98 / su.w;
  var tilpass = (forhold && forhold > 0)
    ? Math.min(breddeTilpass, (0.98 * ch) / (su.h * cw * forhold))
    : breddeTilpass;
  var z = Math.min(50, Math.max(1, tilpass));
  container.style.width = (z * 100) + '%';
  // Vent på layout (bredden anvendt) før vi leser faktisk størrelse og scroller.
  requestAnimationFrame(function() {
    var innerW = container.offsetWidth, innerH = container.offsetHeight;
    if (!innerW || !innerH) return;
    var left = (su.x + su.w / 2) * innerW - cw / 2;
    var top = (su.y + su.h / 2) * innerH - ch / 2;
    window.scrollTo(Math.max(0, left), Math.max(0, top));
  });
}
function etterTegning() { plasser(); anvendStartutsnitt(); oppdaterStrek(); }
// XSS-vern (ordre 2026-10-11, pkt. 3): allowlist FØR innerHTML. WebView-en har ingen
// DOMPurify, så dette er primærvernet. SPEIL av @sitedoc/shared svgMarkupErTrygg/farligCss
// (kan ikke importeres inn i WebView-JS). Endres der, endre her i takt. DOM-parset (ikke
// regex) så et escapet lagnavn med «onload=» i data-layer ikke forveksles med en handler.
function farligCss(css){ return /url\\s*\\(|@import|expression\\s*\\(|behavior\\s*:/i.test(css); }
function svgTrygg(markup){
  var tillatt = ['svg','g','path','line','polyline','polygon','circle','ellipse','rect','text','tspan','style'];
  var doc;
  try { doc = new DOMParser().parseFromString(markup, 'image/svg+xml'); } catch(e){ return false; }
  var root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') return false;
  var alle = root.getElementsByTagName('*');
  var noder = [root];
  for (var i=0;i<alle.length;i++) noder.push(alle[i]);
  for (var n=0;n<noder.length;n++){
    var el = noder[n];
    var tag = el.nodeName.toLowerCase();
    if (tillatt.indexOf(tag) < 0) return false;
    var attrs = el.attributes;
    for (var j=0;j<attrs.length;j++){
      var navn = attrs[j].name.toLowerCase();
      if (navn.indexOf('on') === 0) return false;
      if (navn === 'href' || navn === 'xlink:href') return false;
      if (navn === 'style' && farligCss(attrs[j].value)) return false;
    }
    if (tag === 'style' && farligCss(el.textContent || '')) return false;
  }
  return true;
}
function visSomBilde(el) {
  // Fallback: vis som <img> (mister strek-damping, men SVG kjører ikke skript i <img>).
  el.innerHTML = '<img src="' + TEGNING_URL + '" style="display:block;width:100%;height:auto" draggable="false" />';
  var im = el.querySelector('img');
  im.onload = etterTegning; if (im.complete) etterTegning();
}
if (SVG_INLINE) {
  // Inline ezdxf-SVG (farge-gruppert mobilvariant): hent SVG-teksten og injiser i DOM så
  // vi kan dempe streken via CSS-variabler (<img> kan ikke det → tykk svart ved zoom).
  // SVG-en er generert av vår render.py (kontrollert markup; tekst/lagnavn er html-escapet).
  fetch(TEGNING_URL).then(function(r){ return r.text(); }).then(function(txt){
    // Fjern faste width/height → width:100% (som web-viseren), behold data-motor/-lw-base/viewBox.
    txt = txt.replace(/<svg([^>]*)>/, function(m, a){
      return '<svg' + a.replace(/\\s*width="[^"]*"/g, '').replace(/\\s*height="[^"]*"/g, '') + ' width="100%" height="auto" style="display:block">';
    });
    // RETUR 2: C1-gate. data-lw-base på roten = dempet-strek-formatet. SPEILER
    // svgHarC1Format i @sitedoc/shared (kan ikke importeres inn i inline-JS). En gammel
    // ezdxf uten C1 (rå stroke-width ~173) får egen-behandling (strip <style> + injiser
    // dempet !important-regel) — aldri rå strek, som web-viseren.
    var rotTagg = (txt.match(/<svg[^>]*>/i) || [''])[0];
    SVG_ER_C1 = /\\bdata-lw-base\\s*=/i.test(rotTagg);
    if (!SVG_ER_C1) {
      txt = txt.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '');
      txt = txt.replace(/(<svg[^>]*>)/, '$1<style>line,polyline,circle,path,ellipse,polygon{stroke-width:var(--egen-sw,1.5px) !important}</style>');
    }
    var el = document.getElementById('tegning');
    if (svgTrygg(txt)) { el.innerHTML = txt; etterTegning(); }
    else { visSomBilde(el); }
  }).catch(function(){
    visSomBilde(document.getElementById('tegning'));
  });
} else {
  var img = document.getElementById('tegning');
  img.onload = function() { etterTegning(); };
  if (img.complete) etterTegning();
}

function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

// 🟢 90°/snap-veiledning (ordre 90-snap + GJENOPPTA § 2): stiplet akse + H/V-hjelpelinjer
// + valgt referanselinje (gul) + «90°»-etikett. RN beregner (delt beregnSnap) og sender
// resultatet; her tegnes det bare. null → fjern laget.
window.tegnVeiledning = function(d) {
  var g = document.getElementById('maleVeiledning'); if (g) g.remove();
  var c = document.getElementById('container'); if (!c || !d) return;
  var inv = 1 / (window.visualViewport ? window.visualViewport.scale : 1);
  var lag = document.createElement('div'); lag.id = 'maleVeiledning';
  lag.style.cssText = 'position:absolute;inset:0;z-index:15;pointer-events:none';
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
  var SW = (1 * inv).toFixed(3);
  function strek(x1,y1,x2,y2,farge,bredde,stiplet){
    var l = document.createElementNS(svgNs,'line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',farge); l.setAttribute('stroke-width',bredde);
    if (stiplet) l.setAttribute('stroke-dasharray',(1.2*inv).toFixed(3)+' '+(0.9*inv).toFixed(3));
    svg.appendChild(l);
  }
  if (d.akse) strek(d.akse[0].x,d.akse[0].y,d.akse[1].x,d.akse[1].y,'#1e40af',SW,true);
  if (d.vertikal != null) strek(d.vertikal,0,d.vertikal,100,'#1e40af',SW,true);
  if (d.horisontal != null) strek(d.horisontal,0,d.horisontal,100,'#1e40af',SW,true);
  lag.appendChild(svg);
  if (d.punkt) {
    var dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;left:'+d.punkt.x+'%;top:'+d.punkt.y+'%;width:12px;height:12px;border-radius:50%;background:rgba(30,64,175,0.6);border:2px solid #fff;transform:translate(-50%,-50%) scale('+inv+');transform-origin:center';
    lag.appendChild(dot);
    if (d.vinkelrett) {
      var lbl = document.createElement('div');
      lbl.style.cssText = 'position:absolute;left:'+d.punkt.x+'%;top:'+d.punkt.y+'%;transform:translate(-50%,-160%) scale('+inv+');transform-origin:center bottom;background:#1e40af;color:#fff;font:700 9px sans-serif;padding:1px 4px;border-radius:3px;white-space:nowrap';
      lbl.textContent = '90°';
      lag.appendChild(lbl);
    }
  }
  c.appendChild(lag);
};
window.skjulVeiledning = function(){ var g = document.getElementById('maleVeiledning'); if (g) g.remove(); };

// 🔴 RETUR 5 § 2: lupa er flyttet UT av WebView-en til et RN-nativt overlay
// (den DOM-baserte lupa var usynlig på enhet tross RETUR 4-forsøkene). WebView-en
// sender nå bare fingerposisjon + bilde-koordinat via sendLupe() (se gest-blokken
// nederst); RN tegner sirkelen med forstørret utsnitt + trådkors.

// Hint-boble ved et punkt (navigeringsmodus, kort trykk) — forsvinner etter ~2 s.
window.tegnHint = function(x, y, tekst) {
  var g = document.getElementById('hintBoble'); if (g) g.remove();
  var c = document.getElementById('container'); if (!c) return;
  var hintInv = 1 / (window.visualViewport ? window.visualViewport.scale : 1);
  var d = document.createElement('div'); d.id = 'hintBoble';
  d.style.cssText = 'position:absolute;z-index:30;left:' + x + '%;top:' + y + '%;transform:translate(-50%,-140%) scale(' + hintInv + ');transform-origin:center bottom;background:rgba(17,24,39,0.92);color:#fff;font:600 11px sans-serif;padding:5px 9px;border-radius:7px;max-width:170px;text-align:center;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
  d.textContent = tekst;
  c.appendChild(d);
  setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 2000);
};

// Måle-overlay (RETUR 2): tegn ALLE målinger. Den aktive uthevet (blå, dragbare
// punkter + segment-etiketter); ferdige inaktive dempet (grå, en resultat-etikett).
// data = { malinger:[{verktoy,punkter,ferdig,aktiv,summary}], segmenter:[...] }.
window.tegnMalinger = function(data) {
  data = data || {};
  var malinger = data.malinger || [];
  var segmenter = data.segmenter || [];
  // Hit-test ved punkt-dra/kant gjelder KUN den aktive målingens punkter.
  var aktiv = null;
  for (var i = 0; i < malinger.length; i++) { if (malinger[i].aktiv) { aktiv = malinger[i]; break; } }
  window.__malePunkter = aktiv ? (aktiv.punkter || []) : [];
  // Lukket (areal + ferdig) → sluttkanten teller for «sett inn hjørne» (RETUR 6 § 2).
  window.__maleLukket = !!(aktiv && aktiv.verktoy === 'areal' && aktiv.ferdig);

  var g = document.getElementById('maleLag'); if (g) g.remove();
  var c = document.getElementById('container'); if (!c) return;
  if (!malinger.length) return;
  var lag = document.createElement('div'); lag.id = 'maleLag';
  lag.style.cssText = 'position:absolute;inset:0;z-index:16;pointer-events:none';
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
  var inv = 1 / (window.visualViewport ? window.visualViewport.scale : 1);
  var SW = (2 * inv).toFixed(3);

  // 🟢 GJENOPPTA § 1: valgt referanselinje (gul) — vises persistent mens man tegner.
  if (data.referanse) {
    var rl = document.createElementNS(svgNs, 'line');
    rl.setAttribute('x1', data.referanse.a.x); rl.setAttribute('y1', data.referanse.a.y);
    rl.setAttribute('x2', data.referanse.b.x); rl.setAttribute('y2', data.referanse.b.y);
    rl.setAttribute('stroke', '#f59e0b'); rl.setAttribute('stroke-width', SW);
    rl.setAttribute('stroke-linecap', 'round');
    svg.appendChild(rl);
  }

  malinger.forEach(function(m) {
    var punkter = m.punkter || [];
    if (!punkter.length) return;
    var farge = m.aktiv ? '#1e40af' : '#64748b';
    var pts = punkter.map(function(p){ return p.x + ',' + p.y; }).join(' ');
    var fyll = (m.verktoy === 'areal');
    if (fyll && punkter.length >= 3) {
      var poly = document.createElementNS(svgNs, 'polygon');
      poly.setAttribute('points', pts);
      // Halvgjennomsiktig skravering så tegningen synes gjennom (RETUR 2 § 1).
      poly.setAttribute('fill', m.aktiv ? 'rgba(30,64,175,0.15)' : 'rgba(100,116,139,0.12)');
      poly.setAttribute('stroke', farge); poly.setAttribute('stroke-width', SW);
      poly.setAttribute('stroke-linejoin', 'round'); poly.setAttribute('class', 'male-stroke');
      svg.appendChild(poly);
    } else if (punkter.length >= 2) {
      var pl = document.createElementNS(svgNs, 'polyline');
      pl.setAttribute('points', pts); pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', farge); pl.setAttribute('stroke-width', SW);
      pl.setAttribute('stroke-linejoin', 'round'); pl.setAttribute('stroke-linecap', 'round');
      pl.setAttribute('class', 'male-stroke');
      svg.appendChild(pl);
    }
  });
  lag.appendChild(svg);

  // 🔴 RETUR 1 § 1 / RETUR 2 § 1: punkter/etiketter har FAST skjermstørrelse (1/zoom).
  malinger.forEach(function(m) {
    var punkter = m.punkter || [];
    var farge = m.aktiv ? '#1e40af' : '#64748b';
    var d = m.aktiv ? 11 : 8;
    punkter.forEach(function(p){
      var dot = document.createElement('div'); dot.className = 'male-dot';
      dot.style.cssText = 'position:absolute;left:' + p.x + '%;top:' + p.y + '%;width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:' + farge + ';border:2px solid #fff;transform:translate(-50%,-50%) scale(' + inv + ');transform-origin:center';
      lag.appendChild(dot);
    });
    // Inaktiv måling: én resultat-etikett ved tyngdepunktet.
    if (!m.aktiv && m.summary && punkter.length) {
      var cx = punkter.reduce(function(s,p){return s+p.x;},0) / punkter.length;
      var cy = punkter.reduce(function(s,p){return s+p.y;},0) / punkter.length;
      var sl = document.createElement('div'); sl.className = 'male-sum';
      sl.style.cssText = 'position:absolute;left:' + cx + '%;top:' + cy + '%;transform:translate(-50%,-50%) scale(' + inv + ');transform-origin:center;background:rgba(100,116,139,0.92);color:#fff;font:700 9px sans-serif;padding:1px 4px;border-radius:3px;white-space:nowrap';
      sl.textContent = m.summary;
      lag.appendChild(sl);
    }
  });
  // Segment-/areal-etiketter for den AKTIVE målingen.
  (segmenter || []).forEach(function(s){
    var lbl = document.createElement('div'); lbl.className = 'male-label';
    lbl.style.cssText = 'position:absolute;left:' + s.midx + '%;top:' + s.midy + '%;transform:translate(-50%,-50%) scale(' + inv + ');transform-origin:center;background:#1e40af;color:#fff;font:700 9px sans-serif;padding:1px 4px;border-radius:3px;white-space:nowrap';
    lbl.textContent = s.tekst;
    lag.appendChild(lbl);
  });
  c.appendChild(lag);
  oppdaterZoom();
};

${trykkOppsett === "enkel" ? `
document.getElementById('container').addEventListener('click', function(e) {
  var img = document.getElementById('tegning');
  var rect = img.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  var x = ((e.clientX - rect.left) / rect.width) * 100;
  var y = ((e.clientY - rect.top) / rect.height) * 100;
  post({ type:'trykk', x:Math.max(0,Math.min(100,x)), y:Math.max(0,Math.min(100,y)) });
});` : ""}
${trykkOppsett === "avansert" ? `
(function(){
  // 🔴 RETUR 3 § 0 (skjermlås-fiks): gest-livssyklusen er forankret i PRIMÆR-
  // fingeren og nullstilles HELT ved pointerup/pointercancel. Ingen teller som
  // kan bli stående > 0 og blokkere alle videre trykk (rotårsaken til låsen).
  // En tapt pointerup selvheles: hvis et nytt nedtrykk kommer > 1,2 s etter siste
  // hendelse mens vi fortsatt tror en finger er nede, nullstiller vi først.
  //
  // 🔴 RETUR 5 § 1: ALT regnes i SIDE-/DOKUMENT-koordinater (pageX/pageY + bildets
  // offset-boks), ikke skjerm (clientX/getBoundingClientRect). Da ligger finger og
  // punkter i samme rom uansett pinch-zoom/scroll, og ALLE punkter er grabbare —
  // ikke bare det siste. Matematikken speiler src/lib/tegningKoordinat.ts (testet).
  var c = document.getElementById('container');
  var MOVE_PX = 10, TREFF_PX = 24;
  var primær = null, pekere = {}, maks = 0;
  var sx=0, sy=0, st=0, flyttet=false, dragIdx=-1, lupeAktiv=false, pending=null, pinch=false, sist=0;

  function antallPekere(){ return Object.keys(pekere).length; }
  function zoom(){ return window.visualViewport ? window.visualViewport.scale : 1; }
  // Bildets boks i DOKUMENT-koordinater (zoom-invariant): sum offset opp kjeden + layout-størrelse.
  function sideBoks(){
    var img = document.getElementById('tegning'); if (!img) return null;
    var left=0, top=0, el=img;
    while (el){ left += el.offsetLeft; top += el.offsetTop; el = el.offsetParent; }
    if (img.offsetWidth<=0 || img.offsetHeight<=0) return null;
    return { sideLeft:left, sideTop:top, bredde:img.offsetWidth, hoyde:img.offsetHeight };
  }
  // Speil av tegningKoordinat.sideTilProsent.
  function pctSide(pageX, pageY, box){
    return { x: Math.max(0,Math.min(100,(pageX-box.sideLeft)/box.bredde*100)),
             y: Math.max(0,Math.min(100,(pageY-box.sideTop)/box.hoyde*100)) };
  }
  // RETUR 1: synlig utsnitt av bildet i PROSENT = der den synlige viewporten
  // (visualViewport, dokument-px) overlapper bildeboksen. Sendes til RN så snap/
  // hjelpelinjer ikke fester seg til punkter som er scrollet/zoomet ut av syne.
  function utsnitt(box){
    var vv = window.visualViewport;
    var vL = vv?vv.pageLeft:0, vT = vv?vv.pageTop:0;
    var vR = vL + (vv?vv.width:box.bredde), vB = vT + (vv?vv.height:box.hoyde);
    function clamp(v){ return Math.max(0,Math.min(100,v)); }
    return {
      xMin: clamp((Math.max(vL, box.sideLeft) - box.sideLeft)/box.bredde*100),
      xMax: clamp((Math.min(vR, box.sideLeft+box.bredde) - box.sideLeft)/box.bredde*100),
      yMin: clamp((Math.max(vT, box.sideTop) - box.sideTop)/box.hoyde*100),
      yMax: clamp((Math.min(vB, box.sideTop+box.hoyde) - box.sideTop)/box.hoyde*100),
    };
  }
  // Speil av tegningKoordinat.finnNaermesteSidePunkt. Treffradius i SIDE-px = TREFF_PX/zoom.
  function finnPunkt(pageX, pageY, box){
    var pk = window.__malePunkter || [];
    var tol = TREFF_PX / zoom();
    var best=-1, bestD=tol;
    for (var i=0;i<pk.length;i++){
      var qx = box.sideLeft + pk[i].x/100*box.bredde;
      var qy = box.sideTop + pk[i].y/100*box.hoyde;
      var d = Math.sqrt((qx-pageX)*(qx-pageX)+(qy-pageY)*(qy-pageY));
      if (d<=bestD){ best=i; bestD=d; }
    }
    return best;
  }
  // Speil av malinger.finnNaermesteKant (side-px). Nærmeste KANT (segment) til
  // fingeren → kant-indeks, ellers -1. For et lukket areal teller sluttkanten
  // (siste → første, indeks n-1). Brukes til «sett inn hjørne på kant» (RETUR 6 § 2).
  function finnKant(pageX, pageY, box){
    var pk = window.__malePunkter || [];
    if (pk.length < 2) return -1;
    var tol = TREFF_PX / zoom();
    function sx(i){ return box.sideLeft + pk[i].x/100*box.bredde; }
    function sy(i){ return box.sideTop + pk[i].y/100*box.hoyde; }
    function segD(px,py, ax,ay, bx,by){
      var dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy;
      if (l2===0) return Math.sqrt((px-ax)*(px-ax)+(py-ay)*(py-ay));
      var tt=((px-ax)*dx+(py-ay)*dy)/l2; tt=Math.max(0,Math.min(1,tt));
      var cx=ax+tt*dx, cy=ay+tt*dy; return Math.sqrt((px-cx)*(px-cx)+(py-cy)*(py-cy));
    }
    var best=-1, bestD=tol;
    for (var i=0;i+1<pk.length;i++){ var d=segD(pageX,pageY, sx(i),sy(i), sx(i+1),sy(i+1)); if(d<=bestD){best=i;bestD=d;} }
    if (window.__maleLukket && pk.length>=3){ var d2=segD(pageX,pageY, sx(pk.length-1),sy(pk.length-1), sx(0),sy(0)); if(d2<=bestD){best=pk.length-1;bestD=d2;} }
    return best;
  }
  function modus(){ return window.__maleModus || 'navigering'; }
  function erMale(m){ return m==='linjal'||m==='polylinje'||m==='areal'; }
  // 🔴 RETUR 5 § 2 — lupa er nå et RN-NATIVT overlay (ikke DOM i WebView-en, som
  // var usynlig). Vi sender bare fingerens posisjon i WebViewens SYNLIGE skjerm
  // (dp), bilde-koordinatet (prosent) og vist bildestørrelse (dp). RN tegner
  // sirkelen med forstørret utsnitt + trådkors (src/lib/lupe.ts-geometrien).
  function sendLupe(pageX, pageY, box){
    var vv = window.visualViewport, z = vv?vv.scale:1;
    var vpLeft = vv?vv.pageLeft:0, vpTop = vv?vv.pageTop:0;
    var p = pctSide(pageX, pageY, box);
    post({ type:'lupe', vis:true,
      fingerX:(pageX-vpLeft)*z, fingerY:(pageY-vpTop)*z,
      pctX:p.x, pctY:p.y,
      dispB: box.bredde*z, dispH: box.hoyde*z });
  }
  function skjulLupe(){ post({ type:'lupe', vis:false }); }
  function nullstill(){ primær=null; pekere={}; maks=0; flyttet=false; dragIdx=-1; lupeAktiv=false; pending=null; pinch=false; skjulLupe(); }

  c.addEventListener('pointerdown', function(e){
    var naa = Date.now();
    if (primær !== null && (naa - sist) > 1200) nullstill(); // selvhel tapt pointerup
    sist = naa;
    pekere[e.pointerId] = true;
    maks = Math.max(maks, antallPekere());
    if (primær === null) {
      primær = e.pointerId;
      sx=e.clientX; sy=e.clientY; st=naa; flyttet=false; dragIdx=-1; pending=null; pinch=false;
      var box = sideBoks(); if (!box) return;
      var m = modus();
      if (m === 'flytt') {
        dragIdx = finnPunkt(e.pageX, e.pageY, box);
        // 🟢 RETUR 6 § 2: traff ikke et punkt, men en KANT av den aktive figuren →
        // sett inn et nytt hjørne der og dra det med en gang (indeks = kant+1).
        if (dragIdx < 0) {
          var k = finnKant(e.pageX, e.pageY, box);
          if (k >= 0) {
            var pp0 = pctSide(e.pageX, e.pageY, box);
            post({ type:'settInnKant', kantIndex:k, x:pp0.x, y:pp0.y });
            dragIdx = k + 1;
          }
        }
      }
      lupeAktiv = erMale(m) || (m==='flytt' && dragIdx>=0);
      // 🔴 RETUR 6 § 3: fang pekeren på beholderen så pointermove/up havner HER
      // selv når fingeren drar over en markør/målelinje/tekst — ellers kapret
      // barne-elementet gesten og lupa «hoppet»/sluttet. pageX/pageY brukes uansett.
      if (lupeAktiv) { try { c.setPointerCapture(e.pointerId); } catch (err) {} }
      if (lupeAktiv) { pending = pctSide(e.pageX,e.pageY,box); sendLupe(e.pageX,e.pageY,box); }
    } else {
      // Ekstra finger → knip/zoom. Avbryt pending enkelt-finger-handling.
      pinch = true; dragIdx=-1; lupeAktiv=false; pending=null; skjulLupe();
    }
  });

  c.addEventListener('pointermove', function(e){
    if (e.pointerId !== primær) return;
    sist = Date.now();
    if (Math.abs(e.clientX-sx)>MOVE_PX || Math.abs(e.clientY-sy)>MOVE_PX) flyttet=true;
    if (pinch || antallPekere()>1 || !lupeAktiv) return;
    var box = sideBoks(); if (!box) return;
    var p = pctSide(e.pageX,e.pageY,box); pending=p;
    if (dragIdx>=0) {
      post({ type:'maledrag', index:dragIdx, x:p.x, y:p.y, rectW:box.bredde*zoom(), rectH:box.hoyde*zoom(), utsnitt:utsnitt(box) }); // Flytt: live reshape (+90°/snap i RN)
    } else if (erMale(modus())) {
      // Måleverktøy-plassering: la RN beregne 90°/snap + stiplet veiledning live.
      post({ type:'forhaandspunkt', x:p.x, y:p.y, rectW:box.bredde*zoom(), rectH:box.hoyde*zoom(), utsnitt:utsnitt(box) });
    }
    sendLupe(e.pageX,e.pageY,box);
  });

  // 🔴 RETUR 4 § 1: frys tegningen mens et punkt settes/dras. Pointer-events'
  // preventDefault stopper IKKE WKWebView-scroll/zoom — vi må preventDefault på
  // touchmove (non-passive). Kun når lupeAktiv (ett-finger sett/dra); knip (≥2
  // fingre) og vanlig pan slippes gjennom.
  c.addEventListener('touchmove', function(e){
    if (lupeAktiv && !pinch && e.touches && e.touches.length <= 1) e.preventDefault();
  }, { passive: false });

  function avslutt(e, avbrutt){
    sist = Date.now();
    var erPrimær = (e.pointerId === primær);
    delete pekere[e.pointerId];
    if (!erPrimær) return; // sekundærfinger sluppet — primær styrer commit/reset
    try { c.releasePointerCapture(e.pointerId); } catch (err) {}
    var box = sideBoks();
    skjulLupe();
    if (!avbrutt && !pinch && box) {
      var p = pending || pctSide(e.pageX, e.pageY, box);
      // Punktet settes HER (ved slipp). RN avgjør handling via avgjorTrykkHandling.
      // rectW/rectH = VIST bildestørrelse (skjerm-dp) — brukes til px-terskel ved valg.
      post({ type:'gest', verktoy: modus(), varighetMs: Date.now()-st, flyttet: flyttet, antallPekere: maks, nedPaaPunkt: dragIdx>=0, dragIdx: dragIdx, x:p.x, y:p.y, rectW:box.bredde*zoom(), rectH:box.hoyde*zoom(), utsnitt:utsnitt(box) });
    }
    nullstill();
  }
  c.addEventListener('pointerup', function(e){ avslutt(e,false); });
  c.addEventListener('pointercancel', function(e){ avslutt(e,true); });
})();` : ""}
</script>
</body></html>`;
}
