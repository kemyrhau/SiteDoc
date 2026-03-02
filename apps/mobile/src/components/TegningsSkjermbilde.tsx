import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, SafeAreaView } from "react-native";
import ViewShot from "react-native-view-shot";
import { Camera, X } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { AUTH_CONFIG } from "../config/auth";
import { TegningsVelger } from "./TegningsVelger";
import { TegningsVisning } from "./TegningsVisning";

interface Bygning {
  id: string;
  name: string;
}

interface Tegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  buildingId: string | null;
  _count: { revisions: number };
}

interface TegningsSkjermbildeProps {
  prosjektId: string;
  onFerdig: (bildeUri: string) => void;
  onAvbryt: () => void;
}

export function TegningsSkjermbilde({ prosjektId, onFerdig, onAvbryt }: TegningsSkjermbildeProps) {
  const [valgtBygningId, settValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, settValgtTegningId] = useState<string | null>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [tarSkjermbilde, settTarSkjermbilde] = useState(false);

  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const bygninger = (bygningQuery.data ?? []) as Bygning[];
  const tegninger = (tegningQuery.data ?? []) as Tegning[];

  // Hent fil-URL for valgt tegning
  const valgtTegningDetalj = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  const tegningRådata = valgtTegningDetalj.data as { fileUrl: string; name: string } | undefined;
  const tegningData = tegningRådata
    ? {
        ...tegningRådata,
        fileUrl: tegningRådata.fileUrl.startsWith("/")
          ? `${AUTH_CONFIG.apiUrl}${tegningRådata.fileUrl}`
          : tegningRådata.fileUrl,
      }
    : undefined;

  const håndterSkjermbilde = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;
    settTarSkjermbilde(true);
    try {
      const uri = await viewShotRef.current.capture();
      onFerdig(uri);
    } catch {
      // Feil ved skjermbilde
    } finally {
      settTarSkjermbilde(false);
    }
  }, [onFerdig]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <Pressable onPress={onAvbryt} hitSlop={12}>
          <X size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-base font-semibold text-white">Velg tegning</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tegningsvisning */}
      <View className="flex-1">
        {tegningData?.fileUrl ? (
          <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ flex: 1 }}>
            <TegningsVisning
              tegningUrl={tegningData.fileUrl}
              tegningNavn={tegningData.name}
              onLukk={() => settValgtTegningId(null)}
            />
          </ViewShot>
        ) : (
          <View className="flex-1 items-center justify-center">
            {valgtTegningDetalj.isLoading ? (
              <ActivityIndicator size="large" color="#1e40af" />
            ) : (
              <Text className="text-sm text-gray-400">
                Velg en tegning fra listen nedenfor
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Skjermbildeknapp (flytende) */}
      {tegningData?.fileUrl && (
        <Pressable
          onPress={håndterSkjermbilde}
          disabled={tarSkjermbilde}
          className="absolute bottom-24 right-4 flex-row items-center gap-2 rounded-full bg-blue-600 px-5 py-3 shadow-lg"
        >
          <Camera size={20} color="#ffffff" />
          <Text className="font-medium text-white">
            {tarSkjermbilde ? "Tar bilde..." : "Ta skjermbilde"}
          </Text>
        </Pressable>
      )}

      {/* Tegningsvelger */}
      <TegningsVelger
        bygninger={bygninger}
        tegninger={tegninger}
        valgtBygningId={valgtBygningId}
        valgtTegningId={valgtTegningId}
        onVelgBygning={settValgtBygningId}
        onVelgTegning={settValgtTegningId}
        onAvbryt={() => {}}
        laster={bygningQuery.isLoading || tegningQuery.isLoading}
      />
    </SafeAreaView>
  );
}
