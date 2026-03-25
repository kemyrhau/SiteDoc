import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Box, Eye, EyeOff, Scissors, X, Download } from "lucide-react-native";
import { useWebView3D } from "../src/kontekst/WebView3DKontekst";
import { lastNedIfc } from "../src/services/ifcCache";

/** Oversett IFC-kategorier til norsk */
function oversettKategori(kategori: string | null): string {
  if (!kategori) return "Objekt";
  const map: Record<string, string> = {
    IfcWall: "Vegg", IfcWallStandardCase: "Vegg", IfcSlab: "Dekke", IfcRoof: "Tak",
    IfcBeam: "Bjelke", IfcColumn: "Søyle", IfcDoor: "Dør", IfcWindow: "Vindu",
    IfcStair: "Trapp", IfcStairFlight: "Trappløp", IfcRailing: "Rekkverk",
    IfcPlate: "Plate", IfcMember: "Element", IfcCurtainWall: "Fasadevegg",
    IfcCovering: "Kledning", IfcFurnishingElement: "Møbel",
    IfcBuildingElementProxy: "Bygningselement", IfcFlowTerminal: "Armatur",
    IfcFlowSegment: "Rør/Kanal", IfcDistributionElement: "Teknisk installasjon",
  };
  return map[kategori] ?? kategori.replace("Ifc", "");
}

/** Oversett og filtrer IFC-attributter */
function filtrerAttributter(attr: Record<string, unknown>): [string, string][] {
  const labels: Record<string, string> = {
    Name: "Navn", Description: "Beskrivelse", ObjectType: "Type",
    LongName: "Langt navn", PredefinedType: "Forhåndsdefinert type",
    OverallHeight: "Høyde", OverallWidth: "Bredde",
    IsExternal: "Utvendig", LoadBearing: "Bærende",
    FireRating: "Brannklasse", Reference: "Referanse", Material: "Materiale",
  };
  const skjult = new Set(["expressID", "type", "GlobalId", "Tag", "OwnerHistory", "ObjectPlacement", "Representation", "CompositionType", "ShapeType", "Name"]);
  const resultat: [string, string][] = [];
  const prioritert = ["ObjectType", "Description", "Material", "Reference", "IsExternal", "LoadBearing", "FireRating"];

  for (const k of prioritert) {
    const v = attr[k];
    if (v == null) continue;
    const s = String(v);
    if (!s || s === "NOTDEFINED" || s === "null" || s === "undefined" || s === "ELEMENT") continue;
    const visnVerdi = s === "true" || s === ".T." ? "Ja" : s === "false" || s === ".F." ? "Nei" : s;
    resultat.push([labels[k] ?? k, visnVerdi]);
  }
  for (const [k, v] of Object.entries(attr)) {
    if (skjult.has(k) || prioritert.includes(k)) continue;
    const s = String(v);
    if (!s || s === "NOTDEFINED" || s === "null" || s === "undefined" || s === "ELEMENT") continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) continue;
    if (resultat.length >= 8) break;
    const visnVerdi = s === "true" || s === ".T." ? "Ja" : s === "false" || s === ".F." ? "Nei" : s;
    resultat.push([labels[k] ?? k, visnVerdi]);
  }
  return resultat;
}

interface ValgtObjekt {
  kategori: string | null;
  attributter: Record<string, unknown>;
}

