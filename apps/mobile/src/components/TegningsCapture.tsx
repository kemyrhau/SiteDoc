/**
 * TegningsCapture — rendrer tegning med posisjonsprikk offscreen
 * og capturer som base64-PNG via react-native-view-shot.
 *
 * Brukes for pixel-perfekt tegningsvisning i PDF.
 */

import { useRef, useState, useCallback, useEffect } from "react";
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

export function TegningsCapture({
  tegningUrl,
  positionX,
  positionY,
  onCapture,
}: TegningsCaptureProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const harCaptured = useRef(false);

  console.log("[TegningsCapture] 1. Komponenten monteres", { tegningUrl: tegningUrl.substring(0, 80), positionX, positionY });

  const capture = useCallback(async () => {
    console.log("[TegningsCapture] 3. capture() kalles, harCaptured:", harCaptured.current, "viewShotRef:", !!viewShotRef.current);
    if (harCaptured.current || !viewShotRef.current) return;
    harCaptured.current = true;

    await new Promise((r) => setTimeout(r, 3000));

    try {
      console.log("[TegningsCapture] 4. Kaller ViewShot.capture()...");
      const uri = await (viewShotRef.current as unknown as { capture: () => Promise<string> }).capture();
      console.log("[TegningsCapture] 4. ViewShot URI:", uri);

      console.log("[TegningsCapture] 5. Leser base64...");
      const base64 = await readAsStringAsync(uri, { encoding: "base64" });
      console.log("[TegningsCapture] 5. Base64 lengde:", base64.length, "| Første 100:", base64.substring(0, 100));

      if (base64.length < 1000) {
        console.warn("[TegningsCapture] Base64 er for kort — tomt bilde?");
        return;
      }

      console.log("[TegningsCapture] 6. Kaller onCapture med", base64.length, "tegn");
      onCapture(`data:image/png;base64,${base64}`);
    } catch (e) {
      console.warn("[TegningsCapture] Capture feilet:", e);
    }
  }, [onCapture]);

  const håndterMelding = useCallback((e: WebViewMessageEvent) => {
    console.log("[TegningsCapture] Melding fra WebView:", e.nativeEvent.data);
    if (e.nativeEvent.data === "klar") {
      capture();
    }
  }, [capture]);

  const håndterLoadEnd = useCallback(() => {
    console.log("[TegningsCapture] 2. WebView onLoadEnd fires");
  }, []);

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
  <img src="${tegningUrl}" onload="document.getElementById('p').style.display='block';window.ReactNativeWebView.postMessage('klar');" onerror="window.ReactNativeWebView.postMessage('feil');" />
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
          onLoadEnd={håndterLoadEnd}
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
