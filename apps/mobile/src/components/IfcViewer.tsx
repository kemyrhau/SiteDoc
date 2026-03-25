import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "../services/auth";
import { lastNedIfc } from "../services/ifcCache";
import { Box, Eye, EyeOff, Scissors, X, ChevronLeft, Download } from "lucide-react-native";

interface IfcModell {
  id: string;
  name: string;
  fileUrl: string;
  updatedAt?: string;
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

/** Oversett IFC-kategorier til norsk */
function oversettKategori(kategori: string | null): string {
  if (!kategori) return "Objekt";
  const oversettelser: Record<string, string> = {
    IfcWall: "Vegg", IfcWallStandardCase: "Vegg",
    IfcSlab: "Dekke", IfcRoof: "Tak",
    IfcBeam: "Bjelke", IfcColumn: "Søyle",
    IfcDoor: "Dør", IfcWindow: "Vindu",
    IfcStair: "Trapp", IfcStairFlight: "Trappløp",
    IfcRailing: "Rekkverk", IfcRamp: "Rampe",
    IfcPlate: "Plate", IfcMember: "Element",
    IfcCurtainWall: "Fasadevegg", IfcCovering: "Kledning",
    IfcFurnishingElement: "Møbel", IfcBuildingElementProxy: "Bygningselement",
    IfcFlowTerminal: "Armatur", IfcFlowSegment: "Rør/Kanal",
    IfcDistributionElement: "Teknisk installasjon",
    IfcSpace: "Rom", IfcOpeningElement: "Åpning",
  };
  return oversettelser[kategori] ?? kategori.replace("Ifc", "");
}

/** Oversett og filtrer IFC-attributter til lesbare norske etiketter */
function filtrerAttributter(attr: Record<string, unknown>): [string, string][] {
  const oversettelser: Record<string, string> = {
    Name: "Navn", Description: "Beskrivelse", ObjectType: "Type",
    LongName: "Langt navn", PredefinedType: "Forhåndsdefinert type",
    OverallHeight: "Høyde", OverallWidth: "Bredde", OverallDepth: "Dybde",
    NominalHeight: "Nominell høyde", NominalWidth: "Nominell bredde",
    TotalThickness: "Total tykkelse", Thickness: "Tykkelse",
    Area: "Areal", NetArea: "Netto areal", GrossArea: "Brutto areal",
    Volume: "Volum", NetVolume: "Netto volum",
    LoadBearing: "Bærende", IsExternal: "Utvendig",
    FireRating: "Brannklasse", AcousticRating: "Lydklasse",
    Reference: "Referanse", Material: "Materiale",
    Pset_WallCommon: "Veggegenskaper", Pset_SlabCommon: "Dekkeegenskaper",
  };

  const skjult = new Set([
    "expressID", "type", "GlobalId", "Tag", "OwnerHistory",
    "ObjectPlacement", "Representation", "CompositionType", "ShapeType",
    "Name", // Vises allerede i header
  ]);

  const resultat: [string, string][] = [];

  // Prioriterte felter først
  const prioritert = ["ObjectType", "Description", "Material", "Reference", "IsExternal", "LoadBearing", "FireRating"];
  for (const nøkkel of prioritert) {
    const verdi = attr[nøkkel];
    if (verdi != null) {
      const s = String(verdi);
      if (s && s !== "NOTDEFINED" && s !== "null" && s !== "undefined" && s !== "ELEMENT") {
        const label = oversettelser[nøkkel] ?? nøkkel;
        // Formater boolske verdier
        const visnVerdi = s === "true" || s === ".T." ? "Ja" : s === "false" || s === ".F." ? "Nei" : s;
        resultat.push([label, visnVerdi]);
      }
    }
  }

  // Øvrige felter
  for (const [k, v] of Object.entries(attr)) {
    if (skjult.has(k) || prioritert.includes(k)) continue;
    const s = String(v);
    if (!s || s === "NOTDEFINED" || s === "null" || s === "undefined" || s === "ELEMENT") continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) continue;
    if (resultat.length >= 8) break;
    const label = oversettelser[k] ?? k;
    const visnVerdi = s === "true" || s === ".T." ? "Ja" : s === "false" || s === ".F." ? "Nei" : s;
    resultat.push([label, visnVerdi]);
  }

  return resultat;
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
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  const viewerUrl = `${AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "")}/mobil-viewer`;
  const FRAG_MAPPE = `${FileSystem.documentDirectory}sitedoc-fragments/`;

  // Fragment-cache hjelpere
  const fragSti = useCallback((url: string) => {
    const deler = url.split("/");
    const filnavn = (deler[deler.length - 1] ?? "modell").replace(".ifc", ".frag");
    return `${FRAG_MAPPE}${filnavn}`;
  }, [FRAG_MAPPE]);

