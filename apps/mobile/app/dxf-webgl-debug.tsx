import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Redirect, useRouter } from "expo-router";
import { ChevronLeft, RotateCcw } from "lucide-react-native";
import { trpc } from "../src/lib/trpc";
import { hentWebUrl, erTestLoginAktiv } from "../src/config/auth";

/**
 * Mobil leveranse 1 (arbeidstegning-f1): WebGL-i-WKWebView-røyktest, FØR noe
 * annet bygges (relay/inbox-orkestrator.md, "SVAR MOBILPLAN"). Rendrer den
 * EKTE `DxfViewerTegning`-komponenten (web) via `/dxf-viewer-smoketest`, inne
 * i RNs WebView — samme mønster som `IfcViewer.tsx` bruker for `/mobil-viewer`.
 *
 * Bak samme bryter som dev-login (`erTestLoginAktiv`, EAS-profil `test`) —
 * IKKE en ny `EXPO_PUBLIC_*`-variabel: en ny variabel krever et nytt EAS-bygg
 * (bakt ved build, ikke OTA-publish), og hele poenget er å unngå det. Fraværende
 * i prod/preview-bygg, der flagget aldri er satt. Nås fra "Mer"-fanen (kun
 * synlig når flagget er på).
 */

// "Agent-testprosjekt" — samme fixture som web-bevisrundene (leveranse1-gaten),
// se relay/inbox-orkestrator.md "START BILDEBEVIS PÅ TEST".
const AGENT_TESTPROSJEKT_ID = "73671a05-9016-4bb6-989c-95aa1fe4f6f1";

interface FpsMetrics {
  fps: { median: number; lavest: number };
  prøver: number;
}

export default function DxfWebglDebugSkjerm() {
  const router = useRouter();
  if (!erTestLoginAktiv) {
    return <Redirect href="/(tabs)/hjem" />;
  }
  return <DxfWebglDebugInnhold onTilbake={() => router.back()} />;
}

function DxfWebglDebugInnhold({ onTilbake }: { onTilbake: () => void }) {
  const webViewRef = useRef<WebView>(null);
  const [klarWeb, setKlarWeb] = useState(false);
  const [sendt, setSendt] = useState(false);
  const [metrics, setMetrics] = useState<FpsMetrics | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const tegningerQuery = trpc.tegning.hentForProsjekt.useQuery({
    projectId: AGENT_TESTPROSJEKT_ID,
  });

  // Nyeste tegning med dxf-viewer-artefakter (navnet har variert mellom retur-rundene,
  // se dxfViewerFileUrl heller enn å stole på et bestemt navn). TS2589-fallgruve
  // (docs/claude/api.md § TS/tRPC-fallgruver): cast til unknown FØR filtrering,
  // ellers forsøker tsc å instansiere hele Drawing+include-typen i `.find()`.
  interface TegningMedDxfArtefakter {
    id: string;
    dxfViewerFileUrl: string;
    registerWorldUrl: string;
    rotasjonOverstyrt: number | null;
  }
  const tegning = useMemo(() => {
    const liste = (tegningerQuery.data ?? []) as unknown as TegningMedDxfArtefakter[];
    return liste.find((t) => !!t.dxfViewerFileUrl && !!t.registerWorldUrl) ?? null;
  }, [tegningerQuery.data]);

  const sendStart = useCallback(() => {
    if (!tegning) return;
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "start",
        dxfUrl: `/api${tegning.dxfViewerFileUrl}`,
        registerWorldUrl: `/api${tegning.registerWorldUrl}`,
        rotasjonOverstyrt: tegning.rotasjonOverstyrt ?? null,
      }),
    );
    setSendt(true);
  }, [tegning]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "klar") {
        setKlarWeb(true);
      } else if (msg.type === "metrics") {
        setMetrics(msg);
      } else if (msg.type === "feil") {
        setFeil(msg.melding);
      }
    } catch {
      /* Ignorer ugyldig JSON */
    }
  }, []);

  // Så snart web-siden er klar OG tegningen er hentet: send start (kun én gang).
  useEffect(() => {
    if (klarWeb && tegning && !sendt) {
      sendStart();
    }
  }, [klarWeb, tegning, sendt, sendStart]);

  const beOmStatus = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "rapporter" }));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onTilbake} style={styles.headerBtn}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DXF WebGL-røyktest</Text>
        <TouchableOpacity onPress={beOmStatus} style={styles.headerBtn}>
          <RotateCcw size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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

        {(!klarWeb || tegningerQuery.isLoading) && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text style={styles.overlayText}>
              {!klarWeb ? "Laster WebView…" : "Henter testtegning…"}
            </Text>
          </View>
        )}

        {!tegningerQuery.isLoading && !tegning && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              Fant ingen tegning med dxf-viewer-artefakter i Agent-testprosjekt.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.resultPanel}>
        <Text selectable style={styles.resultText}>
          {feil
            ? `FEIL: ${feil}`
            : metrics
              ? `fps median ${metrics.fps.median} / lavest ${metrics.fps.lavest} (${metrics.prøver} prøver)`
              : "Trykk ⟲ for status. Pinch/pan i flaten over for å belaste GPU-en."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e40af",
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  headerBtn: { padding: 8, borderRadius: 8 },
  content: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  overlayText: { marginTop: 12, fontSize: 14, color: "#374151", fontWeight: "500", textAlign: "center" },
  resultPanel: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  resultText: { color: "#d1fae5", fontSize: 13, fontFamily: "monospace" },
});
