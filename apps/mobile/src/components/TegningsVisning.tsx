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
import { X, AlertTriangle, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";

const LASTING_TIMEOUT_MS = 15_000;

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
  onTrykk?: (posX: number, posY: number) => void;
  onMarkørTrykk?: (id: string) => void;
  markører?: Markør[];
  omrader?: Omrade[];
  gpsMarkør?: GpsMarkør | null;
  /** Ubrukt — beholdt for bakoverkompatibilitet */
  pdfPageSize?: { width: number; height: number };
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
  kanTrykke: boolean,
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
  body { background:#1a1a1a; }
  #container { position:relative; }
  #tegning { display:block; width:100%; height:auto; }
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
<div id="container">
  <img id="tegning" src="${tegningUrl}" />
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

${kanTrykke ? `
document.getElementById('container').addEventListener('click', function(e) {
  var img = document.getElementById('tegning');
  var rect = img.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  var x = ((e.clientX - rect.left) / rect.width) * 100;
  var y = ((e.clientY - rect.top) / rect.height) * 100;
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type:'trykk', x:Math.max(0,Math.min(100,x)), y:Math.max(0,Math.min(100,y))
  }));
});` : ""}
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
}: TegningsVisningProps) {
  const { t } = useTranslation();
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const håndterMelding = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "trykk" && onTrykk) {
          onTrykk(data.x, data.y);
        } else if (data.type === "markør" && onMarkørTrykk) {
          onMarkørTrykk(data.id);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onTrykk, onMarkørTrykk],
  );

  const html = byggHtml(tegningUrl, markører, omrader, gpsMarkør ?? null, !!onTrykk);

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
            onLoadEnd={() => { setLaster(false); setFeil(false); }}
            onError={() => { setLaster(false); setFeil(true); }}
            onMessage={håndterMelding}
            allowsInlineMediaPlayback
            javaScriptEnabled
            scalesPageToFit={false}
          />
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
});
