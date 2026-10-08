"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { X, AlertTriangle, RefreshCw, Ruler, Waypoints, VectorSquare, Check, Trash2, Hand, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  kanMale,
  malMm,
  malArealMm2,
  parseMalestokk,
  TOM_MALETILSTAND,
  minPunkter,
  aktivMaling,
  startMaling,
  leggTilPunkt,
  settFerdig,
  flyttPunkt,
  velgMaling,
  slettAktiv,
  slettAlle,
  avsluttAktiv,
  finnMalingTreff,
  type Punkt,
  type MaleVerktoy,
  type Maling,
  type MaleTilstand,
} from "@sitedoc/shared/utils";
import { avgjorTrykkHandling, type TegningVerktoy } from "../lib/tegningTrykk";

const LASTING_TIMEOUT_MS = 15_000;

/** Måledata fra tegningen (speiler web). `undefined` = måling ikke aktivert av forelder. */
export interface MaaleData {
  mmPrPiksel: number | null;
  scale: string | null;
  scaleKilde: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

/** Lukk-terskel i prosent: trykk nær et eksisterende punkt lukker polylinje/areal. */
const LUKK_TERSKEL_PCT = 3.5;

/** Trykk innen denne radiusen (skjerm-px) velger en eksisterende måling. */
const VELG_TREFF_PX = 20;

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
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=20,user-scalable=yes">
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

// Lupe (RETUR 3 § 2): forstørret utsnitt (~2,5× LOKAL zoom) forskjøvet OPP og TIL
// SIDEN for fingeren, med trådkors som viser nøyaktig punkt. Bytter side/retning
// ved skjermkanten. Vises både når man setter punkt (måleverktøy) og når man drar
// (Flytt). Punktet settes ved SLIPP — lupa lar deg justere før du slipper.
window.visLupe = function(px_pct, py_pct, clientX, clientY) {
  var img = document.getElementById('tegning');
  var c = document.getElementById('container'); if (!img || !c) return;
  var dispW = img.clientWidth, dispH = img.clientHeight;
  var z = window.visualViewport ? window.visualViewport.scale : 1;
  var M = 2.5 * z, L = 120, GAP = 26;
  var ix = (px_pct/100) * dispW, iy = (py_pct/100) * dispH;
  var lupe = document.getElementById('maleLupe');
  if (!lupe) {
    lupe = document.createElement('div'); lupe.id = 'maleLupe';
    lupe.innerHTML = '<div class="lk lkh"></div><div class="lk lkv"></div>';
    c.appendChild(lupe);
  }
  var vw = window.innerWidth, vh = window.innerHeight;
  var left = clientX + GAP;                       // til høyre for fingeren
  if (left + L > vw - 4) left = clientX - GAP - L; // flipp til venstre ved høyre kant
  if (left < 4) left = 4;
  var top = clientY - GAP - L;                     // over fingeren
  if (top < 4) top = clientY + GAP;                // under ved toppkanten
  if (top + L > vh - 4) top = vh - L - 4;
  lupe.style.cssText = 'position:fixed;z-index:40;width:' + L + 'px;height:' + L + 'px;border-radius:50%;border:2px solid #1e40af;overflow:hidden;background-color:#fff;background-image:url(' + TEGNING_URL + ');background-repeat:no-repeat;background-size:' + (dispW*M) + 'px ' + (dispH*M) + 'px;background-position:' + (L/2 - ix*M) + 'px ' + (L/2 - iy*M) + 'px;box-shadow:0 2px 12px rgba(0,0,0,0.45);pointer-events:none;' +
    'left:' + left + 'px;top:' + top + 'px;';
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

// Måle-overlay (RETUR 2): tegn ALLE målinger. Den aktive uthevet (blå, dragbare
// punkter + segment-etiketter); ferdige inaktive dempet (grå, en resultat-etikett).
// data = { malinger:[{verktoy,punkter,ferdig,aktiv,summary}], segmenter:[...] }.
window.tegnMalinger = function(data) {
  data = data || {};
  var malinger = data.malinger || [];
  var segmenter = data.segmenter || [];
  // Hit-test ved punkt-dra gjelder KUN den aktive målingens punkter.
  var aktiv = null;
  for (var i = 0; i < malinger.length; i++) { if (malinger[i].aktiv) { aktiv = malinger[i]; break; } }
  window.__malePunkter = aktiv ? (aktiv.punkter || []) : [];

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
  var c = document.getElementById('container');
  var MOVE_PX = 10, TREFF_PX = 24;
  var primær = null, pekere = {}, maks = 0;
  var sx=0, sy=0, st=0, flyttet=false, dragIdx=-1, lupeAktiv=false, pending=null, pinch=false, sist=0;

  function antallPekere(){ return Object.keys(pekere).length; }
  function rekt(){ var img=document.getElementById('tegning'); return img?img.getBoundingClientRect():null; }
  function pct(clientX, clientY, r){
    return { x: Math.max(0,Math.min(100,(clientX-r.left)/r.width*100)), y: Math.max(0,Math.min(100,(clientY-r.top)/r.height*100)) };
  }
  function finnPunkt(clientX, clientY, r){
    var pk = window.__malePunkter || [];
    for (var i=0;i<pk.length;i++){ var dx=clientX-(r.left+pk[i].x/100*r.width), dy=clientY-(r.top+pk[i].y/100*r.height); if (Math.sqrt(dx*dx+dy*dy)<=TREFF_PX) return i; }
    return -1;
  }
  function modus(){ return window.__maleModus || 'navigering'; }
  function erMale(m){ return m==='linjal'||m==='polylinje'||m==='areal'; }
  function nullstill(){ primær=null; pekere={}; maks=0; flyttet=false; dragIdx=-1; lupeAktiv=false; pending=null; pinch=false; window.skjulLupe && window.skjulLupe(); }

  c.addEventListener('pointerdown', function(e){
    var naa = Date.now();
    if (primær !== null && (naa - sist) > 1200) nullstill(); // selvhel tapt pointerup
    sist = naa;
    pekere[e.pointerId] = true;
    maks = Math.max(maks, antallPekere());
    if (primær === null) {
      primær = e.pointerId;
      sx=e.clientX; sy=e.clientY; st=naa; flyttet=false; dragIdx=-1; pending=null; pinch=false;
      var r = rekt(); if (!r || r.width<=0 || r.height<=0) return;
      var m = modus();
      if (m === 'flytt') dragIdx = finnPunkt(e.clientX, e.clientY, r);
      lupeAktiv = erMale(m) || (m==='flytt' && dragIdx>=0);
      if (lupeAktiv) { var p = pct(e.clientX,e.clientY,r); pending=p; window.visLupe && window.visLupe(p.x,p.y,e.clientX,e.clientY); }
    } else {
      // Ekstra finger → knip/zoom. Avbryt pending enkelt-finger-handling.
      pinch = true; dragIdx=-1; lupeAktiv=false; pending=null; window.skjulLupe && window.skjulLupe();
    }
  });

  c.addEventListener('pointermove', function(e){
    if (e.pointerId !== primær) return;
    sist = Date.now();
    if (Math.abs(e.clientX-sx)>MOVE_PX || Math.abs(e.clientY-sy)>MOVE_PX) flyttet=true;
    if (pinch || antallPekere()>1 || !lupeAktiv) return;
    var r = rekt(); if (!r || r.width<=0 || r.height<=0) return;
    var p = pct(e.clientX,e.clientY,r); pending=p;
    if (dragIdx>=0) post({ type:'maledrag', index:dragIdx, x:p.x, y:p.y }); // Flytt: live reshape
    window.visLupe && window.visLupe(p.x,p.y,e.clientX,e.clientY);
  });

  function avslutt(e, avbrutt){
    sist = Date.now();
    var erPrimær = (e.pointerId === primær);
    delete pekere[e.pointerId];
    if (!erPrimær) return; // sekundærfinger sluppet — primær styrer commit/reset
    var r = rekt();
    window.skjulLupe && window.skjulLupe();
    if (!avbrutt && !pinch && r && r.width>0 && r.height>0) {
      var cx = (e.clientX!=null?e.clientX:sx), cy=(e.clientY!=null?e.clientY:sy);
      var p = pending || pct(cx,cy,r);
      // Punktet settes HER (ved slipp). RN avgjør handling via avgjorTrykkHandling.
      post({ type:'gest', verktoy: modus(), varighetMs: Date.now()-st, flyttet: flyttet, antallPekere: maks, nedPaaPunkt: dragIdx>=0, dragIdx: dragIdx, x:p.x, y:p.y, rectW:r.width, rectH:r.height });
    }
    nullstill();
  }
  c.addEventListener('pointerup', function(e){ avslutt(e,false); });
  c.addEventListener('pointercancel', function(e){ avslutt(e,true); });
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

  // --- Måling: flere målinger (RETUR 2) + eksplisitte verktøy (RETUR 3). ---
  // `aktivtVerktoy` er den valgte modusen i verktøylinja (ikke den aktive målingens
  // type). "navigering" = ingen verktøy (pan/zoom + hint / langt trykk).
  const [maleTilstand, setMaleTilstand] = useState<MaleTilstand>(TOM_MALETILSTAND);
  const [aktivtVerktoy, setAktivtVerktoy] = useState<TegningVerktoy>("navigering");
  const [visSlettAlle, setVisSlettAlle] = useState(false);
  const aktiv = aktivMaling(maleTilstand);
  const aktivPunkter = aktiv?.punkter ?? [];
  const erAreal = aktiv?.verktoy === "areal";
  const maleEngasjert = maleTilstand.aktivId !== null;
  const verktoyAktiv = aktivtVerktoy !== "navigering";

  const mmPrPiksel = maleData?.mmPrPiksel ?? null;
  const scale = maleData?.scale ?? null;
  const scaleKilde = maleData?.scaleKilde ?? null;
  const scaleDenom = parseMalestokk(scale);
  const imgW = maleData?.imageWidth ?? null;
  const imgH = maleData?.imageHeight ?? null;
  const kanMaleNaa = !!maleData && kanMale(scale, mmPrPiksel, scaleKilde);

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
  const malLengdeMeter = useCallback(
    (punkter: Punkt[]): number => {
      let sum = 0;
      for (let i = 1; i < punkter.length; i++) {
        const m = segMeter(punkter[i - 1]!, punkter[i]!);
        if (m != null) sum += m;
      }
      return sum;
    },
    [segMeter],
  );
  const malArealM2 = useCallback(
    (punkter: Punkt[]): number | null => {
      if (punkter.length >= 3 && mmPrPiksel != null && scaleDenom != null && imgW != null && imgH != null) {
        return malArealMm2(punkter, imgW, imgH, mmPrPiksel, scaleDenom) / 1_000_000;
      }
      return null;
    },
    [mmPrPiksel, scaleDenom, imgW, imgH],
  );
  // Kort resultat-etikett for en inaktiv måling (vises ved tyngdepunktet).
  const summaryFor = useCallback(
    (m: Maling): string => {
      if (m.verktoy === "areal") {
        const a = malArealM2(m.punkter);
        return a != null ? formatAreal(a) : "";
      }
      return m.punkter.length >= 2 ? formatMeter(malLengdeMeter(m.punkter)) : "";
    },
    [malArealM2, malLengdeMeter],
  );

  // Segment-/areal-etiketter + resultattekst for den AKTIVE målingen.
  const maleSegmenter: { midx: number; midy: number; tekst: string }[] = [];
  let maleTotalMeter = 0;
  let arealM2: number | null = null;
  let omkretsMeter = 0;
  if (!erAreal) {
    for (let i = 1; i < aktivPunkter.length; i++) {
      const a = aktivPunkter[i - 1];
      const b = aktivPunkter[i];
      if (!a || !b) continue;
      const m = segMeter(a, b);
      if (m == null) continue;
      maleTotalMeter += m;
      maleSegmenter.push({ midx: (a.x + b.x) / 2, midy: (a.y + b.y) / 2, tekst: formatMeter(m) });
    }
  } else if (aktivPunkter.length >= 3) {
    const ring = [...aktivPunkter, aktivPunkter[0]!];
    for (let i = 1; i < ring.length; i++) {
      const m = segMeter(ring[i - 1]!, ring[i]!);
      if (m != null) omkretsMeter += m;
    }
    arealM2 = malArealM2(aktivPunkter);
    const cx = aktivPunkter.reduce((s, p) => s + p.x, 0) / aktivPunkter.length;
    const cy = aktivPunkter.reduce((s, p) => s + p.y, 0) / aktivPunkter.length;
    if (arealM2 != null) maleSegmenter.push({ midx: cx, midy: cy, tekst: formatAreal(arealM2) });
  }

  // Refs så den stabile WebView-meldingshåndtereren leser ferskeste tilstand.
  const maleTilstandRef = useRef(maleTilstand);
  maleTilstandRef.current = maleTilstand;
  const plasseringRef = useRef(plasseringAktiv);
  plasseringRef.current = plasseringAktiv;

  // Unik id pr. ny måling (ingen Date.now/Math.random — en stigende teller holder).
  const nesteIdRef = useRef(0);

  // Forlat en påbegynt måling pent: behold hvis lang nok (settFerdig), ellers forkast.
  const forlatPaagaaende = useCallback((t0: MaleTilstand): MaleTilstand => {
    const akt = aktivMaling(t0);
    if (akt && !akt.ferdig) {
      return akt.punkter.length >= minPunkter(akt.verktoy) ? settFerdig(t0) : slettAktiv(t0);
    }
    return t0;
  }, []);

  // Verktøylinje (RETUR 3): ett verktøy om gangen.
  const velgMaleVerktoy = useCallback((v: MaleVerktoy) => {
    setMaleTilstand((prev) => startMaling(prev, v, `m${(nesteIdRef.current += 1)}`));
    setAktivtVerktoy(v);
  }, []);
  const velgFlytt = useCallback(() => {
    setMaleTilstand(forlatPaagaaende);
    setAktivtVerktoy("flytt");
  }, [forlatPaagaaende]);
  const velgOpprett = useCallback(() => {
    setMaleTilstand(forlatPaagaaende);
    setAktivtVerktoy("opprett");
  }, [forlatPaagaaende]);

  const håndterLeggTilPunkt = useCallback((x: number, y: number) => {
    const neste = leggTilPunkt(
      maleTilstandRef.current,
      { x, y },
      (q) => Math.hypot(q.x - x, q.y - y) <= LUKK_TERSKEL_PCT,
    );
    setMaleTilstand(neste);
    // Ferdig figur → gå automatisk til Flytt med figuren valgt (RETUR 3 § 1).
    const akt = aktivMaling(neste);
    if (akt?.ferdig) setAktivtVerktoy("flytt");
  }, []);
  const håndterFlyttPunkt = useCallback((index: number, x: number, y: number) => {
    setMaleTilstand((prev) => flyttPunkt(prev, index, { x, y }));
  }, []);
  const håndterFerdig = useCallback(() => {
    setMaleTilstand((prev) => settFerdig(prev));
    setAktivtVerktoy("flytt");
  }, []);
  const håndterVelgMaling = useCallback((id: string) => {
    setMaleTilstand((prev) => velgMaling(prev, id));
    setAktivtVerktoy("flytt");
  }, []);
  const håndterSlettAktiv = useCallback(() => setMaleTilstand((prev) => slettAktiv(prev)), []);
  const håndterSlettAlle = useCallback(() => { setMaleTilstand(slettAlle()); setVisSlettAlle(false); }, []);
  const avsluttMaling = useCallback(() => {
    setMaleTilstand((prev) => avsluttAktiv(prev));
    setAktivtVerktoy("navigering");
  }, []);

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

  // Injiser (eller fjern) måle-overlayet uten reload — kalt når tilstanden endres
  // og etter en reload (markør-refetch bygger HTML på nytt). Leser fra refs så
  // callbacken er stabil (ellers re-injiseres overlayet ved hver render).
  const maleSegmenterRef = useRef(maleSegmenter);
  maleSegmenterRef.current = maleSegmenter;
  const injiserMaling = useCallback(() => {
    if (!webViewRef.current) return;
    const tilstand = maleTilstandRef.current;
    const payload = {
      malinger: tilstand.malinger.map((m) => ({
        verktoy: m.verktoy,
        punkter: m.punkter,
        ferdig: m.ferdig,
        aktiv: m.id === tilstand.aktivId,
        summary: m.id === tilstand.aktivId ? "" : summaryFor(m),
      })),
      segmenter: maleSegmenterRef.current,
    };
    webViewRef.current.injectJavaScript(
      `window.tegnMalinger && window.tegnMalinger(${JSON.stringify(payload)}); true;`,
    );
  }, [summaryFor]);

  useEffect(() => {
    if (laster) return;
    injiserMaling();
  }, [maleTilstand, laster, injiserMaling]);

  // Verktøyet har forrang over forelderens modus (RETUR 1 § 3/4, RETUR 3): varsle
  // forelder så plasseringsmodus (og banneret) slås av mens et verktøy er valgt.
  useEffect(() => {
    onMaleModusEndring?.(verktoyAktiv);
  }, [verktoyAktiv, onMaleModusEndring]);

  // Fortell WebView-en hvilket verktøy som er aktivt (styrer lupe + set-on-release).
  // Utenfor et eksplisitt verktøy følger vi forelderens bryter (plassering → opprett).
  const effektivtVerktoyRef = useRef<TegningVerktoy>("navigering");
  const effektivtVerktoy: TegningVerktoy = verktoyAktiv
    ? aktivtVerktoy
    : plasseringAktiv
      ? "opprett"
      : "navigering";
  effektivtVerktoyRef.current = effektivtVerktoy;
  useEffect(() => {
    if (laster) return;
    webViewRef.current?.injectJavaScript(`window.__maleModus=${JSON.stringify(effektivtVerktoy)};true;`);
  }, [effektivtVerktoy, laster]);

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
        // Punkt-dra (Flytt): live-oppdatering mens fingeren drar.
        if (data.type === "maledrag") {
          håndterFlyttPunkt(data.index, data.x, data.y);
          return;
        }
        if (data.type === "gest") {
          const tilstand = maleTilstandRef.current;
          const verktoy = effektivtVerktoyRef.current;
          // Flytt + ikke på punkt: traff gesten en eksisterende måling? (grunnlag for valg)
          let traffMaling = false;
          if (verktoy === "flytt" && !data.nedPaaPunkt && tilstand.malinger.length) {
            traffMaling =
              finnMalingTreff(tilstand.malinger, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX) != null;
          }
          const handling = avgjorTrykkHandling(verktoy, {
            varighetMs: data.varighetMs,
            flyttet: data.flyttet,
            antallPekere: data.antallPekere,
            nedPaaPunkt: data.nedPaaPunkt,
            traffMaling,
          });
          switch (handling) {
            case "settPunkt":
              håndterLeggTilPunkt(data.x, data.y);
              return;
            case "draPunkt":
              return; // allerede anvendt live via `maledrag`
            case "velgMaling": {
              const traff = finnMalingTreff(tilstand.malinger, { x: data.x, y: data.y }, data.rectW, data.rectH, VELG_TREFF_PX);
              if (traff) håndterVelgMaling(traff);
              return;
            }
            case "opprett":
              onOpprett?.(data.x, data.y);
              return;
            case "hint":
              webViewRef.current?.injectJavaScript(
                `window.tegnHint && window.tegnHint(${data.x}, ${data.y}, ${JSON.stringify(t("maaling.hintTrykk"))}); true;`,
              );
              onHint?.();
              return;
            default:
              return; // pan / ingen
          }
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onTrykk, onMarkørTrykk, onOpprett, onHint, håndterLeggTilPunkt, håndterFlyttPunkt, håndterVelgMaling, t],
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

          {/* Verktøylinje (RETUR 3): [Flytt] [Linjal] [Polylinje] [Areal] [＋ Opprett].
              Ett verktøy om gangen. Måleverktøyene sperres når målestokken ikke er
              bekreftet (samme lås som web, ingen kalibrering på mobil); Flytt og
              Opprett er alltid tilgjengelige. */}
          {maleData !== undefined && !laster && (
            <View style={stiler.maleToolbar} pointerEvents="box-none">
              <View style={stiler.maleKnappRad}>
                <Pressable
                  onPress={velgFlytt}
                  style={[stiler.maleKnapp, aktivtVerktoy === "flytt" && stiler.maleKnappAktiv]}
                >
                  <Hand size={14} color={aktivtVerktoy === "flytt" ? "#ffffff" : "#1e3a8a"} />
                  <Text style={[stiler.maleKnappTekst, aktivtVerktoy === "flytt" && stiler.maleKnappTekstAktiv]}>{t("maaling.verktoyFlytt")}</Text>
                </Pressable>
                {([
                  ["linjal", Ruler, t("maaling.verktoyLinjal")],
                  ["polylinje", Waypoints, t("maaling.verktoyPolylinje")],
                  ["areal", VectorSquare, t("maaling.verktoyAreal")],
                ] as const).map(([v, Ikon, etikett]) => {
                  const erValgt = aktivtVerktoy === v;
                  return (
                    <Pressable
                      key={v}
                      disabled={!kanMaleNaa}
                      onPress={() => velgMaleVerktoy(v)}
                      style={[stiler.maleKnapp, erValgt && stiler.maleKnappAktiv, !kanMaleNaa && stiler.maleKnappSperret]}
                    >
                      <Ikon size={14} color={erValgt ? "#ffffff" : "#1e3a8a"} />
                      <Text style={[stiler.maleKnappTekst, erValgt && stiler.maleKnappTekstAktiv]}>{etikett}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={velgOpprett}
                  style={[stiler.maleKnapp, aktivtVerktoy === "opprett" && stiler.maleKnappAktiv]}
                >
                  <Plus size={14} color={aktivtVerktoy === "opprett" ? "#ffffff" : "#1e3a8a"} />
                  <Text style={[stiler.maleKnappTekst, aktivtVerktoy === "opprett" && stiler.maleKnappTekstAktiv]}>{t("maaling.verktoyOpprett")}</Text>
                </Pressable>
              </View>
              {!kanMaleNaa && (
                <View style={stiler.maleSperret}>
                  <Ruler size={12} color="#9ca3af" />
                  <Text style={stiler.maleSperretTekst}>{t("maaling.malestokkBekreftPaaWeb")}</Text>
                </View>
              )}
            </View>
          )}

          {/* Resultatstripe — den AKTIVE målingen: lengde/areal + kilde + handlinger. */}
          {maleEngasjert && aktiv && (
            <View style={stiler.maleStripe} pointerEvents="box-none">
              <View style={stiler.maleStripeInnhold}>
                {erAreal ? (
                  aktivPunkter.length < 3 ? (
                    <Text style={stiler.maleHint}>{t("maaling.hintArealMobil")}</Text>
                  ) : (
                    <Text style={stiler.maleResultat}>
                      {arealM2 != null ? formatAreal(arealM2) : "—"}
                      <Text style={stiler.maleKilde}>  {t("maaling.omkrets")}: {formatMeter(omkretsMeter)}  ({malestokkEtikett})</Text>
                    </Text>
                  )
                ) : aktivPunkter.length < 2 ? (
                  <Text style={stiler.maleHint}>
                    {aktiv?.verktoy === "polylinje" ? t("maaling.hintPolylinjeMobil") : t("maaling.klikkToPunkter")}
                  </Text>
                ) : (
                  <Text style={stiler.maleResultat}>
                    {formatMeter(maleTotalMeter)}
                    <Text style={stiler.maleKilde}>  ({malestokkEtikett})</Text>
                  </Text>
                )}
                <View style={stiler.maleStripeKnapper}>
                  {(aktiv?.verktoy === "polylinje" && aktivPunkter.length >= 2 && !aktiv.ferdig) && (
                    <Pressable onPress={håndterFerdig} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.fullfor")}</Text>
                    </Pressable>
                  )}
                  {(aktiv?.verktoy === "areal" && aktivPunkter.length >= 3 && !aktiv.ferdig) && (
                    <Pressable onPress={håndterFerdig} style={stiler.maleHandling}>
                      <Check size={14} color="#16a34a" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.lukkFlate")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={håndterSlettAktiv} style={stiler.maleHandling}>
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={[stiler.maleHandlingTekst, { color: "#dc2626" }]}>{t("maaling.slett")}</Text>
                  </Pressable>
                  {maleTilstand.malinger.length > 1 && (
                    <Pressable onPress={() => setVisSlettAlle(true)} style={stiler.maleHandling}>
                      <Trash2 size={14} color="#6b7280" />
                      <Text style={stiler.maleHandlingTekst}>{t("maaling.slettAlle")}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={avsluttMaling} style={stiler.maleHandling}>
                    <X size={14} color="#6b7280" />
                    <Text style={stiler.maleHandlingTekst}>{t("handling.lukk")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Slett alle — bekreftelsesmodal (ikke confirm(), jf. ui-standarder). */}
          <Modal visible={visSlettAlle} transparent animationType="fade" onRequestClose={() => setVisSlettAlle(false)}>
            <View style={stiler.modalBakgrunn}>
              <View style={stiler.modalKort}>
                <Text style={stiler.modalTittel}>{t("maaling.slettAlleTittel")}</Text>
                <Text style={stiler.modalTekst}>{t("maaling.slettAlleBekreft")}</Text>
                <View style={stiler.modalKnapper}>
                  <Pressable onPress={() => setVisSlettAlle(false)} style={[stiler.modalKnapp, stiler.modalKnappAvbryt]}>
                    <Text style={stiler.modalKnappTekst}>{t("handling.avbryt")}</Text>
                  </Pressable>
                  <Pressable onPress={håndterSlettAlle} style={[stiler.modalKnapp, stiler.modalKnappSlett]}>
                    <Text style={[stiler.modalKnappTekst, { color: "#ffffff" }]}>{t("maaling.slettAlle")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
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
    right: 8,
    zIndex: 25,
  },
  maleKnappRad: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  maleKnappSperret: {
    opacity: 0.4,
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
  modalBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalKort: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    gap: 10,
  },
  modalTittel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  modalTekst: {
    color: "#4b5563",
    fontSize: 14,
  },
  modalKnapper: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalKnapp: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalKnappAvbryt: {
    backgroundColor: "#f3f4f6",
  },
  modalKnappSlett: {
    backgroundColor: "#dc2626",
  },
  modalKnappTekst: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
});
