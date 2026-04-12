/**
 * TegningsCapture — rendrer tegning med posisjonsprikk offscreen
 * og capturer som base64-PNG via react-native-view-shot.
 *
 * Brukes for pixel-perfekt tegningsvisning i PDF.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
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
 * Rendrer en usynlig WebView med tegning + prikk, tar screenshot når lastet.
 * Resultatet er en base64-PNG som kan embeddes direkte i PDF-HTML.
 */
export function TegningsCapture({
  tegningUrl,
  positionX,
  positionY,
  onCapture,
}: TegningsCaptureProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [lastet, setLastet] = useState(false);
  const harCaptured = useRef(false);

  const capture = useCallback(async () => {
    if (harCaptured.current || !viewShotRef.current) return;
    harCaptured.current = true;

    // Kort forsinkelse for å sikre at WebView er ferdig rendret
    await new Promise((r) => setTimeout(r, 500));

    try {
      const uri = await (viewShotRef.current as unknown as { capture: () => Promise<string> }).capture();
      const base64 = await readAsStringAsync(uri, {
        encoding: "base64",
      });
      onCapture(`data:image/png;base64,${base64}`);
    } catch (e) {
      console.warn("[TegningsCapture] Feilet:", e);
    }
  }, [onCapture]);

  useEffect(() => {
    if (lastet) capture();
  }, [lastet, capture]);

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
  <img src="${tegningUrl}" onload="document.getElementById('p').style.display='block'" />
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
          onLoadEnd={() => setLastet(true)}
          javaScriptEnabled
          scrollEnabled={false}
          scalesPageToFit={false}
        />
      </ViewShot>
    </View>
  );
}

const stiler = StyleSheet.create({
  // Rendrer offscreen — usynlig for brukeren
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: 800,
    height: 600,
    opacity: 0,
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