export default function TreDVisningSkjerm() {
  const router = useRouter();
  const { vis, skjul, postMelding, registrerHandler, erKlar, erLastet, lastet, totalt, ifcModeller, feil } = useWebView3D();

  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [synlighet, setSynlighet] = useState<Map<number, boolean>>(new Map());
  const [klippAktiv, setKlippAktiv] = useState(false);
  const [visSidepanel, setVisSidepanel] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  // Vis WebView ved mount, skjul ved unmount
  useEffect(() => {
    vis();
    return () => skjul();
  }, [vis, skjul]);

  // Lytt på meldinger
  useEffect(() => {
    return registrerHandler((msg) => {
      if (msg.type === "objektValgt") setValgtObjekt(msg.data as ValgtObjekt);
      else if (msg.type === "objektFjernet") setValgtObjekt(null);
    });
  }, [registrerHandler]);

  const toggleModell = useCallback((index: number) => {
    setSynlighet((prev) => {
      const neste = new Map(prev);
      const ny = !(neste.get(index) ?? true);
      neste.set(index, ny);
      postMelding({ type: "toggleModell", index, synlig: ny });
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

  const viseFeil = feil;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Header — rendres oppå WebView */}
      <View style={styles.header} pointerEvents="auto">
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
        <View style={styles.cacheBanner} pointerEvents="auto">
          <Download size={14} color="#1e40af" />
          <Text style={styles.cacheTekst}>{cacheStatus}</Text>
        </View>
      )}

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
        </View>
      )}

      {/* Sidepanel */}
      {visSidepanel && (
        <View style={styles.sidepanel} pointerEvents="auto">
          <Text style={styles.sidepanelTittel}>Modeller</Text>
          {ifcModeller.map((m, i) => (
            <TouchableOpacity key={m.id} style={styles.modellRad} onPress={() => toggleModell(i)}>
              {synlighet.get(i) !== false ? <Eye size={16} color="#1e40af" /> : <EyeOff size={16} color="#9ca3af" />}
              <Text style={[styles.modellNavn, synlighet.get(i) === false && styles.modellNavnSkjult]} numberOfLines={1}>
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Objektinfo */}
      {valgtObjekt && (
        <View style={styles.objektPanel} pointerEvents="auto">
          <View style={styles.objektHåndtak}><View style={styles.objektHåndtakStrek} /></View>
          <View style={styles.objektHeader}>
            <View style={styles.objektHeaderVenstre}>
              <View style={styles.objektIkon}><Box size={14} color="#1e40af" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.objektKategori}>{oversettKategori(valgtObjekt.kategori)}</Text>
                {valgtObjekt.attributter.Name != null && (
                  <Text style={styles.objektNavn} numberOfLines={2}>{String(valgtObjekt.attributter.Name)}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => setValgtObjekt(null)} style={styles.lukkBtn}>
              <X size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.objektScroll} showsVerticalScrollIndicator={false}>
            {filtrerAttributter(valgtObjekt.attributter).map(([label, verdi]) => (
              <View key={label} style={styles.objektRad}>
                <Text style={styles.objektLabel}>{label}</Text>
                <Text style={styles.objektVerdi}>{verdi}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#1e40af",
    paddingTop: 50, paddingBottom: 10, paddingHorizontal: 12, zIndex: 10,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { padding: 8, borderRadius: 8 },
  headerBtnAktiv: { backgroundColor: "rgba(255,255,255,0.2)" },
  cacheBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: "#dbeafe", zIndex: 10,
  },
  cacheTekst: { fontSize: 12, color: "#1e40af", fontWeight: "500" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center", alignItems: "center", zIndex: 5,
  },
  overlayText: { marginTop: 12, fontSize: 14, color: "#374151", fontWeight: "500" },
  feilBanner: {
    position: "absolute", top: 80, left: 8, right: 8,
    backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, zIndex: 20,
  },
  feilTekst: { fontSize: 12, color: "#ef4444" },
  sidepanel: {
    position: "absolute", left: 0, top: 70, bottom: 0, width: 220,
    backgroundColor: "#fff", borderRightWidth: 1, borderRightColor: "#e5e7eb",
    paddingTop: 12, paddingHorizontal: 12, zIndex: 20,
  },
  sidepanelTittel: { fontSize: 13, fontWeight: "600", color: "#111", marginBottom: 10 },
  modellRad: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  modellNavn: { flex: 1, fontSize: 13, color: "#374151" },
  modellNavnSkjult: { color: "#9ca3af" },
  objektPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingBottom: 24, maxHeight: "50%", zIndex: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  objektHåndtak: { alignItems: "center", paddingVertical: 8 },
  objektHåndtakStrek: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#d1d5db" },
  objektHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  objektHeaderVenstre: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  objektIkon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center" },
  objektKategori: { fontSize: 15, fontWeight: "700", color: "#1e40af" },
  objektNavn: { fontSize: 13, color: "#374151", marginTop: 2 },
  lukkBtn: { padding: 6, marginLeft: 8 },
  objektScroll: { maxHeight: 200 },
  objektRad: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#f0f0f0" },
  objektLabel: { width: 110, fontSize: 13, fontWeight: "500", color: "#6b7280" },
  objektVerdi: { flex: 1, fontSize: 13, color: "#111" },
});
