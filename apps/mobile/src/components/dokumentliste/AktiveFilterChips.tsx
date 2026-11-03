import { View, Text, Pressable } from "react-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/**
 * Fjernbare filter-chips + «Viser N av M — nullstill filter» over dokumentlista
 * (fabel-designlås pkt 6): aldri usynlig AT lista er filtrert.
 */
export function AktiveFilterChips({
  chips,
  synlige,
  totalt,
  onFjern,
  onNullstill,
}: {
  chips: { kolId: string; value: string; label: string }[];
  synlige: number;
  totalt: number;
  onFjern: (kolId: string, value: string) => void;
  onNullstill: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="border-b border-gray-100 bg-white px-4 py-2">
      <View className="flex-row flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Pressable
            key={`${chip.kolId}:${chip.value}`}
            onPress={() => onFjern(chip.kolId, chip.value)}
            className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1"
          >
            <Text className="text-xs font-medium text-sitedoc-primary">{chip.label}</Text>
            <X size={12} color="#1e40af" />
          </Pressable>
        ))}
      </View>
      <Text className="mt-1.5 text-xs text-gray-500">
        {t("dokumentsok.viserAvTotalt", { synlige, totalt })}
        {" — "}
        <Text className="font-semibold text-sitedoc-primary" onPress={onNullstill}>
          {t("dokumentsok.nullstillFilter")}
        </Text>
      </Text>
    </View>
  );
}
