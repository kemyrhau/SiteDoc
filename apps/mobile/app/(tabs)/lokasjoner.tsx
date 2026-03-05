import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MoreVertical,
  MapPin,
  Plus,
  Crosshair,
  Navigation,
} from "lucide-react-native";
import * as Location from "expo-location";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { AUTH_CONFIG } from "../../src/config/auth";
import { KartVisning } from "../../src/components/KartVisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør, GpsMarkør } from "../../src/components/TegningsVisning";
import { TegningsVelger } from "../../src/components/TegningsVelger";
import { OppgaveModal } from "../../src/components/OppgaveModal";
import { MalVelger } from "../../src/components/MalVelger";
import { useRouter } from "expo-router";
import {
  beregnTransformasjon,
  gpsTilTegning,
} from "@siteflow/shared/utils";
import type { GeoReferanse } from "@siteflow/shared";

// Type-casts for å unngå TS2589 (excessively deep type instantiation)
interface BygningData {
  id: string;
  name: string;
  status: string;
  type?: string;
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  buildingId: string | null;
  fileUrl: string | null;
  geoReference?: unknown;
  _count: { revisions: number };
}

interface TegningDetalj {
  id: string;
  name: string;
  fileUrl: string | null;
  geoReference?: unknown;
}

interface OppgaveMarkør {
  id: string;
  number: number;
  positionX: number;
  positionY: number;
  status: string;
  template: { prefix: string | null } | null;
}

