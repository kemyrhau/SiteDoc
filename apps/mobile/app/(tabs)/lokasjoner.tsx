import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronDown,
  MoreVertical,
  MapPin,
} from "lucide-react-native";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { AUTH_CONFIG } from "../../src/config/auth";
import { KartVisning } from "../../src/components/KartVisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import { TegningsVelger } from "../../src/components/TegningsVelger";

// Type-casts for å unngå TS2589 (excessively deep type instantiation)
interface BygningData {
  id: string;
  name: string;
  status: string;
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  buildingId: string | null;
  fileUrl: string | null;
  _count: { revisions: number };
}

interface TegningDetalj {
  id: string;
  name: string;
  fileUrl: string | null;
}

export default function LokasjonerSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  // Hent bygninger for valgt prosjekt
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
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

  // Hent detaljer for valgt tegning (for å få fileUrl)
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
          // Funksjonalitet implementeres ved behov
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
  }, []);

  // Håndter lukking av tegning
  const håndterLukkTegning = useCallback(() => {
    setValgtTegningId(null);
  }, []);

  // Håndter avbryt i bottom sheet
  const håndterAvbryt = useCallback(() => {
    setValgtTegningId(null);
    setValgtBygningId(null);
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
      {/* Grønn filterbar */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <Pressable className="flex-row items-center gap-1">
          <Text className="text-base font-semibold text-white">Oppgaver</Text>
          <ChevronDown size={18} color="#ffffff" />
        </Pressable>
        <Pressable onPress={visTreprikkmeny} hitSlop={12}>
          <MoreVertical size={20} color="#ffffff" />
        </Pressable>
      </View>

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
    </SafeAreaView>
  );
}