  // Send modeller til WebView — inkluder cached fragments
  const sendModeller = useCallback(async () => {
    const token = await hentSessionToken();
    const baseUrl = AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "");
    const modelUrls = modeller.map((m) => {
      const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
      return `${baseUrl}${url}`;
    });

    // Les cachede fragmenter fra filsystemet
    const cachedFragments: Record<string, string> = {};
    try {
      const mappeInfo = await FileSystem.getInfoAsync(FRAG_MAPPE);
      if (mappeInfo.exists) {
        for (const fullUrl of modelUrls) {
          const sti = fragSti(fullUrl);
          const info = await FileSystem.getInfoAsync(sti);
          if (info.exists) {
            const b64 = await FileSystem.readAsStringAsync(sti, { encoding: FileSystem.EncodingType.Base64 });
            cachedFragments[fullUrl] = b64;
          }
        }
      }
    } catch { /* Fragment-cache er valgfritt */ }

    const harCache = Object.keys(cachedFragments).length > 0;
    console.log(`[IfcViewer] Sender ${modelUrls.length} modeller, ${Object.keys(cachedFragments).length} fra cache`);

    webViewRef.current?.postMessage(
      JSON.stringify({ type: "lastModeller", urls: modelUrls, token, ...(harCache ? { cachedFragments } : {}) }),
    );
  }, [modeller, FRAG_MAPPE, fragSti]);

  // Lagre fragment-cache fra WebView
  const lagreFragment = useCallback(async (url: string, b64Data: string) => {
    try {
      const mappeInfo = await FileSystem.getInfoAsync(FRAG_MAPPE);
      if (!mappeInfo.exists) {
        await FileSystem.makeDirectoryAsync(FRAG_MAPPE, { intermediates: true });
      }
      const sti = fragSti(url);
      await FileSystem.writeAsStringAsync(sti, b64Data, { encoding: FileSystem.EncodingType.Base64 });
      console.log(`[IfcViewer] Fragment cachet: ${sti}`);
    } catch (err) {
      console.warn("[IfcViewer] Kunne ikke cache fragment:", err);
    }
  }, [FRAG_MAPPE, fragSti]);

  // Forhåndslast IFC-filer til lokal cache
  const lastNedTilCache = useCallback(async () => {
    setCacheStatus("Laster ned...");
    try {
      for (let i = 0; i < modeller.length; i++) {
        const m = modeller[i]!;
        setCacheStatus(`${m.name} (${i + 1}/${modeller.length})`);
        await lastNedIfc(m.fileUrl, (prosent) => {
          setCacheStatus(`${m.name} — ${prosent}%`);
        }, m.updatedAt);
      }
      setCacheStatus("Lagret for offline-bruk");
      setTimeout(() => setCacheStatus(null), 2000);
    } catch (err) {
      setCacheStatus(`Feil: ${err instanceof Error ? err.message : String(err)}`);
    }
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
        case "cacheFragment":
          // WebView sender parsede fragmenter for caching
          if (msg.url && msg.data) {
            lagreFragment(msg.url, msg.data);
          }
          break;
      }
    } catch {
      // Ignorer ugyldig JSON
    }
  }, [sendModeller, lagreFragment]);

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
          <TouchableOpacity onPress={lastNedTilCache} style={styles.headerBtn}>
            <Download size={18} color="#fff" />
          </TouchableOpacity>
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

      {/* Cache-status */}
      {cacheStatus && (
        <View style={styles.cacheBanner}>
          <Download size={14} color="#1e40af" />
          <Text style={styles.cacheTekst}>{cacheStatus}</Text>
        </View>
      )}

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
              <View style={styles.objektHeaderVenstre}>
                <View style={styles.objektIkon}>
                  <Box size={14} color="#1e40af" />
                </View>
                <View>
                  <Text style={styles.objektKategori}>
                    {oversettKategori(valgtObjekt.kategori)}
                  </Text>
                  {valgtObjekt.attributter.Name != null && (
                    <Text style={styles.objektNavn} numberOfLines={1}>
                      {String(valgtObjekt.attributter.Name)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setValgtObjekt(null)} style={styles.lukkBtn}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {filtrerAttributter(valgtObjekt.attributter).map(([label, verdi]) => (
              <View key={label} style={styles.objektRad}>
                <Text style={styles.objektLabel}>{label}</Text>
                <Text style={styles.objektVerdi} numberOfLines={2}>{verdi}</Text>
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
    maxHeight: 300,
  },
  objektHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  objektHeaderVenstre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  objektIkon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  objektKategori: { fontSize: 14, fontWeight: "700", color: "#1e40af" },
  objektNavn: { fontSize: 13, color: "#374151", marginTop: 1 },
  lukkBtn: { padding: 4, marginLeft: 8 },
  objektRad: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  objektLabel: { width: 110, fontSize: 12, fontWeight: "500", color: "#6b7280" },
  objektVerdi: { flex: 1, fontSize: 12, color: "#111" },
});