export default function LokasjonerSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  const router = useRouter();

  // Modus: visning (standard) eller plassering (opprett oppgave)
  const [plasseringsmodus, setPlasseringsmodus] = useState(false);

  // Markør- og oppgavemodal-state
  const [markørPosisjon, setMarkørPosisjon] = useState<{ x: number; y: number } | null>(null);
  const [visOppgaveModal, setVisOppgaveModal] = useState(false);
  const [visMalVelger, setVisMalVelger] = useState(false);
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);

  // Hent alle bygninger for valgt prosjekt
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Hent tegninger for valgt prosjekt
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  // Hent detaljer for valgt tegning
  const valgtTegningQuery = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Hent eksisterende oppgaver for valgt tegning
  const oppgaverQuery = trpc.oppgave.hentForTegning.useQuery(
    { drawingId: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Cast data
  const bygninger = (bygningQuery.data ?? []) as BygningData[];
  const tegninger = (tegningQuery.data ?? []) as TegningData[];
  const valgtTegningDetalj = valgtTegningQuery.data as TegningDetalj | undefined;
  const eksisterendeOppgaver = (oppgaverQuery.data ?? []) as OppgaveMarkør[];

  const lasterData = bygningQuery.isLoading || tegningQuery.isLoading;

  // Finn valgt tegning fra listen
  const valgtTegning = useMemo(
    () => tegninger.find((t) => t.id === valgtTegningId),
    [tegninger, valgtTegningId],
  );

  // Stabil georeferanse
  const harGeoRef = !!valgtTegningDetalj?.geoReference;
  const geoRefStringifisert = useMemo(
    () => (valgtTegningDetalj?.geoReference ? JSON.stringify(valgtTegningDetalj.geoReference) : null),
    [valgtTegningDetalj?.geoReference],
  );

  // Bygg markørliste: eksisterende oppgaver (røde) + ny markør (grønn/rød)
  const markører: Markør[] = useMemo(() => {
    const liste: Markør[] = eksisterendeOppgaver
      .filter((o) => o.positionX != null && o.positionY != null)
      .map((o) => ({
        id: o.id,
        x: o.positionX,
        y: o.positionY,
        label: `${o.template?.prefix ?? ""}${o.template?.prefix ? "-" : ""}${String(o.number).padStart(3, "0")}`,
      }));

    if (markørPosisjon) {
      liste.push({
        id: "ny-oppgave",
        x: markørPosisjon.x,
        y: markørPosisjon.y,
        farge: "#10b981",
      });
    }

    return liste;
  }, [eksisterendeOppgaver, markørPosisjon]);

  // GPS-posisjon på tegning (kontinuerlig sporing for georefererte tegninger)
  const [gpsMarkør, setGpsMarkør] = useState<GpsMarkør | null>(null);
  const gpsAbonnementRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!harGeoRef || !geoRefStringifisert || !valgtTegningId) {
      setGpsMarkør(null);
      return;
    }

    let aktiv = true;

    async function startSporing() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !aktiv) return;

      const geoRef = JSON.parse(geoRefStringifisert!) as GeoReferanse;
      const transformasjon = beregnTransformasjon(geoRef);

      gpsAbonnementRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (lokasjon) => {
          if (!aktiv) return;
          const gps = {
            lat: lokasjon.coords.latitude,
            lng: lokasjon.coords.longitude,
          };
          const posisjon = gpsTilTegning(gps, transformasjon);
          InteractionManager.runAfterInteractions(() => {
            if (aktiv) setGpsMarkør({ x: posisjon.x, y: posisjon.y });
          });
        },
      );
    }

    startSporing();

    return () => {
      aktiv = false;
      if (gpsAbonnementRef.current) {
        gpsAbonnementRef.current.remove();
        gpsAbonnementRef.current = null;
      }
      setGpsMarkør(null);
    };
  }, [harGeoRef, geoRefStringifisert, valgtTegningId]);

  // Treprikk-meny
  const visTreprikkmeny = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Avbryt",
            "Tegningsinformasjon",
            "Forbered til offline",
            "Oppdatere oppgaver",
          ],
          cancelButtonIndex: 0,
        },
        (indeks) => {
          if (indeks === 1) {
            // Tegningsinformasjon
          } else if (indeks === 2) {
            // Forbered til offline
          } else if (indeks === 3) {
            // Oppdatere oppgaver
          }
        },
      );
    }
  }, []);

  // Håndter tegningsvalg
  const håndterVelgTegning = useCallback((id: string) => {
    setValgtTegningId(id);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter lukking av tegning
  const håndterLukkTegning = useCallback(() => {
    setValgtTegningId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter avbryt i bottom sheet
  const håndterAvbryt = useCallback(() => {
    setValgtTegningId(null);
    setValgtBygningId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter trykk på tegning (kun i plasseringsmodus)
  const håndterTegningTrykk = useCallback(
    (posX: number, posY: number) => {
      setMarkørPosisjon({ x: posX, y: posY });
      setVisMalVelger(true);
    },
    [],
  );

  // Bruk GPS-posisjon som markørposisjon
  const brukGpsPosisjon = useCallback(() => {
    if (gpsMarkør) {
      setMarkørPosisjon({ x: gpsMarkør.x, y: gpsMarkør.y });
      setVisMalVelger(true);
    } else {
      Alert.alert("GPS ikke tilgjengelig", "Venter på GPS-posisjon. Prøv igjen om et øyeblikk.");
    }
  }, [gpsMarkør]);

  // Håndter trykk på eksisterende markør
  const håndterMarkørTrykk = useCallback((markørId: string) => {
    if (markørId === "ny-oppgave") return;
    router.push(`/oppgave/${markørId}`);
  }, [router]);

  // Håndter oppgave opprettet
  const håndterOppgaveOpprettet = useCallback((oppgaveId: string) => {
    setVisOppgaveModal(false);
    setVisMalVelger(false);
    setValgtMalId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
    router.push(`/oppgave/${oppgaveId}`);
  }, [router]);

  // Håndter lukking av oppgavemodal
  const håndterLukkOppgaveModal = useCallback(() => {
    setVisOppgaveModal(false);
    setVisMalVelger(false);
    setValgtMalId(null);
    setMarkørPosisjon(null);
  }, []);

  // Ingen prosjekt valgt
  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <MapPin size={48} color="#9ca3af" />
          <Text className="mt-4 text-base font-medium text-gray-500">
            Lokasjoner
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-400">
            Velg et prosjekt for å se lokasjoner
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const visserTegning = !!valgtTegningId && !!valgtTegningDetalj?.fileUrl;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Blå header */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <Text className="text-sm font-semibold text-white">Lokasjoner</Text>
        <View className="flex-row items-center gap-3">
          {/* Plasseringsmodus-toggle (kun når tegning vises) */}
          {visserTegning && (
            <Pressable
              onPress={() => {
                setPlasseringsmodus(!plasseringsmodus);
                if (plasseringsmodus) setMarkørPosisjon(null);
              }}
              hitSlop={8}
              className={`rounded-full px-3 py-1 ${plasseringsmodus ? "bg-white" : "bg-white/20"}`}
            >
              <View className="flex-row items-center gap-1.5">
                {plasseringsmodus ? (
                  <Crosshair size={14} color="#1e40af" />
                ) : (
                  <Navigation size={14} color="#ffffff" />
                )}
                <Text className={`text-xs font-medium ${plasseringsmodus ? "text-siteflow-blue" : "text-white"}`}>
                  {plasseringsmodus ? "Plassering" : "Navigering"}
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable onPress={visTreprikkmeny} hitSlop={12}>
            <MoreVertical size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Plasseringsmodus-banner */}
      {visserTegning && plasseringsmodus && (
        <View className="flex-row items-center justify-between bg-amber-50 px-4 py-2">
          <Text className="text-xs text-amber-700">
            Trykk på tegningen for å plassere markør
          </Text>
          {harGeoRef && gpsMarkør && (
            <Pressable
              onPress={brukGpsPosisjon}
              className="flex-row items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1"
            >
              <Crosshair size={12} color="#1e40af" />
              <Text className="text-xs font-medium text-blue-700">Bruk GPS</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Hovedinnhold */}
      <View className="flex-1">
        {lasterData ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter lokasjonsdata…
            </Text>
          </View>
        ) : visserTegning ? (
          <TegningsVisning
            tegningUrl={
              valgtTegningDetalj!.fileUrl!.startsWith("http")
                ? valgtTegningDetalj!.fileUrl!
                : `${AUTH_CONFIG.apiUrl}${valgtTegningDetalj!.fileUrl}`
            }
            tegningNavn={valgtTegningDetalj!.name}
            onLukk={håndterLukkTegning}
            onTrykk={plasseringsmodus ? håndterTegningTrykk : undefined}
            onMarkørTrykk={håndterMarkørTrykk}
            markører={markører}
            gpsMarkør={gpsMarkør}
          />
        ) : (
          <KartVisning />
        )}
      </View>

      {/* Bottom sheet tegningsvelger */}
      <TegningsVelger
        bygninger={bygninger}
        tegninger={tegninger}
        valgtBygningId={valgtBygningId}
        valgtTegningId={valgtTegningId}
        onVelgBygning={setValgtBygningId}
        onVelgTegning={håndterVelgTegning}
        onAvbryt={håndterAvbryt}
        laster={lasterData}
      />

      {/* Malvelger for oppgave fra tegning */}
      <MalVelger
        synlig={visMalVelger && !valgtMalId}
        kategori="oppgave"
        onVelg={(mal) => {
          setValgtMalId(mal.id);
          setVisMalVelger(false);
          setVisOppgaveModal(true);
        }}
        onLukk={() => {
          setVisMalVelger(false);
          setMarkørPosisjon(null);
        }}
      />

      {/* Oppgave-opprettelsesmodal */}
      {valgtTegningId && valgtTegning && markørPosisjon && valgtMalId && (
        <OppgaveModal
          synlig={visOppgaveModal}
          onLukk={håndterLukkOppgaveModal}
          onOpprettet={håndterOppgaveOpprettet}
          tegningNavn={valgtTegning.drawingNumber || valgtTegning.name}
          tegningId={valgtTegningId}
          posisjonX={markørPosisjon.x}
          posisjonY={markørPosisjon.y}
          gpsPositionert={harGeoRef}
          templateId={valgtMalId}
        />
      )}
    </SafeAreaView>
  );
}
