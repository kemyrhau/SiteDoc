import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useProsjekt } from "../src/kontekst/ProsjektKontekst";
import { useBygning } from "../src/kontekst/BygningKontekst";
import { trpc } from "../src/lib/trpc";
import { hentWebUrl } from "../src/config/auth";
import { hentSessionToken } from "../src/services/auth";
import { ChevronLeft, Maximize2, Minimize2, Navigation, MapPin } from "lucide-react-native";

const { height: SKJERMHOYDE } = Dimensions.get("window");

export default function LiveViewSkjerm() {
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();
  const webViewRef = useRef<WebView>(null);

  const [kameraTillatelse, beKameraTillatelse] = useCameraPermissions();
  const [posisjon, setPosisjon] = useState<{ lat: number; lng: number } | null>(null);
  const [kompass, setKompass] = useState<number | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5); // 0.5 = 50/50
  const [viewerKlar, setViewerKlar] = useState(false);

  // Hent IFC-modeller
  const { data: tegninger } = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  const ifcModeller = (tegninger ?? [])
    .filter((t: { fileType?: string }) => t.fileType?.toLowerCase() === "ifc")
    .map((t: { id: string; name: string; fileUrl: string }) => ({
      id: t.id,
      name: t.name,
      fileUrl: t.fileUrl,
    }));

  // GPS-posisjon — kontinuerlig
  useEffect(() => {
    let abonnement: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      abonnement = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 2,
        },
        (lokasjon) => {
          setPosisjon({
            lat: lokasjon.coords.latitude,
            lng: lokasjon.coords.longitude,
          });
        },
      );
    })();

    return () => { abonnement?.remove(); };
  }, []);

  // Kompass
  useEffect(() => {
    let abonnement: { remove: () => void } | null = null;

    (async () => {
      const tilgjengelig = await Location.hasServicesEnabledAsync();
      if (!tilgjengelig) return;

      abonnement = await Location.watchHeadingAsync((heading) => {
        setKompass(Math.round(heading.trueHeading));
      });
    })();

    return () => { abonnement?.remove(); };
  }, []);

  // Send modeller til WebView — alltid server-URL (WebView kan ikke lese file://)
  useEffect(() => {
    if (!viewerKlar || ifcModeller.length === 0) return;
    (async () => {
      const token = await hentSessionToken();
      const baseUrl = hentWebUrl();
      const urls = ifcModeller.map((m) => {
        const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
        return `${baseUrl}${url}`;
      });
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "lastModeller", urls, token }),
      );
    })();
  }, [viewerKlar, ifcModeller.length]); // eslint-disable-line

  // Be om kameratillatelse
  useEffect(() => {
    if (!kameraTillatelse?.granted) {
      beKameraTillatelse();
    }
  }, [kameraTillatelse, beKameraTillatelse]);

  const viewerUrl = `${hentWebUrl()}/mobil-viewer`;

  const kameraHoyde = SKJERMHOYDE * splitRatio;
  const toggleSplit = () => {
    setSplitRatio((prev) => {
      if (prev === 0.5) return 0.7; // Mer kamera
      if (prev === 0.7) return 0.3; // Mer modell
      return 0.5; // Tilbake til 50/50
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live View</Text>
        <TouchableOpacity onPress={toggleSplit} style={styles.headerBtn}>
          {splitRatio === 0.5 ? <Maximize2 size={18} color="#fff" /> : <Minimize2 size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Kamera */}
      <View style={[styles.kameraContainer, { height: kameraHoyde }]}>
        {kameraTillatelse?.granted ? (
          <CameraView style={styles.kamera} facing="back" />
        ) : (
          <View style={styles.ingenTilgang}>
            <Text style={styles.ingenTilgangTekst}>Kameratilgang kreves</Text>
          </View>
        )}

        {/* GPS-overlay på kamera */}
        {posisjon && (
          <View style={styles.gpsOverlay}>
            <MapPin size={12} color="#10b981" />
            <Text style={styles.gpsTekst}>
              {posisjon.lat.toFixed(6)}, {posisjon.lng.toFixed(6)}
            </Text>
            {kompass !== null && (
              <>
                <Navigation size={12} color="#3b82f6" style={{ transform: [{ rotate: `${kompass}deg` }] }} />
                <Text style={styles.gpsTekst}>{kompass}°</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Skillelinje */}
      <View style={styles.skillelinje}>
        <View style={styles.skillehåndtak} />
      </View>

      {/* 3D-modell (WebView) */}
      <View style={styles.modellContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg.type === "klar") setViewerKlar(true);
            } catch { /* */ }
          }}
        />

        {/* GPS-overlay på modell */}
        {posisjon && (
          <View style={[styles.gpsOverlay, { bottom: 8, top: undefined }]}>
            <MapPin size={12} color="#10b981" />
            <Text style={styles.gpsTekst}>
              {posisjon.lat.toFixed(6)}, {posisjon.lng.toFixed(6)}
            </Text>
          </View>
        )}

        {!viewerKlar && (
          <View style={styles.modellOverlay}>
            <Text style={styles.modellOverlayTekst}>Laster 3D-modell...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e40af",
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
  headerBtn: { padding: 8, borderRadius: 8 },
  kameraContainer: { position: "relative", backgroundColor: "#000" },
  kamera: { flex: 1 },
  ingenTilgang: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1f2937" },
  ingenTilgangTekst: { color: "#9ca3af", fontSize: 14 },
  gpsOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  gpsTekst: { fontFamily: "monospace", fontSize: 10, color: "#fff" },
  skillelinje: {
    height: 6,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  skillehåndtak: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#9ca3af",
  },
  modellContainer: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  modellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modellOverlayTekst: { fontSize: 14, color: "#6b7280" },
});
