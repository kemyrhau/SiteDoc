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

const LASTING_TIMEOUT_MS = 15_000;

export interface Markør {
  x: number;
  y: number;
  id: string;
  label?: string;
  farge?: string;
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
  gpsMarkør?: GpsMarkør | null;
  /** Ubrukt — beholdt for bakoverkompatibilitet */
  pdfPageSize?: { width: number; height: number };
}

/**
 * Bygg HTML som rendrer tegningen + alle markører i SAMME koordinatsystem.
 * CSS-prosentposisjonering sikrer at markørene alltid er korrekt plassert
 * uavhengig av OS, skjermstørrelse eller skalering.
 */
function byggHtml(
  tegningUrl: string,
  markører: Markør[],
  gpsMarkør: GpsMarkør | null,
  kanTrykke: boolean,
): string {
  const markørHtml = markører.map((m) => {
    const farge = m.farge || "#ef4444";
    return `<div class="markør" data-id="${m.id}" style="left:${m.x}%;top:${m.y}%">
      <div style="width:16px;height:16px;border-radius:50%;background:${farge};border:2px solid #fff;transform:translate(-50%,-50%)"></div>
      ${m.label ? `<div class="label">${m.label}</div>` : ""}
    </div>`;
  }).join("\n");

  const gpsHtml = gpsMarkør ? `
    <div class="gps" style="left:${gpsMarkør.x}%;top:${gpsMarkør.y}%">
      <div class="gps-outer"><div class="gps-inner"></div></div>
    </div>` : "";

  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=10,user-scalable=yes">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1a1a1a; overflow:auto; -webkit-overflow-scrolling:touch; }
  .container { position:relative; display:inline-block; }
  .container img { display:block; width:100%; height:auto; }
  .markør { position:absolute; z-index:10; cursor:pointer; }
  .markør .label {
    position:absolute; top:10px; left:50%; transform:translateX(-50%);
    font-size:8px; font-weight:700; color:#1f2937;
    background:rgba(255,255,255,0.85); border-radius:3px;
    padding:1px 3px; white-space:nowrap;
  }
  .gps { position:absolute; z-index:20; transform:translate(-50%,-50%); }
  .gps-outer {
    width:24px; height:24px; border-radius:50%;
    background:rgba(59,130,246,0.25);
    display:flex; align-items:center; justify-content:center;
    animation: pulse 2s ease-in-out infinite;
  }
  .gps-inner {
    width:14px; height:14px; border-radius:50%;
    background:#3b82f6; border:2.5px solid #fff;
    box-shadow: 0 0 6px rgba(59,130,246,0.5);
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }
</style></head><body>
<div class="container" id="container">
  <img src="${tegningUrl}" id="tegning" />
  ${markørHtml}
  ${gpsHtml}
</div>
<script>
  ${kanTrykke ? `
  document.getElementById('container').addEventListener('click', function(e) {
    var img = document.getElementById('tegning');
    var rect = img.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width) * 100;
    var y = ((e.clientY - rect.top) / rect.height) * 100;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'trykk', x: Math.max(0,Math.min(100,x)), y: Math.max(0,Math.min(100,y))
    }));
  });` : ""}

  document.querySelectorAll('.markør').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'markør', id: el.dataset.id
      }));
    });
  });
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
  gpsMarkør,
}: TegningsVisningProps) {
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset ved URL-endring
  useEffect(() => {
    setLaster(true);
    setFeil(false);
  }, [tegningUrl]);

  // Timeout
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

  // Oppdater GPS-markør uten å laste hele siden på nytt
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

  const html = byggHtml(tegningUrl, markører, gpsMarkør ?? null, !!onTrykk);

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-black/80 px-4 py-3">
        <Pressable onPress={onLukk} hitSlop={12} className="rounded-full bg-white/20 p-2">
          <X size={20} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-3 text-center text-sm font-medium text-white" numberOfLines={1}>
          {tegningNavn}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Feilvisning */}
      {feil ? (
        <View style={stiler.feilContainer}>
          <AlertTriangle size={48} color="#f59e0b" />
          <Text style={stiler.feilTekst}>Kunne ikke laste tegningen</Text>
          <Text style={stiler.feilBeskrivelse}>Sjekk nettverkstilkoblingen og prøv igjen</Text>
          <Pressable
            onPress={() => { setLaster(true); setFeil(false); }}
            style={stiler.prøvIgjenKnapp}
          >
            <RefreshCw size={16} color="#ffffff" />
            <Text style={stiler.prøvIgjenTekst}>Prøv igjen</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {laster && (
            <View style={stiler.lastingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={stiler.lastingTekst}>Laster tegning…</Text>
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
