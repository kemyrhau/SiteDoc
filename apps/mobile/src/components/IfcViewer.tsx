import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "../services/auth";
import { Box, Eye, EyeOff, Scissors, X, ChevronLeft } from "lucide-react-native";

interface IfcModell {
  id: string;
  name: string;
  fileUrl: string;
}

interface ValgtObjekt {
  localId: number;
  modelId: string;
  kategori: string | null;
  attributter: Record<string, unknown>;
  punkt: { x: number; y: number; z: number };
}

interface IfcViewerProps {
  modeller: IfcModell[];
  onTilbake: () => void;
}

export function IfcViewer({ modeller, onTilbake }: IfcViewerProps) {
  const webViewRef = useRef<WebView>(null);
  const [klar, setKlar] = useState(false);
  const [lastet, setLastet] = useState(0);
  const [totalt, setTotalt] = useState(0);
  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [synlighet, setSynlighet] = useState<Map<number, boolean>>(
    () => new Map(modeller.map((_, i) => [i, true])),
  );
  const [klippAktiv, setKlippAktiv] = useState(false);
  const [visSidepanel, setVisSidepanel] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  // Bygg URL for modellene
  const urls = modeller
    .map((m) => {
      const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
      return `${AUTH_CONFIG.apiUrl.replace("/trpc", "")}${url}`;
    })
    .join(",");

  const viewerUrl = `${AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "")}/mobil-viewer`;

  // Send modeller til WebView etter den er klar
  const sendModeller = useCallback(async () => {
    const token = await hentSessionToken();
    const modelUrls = modeller.map((m) => {
      const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
      // Bruk web-URL (ikke API-URL) for å unngå CORS
      return `${AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "")}${url}`;
    });
    webViewRef.current?.postMessage(
      JSON.stringify({ type: "lastModeller", urls: modelUrls, token }),
    );
  }, [modeller]);

  // Håndter meldinger fra WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case "klar":
          setKlar(true);
          sendModeller();
          break;
        case "modellLastet":
          setLastet(msg.index + 1);
          setTotalt(msg.totalt);
          break;
        case "alleLastet":
          setLastet(msg.antall);
          break;
        case "objektValgt":
          setValgtObjekt(msg.data);
          break;
        case "objektFjernet":
          setValgtObjekt(null);
          break;
        case "feil":
          setFeil(msg.melding);
          break;
      }
    } catch {
      // Ignorer ugyldig JSON
    }
  }, [sendModeller]);

  const toggleModell = useCallback((index: number) => {
    setSynlighet((prev) => {
      const neste = new Map(prev);
      const nySynlighet = !(neste.get(index) ?? true);
      neste.set(index, nySynlighet);
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "toggleModell", index, synlig: nySynlighet }),
      );
      return neste;
    });
  }, []);

  const toggleKlipp = useCallback(() => {
    const ny = !klippAktiv;
    setKlippAktiv(ny);
    webViewRef.current?.postMessage(
      JSON.stringify({ type: "klippmodus", aktiv: ny }),
    );
  }, [klippAktiv]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onTilbake} style={styles.headerBtn}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>3D-visning</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleKlipp}
            style={[styles.headerBtn, klippAktiv && styles.headerBtnAktiv]}
          >
            <Scissors size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setVisSidepanel(!visSidepanel)}
            style={styles.headerBtn}
          >
            <Box size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* WebView med 3D-viewer */}
        <WebView
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
        />

        {/* Laste-overlay */}
        {(!klar || lastet < modeller.length) && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text style={styles.overlayText}>
              {!klar ? "Initialiserer viewer..." : `Laster modeller ${lastet}/${totalt || modeller.length}...`}
            </Text>
          </View>
        )}

        {/* Feil */}
        {feil && (
          <View style={styles.feilBanner}>
            <Text style={styles.feilTekst}>{feil}</Text>
            <TouchableOpacity onPress={() => setFeil(null)}>
              <X size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sidepanel — modell-toggle */}
        {visSidepanel && (
          <View style={styles.sidepanel}>
            <Text style={styles.sidepanelTittel}>Modeller</Text>
            {modeller.map((m, i) => (
              <TouchableOpacity
                key={m.id}
                style={styles.modellRad}
                onPress={() => toggleModell(i)}
              >
                {synlighet.get(i) !== false ? (
                  <Eye size={16} color="#1e40af" />
                ) : (
                  <EyeOff size={16} color="#9ca3af" />
                )}
                <Text
                  style={[
                    styles.modellNavn,
                    synlighet.get(i) === false && styles.modellNavnSkjult,
                  ]}
                  numberOfLines={1}
                >
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Objektinfo-bunnpanel */}
        {valgtObjekt && (
          <View style={styles.objektPanel}>
            <View style={styles.objektHeader}>
              <Text style={styles.objektKategori}>
                {valgtObjekt.kategori ?? "Objekt"}
              </Text>
              <TouchableOpacity onPress={() => setValgtObjekt(null)}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {Object.entries(valgtObjekt.attributter)
              .filter(([k]) => !["expressID", "type", "GlobalId"].includes(k))
              .slice(0, 8)
              .map(([k, v]) => (
                <View key={k} style={styles.objektRad}>
                  <Text style={styles.objektLabel}>{k}</Text>
                  <Text style={styles.objektVerdi} numberOfLines={1}>
                    {String(v)}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e40af",
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { padding: 8, borderRadius: 8 },
  headerBtnAktiv: { backgroundColor: "rgba(255,255,255,0.2)" },
  content: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: { marginTop: 12, fontSize: 14, color: "#374151", fontWeight: "500" },
  feilBanner: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  feilTekst: { flex: 1, fontSize: 12, color: "#ef4444" },
  sidepanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 220,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  sidepanelTittel: { fontSize: 13, fontWeight: "600", color: "#111", marginBottom: 10 },
  modellRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modellNavn: { flex: 1, fontSize: 13, color: "#374151" },
  modellNavnSkjult: { color: "#9ca3af" },
  objektPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: 280,
  },
  objektHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  objektKategori: { fontSize: 15, fontWeight: "600", color: "#111" },
  objektRad: { flexDirection: "row", paddingVertical: 3 },
  objektLabel: { width: 100, fontSize: 12, color: "#9ca3af" },
  objektVerdi: { flex: 1, fontSize: 12, color: "#374151" },
});
