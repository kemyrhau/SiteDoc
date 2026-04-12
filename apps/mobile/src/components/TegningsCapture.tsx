/**
 * TegningsCapture — rendrer tegning med posisjonsprikk offscreen
 * og capturer som base64-PNG via react-native-view-shot.
 *
 * Brukes for pixel-perfekt tegningsvisning i PDF.
 */

import { useRef, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import ViewShot from "react-native-view-shot";
import { readAsStringAsync } from "expo-file-system";

interface TegningsCaptureProps {
  /** Full URL til tegningsbilde */
  tegningUrl: string;
  /** Posisjon i prosent (0–100) */
  positionX: number;
  positionY: number;
  /** Callback med base64 data-URL når capture er klar */
  onCapture: (base64DataUrl: string) => void;
}

/**
 * Rendrer en offscreen WebView med tegning + prikk, tar screenshot når bildet er lastet.
 * Trigger: <img onload> sender postMessage("klar") → capture etter 3s forsinkelse.
 */
export function TegningsCapture({
  tegningUrl,
  positionX,
  positionY,
  onCapture,
}: TegningsCaptureProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const harCaptured = useRef(false);
  const [_klar, setKlar] = useState(false);

  const capture = useCallback(async () => {
    if (harCaptured.current || !viewShotRef.current) return;
    harCaptured.current = true;

    console.log("[TegningsCapture] Bildet er lastet, venter 3s før capture…");

    // Vent for å sikre at WebView har rendret bildet fullstendig
    await new Promise((r) => setTimeout(r, 3000));

    try {
      const uri = await (viewShotRef.current as unknown as { capture: () => Promise<string> }).capture();
      console.log("[TegningsCapture] Screenshot URI:", uri);

      const base64 = await readAsStringAsync(uri, { encoding: "base64" });
      console.log("[TegningsCapture] Base64 lengde:", base64.length, "| Første 100 tegn:", base64.substring(0, 100));

      if (base64.length < 1000) {
        console.warn("[TegningsCapture] Base64 er for kort — sannsynligvis hvitt/tomt bilde");
        return;
      }

      onCapture(`data:image/png;base64,${base64}`);
      console.log("[TegningsCapture] Capture levert til onCapture");
    } catch (e) {
      console.warn("[TegningsCapture] Capture feilet:", e);
    }
  }, [onCapture]);

  const håndterMelding = useCallback((e: WebViewMessageEvent) => {
    const data = e.nativeEvent.data;
    console.log("[TegningsCapture] Melding fra WebView:", data);
    if (data === "klar") {
      setKlar(true);
      capture();
    }
  }, [capture]);

  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fff}
  #c{position:relative;width:100%}
  #c img{display:block;width:100%;height:auto}
  .pin{position:absolute;width:16px;height:16px;border-radius:50%;background:#ef4444;border:2px solid #fff;transform:translate(-50%,-50%);box-shadow:0 1px 3px rgba(0,0,0,0.3)}
</style></head><body>
<div id="c">
  <img src="${tegningUrl}" onload="document.getElementById('p').style.display='block';window.ReactNativeWebView.postMessage('klar');" />
  <div id="p" class="pin" style="display:none;left:${positionX}%;top:${positionY}%"></div>
</div>
</body></html>`;

  return (
    <View style={stiler.offscreen}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1, result: "tmpfile" }}
        style={stiler.captureArea}
      >
        <WebView
          source={{ html, baseUrl: tegningUrl.substring(0, tegningUrl.lastIndexOf("/") + 1) }}
          style={stiler.webview}
          onMessage={håndterMelding}
          javaScriptEnabled
          scrollEnabled={false}
          scalesPageToFit={false}
        />
      </ViewShot>
    </View>
  );
}

const stiler = StyleSheet.create({
  // Offscreen — ingen opacity:0 (WKWebView rendrer ikke usynlige views)
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: 800,
    height: 600,
  },
  captureArea: {
    width: 800,
    height: 600,
  },
  webview: {
    width: 800,
    height: 600,
    backgroundColor: "#ffffff",
  },
});
