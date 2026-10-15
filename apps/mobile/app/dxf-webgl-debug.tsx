import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { ChevronLeft, RotateCcw } from "lucide-react-native";
import { trpc } from "../src/lib/trpc";
import { erTestLoginAktiv } from "../src/config/auth";
import {
  DxfViewerTegningMobil,
  type DxfViewerTegningMobilRef,
} from "../src/components/DxfViewerTegningMobil";

/**
 * Mobil leveranse 1 (arbeidstegning-f1): WebGL-i-WKWebView-røyktest, FØR noe
 * annet bygges (relay/inbox-orkestrator.md, "SVAR MOBILPLAN"). WebView-
 * oppkoblingen selv ligger i `DxfViewerTegningMobil` (delt med den ekte
 * visningen i leveranse 2, `(tabs)/lokasjoner.tsx`) — denne skjermen legger
 * kun på header + fps-resultatpanel, siden det er røyktestens formål.
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
  const viewerRef = useRef<DxfViewerTegningMobilRef>(null);
  const [metrics, setMetrics] = useState<FpsMetrics | null>(null);

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

  const beOmStatus = useCallback(() => viewerRef.current?.beOmStatus(), []);

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
        {tegningerQuery.isLoading ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text style={styles.overlayText}>Henter testtegning…</Text>
          </View>
        ) : !tegning ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              Fant ingen tegning med dxf-viewer-artefakter i Agent-testprosjekt.
            </Text>
          </View>
        ) : (
          <DxfViewerTegningMobil
            ref={viewerRef}
            dxfUrl={`/api${tegning.dxfViewerFileUrl}`}
            registerWorldUrl={`/api${tegning.registerWorldUrl}`}
            rotasjonOverstyrt={tegning.rotasjonOverstyrt ?? null}
            onMetrics={setMetrics}
          />
        )}
      </View>

      <View style={styles.resultPanel}>
        <Text selectable style={styles.resultText}>
          {metrics
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
