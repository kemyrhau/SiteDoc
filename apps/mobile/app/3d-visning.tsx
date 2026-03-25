import { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Box, Eye, EyeOff, Scissors, X, Download } from "lucide-react-native";
import { usePersistent3D } from "../src/hooks/usePersistent3D";
import { lastNedIfc } from "../src/services/ifcCache";

interface ValgtObjekt {
  localId: number;
  modelId: string;
  kategori: string | null;
  attributter: Record<string, unknown>;
  punkt: { x: number; y: number; z: number };
}

export default function TreDVisningSkjerm() {
  const router = useRouter();
  const {
    plassholder,
    målOgAktiver,
    postMelding,
    registrerHandler,
    erKlar,
    erLastet,
    lastet,
    totalt,
    ifcModeller,
    feil,
  } = usePersistent3D();

  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [synlighet, setSynlighet] = useState<Map<number, boolean>>(new Map());
  const [klippAktiv, setKlippAktiv] = useState(false);
  const [visSidepanel, setVisSidepanel] = useState(false);
  const [lokalFeil, setLokalFeil] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  // Registrer meldingshandler
  useEffect(() => {
    const unsub = registrerHandler((msg) => {
      switch (msg.type) {
        case "objektValgt":
          setValgtObjekt(msg.data as ValgtObjekt);
          break;
        case "objektFjernet":
          setValgtObjekt(null);
          break;
        case "feil":
          setLokalFeil(msg.melding as string);
          break;
      }
    });
    return unsub;
  }, [registrerHandler]);

  const toggleModell = useCallback((index: number) => {
    setSynlighet((prev) => {
      const neste = new Map(prev);
      const nySynlighet = !(neste.get(index) ?? true);
      neste.set(index, nySynlighet);
      postMelding({ type: "toggleModell", index, synlig: nySynlighet });
      return neste;
    });
  }, [postMelding]);

  const toggleKlipp = useCallback(() => {
    const ny = !klippAktiv;
    setKlippAktiv(ny);
    postMelding({ type: "klippmodus", aktiv: ny });
  }, [klippAktiv, postMelding]);

  const lastNedTilCache = useCallback(async () => {
    setCacheStatus("Laster ned...");
    try {
      for (let i = 0; i < ifcModeller.length; i++) {
        const m = ifcModeller[i]!;
        setCacheStatus(`${m.name} (${i + 1}/${ifcModeller.length})`);
        await lastNedIfc(m.fileUrl, (prosent) => {
          setCacheStatus(`${m.name} — ${prosent}%`);
        }, m.updatedAt);
      }
      setCacheStatus("Lagret for offline-bruk");
      setTimeout(() => setCacheStatus(null), 2000);
    } catch (err) {
      setCacheStatus(`Feil: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [ifcModeller]);

  const viseFeil = lokalFeil ?? feil;

  if (ifcModeller.length === 0 && !erKlar) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>3D-visning</Text>
        </View>
        <View style={styles.center}>
          {ifcModeller.length === 0 ? (
            <>
              <Box size={48} color="#9ca3af" />
              <Text style={styles.tomTekst}>Ingen IFC-modeller</Text>
              <Text style={styles.tomDetalj}>Velg en bygning med 3D-modeller i Lokasjoner</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#1e40af" />
              <Text style={styles.lasteTekst}>Henter modeller...</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>3D-visning</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={lastNedTilCache} style={styles.headerBtn}>
            <Download size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleKlipp}
            style={[styles.headerBtn, klippAktiv && styles.headerBtnAktiv]}
          >
            <Scissors size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVisSidepanel(!visSidepanel)} style={styles.headerBtn}>
            <Box size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Cache-status */}
      {cacheStatus && (
        <View style={styles.cacheBanner}>
          <Download size={14} color="#1e40af" />
          <Text style={styles.cacheTekst}>{cacheStatus}</Text>
        </View>
      )}

      {/* 3D-plassholder — persistent WebView posisjoneres her */}
      <View ref={plassholder} style={styles.content} onLayout={målOgAktiver}>
        {/* Laste-overlay */}
        {(!erKlar || !erLastet) && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text style={styles.overlayText}>
              {!erKlar ? "Initialiserer viewer..." : `Laster modeller ${lastet}/${totalt || ifcModeller.length}...`}
            </Text>
          </View>
        )}

        {/* Feil */}
        {viseFeil && (
          <View style={styles.feilBanner}>
            <Text style={styles.feilTekst}>{viseFeil}</Text>
            <TouchableOpacity onPress={() => setLokalFeil(null)}>
              <X size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sidepanel — modell-toggle */}
        {visSidepanel && (
          <View style={styles.sidepanel}>
            <Text style={styles.sidepanelTittel}>Modeller</Text>
            {ifcModeller.map((m, i) => (
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
                  style={[styles.modellNavn, synlighet.get(i) === false && styles.modellNavnSkjult]}
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
              <Text style={styles.objektKategori}>{valgtObjekt.kategori ?? "Objekt"}</Text>
              <TouchableOpacity onPress={() => setValgtObjekt(null)}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {Object.entries(valgtObjekt.attributter)
              .filter(([k, v]) => {
                const skjult = ["expressID", "type", "GlobalId", "Tag", "OwnerHistory", "ObjectPlacement", "Representation", "CompositionType", "ShapeType"];
                if (skjult.includes(k)) return false;
                const s = String(v);
                if (!s || s === "NOTDEFINED" || s === "null" || s === "undefined" || s === "ELEMENT") return false;
                if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) return false;
                return true;
              })
              .slice(0, 8)
              .map(([k, v]) => (
                <View key={k} style={styles.objektRad}>
                  <Text style={styles.objektLabel}>{k}</Text>
                  <Text style={styles.objektVerdi} numberOfLines={2}>{String(v)}</Text>
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
  cacheBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  cacheTekst: { fontSize: 12, color: "#1e40af", fontWeight: "500" },
  content: { flex: 1, position: "relative" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  tomTekst: { color: "#6b7280", fontSize: 16, fontWeight: "500", marginTop: 16 },
  tomDetalj: { color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 6 },
  lasteTekst: { marginTop: 12, color: "#6b7280", fontSize: 14 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
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
    zIndex: 20,
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
    zIndex: 20,
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
    zIndex: 20,
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
