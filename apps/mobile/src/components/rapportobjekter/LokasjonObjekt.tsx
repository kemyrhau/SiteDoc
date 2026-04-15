import { View, Text } from "react-native";
import { MapPin } from "lucide-react-native";
import { trpc } from "../../lib/trpc";
import type { RapportObjektProps } from "./typer";

export function LokasjonObjekt({ verdi, prosjektId }: RapportObjektProps) {
  // Lokasjon-verdi: bygning + tegning-tekst (f.eks. "NRK · AG-01-01 Gulvbehandling")
  const lokasjonTekst = typeof verdi === "string" && verdi ? verdi : null;

  // Fallback til prosjektadresse hvis ingen dokumentlokasjon
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId && !lokasjonTekst },
  );

  const visTekst = lokasjonTekst ?? prosjekt?.address ?? null;

  if (!visTekst) return null;

  return (
    <View className="flex-row items-center gap-2 px-1 py-1">
      <MapPin size={14} color="#6b7280" />
      <Text className="text-sm text-gray-700">{visTekst}</Text>
    </View>
  );
}
