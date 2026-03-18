import { View, Text, Pressable, Linking } from "react-native";
import { MapPin, ExternalLink } from "lucide-react-native";
import { trpc } from "../../lib/trpc";
import type { RapportObjektProps } from "./typer";

export function LokasjonObjekt({ prosjektId }: RapportObjektProps) {
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  if (!prosjektId || !prosjekt) {
    return null;
  }

  const latitude = prosjekt.latitude;
  const longitude = prosjekt.longitude;

  if (latitude == null || longitude == null) {
    return (
      <View className="flex-row items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3">
        <MapPin size={16} color="#9ca3af" />
        <Text className="text-sm text-gray-500">
          Prosjektet har ikke satt lokasjon
        </Text>
      </View>
    );
  }

  function åpneIKart() {
    if (latitude == null || longitude == null) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  }

  return (
    <View className="gap-2">
      {prosjekt.address && (
        <Text className="text-sm text-gray-700">{prosjekt.address}</Text>
      )}
      <Text className="text-xs text-gray-500">
        {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </Text>
      <Pressable
        onPress={åpneIKart}
        className="flex-row items-center gap-1 self-start rounded-lg bg-blue-50 px-3 py-2"
      >
        <ExternalLink size={14} color="#1e40af" />
        <Text className="text-sm font-medium text-blue-800">
          Åpne i kart
        </Text>
      </Pressable>
    </View>
  );
}
