import { View, Text, Pressable, Linking } from "react-native";
import { MapPin, ExternalLink } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

// Merk: I mobilappen henter vi prosjektdata fra kontekst utenfor denne komponenten.
// Komponentens props inkluderer prosjektdata som del av config.
// I første omgang viser vi en statisk visning basert på config-verdier.

export function LokasjonObjekt({ objekt }: RapportObjektProps) {
  const config = objekt.config;
  const latitude = config.prosjektLatitude as number | undefined;
  const longitude = config.prosjektLongitude as number | undefined;
  const adresse = config.prosjektAdresse as string | undefined;

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
      {adresse && (
        <Text className="text-sm text-gray-700">{adresse}</Text>
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
