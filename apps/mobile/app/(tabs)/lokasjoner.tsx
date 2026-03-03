import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronDown,
  MoreVertical,
  MapPin,
} from "lucide-react-native";
import * as Location from "expo-location";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { AUTH_CONFIG } from "../../src/config/auth";
import { KartVisning } from "../../src/components/KartVisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør } from "../../src/components/TegningsVisning";
import { TegningsVelger } from "../../src/components/TegningsVelger";
import { OppgaveModal } from "../../src/components/OppgaveModal";
import { MalVelger } from "../../src/components/MalVelger";
import { useRouter } from "expo-router";
import {
  beregnTransformasjon,
  gpsTilTegning,
  erInnenforTegning,
} from "@siteflow/shared/utils";
import type { GeoReferanse } from "@siteflow/shared";

type LokasjonTab = "bygg" | "anlegg";

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

export default function LokasjonerSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const [aktivTab, setAktivTab] = useState<LokasjonTab>("bygg");
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  const router = useRouter();

  // Markør- og oppgavemodal-state
  const [markørPosisjon, setMarkørPosisjon] = useState<{ x: number; y: number } | null>(null);
  const [visOppgaveModal, setVisOppgaveModal] = useState(false);
  const [visMalVelger, setVisMalVelger] = useState(false);
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);
  const [gpsHenter, setGpsHenter] = useState(false);

  // Hent bygninger for valgt prosjekt med type-filter
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, type: aktivTab },
    { enabled: !!valgtProsjektId },
  );

  // Hent tegninger for valgt prosjekt, filtrert på bygning
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  // Hent detaljer for valgt tegning (for å få fileUrl og geoReference)
  const valgtTegningQuery = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Cast data for type safety
  const bygninger = (bygningQuery.data ?? []) as BygningData[];
  const tegninger = (tegningQuery.data ?? []) as TegningData[];
  const valgtTegningDetalj = valgtTegningQuery.data as TegningDetalj | undefined;

  const lasterData =
    bygningQuery.isLoading || tegningQuery.isLoading;

  // Finn valgt tegning fra listen
  const valgtTegning = useMemo(
    () => tegninger.find((t) => t.id === valgtTegningId),
    [tegninger, valgtTegningId],
  );

  // Bygg markørliste fra state
  const markører: Markør[] = useMemo(() => {
    if (!markørPosisjon) return [];
    const farge = aktivTab === "anlegg" ? "#10b981" : undefined; // Grønn for anlegg
    return [{ x: markørPosisjon.x, y: markørPosisjon.y, id: "ny-oppgave", farge }];
  }, [markørPosisjon, aktivTab]);

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

  // Håndter tab-bytte
  const håndterTabBytte = useCallback((tab: LokasjonTab) => {
    setAktivTab(tab);
    setValgtBygningId(null);
    setValgtTegningId(null);
    setMarkørPosisjon(null);
  }, []);

  // Håndter tegningsvalg
  const håndterVelgTegning = useCallback((id: string) => {
    setValgtTegningId(id);
    setMarkørPosisjon(null); // Nullstill markør ved ny tegning
  }, []);

  // Håndter lukking av tegning
  const håndterLukkTegning = useCallback(() => {
    setValgtTegningId(null);
    setMarkørPosisjon(null);
  }, []);

  // Håndter avbryt i bottom sheet
  const håndterAvbryt = useCallback(() => {
    setValgtTegningId(null);
    setValgtBygningId(null);
    setMarkørPosisjon(null);
  }, []);

  // Håndter trykk på tegning — for Anlegg: hent GPS og beregn posisjon
  const håndterTegningTrykk = useCallback(
    async (posX: number, posY: number) => {
      if (aktivTab === "anlegg" && valgtTegningDetalj?.geoReference) {
        // Anlegg med georeferanse: hent GPS og beregn posisjon
        setGpsHenter(true);
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("GPS-tilgang", "Appen trenger tilgang til GPS for å plassere markør på georefererte tegninger.");
            setGpsHenter(false);
            return;
          }

          const lokasjon = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const geoRef = valgtTegningDetalj.geoReference as GeoReferanse;
          const transformasjon = beregnTransformasjon(geoRef);

          const gps = {
            lat: lokasjon.coords.latitude,
            lng: lokasjon.coords.longitude,
          };

          if (!erInnenforTegning(gps, transformasjon)) {
            Alert.alert(
              "Utenfor tegningen",
              "Din GPS-posisjon er utenfor tegningens dekningsområde. Posisjonen plasseres likevel, men kan være unøyaktig.",
            );
          }

          const posisjon = gpsTilTegning(gps, transformasjon);
          setMarkørPosisjon({ x: posisjon.x, y: posisjon.y });
          setVisMalVelger(true);
        } catch (feil) {
          Alert.alert("GPS-feil", "Kunne ikke hente GPS-posisjon. Prøv igjen.");
        } finally {
          setGpsHenter(false);
        }
      } else {
        // Vanlig Bygg-modus: bruk trykk-posisjon direkte
        setMarkørPosisjon({ x: posX, y: posY });
        setVisMalVelger(true);
      }
    },
    [aktivTab, valgtTegningDetalj],
  );

  // Håndter oppgave opprettet — naviger til utfylling
  const håndterOppgaveOpprettet = useCallback((oppgaveId: string) => {
    setVisOppgaveModal(false);
    setVisMalVelger(false);
    setValgtMalId(null);
    setMarkørPosisjon(null);
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Blå filterbar med segmentert kontroll */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <View className="flex-row items-center gap-1">
          {(["bygg", "anlegg"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => håndterTabBytte(tab)}
              className={`rounded-full px-4 py-1.5 ${
                aktivTab === tab ? "bg-white" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  aktivTab === tab ? "text-siteflow-blue" : "text-white/70"
                }`}
              >
                {tab === "bygg" ? "Bygg" : "Anlegg"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={visTreprikkmeny} hitSlop={12}>
          <MoreVertical size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* GPS-henting-indikator */}
      {gpsHenter && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <ActivityIndicator size="small" color="#d97706" />
          <Text className="text-sm text-amber-700">Henter GPS-posisjon…</Text>
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
        ) : valgtTegningId && valgtTegningDetalj?.fileUrl ? (
          <TegningsVisning
            tegningUrl={
              valgtTegningDetalj.fileUrl.startsWith("http")
                ? valgtTegningDetalj.fileUrl
                : `${AUTH_CONFIG.apiUrl}${valgtTegningDetalj.fileUrl}`
            }
            tegningNavn={valgtTegningDetalj.name}
            onLukk={håndterLukkTegning}
            onTrykk={håndterTegningTrykk}
            markører={markører}
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
          gpsPositionert={aktivTab === "anlegg"}
          templateId={valgtMalId}
        />
      )}
    </SafeAreaView>
  );
}
