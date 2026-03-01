import { View, Text, Pressable } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";
import type { FeltVerdi } from "../../hooks/useSjekklisteSkjema";

// Forenkling: Repeater-rader er en array av Record<string, FeltVerdi>
type RepeaterVerdi = Array<Record<string, FeltVerdi>>;

export function RepeaterObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const rader = Array.isArray(verdi) ? (verdi as RepeaterVerdi) : [];
  const barneObjekter = (objekt.config.children as Array<{ id: string; type: string; label: string }>) ?? [];

  const leggTilRad = () => {
    const nyRad: Record<string, FeltVerdi> = {};
    for (const barn of barneObjekter) {
      nyRad[barn.id] = { verdi: null, kommentar: "", vedlegg: [] };
    }
    onEndreVerdi([...rader, nyRad]);
  };

  const fjernRad = (indeks: number) => {
    onEndreVerdi(rader.filter((_, i) => i !== indeks));
  };

  return (
    <View className="gap-3">
      {rader.map((rad, indeks) => (
        <View key={indeks} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-medium text-gray-500">Rad {indeks + 1}</Text>
            {!leseModus && (
              <Pressable onPress={() => fjernRad(indeks)} hitSlop={8}>
                <Trash2 size={16} color="#ef4444" />
              </Pressable>
            )}
          </View>
          {barneObjekter.map((barn) => (
            <View key={barn.id} className="mb-2">
              <Text className="mb-1 text-xs text-gray-600">{barn.label}</Text>
              <Text className="text-sm text-gray-400">
                {String(rad[barn.id]?.verdi ?? "—")}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {!leseModus && (
        <Pressable
          onPress={leggTilRad}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-3"
        >
          <Plus size={16} color="#6b7280" />
          <Text className="text-sm text-gray-600">Legg til rad</Text>
        </Pressable>
      )}
    </View>
  );
}
