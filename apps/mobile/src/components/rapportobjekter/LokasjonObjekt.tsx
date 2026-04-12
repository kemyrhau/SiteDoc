import { View, Text } from "react-native";
import { MapPin } from "lucide-react-native";
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

  if (!prosjekt.address) {
    return (
      <View className="flex-row items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3">
        <MapPin size={16} color="#9ca3af" />
        <Text className="text-sm text-gray-500">
          Prosjektet har ikke satt adresse
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2 px-1 py-1">
      <MapPin size={14} color="#6b7280" />
      <Text className="text-sm text-gray-700">{prosjekt.address}</Text>
    </View>
  );
}
