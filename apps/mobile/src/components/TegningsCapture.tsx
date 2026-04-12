/**
 * TegningsCapture — genererer to base64-PNG av tegning:
 * 1. Oversikt: hele tegningen med posisjonsprikk
 * 2. Detalj: innzoomet utsnitt rundt prikken (800x800px)
 *
 * Alt skjer i WebView via canvas — ingen native snapshot.
 */

import { useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

interface TegningsCaptureProps {
  /** Full URL til tegningsbilde */
  tegningUrl: string;
  /** Posisjon i prosent (0–100) */
  positionX: number;
  positionY: number;
  /** Callback med oversikt + detalj base64 */
  onCapture: (oversikt: string, detalj: string) => void;
}

const MAX_BREDDE = 2400;
const DETALJ_SIZE = 800;
const DETALJ_UTSNITT = 0.125; // 12.5% av bildet vises i detalj

export function TegningsCapture({
  tegningUrl,
  positionX,
  positionY,
  onCapture,
}: TegningsCaptureProps) {
  const harLevert = useRef(false);

  if (positionX <= 0 && positionY <= 0) return null;

  const håndterMelding = useCallback((e: WebViewMessageEvent) => {
    if (harLevert.current) return;

    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "resultat" && data.oversikt && data.detalj) {
        harLevert.current = true;
        console.log("[TegningsCapture] Mottatt — oversikt:", data.oversikt.length, "detalj:", data.detalj.length);
        onCapture(data.oversikt, data.detalj);
      } else if (data.type === "feil") {
        console.warn("[TegningsCapture] Feil:", data.melding);
      }
    } catch {
      // Ikke JSON — ignorer
      const msg = e.nativeEvent.data;
      if (msg === "feil") console.warn("[TegningsCapture] Bildet kunne ikke lastes");
    }
  }, [onCapture]);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff;">
<canvas id="oversikt"></canvas>
<canvas id="detalj"></canvas>
<script>
(function() {
  var img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = function() {
    try {
      var ow = img.naturalWidth;
      var oh = img.naturalHeight;
      var maxW = ${MAX_BREDDE};
      var w = ow, h = oh;
      if (w > maxW) { var r = maxW / w; w = maxW; h = Math.round(h * r); }

      // --- Oversikt ---
      var c1 = document.getElementById('oversikt');
      c1.width = w; c1.height = h;
      var ctx1 = c1.getContext('2d');
      ctx1.drawImage(img, 0, 0, w, h);

      var px = ${positionX} / 100 * w;
      var py = ${positionY} / 100 * h;
      var pr = Math.max(6, w / 120);

      // Prikk på oversikt
      ctx1.beginPath(); ctx1.arc(px, py, pr + 2, 0, Math.PI*2); ctx1.fillStyle='#fff'; ctx1.fill();
      ctx1.beginPath(); ctx1.arc(px, py, pr, 0, Math.PI*2); ctx1.fillStyle='#ef4444'; ctx1.fill();

      // Detalj-ramme på oversikt
      var utsSnitt = ${DETALJ_UTSNITT};
      var rw = w * utsSnitt;
      var rh = h * utsSnitt;
      var rx = Math.max(0, Math.min(w - rw, px - rw/2));
      var ry = Math.max(0, Math.min(h - rh, py - rh/2));
      ctx1.strokeStyle = '#f87171'; ctx1.lineWidth = 2;
      ctx1.strokeRect(rx, ry, rw, rh);

      var oversiktData = c1.toDataURL('image/png');

      // --- Detalj — same aspect ratio som originalbilde ---
      var imgRatio = ow / oh;
      var dw = ${DETALJ_SIZE};
      var dh = Math.round(dw / imgRatio);
      var c2 = document.getElementById('detalj');
      c2.width = dw; c2.height = dh;
      var ctx2 = c2.getContext('2d');

      // Kilde-rektangel med bildets aspect ratio
      var srcW = ow * utsSnitt;
      var srcH = oh * utsSnitt;
      var srcCx = ${positionX}/100*ow;
      var srcCy = ${positionY}/100*oh;
      var srcX = Math.max(0, Math.min(ow - srcW, srcCx - srcW/2));
      var srcY = Math.max(0, Math.min(oh - srcH, srcCy - srcH/2));

      ctx2.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dw, dh);

      // Prikk i detalj
      var dpx = (srcCx - srcX) / srcW * dw;
      var dpy = (srcCy - srcY) / srcH * dh;
      var dr = Math.max(8, dw / 60);
      ctx2.beginPath(); ctx2.arc(dpx, dpy, dr + 3, 0, Math.PI*2); ctx2.fillStyle='#fff'; ctx2.fill();
      ctx2.beginPath(); ctx2.arc(dpx, dpy, dr, 0, Math.PI*2); ctx2.fillStyle='#ef4444'; ctx2.fill();

      var detaljData = c2.toDataURL('image/png');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'resultat', oversikt: oversiktData, detalj: detaljData
      }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'feil', melding: e.message }));
    }
  };

  img.onerror = function() {
    window.ReactNativeWebView.postMessage('feil');
  };

  img.src = '${tegningUrl}';
})();
</script>
</body></html>`;

  return (
    <View style={stiler.offscreen}>
      <WebView
        source={{ html, baseUrl: tegningUrl.substring(0, tegningUrl.lastIndexOf("/") + 1) }}
        style={stiler.webview}
        onMessage={håndterMelding}
        javaScriptEnabled
        scrollEnabled={false}
        originWhitelist={["*"]}
      />
    </View>
  );
}

const stiler = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    overflow: "hidden",
  },
  webview: {
    width: 1,
    height: 1,
  },
});
