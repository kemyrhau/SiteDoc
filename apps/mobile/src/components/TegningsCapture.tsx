/**
 * TegningsCapture — genererer base64-PNG av tegning med posisjonsprikk
 * via canvas inne i WebView. Ingen native snapshot — alt skjer i WebView.
 *
 * Flyten:
 * 1. WebView rendrer HTML med <canvas>
 * 2. JavaScript laster bildet, tegner det + prikk på canvas
 * 3. canvas.toDataURL() → base64-PNG
 * 4. postMessage sender base64 tilbake til React Native
 * 5. onCapture callback leverer resultatet
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
  /** Callback med base64 data-URL når capture er klar */
  onCapture: (base64DataUrl: string) => void;
}

const MAX_BREDDE = 2400;

export function TegningsCapture({
  tegningUrl,
  positionX,
  positionY,
  onCapture,
}: TegningsCaptureProps) {
  const harLevert = useRef(false);

  console.log("[TegningsCapture] Montert", { url: tegningUrl.substring(0, 60), positionX, positionY });

  if (positionX <= 0 && positionY <= 0) {
    console.log("[TegningsCapture] Skipper — posisjon er 0,0");
    return null;
  }

  const håndterMelding = useCallback((e: WebViewMessageEvent) => {
    if (harLevert.current) return;
    const msg = e.nativeEvent.data;

    if (msg.startsWith("data:image/")) {
      harLevert.current = true;
      console.log("[TegningsCapture] Base64 mottatt:", msg.length, "tegn");
      onCapture(msg);
    } else if (msg === "feil") {
      console.warn("[TegningsCapture] Bildet kunne ikke lastes (CORS/nettfeil)");
    } else {
      console.log("[TegningsCapture] Melding:", msg);
    }
  }, [onCapture]);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff;">
<canvas id="c"></canvas>
<script>
(function() {
  var img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = function() {
    try {
      // Skalér ned store bilder
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var maxW = ${MAX_BREDDE};
      if (w > maxW) {
        var ratio = maxW / w;
        w = maxW;
        h = Math.round(h * ratio);
      }

      var canvas = document.getElementById('c');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');

      // Tegn bildet
      ctx.drawImage(img, 0, 0, w, h);

      // Tegn rød prikk
      var px = ${positionX} / 100 * w;
      var py = ${positionY} / 100 * h;
      var r = Math.max(6, w / 120);

      // Hvit kant
      ctx.beginPath();
      ctx.arc(px, py, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Rød fylling
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Konverter til base64
      var dataUrl = canvas.toDataURL('image/png');
      window.ReactNativeWebView.postMessage(dataUrl);
    } catch (e) {
      window.ReactNativeWebView.postMessage('feil');
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
