import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useProsjekt } from "../src/kontekst/ProsjektKontekst";
import { useBygning } from "../src/kontekst/BygningKontekst";
import { trpc } from "../src/lib/trpc";
import { TegningsVisning } from "../src/components/TegningsVisning";
import type { Markør } from "../src/components/TegningsVisning";
import { usePersistent3D } from "../src/hooks/usePersistent3D";
import {
  beregnTransformasjon,
  tegningTilGps,
  gpsTilTegning,
  gpsTil3D,
  tredjeTilGps,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import { ChevronLeft, Maximize2, Minimize2, Layers, Link2, Link2Off } from "lucide-react-native";

const { height: SKJERMHOYDE } = Dimensions.get("window");

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  floor: string | null;
  fileUrl: string | null;
  fileType: string | null;
  geoReference?: unknown;
  ifcMetadata?: {
    gpsBreddegrad?: number | null;
    gpsLengdegrad?: number | null;
  } | null;
  coordinateSystem?: string | null;
}

export default function Tegning3DSkjerm() {
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();

  const {
    plassholder,
    målOgAktiver,
    postMelding,
    registrerHandler,
    erKlar,
    ifcModeller,
  } = usePersistent3D();

  const [splitRatio, setSplitRatio] = useState(0.5);
  const [synkAktiv, setSynkAktiv] = useState(true);
  const [valgtTegningIdx, setValgtTegningIdx] = useState(0);
  const [tegningMarkør, setTegningMarkør] = useState<Markør[]>([]);

  // Hent tegninger
  const tegningQuery = (trpc.tegning.hentForProsjekt as unknown as {
    useQuery: (input: { projectId: string; buildingId?: string }, opts: { enabled: boolean }) => { data: unknown; isLoading: boolean };
  }).useQuery(
    { projectId: valgtProsjektId!, buildingId: valgtBygningId! },
    { enabled: !!valgtProsjektId && !!valgtBygningId },
  );
  const isLoading = tegningQuery.isLoading;
  const alleTegninger = (tegningQuery.data ?? []) as TegningData[];
  const plantegninger = useMemo(
    () => alleTegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc"),
    [alleTegninger],
  );

  const valgtTegning = plantegninger[valgtTegningIdx] ?? null;

  // IFC GPS-opprinnelse
  const ifcOpprinnelse = useMemo(() => {
    for (const t of alleTegninger) {
      const meta = t.ifcMetadata;
      if (meta?.gpsBreddegrad && meta?.gpsLengdegrad) {
        return { lat: meta.gpsBreddegrad, lng: meta.gpsLengdegrad };
      }
    }
    return null;
  }, [alleTegninger]);

  const coordSystem: KoordinatSystem = useMemo(() => {
    for (const t of alleTegninger) {
      if (t.coordinateSystem) return t.coordinateSystem as KoordinatSystem;
    }
    return "utm33";
  }, [alleTegninger]);

  // Georeferanse-transformasjon
  const transformasjon = useMemo(() => {
    if (!valgtTegning?.geoReference) return null;
    try { return beregnTransformasjon(valgtTegning.geoReference as GeoReferanse); } catch { return null; }
  }, [valgtTegning?.geoReference]);

  const harSynk = !!transformasjon && !!ifcOpprinnelse;

  // Lytt på 3D-klikk → markør i tegning
  useEffect(() => {
    const unsub = registrerHandler((msg) => {
      if (msg.type === "objektValgt" && (msg.data as { punkt?: unknown })?.punkt && synkAktiv && transformasjon && ifcOpprinnelse) {
        const punkt = (msg.data as { punkt: { x: number; y: number; z: number } }).punkt;
        const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
        if (gps) {
          const tegningPkt = gpsTilTegning(gps, transformasjon);
          setTegningMarkør([{ x: tegningPkt.x, y: tegningPkt.y, id: "synk3d", farge: "#ef4444" }]);
        }
      }
    });
    return unsub;
  }, [registrerHandler, synkAktiv, transformasjon, ifcOpprinnelse, coordSystem]);

  // Tegning-klikk → fly 3D
  const handleTegningTrykk = useCallback((posX: number, posY: number) => {
    if (!synkAktiv || !transformasjon || !ifcOpprinnelse) return;
    setTegningMarkør([{ x: posX, y: posY, id: "synk", farge: "#3b82f6" }]);
    const gps = tegningTilGps({ x: posX, y: posY }, transformasjon);
    const punkt3d = gpsTil3D(gps, ifcOpprinnelse, coordSystem, 0);
    if (punkt3d) {
      postMelding({ type: "flyTil", x: punkt3d.x, y: punkt3d.y, z: punkt3d.z });
    }
  }, [synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, postMelding]);

  const tegningHoyde = SKJERMHOYDE * splitRatio;

  const toggleSplit = () => {
    setSplitRatio((prev) => (prev === 0.5 ? 0.7 : prev === 0.7 ? 0.3 : 0.5));
  };

  const tegningUrl = valgtTegning?.fileUrl
    ? valgtTegning.fileUrl.startsWith("/api") ? valgtTegning.fileUrl : `/api${valgtTegning.fileUrl}`
    : null;

  const byttTegning = () => {
    setValgtTegningIdx((prev) => (prev + 1) % Math.max(1, plantegninger.length));
    setTegningMarkør([]);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tegning + 3D</Text>
        </View>
        <View style={styles.laster}>
          <ActivityIndicator size="large" color="#1e40af" />
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {valgtTegning?.drawingNumber ?? valgtTegning?.name ?? "Tegning + 3D"}
        </Text>
        <TouchableOpacity onPress={() => setSynkAktiv(!synkAktiv)} style={styles.headerBtn}>
          {synkAktiv && harSynk ? <Link2 size={18} color="#10b981" /> : <Link2Off size={18} color="#6b7280" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={byttTegning} style={styles.headerBtn}>
          <Layers size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSplit} style={styles.headerBtn}>
          {splitRatio === 0.5 ? <Maximize2 size={18} color="#fff" /> : <Minimize2 size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Tegning (topp) */}
      <View style={[styles.tegningContainer, { height: tegningHoyde }]}>
        {tegningUrl ? (
          <TegningsVisning
            tegningUrl={tegningUrl}
            tegningNavn={valgtTegning?.name ?? "Tegning"}
            onLukk={() => {}}
            onTrykk={handleTegningTrykk}
            markører={tegningMarkør}
          />
        ) : (
          <View style={styles.ingenTegning}>
            <Layers size={32} color="#9ca3af" />
            <Text style={styles.ingenTegningTekst}>Ingen tegning tilgjengelig</Text>
          </View>
        )}
      </View>

      {/* Skillelinje */}
      <View style={styles.skillelinje}>
        <View style={styles.skillehåndtak} />
      </View>

      {/* 3D-modell (bunn) — persistent WebView posisjoneres her */}
      <View ref={plassholder} style={styles.modellContainer} onLayout={målOgAktiver}>
        {!erKlar && (
          <View style={styles.modellOverlay}>
            <ActivityIndicator size="small" color="#fff" />
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
  laster: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" },
  tegningContainer: { position: "relative", backgroundColor: "#f3f4f6" },
  ingenTegning: { flex: 1, justifyContent: "center", alignItems: "center" },
  ingenTegningTekst: { color: "#9ca3af", fontSize: 14, marginTop: 8 },
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
  modellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },
  modellOverlayTekst: { color: "#fff", fontSize: 14 },
});
