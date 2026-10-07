"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { X, AlertTriangle, RefreshCw, Ruler, Waypoints, VectorSquare, RotateCcw, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  kanMale,
  malMm,
  malArealMm2,
  parseMalestokk,
  type Punkt,
} from "@sitedoc/shared/utils";
import { avgjorTrykkHandling, type TrykkModus } from "../lib/tegningTrykk";

const LASTING_TIMEOUT_MS = 15_000;

/** Måledata fra tegningen (speiler web). `undefined` = måling ikke aktivert av forelder. */
export interface MaaleData {
  mmPrPiksel: number | null;
  scale: string | null;
  scaleKilde: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

/** De tre måleverktøyene (paritet med web RETUR 3 § C). */
type MaleVerktoy = "linjal" | "polylinje" | "areal";

/** Lukk-terskel i prosent: trykk nær et eksisterende punkt lukker polylinje/areal. */
const LUKK_TERSKEL_PCT = 3.5;

export interface Markør {
  x: number;
  y: number;
  id: string;
  label?: string;
  farge?: string;
  /** true = fylt sirkel (arbeid startet) · false/utelatt = ring (hul). Speiler web-tilstandsformen. */
  fylt?: boolean;
  /** Kant-farge-overstyring (over frist → rød). Utelatt → hvit kant som før. */
  kantFarge?: string;
}

/** Område (sone/rom/etasje) tegnet som polygon i prosent-koordinater — parallelt med web. */
export interface Omrade {
  id: string;
  navn: string;
  farge: string;
  polygon: Array<{ x: number; y: number }>;
}

export interface GpsMarkør {
  x: number;
  y: number;
}

interface TegningsVisningProps {
  tegningUrl: string;
  tegningNavn: string;
  onLukk: () => void;
  /** Legacy: enkelt trykk → plassering (sjekkliste/rapportobjekt m.fl.). */
  onTrykk?: (posX: number, posY: number) => void;
  onMarkørTrykk?: (id: string) => void;
  markører?: Markør[];
  omrader?: Omrade[];
  gpsMarkør?: GpsMarkør | null;
  /** Ubrukt — beholdt for bakoverkompatibilitet */
  pdfPageSize?: { width: number; height: number };
  // --- Avansert trykk + måling (lokasjoner). Settes disse, brukes pekerbasert
  //     trykk-klassifisering i stedet for legacy `onTrykk`. ---
  /** true = plasseringsmodus (trykk oppretter). false/utelatt = navigering. */
  plasseringAktiv?: boolean;
  /** Kort trykk i navigering: vis hint og blink bryteren (ingen oppretting). */
  onHint?: () => void;
  /** Opprett her: langt trykk (navigering) ELLER trykk (plassering). */
  onOpprett?: (posX: number, posY: number) => void;
  /** Måledata. Settes (kan være null) → måleverktøyet vises. undefined → av. */
  maleData?: MaaleData | null;
  /** Varsler når et måleverktøy slås på/av, så forelder kan skjule plasseringsmodus. */
  onMaleModusEndring?: (aktiv: boolean) => void;
}

/**
 * Bygg HTML som rendrer tegningen + alle markører i SAMME koordinatsystem.
 * Markører posisjoneres med CSS-prosent (identisk med web UI og PDF).
 * visualViewport.scale brukes for å holde markørene visuelt like store ved zoom.
 */
function byggHtml(
  tegningUrl: string,
  markører: Markør[],
  omrader: Omrade[],
  gpsMarkør: GpsMarkør | null,
  trykkOppsett: "ingen" | "enkel" | "avansert",
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

  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=10,user-scalable=yes">
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
  #container { position:relative; }
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
  #maleLupe .lk { position:absolute; background:rgba(30,64,175,0.7); }
  #maleLupe .lkh { left:8px; right:8px; top:50%; height:1px; }
  #maleLupe .lkv { top:8px; bottom:8px; left:50%; width:1px; }
</style></head><body>
<div id="container" oncontextmenu="return false">
  <img id="tegning" src="${tegningUrl}" draggable="false" oncontextmenu="return false" />
</div>
<script>
var markører = ${markørData};
var omrader = ${omradeData};
var gpsPos = ${gpsData};
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
  document.querySelectorAll('.male-dot,.male-label').forEach(function(el) {
    el.style.transform = 'translate(-50%,-50%) scale(' + inv + ')';
  });
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('scroll', oppdaterZoom);
  window.visualViewport.addEventListener('resize', oppdaterZoom);
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

var img = document.getElementById('tegning');
img.onload = function() { plasser(); };
if (img.complete) plasser();

function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
var TEGNING_URL = ${JSON.stringify(tegningUrl)};

// Lupe (TILLEGG RETUR 1): forstørret utsnitt forskjøvet over fingeren med trådkors,
// så brukeren ser målepunktet fingeren dekker mens det dras.
window.visLupe = function(px_pct, py_pct, clientX, clientY) {
  var img = document.getElementById('tegning');
  var c = document.getElementById('container'); if (!img || !c) return;
  var dispW = img.clientWidth, dispH = img.clientHeight;
  var M = 2.4, L = 118;
  var ix = (px_pct/100) * dispW, iy = (py_pct/100) * dispH;
  var lupe = document.getElementById('maleLupe');
  if (!lupe) {
    lupe = document.createElement('div'); lupe.id = 'maleLupe';
    lupe.innerHTML = '<div class="lk lkh"></div><div class="lk lkv"></div>';
    c.appendChild(lupe);
  }
  lupe.style.cssText = 'position:fixed;z-index:40;width:' + L + 'px;height:' + L + 'px;border-radius:50%;border:2px solid #1e40af;overflow:hidden;background-color:#fff;background-image:url(' + TEGNING_URL + ');background-repeat:no-repeat;background-size:' + (dispW*M) + 'px ' + (dispH*M) + 'px;background-position:' + (L/2 - ix*M) + 'px ' + (L/2 - iy*M) + 'px;box-shadow:0 2px 12px rgba(0,0,0,0.45);pointer-events:none;' +
    'left:' + (clientX - L/2) + 'px;top:' + (clientY - L - 28) + 'px;';
  // Gjenoppbygg trådkorset (cssText tømte ikke innerHTML, men sikre at det finnes).
  if (!lupe.querySelector('.lk')) lupe.innerHTML = '<div class="lk lkh"></div><div class="lk lkv"></div>';
};
window.skjulLupe = function() {
  var lupe = document.getElementById('maleLupe'); if (lupe) lupe.remove();
};

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

// Måle-overlay: polylinje/polygon + punkter + etiketter (prosent-koordinater).
window.tegnMaling = function(punkter, segmenter, fyll) {
  window.__malePunkter = punkter || []; // for hit-test ved punkt-dra
  var g = document.getElementById('maleLag'); if (g) g.remove();
  var c = document.getElementById('container'); if (!c) return;
  if (!punkter || !punkter.length) return;
  var lag = document.createElement('div'); lag.id = 'maleLag';
  lag.style.cssText = 'position:absolute;inset:0;z-index:16;pointer-events:none';
  var svgNs = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
  var pts = punkter.map(function(p){ return p.x + ',' + p.y; }).join(' ');
  if (fyll && punkter.length >= 3) {
    var poly = document.createElementNS(svgNs, 'polygon');
    poly.setAttribute('points', pts); poly.setAttribute('fill', 'rgba(30,64,175,0.18)');
    poly.setAttribute('stroke', '#1e40af'); poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linejoin', 'round'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(poly);
  } else if (punkter.length >= 2) {
    var pl = document.createElementNS(svgNs, 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', '#1e40af'); pl.setAttribute('stroke-width', '2');
    pl.setAttribute('stroke-linejoin', 'round'); pl.setAttribute('stroke-linecap', 'round');
    pl.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(pl);
  }
  lag.appendChild(svg);
  // 🔴 RETUR 1 § 1: punkter/etiketter skal ha FAST skjermstørrelse uansett zoom.
  // oppdaterZoom() tidlig-returnerer når zoomen er uendret, så nye elementer må få
  // invers skala ved opprettelse — ellers blir de zoom·størrelse store.
  var inv = 1 / (window.visualViewport ? window.visualViewport.scale : 1);
  punkter.forEach(function(p){
    var dot = document.createElement('div'); dot.className = 'male-dot';
    dot.style.cssText = 'position:absolute;left:' + p.x + '%;top:' + p.y + '%;width:11px;height:11px;border-radius:50%;background:#1e40af;border:2px solid #fff;transform:translate(-50%,-50%) scale(' + inv + ');transform-origin:center';
    lag.appendChild(dot);
  });
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
  var c = document.getElementById('container');
  var sx=0, sy=0, st=0, flyttet=false, antallPekere=0, maksPekere=0, dragIdx=-1;
  var TREFF_PX = 22; // fingerradius for å treffe et eksisterende målepunkt
  function pct(clientX, clientY, rect){
    return {
      x: Math.max(0, Math.min(100, (clientX-rect.left)/rect.width*100)),
      y: Math.max(0, Math.min(100, (clientY-rect.top)/rect.height*100)),
    };
  }
  // Nærmeste målepunkt innen TREFF_PX (i skjerm-px). -1 = ingen.
  function finnPunkt(clientX, clientY, rect){
    var pk = window.__malePunkter || [];
    for (var i=0; i<pk.length; i++){
      var dx = clientX - (rect.left + pk[i].x/100*rect.width);
      var dy = clientY - (rect.top + pk[i].y/100*rect.height);
      if (Math.sqrt(dx*dx + dy*dy) <= TREFF_PX) return i;
    }
    return -1;
  }
  c.addEventListener('pointerdown', function(e){
    antallPekere++;
    if (antallPekere === 1) {
      sx=e.clientX; sy=e.clientY; st=Date.now(); flyttet=false; maksPekere=1;
      var img = document.getElementById('tegning');
      var rect = img.getBoundingClientRect();
      dragIdx = (rect.width>0 && rect.height>0) ? finnPunkt(e.clientX, e.clientY, rect) : -1;
    } else {
      maksPekere = Math.max(maksPekere, antallPekere);
      if (antallPekere > 1) { dragIdx = -1; window.skjulLupe && window.skjulLupe(); } // knip avbryter drag
    }
  });
  c.addEventListener('pointermove', function(e){
    if (Math.abs(e.clientX-sx) > 10 || Math.abs(e.clientY-sy) > 10) flyttet=true;
    if (dragIdx >= 0 && antallPekere === 1) {
      var img = document.getElementById('tegning');
      var rect = img.getBoundingClientRect();
      if (rect.width<=0 || rect.height<=0) return;
      var p = pct(e.clientX, e.clientY, rect);
      post({ type:'maledrag', index: dragIdx, x: p.x, y: p.y });
      window.visLupe && window.visLupe(p.x, p.y, e.clientX, e.clientY);
    }
  });
  function slutt(e){
    antallPekere = Math.max(0, antallPekere-1);
    if (antallPekere > 0) return; // vent til alle fingre er oppe
    var img = document.getElementById('tegning');
    var rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { maksPekere=0; dragIdx=-1; return; }
    var cx = (e.clientX != null ? e.clientX : sx), cy = (e.clientY != null ? e.clientY : sy);
    var p = pct(cx, cy, rect);
    // Var dette en punkt-dra? Da er det ALDRI et trykk (drarPunkt → 'ingen').
    var vardrag = (dragIdx >= 0 && flyttet);
    window.skjulLupe && window.skjulLupe();
    post({ type:'gest', varighetMs: Date.now()-st, flyttet: flyttet, antallPekere: maksPekere, x:p.x, y:p.y, drarPunkt: vardrag });
    maksPekere = 0; dragIdx = -1;
  }
  c.addEventListener('pointerup', slutt);
  c.addEventListener('pointercancel', function(){ antallPekere = Math.max(0, antallPekere-1); flyttet = true; dragIdx = -1; window.skjulLupe && window.skjulLupe(); });
})();` : ""}
</script>
</body></html>`;
}

export function TegningsVisning({
  tegningUrl,
  tegningNavn,
  onLukk,
  onTrykk,
  onMarkørTrykk,
  markører = [],
  omrader = [],
  gpsMarkør,
  plasseringAktiv = false,
  onHint,
  onOpprett,
  maleData,
  onMaleModusEndring,
}: TegningsVisningProps) {
  const { t } = useTranslation();
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avansert trykk/måling aktiveres når forelder gir avanserte props.
  const avansert = !!onHint || !!onOpprett || maleData !== undefined;

  // --- Måling (paritet med web, papir-veien). ---
  const [maleVerktoy, setMaleVerktoy] = useState<MaleVerktoy | null>(null);
  const [malePunkter, setMalePunkter] = useState<Punkt[]>([]);
  const [maleFerdig, setMaleFerdig] = useState(false);

  const mmPrPiksel = maleData?.mmPrPiksel ?? null;
  const scale = maleData?.scale ?? null;
  const scaleKilde = maleData?.scaleKilde ?? null;
  const scaleDenom = parseMalestokk(scale);
  const imgW = maleData?.imageWidth ?? null;
  const imgH = maleData?.imageHeight ?? null;
  const kanMaleNaa = !!maleData && kanMale(scale, mmPrPiksel, scaleKilde);
  const erAreal = maleVerktoy === "areal";

  const formatMeter = (m: number) => `${m.toFixed(2).replace(".", ",")} m`;
  const formatAreal = (m2: number) => `${m2.toFixed(2).replace(".", ",")} m²`;

  const kildeEtikett = (() => {
    if (scaleKilde === "kalibrert") return t("maaling.kildeKalibrert");
    if (scaleKilde === "manuell") return t("maaling.kildeManuell");
    if (scaleKilde === "tittelfelt") return t("maaling.kildeTittelfelt");
    return "";
  })();
  const malestokkEtikett = scale ? `${t("maaling.malestokk")} ${scale}, ${kildeEtikett}` : kildeEtikett;

  // Ett segment i meter (papir-målestokk). null uten komplett måledata.
  const segMeter = useCallback(
    (a: Punkt, b: Punkt): number | null => {
      if (mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
        return malMm(a, b, imgW, imgH, mmPrPiksel, scaleDenom) / 1000;
      }
      return null;
    },
    [mmPrPiksel, scaleDenom, imgW, imgH],
  );

  // Segment-/areal-etiketter + resultattekst.
  const maleSegmenter: { midx: number; midy: number; tekst: string }[] = [];
  let maleTotalMeter = 0;
  let arealM2: number | null = null;
  let omkretsMeter = 0;
  if (!erAreal) {
    for (let i = 1; i < malePunkter.length; i++) {
      const a = malePunkter[i - 1];
      const b = malePunkter[i];
      if (!a || !b) continue;
      const m = segMeter(a, b);
      if (m == null) continue;
      maleTotalMeter += m;
      maleSegmenter.push({ midx: (a.x + b.x) / 2, midy: (a.y + b.y) / 2, tekst: formatMeter(m) });
    }
  } else if (malePunkter.length >= 3) {
    const ring = [...malePunkter, malePunkter[0]!];
    for (let i = 1; i < ring.length; i++) {
      const m = segMeter(ring[i - 1]!, ring[i]!);
      if (m != null) omkretsMeter += m;
    }
    if (mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
      arealM2 = malArealMm2(malePunkter, imgW, imgH, mmPrPiksel, scaleDenom) / 1_000_000;
    }
    const cx = malePunkter.reduce((s, p) => s + p.x, 0) / malePunkter.length;
    const cy = malePunkter.reduce((s, p) => s + p.y, 0) / malePunkter.length;
    if (arealM2 != null) maleSegmenter.push({ midx: cx, midy: cy, tekst: formatAreal(arealM2) });
  }

  // Refs så den stabile WebView-meldingshåndtereren leser ferskeste tilstand.
  const maleVerktoyRef = useRef(maleVerktoy);
  maleVerktoyRef.current = maleVerktoy;
  const malePunkterRef = useRef(malePunkter);
  malePunkterRef.current = malePunkter;
  const maleFerdigRef = useRef(maleFerdig);
  maleFerdigRef.current = maleFerdig;
  const plasseringRef = useRef(plasseringAktiv);
  plasseringRef.current = plasseringAktiv;

  // Legg til et målepunkt (speiler web-logikken: linjal 2 punkter, polylinje/areal
  // lukkes ved trykk nær et eksisterende punkt).
  const leggTilMalepunkt = useCallback((x: number, y: number) => {
    const verktoy = maleVerktoyRef.current;
    if (!verktoy) return;
    const p: Punkt = { x, y };
    const forrige = malePunkterRef.current;
    if (maleFerdigRef.current) {
      setMaleFerdig(false);
      setMalePunkter([p]);
      return;
    }
    if (verktoy === "linjal") {
      const nye = [...forrige, p].slice(-2);
      setMalePunkter(nye);
      if (nye.length >= 2) setMaleFerdig(true);
      return;
    }
    const nær = (q: Punkt) => Math.hypot(q.x - x, q.y - y) <= LUKK_TERSKEL_PCT;
    if (verktoy === "areal") {
      if (forrige.length >= 3 && forrige[0] && nær(forrige[0])) { setMaleFerdig(true); return; }
    } else if (forrige.length >= 2 && forrige.some(nær)) {
      setMaleFerdig(true);
      return;
    }
    setMalePunkter([...forrige, p]);
  }, []);

  // Flytt et eksisterende målepunkt (TILLEGG RETUR 1). Rører ikke maleFerdig →
  // et lukket areal/polylinje forblir lukket mens punktet justeres.
  const flyttMalepunkt = useCallback((index: number, x: number, y: number) => {
    const forrige = malePunkterRef.current;
    if (index < 0 || index >= forrige.length) return;
    const nye = forrige.slice();
    nye[index] = { x, y };
    setMalePunkter(nye);
  }, []);

  const velgVerktoy = useCallback((v: MaleVerktoy) => {
    setMaleVerktoy((forrige) => (forrige === v ? null : v));
    setMalePunkter([]);
    setMaleFerdig(false);
  }, []);
  const nullstillMaling = useCallback(() => { setMalePunkter([]); setMaleFerdig(false); }, []);
  const avsluttMaling = useCallback(() => { setMaleVerktoy(null); setMalePunkter([]); setMaleFerdig(false); }, []);

  useEffect(() => {
    setLaster(true);
    setFeil(false);
  }, [tegningUrl]);

  useEffect(() => {
    if (laster && !feil) {
      timeoutRef.current = setTimeout(() => {
        setLaster(false);
        setFeil(true);
      }, LASTING_TIMEOUT_MS);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [laster, feil]);

  // Oppdater GPS-markør med CSS-prosent
  useEffect(() => {
    if (!webViewRef.current || laster) return;
    if (gpsMarkør) {
      webViewRef.current.injectJavaScript(`
        (function() {
          var old = document.querySelector('.gps');
          if (old) old.remove();
          var c = document.getElementById('container');
          if (!c) return;
          var div = document.createElement('div');
          div.className = 'gps';
          div.style.left = '${gpsMarkør.x}%';
          div.style.top = '${gpsMarkør.y}%';
          div.innerHTML = '<div class="gps-outer"><div class="gps-inner"></div></div>';
          c.appendChild(div);
          oppdaterZoom();
        })();
        true;
      `);
    }
  }, [gpsMarkør, laster]);

  // Injiser (eller fjern) måle-overlayet uten reload — kalt når punktene endres
  // og etter en reload (markør-refetch bygger HTML på nytt). Leser fra refs så
  // callbacken er stabil (ellers re-injiseres overlayet ved hver render).
  const maleSegmenterRef = useRef(maleSegmenter);
  maleSegmenterRef.current = maleSegmenter;
  const injiserMaling = useCallback(() => {
    if (!webViewRef.current) return;
    const punkter = malePunkterRef.current;
    const segmenter = punkter.length ? maleSegmenterRef.current : [];
    const fyll = maleVerktoyRef.current === "areal";
    webViewRef.current.injectJavaScript(
      `window.tegnMaling && window.tegnMaling(${JSON.stringify(punkter)}, ${JSON.stringify(segmenter)}, ${fyll}); true;`,
    );
  }, []);

  useEffect(() => {
    if (laster) return;
    injiserMaling();
  }, [malePunkter, maleVerktoy, laster, injiserMaling]);

  // Måling har forrang over modus (RETUR 1 § 3/4): varsle forelder så
  // plasseringsmodus (og banneret) slås av mens et verktøy er aktivt.
  useEffect(() => {
    onMaleModusEndring?.(maleVerktoy !== null);
  }, [maleVerktoy, onMaleModusEndring]);

  const håndterMelding = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "markør") {
          if (onMarkørTrykk) onMarkørTrykk(data.id);
          return;
        }
        // Legacy enkelt-trykk (andre forbrukere uten avanserte props).
        if (data.type === "trykk") {
          if (onTrykk) onTrykk(data.x, data.y);
          return;
        }
        // Punkt-dra (TILLEGG RETUR 1): live-oppdatering mens fingeren drar.
        if (data.type === "maledrag") {
          flyttMalepunkt(data.index, data.x, data.y);
          return;
        }
        if (data.type === "gest") {
          const modus: TrykkModus = maleVerktoyRef.current
            ? "maling"
            : plasseringRef.current
              ? "plassering"
              : "navigering";
          const handling = avgjorTrykkHandling(modus, {
            varighetMs: data.varighetMs,
            flyttet: data.flyttet,
            antallPekere: data.antallPekere,
          });
          if (handling === "malepunkt") {
            leggTilMalepunkt(data.x, data.y);
          } else if (handling === "opprett") {
            onOpprett?.(data.x, data.y);
          } else if (handling === "hint") {
            webViewRef.current?.injectJavaScript(
              `window.tegnHint && window.tegnHint(${data.x}, ${data.y}, ${JSON.stringify(t("lokasjoner.trykkHint"))}); true;`,
            );
            onHint?.();
          }
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onTrykk, onMarkørTrykk, onOpprett, onHint, leggTilMalepunkt, flyttMalepunkt, t],
  );

  const trykkOppsett: "ingen" | "enkel" | "avansert" = avansert
    ? "avansert"
    : onTrykk
      ? "enkel"
      : "ingen";
  const html = byggHtml(tegningUrl, markører, omrader, gpsMarkør ?? null, trykkOppsett);

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between bg-black/80 px-5 py-4">
        <Pressable onPress={onLukk} hitSlop={16} className="rounded-full bg-white/20 p-2.5">
          <X size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-4 text-center text-sm font-medium text-white" numberOfLines={1}>
          {tegningNavn}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      {feil ? (
        <View style={stiler.feilContainer}>
          <AlertTriangle size={48} color="#f59e0b" />
          <Text style={stiler.feilTekst}>{t("tegningsvelger.kunneIkkeLaste")}</Text>
          <Text style={stiler.feilBeskrivelse}>{t("tegningsvelger.sjekkNettverkProvIgjen")}</Text>
          <Pressable
            onPress={() => { setLaster(true); setFeil(false); }}
            style={stiler.prøvIgjenKnapp}
          >
            <RefreshCw size={16} color="#ffffff" />
            <Text style={stiler.prøvIgjenTekst}>{t("handling.provIgjen")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {laster && (
            <View style={stiler.lastingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={stiler.lastingTekst}>{t("tegningsvelger.lasterTegning")}</Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html, baseUrl: tegningUrl.substring(0, tegningUrl.lastIndexOf("/") + 1) }}
            style={{ flex: 1, backgroundColor: "#1a1a1a" }}
            onLoadEnd={() => { setLaster(false); setFeil(false); injiserMaling(); }}
            onError={() => { setLaster(false); setFeil(true); }}
            onMessage={håndterMelding}
            allowsInlineMediaPlayback
            javaScriptEnabled
            scalesPageToFit={false}
          />

          {/* Måleverktøy-linje (paritet med web RETUR 3 § C). Vises når måling er
              aktivert av forelder. Sperret med forklaring når målestokken ikke er
              bekreftet/kalibrert (samme lås som web, ingen kalibrering på mobil). */}
          {maleData !== undefined && !laster && (
            <View style={stiler.maleToolbar} pointerEvents="box-none">
              {kanMaleNaa ? (
                <View style={stiler.maleKnappRad}>
                  {([
                    ["linjal", Ruler, t("maaling.verktoyLinjal")],
                    ["polylinje", Waypoints, t("maaling.verktoyPolylinje")],
                    ["areal", VectorSquare, t("maaling.verktoyAreal")],
                  ] as const).map(([v, Ikon, etikett]) => {
                    const aktiv = maleVerktoy === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => velgVerktoy(v)}
                        style={[stiler.maleKnapp, aktiv && stiler.maleKnappAktiv]}
                      >
                        <Ikon size={14} color={aktiv ? "#ffffff" : "#1e3a8a"} />
                        <Text style={[stiler.maleKnappTekst, aktiv && stiler.maleKnappTekstAktiv]}>{etikett}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={stiler.maleSperret}>
                  <Ruler size={14} color="#9ca3af" />
                  <Text style={stiler.maleSperretTekst}>{t("maaling.malestokkBekreftPaaWeb")}</Text>
                </View>
              )}
            </View>
          )}

          {/* Resultatstripe — lengde/areal + kilde + handlinger. */}
          {maleVerktoy && (
            <View style={stiler.maleStripe} pointerEvents="box-none">
              <View style={stiler.maleStripeInnhold}>
                {erAreal ? (
                  malePunkter.length < 3 ? (
                    <Text style={stiler.maleHint}>{t("maaling.hintArealMobil")}</Text>
                  ) : (
                    <Text style={stiler.maleResultat}>
                      {arealM2 != null ? formatAreal(arealM2) : "—"}
                      <Text style={stiler.maleKilde}>  {t("maaling.omkrets")}: {formatMeter(omkretsMeter)}  ({malestokkEtikett})</Text>
                    </Text>
                  )
                ) : malePunkter.length < 2 ? (
                  <Text style={stiler.maleHint}>
                    {maleVerktoy === "polylinje" ? t("maaling.hintPolylinjeMobil") : t("maaling.klikkToPunkter")}
                  </Text>
                ) : (
                  <Text style={stiler.maleResultat}>
                    {formatMeter(maleTotalMeter)}
                    <Text style={stiler.maleKilde}>  ({malestokkEtikett})</Text>
                  </Text>
                )}
                <View style={stiler.maleStripeKnapper}>
                  {(maleVerktoy === "polylinje" && malePunkter.length >= 2 && !maleFerdig) && (
                    <Pressable onPress={() => setMaleFerdig(true)} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.fullfor")}</Text>
                    </Pressable>
                  )}
                  {(maleVerktoy === "areal" && malePunkter.length >= 3 && !maleFerdig) && (
                    <Pressable onPress={() => setMaleFerdig(true)} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.lukkFlate")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={nullstillMaling} style={stiler.maleHandling}>
                    <RotateCcw size={14} color="#6b7280" />
                    <Text style={stiler.maleHandlingTekst}>{t("maaling.nullstill")}</Text>
                  </Pressable>
                  <Pressable onPress={avsluttMaling} style={stiler.maleHandling}>
                    <X size={14} color="#6b7280" />
                    <Text style={stiler.maleHandlingTekst}>{t("handling.lukk")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const stiler = StyleSheet.create({
  feilContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  feilTekst: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  feilBeskrivelse: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  prøvIgjenKnapp: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e40af",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  prøvIgjenTekst: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  lastingContainer: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  lastingTekst: {
    color: "#d1d5db",
    fontSize: 14,
    marginTop: 12,
  },
  // --- Måleverktøy ---
  maleToolbar: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 25,
  },
  maleKnappRad: {
    flexDirection: "row",
    gap: 6,
  },
  maleKnapp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  maleKnappAktiv: {
    backgroundColor: "#1e40af",
  },
  maleKnappTekst: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "600",
  },
  maleKnappTekstAktiv: {
    color: "#ffffff",
  },
  maleSperret: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 260,
  },
  maleSperretTekst: {
    color: "#6b7280",
    fontSize: 11,
    flexShrink: 1,
  },
  maleStripe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  maleStripeInnhold: {
    backgroundColor: "rgba(239,246,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  maleHint: {
    color: "#4b5563",
    fontSize: 12,
  },
  maleResultat: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
  },
  maleKilde: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "400",
  },
  maleStripeKnapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  maleHandling: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  maleHandlingTekst: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "500",
  },
});
