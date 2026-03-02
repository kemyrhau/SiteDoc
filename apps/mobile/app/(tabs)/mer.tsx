import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import {
  Settings,
  Printer,
  Download,
  Users,
  Building2,
  WifiOff,
  QrCode,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { useAuth } from "../../src/providers/AuthProvider";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { trpc } from "../../src/lib/trpc";

export default function MerSkjerm() {
  const { bruker, loggUt } = useAuth();
  const { valgtProsjektId } = useProsjekt();

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const erAdmin = medlemmer?.some(
    (m) => m.user.email === bruker?.email && m.role === "admin",
  );

  const initialer = bruker?.name
    ? bruker.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">Mer</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Prosjekthandlinger */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Prosjekt
            </Text>
          </View>
          <MenyRad
            ikon={Settings}
            tekst="Prosjektinnstillinger"
            deaktivert={!erAdmin}
            onPress={() => {
              if (!erAdmin) {
                Alert.alert(
                  "Ingen tilgang",
                  "Kun prosjektadministratorer har tilgang til prosjektinnstillinger.",
                );
              }
            }}
          />
          <MenyRad
            ikon={Printer}
            tekst="Skriv ut"
            onPress={() => {
              Alert.alert("Skriv ut", "Utskriftsfunksjonalitet kommer snart.");
            }}
          />
          <MenyRad
            ikon={Download}
            tekst="Eksporter"
            onPress={() => {
              Alert.alert("Eksporter", "Eksportfunksjonalitet kommer snart.");
            }}
          />
        </View>

        {/* Generelt */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Generelt
            </Text>
          </View>
          <MenyRad ikon={Users} tekst="Kontakter" />
          <MenyRad ikon={Building2} tekst="Grupper" />
          <MenyRad ikon={WifiOff} tekst="Forbered til offline" />
          <MenyRad ikon={QrCode} tekst="Skann QR-kode" />
        </View>

        {/* Brukerprofil */}
        <View className="mx-4 mt-6 rounded-xl bg-white p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-siteflow-blue">
              <Text className="text-base font-bold text-white">
                {initialer}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {bruker?.name ?? "Ukjent bruker"}
              </Text>
              <Text className="text-sm text-gray-500">
                {bruker?.email ?? ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Logg ut */}
        <View className="mx-4 mt-6">
          <Pressable
            onPress={loggUt}
            className="items-center rounded-lg bg-red-50 py-3 active:bg-red-100"
          >
            <View className="flex-row items-center gap-2">
              <LogOut size={18} color="#ef4444" />
              <Text className="text-base font-medium text-red-600">
                Logg ut
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenyRad({
  ikon: Ikon,
  tekst,
  deaktivert,
  onPress,
}: {
  ikon: LucideIcon;
  tekst: string;
  deaktivert?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
      style={deaktivert ? { opacity: 0.4 } : undefined}
    >
      <View className="flex-row items-center gap-3">
        <Ikon size={20} color="#6b7280" />
        <Text className="text-base text-gray-900">{tekst}</Text>
      </View>
      <ChevronRight size={18} color="#d1d5db" />
    </Pressable>
  );
}
