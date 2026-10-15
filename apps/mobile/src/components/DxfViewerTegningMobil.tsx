import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { hentWebUrl } from "../config/auth";

/**
 * Mobil leveranse 2 (arbeidstegning-f1, "SVAR mobil leveranse 1 d5f90b1a" i
 * relay/inbox-orkestrator.md): "motor-last i appen uten lupe/måling" — ren
 * last+vis (pan/zoom fra dxf-viewers egne kontroller), INGEN markør-trykk,
 * måling eller GPS-overlegg ennå (skjerm→verden-projeksjonen for det er egen
 * leveranse). Delt mellom `(tabs)/lokasjoner.tsx` (ekte visning) og
 * `dxf-webgl-debug.tsx` (røyktest-skjermen fra leveranse 1), så WebView-
 * oppkoblingen ikke dupliseres.
 *
 * Rendrer `DxfViewerTegning` (ekte web-komponent) via den auth-frie
 * `/dxf-viewer-smoketest`-siden, samme postMessage-mønster som `IfcViewer.tsx`
 * bruker for `/mobil-viewer`.
 */

export interface DxfViewerTegningMobilProps {
  dxfUrl: string;
  registerWorldUrl: string;
  rotasjonOverstyrt: number | null;
  /** Kalt når web-siden rapporterer fps på forespørsel (se `beOmStatus` på ref). */
  onMetrics?: (metrics: { fps: { median: number; lavest: number }; prøver: number }) => void;
}

export interface DxfViewerTegningMobilRef {
  /** Be web-siden rapportere nåværende fps-måling (kun brukt av røyktest-skjermen). */
  beOmStatus: () => void;
}

export const DxfViewerTegningMobil = forwardRef<DxfViewerTegningMobilRef, DxfViewerTegningMobilProps>(
  function DxfViewerTegningMobil({ dxfUrl, registerWorldUrl, rotasjonOverstyrt, onMetrics }, ref) {
    const webViewRef = useRef<WebView>(null);
    const [klarWeb, setKlarWeb] = useState(false);
    const [sendt, setSendt] = useState(false);
    // Katastrofal feil i selve WebView-siden (window.onerror) — IKKE web-komponentens
    // egen last-feil (den har sin egen "Prøv igjen"-knapp inni WebView-en allerede).
    const [sideFeil, setSideFeil] = useState<string | null>(null);

    const sendStart = useCallback(() => {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "start", dxfUrl, registerWorldUrl, rotasjonOverstyrt }),
      );
      setSendt(true);
    }, [dxfUrl, registerWorldUrl, rotasjonOverstyrt]);

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === "klar") {
            setKlarWeb(true);
          } else if (msg.type === "metrics") {
            onMetrics?.(msg);
          } else if (msg.type === "feil") {
            setSideFeil(msg.melding);
          }
        } catch {
          /* Ignorer ugyldig JSON */
        }
      },
      [onMetrics],
    );

    useEffect(() => {
      if (klarWeb && !sendt) sendStart();
    }, [klarWeb, sendt, sendStart]);

    // Ny tegning (annen dxfUrl) mens komponenten står: send ny start-melding.
    useEffect(() => {
      setSendt(false);
      setSideFeil(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dxfUrl, registerWorldUrl]);

    useImperativeHandle(ref, () => ({
      beOmStatus: () => webViewRef.current?.postMessage(JSON.stringify({ type: "rapporter" })),
    }));

    const lastPaaNytt = useCallback(() => {
      setSideFeil(null);
      setKlarWeb(false);
      setSendt(false);
      webViewRef.current?.reload();
    }, []);

    return (
      <View style={styles.content}>
        <WebView
          ref={webViewRef}
          source={{ uri: `${hentWebUrl()}/dxf-viewer-smoketest` }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
        />

        {!klarWeb && !sideFeil && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        )}

        {sideFeil && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>{sideFeil}</Text>
            <TouchableOpacity onPress={lastPaaNytt} style={styles.retryBtn}>
              <Text style={styles.retryTekst}>Prøv igjen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  overlayText: { fontSize: 14, color: "#374151", fontWeight: "500", textAlign: "center" },
  retryBtn: { marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 },
  retryTekst: { color: "#dc2626", fontSize: 13, fontWeight: "500" },
});
