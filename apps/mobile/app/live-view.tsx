import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useWebView3D } from "../src/kontekst/WebView3DKontekst";
import { ChevronLeft, Maximize2, Minimize2, Navigation, MapPin } from "lucide-react-native";

const { height: SKJERMHOYDE } = Dimensions.get("window");

export default function LiveViewSkjerm() {
  const router = useRouter();
  const { vis, skjul, erKlar } = useWebView3D();

  const [kameraTillatelse, beKameraTillatelse] = useCameraPermissions();
  const [posisjon, setPosisjon] = useState<{ lat: number; lng: number } | null>(null);
  const [kompass, setKompass] = useState<number | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);

  // Vis WebView ved mount, skjul ved unmount
  useEffect(() => {
    vis();
    return () => skjul();
  }, [vis, skjul]);

  // GPS
  useEffect(() => {
    let abonnement: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      abonnement = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 2 },
        (lok) => setPosisjon({ lat: lok.coords.latitude, lng: lok.coords.longitude }),
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

  useEffect(() => {
    if (!kameraTillatelse?.granted) beKameraTillatelse();
  }, [kameraTillatelse, beKameraTillatelse]);

  const kameraHoyde = SKJERMHOYDE * splitRatio;
  const toggleSplit = () => {
    setSplitRatio((prev) => prev === 0.5 ? 0.7 : prev === 0.7 ? 0.3 : 0.5);
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

      {/* Kamera — oppå WebView */}
      <View style={[styles.kameraContainer, { height: kameraHoyde }]}>
        {kameraTillatelse?.granted ? (
          <CameraView style={styles.kamera} facing="back" />
        ) : (
          <View style={styles.ingenTilgang}>
            <Text style={styles.ingenTilgangTekst}>Kameratilgang kreves</Text>
          </View>
        )}
        {posisjon && (
          <View style={styles.gpsOverlay}>
            <MapPin size={12} color="#10b981" />
            <Text style={styles.gpsTekst}>{posisjon.lat.toFixed(6)}, {posisjon.lng.toFixed(6)}</Text>
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
      <View style={styles.skillelinje}><View style={styles.skillehåndtak} /></View>

      {/* 3D — WebView synlig gjennom tom View */}
      <View style={styles.modellContainer}>
        {posisjon && (
          <View style={[styles.gpsOverlay, { bottom: 8, top: undefined }]}>
            <MapPin size={12} color="#10b981" />
            <Text style={styles.gpsTekst}>{posisjon.lat.toFixed(6)}, {posisjon.lng.toFixed(6)}</Text>
          </View>
        )}
        {!erKlar && (
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
    flexDirection: "row", alignItems: "center", backgroundColor: "#1e40af",
    paddingTop: 50, paddingBottom: 10, paddingHorizontal: 12, zIndex: 10,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
  headerBtn: { padding: 8, borderRadius: 8 },
  kameraContainer: { position: "relative", backgroundColor: "#000", zIndex: 5 },
  kamera: { flex: 1 },
  ingenTilgang: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1f2937" },
  ingenTilgangTekst: { color: "#9ca3af", fontSize: 14 },
  gpsOverlay: {
    position: "absolute", top: 8, left: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, zIndex: 10,
  },
  gpsTekst: { fontFamily: "monospace", fontSize: 10, color: "#fff" },
  skillelinje: {
    height: 6, backgroundColor: "#374151",
    justifyContent: "center", alignItems: "center", zIndex: 5,
  },
  skillehåndtak: { width: 40, height: 3, borderRadius: 2, backgroundColor: "#9ca3af" },
  modellContainer: { flex: 1, position: "relative" },
  modellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.9)",
    justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  modellOverlayTekst: { fontSize: 14, color: "#6b7280" },
});
