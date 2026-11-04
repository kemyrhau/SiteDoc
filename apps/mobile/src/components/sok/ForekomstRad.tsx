import { View, Text, Pressable } from "react-native";
import { ChevronUp, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/** Bunnrad i chunk-leseren (spec § 3 B): ▲▼ «n av m» med rundgang + «Åpne dokumentet». */
export function ForekomstRad({
  aktiv,
  antall,
  onForrige,
  onNeste,
  onÅpneDokument,
}: {
  aktiv: number | null;
  antall: number;
  onForrige: () => void;
  onNeste: () => void;
  onÅpneDokument: () => void;
}) {
  const { t } = useTranslation();
  const av = antall === 0;
  return (
    <View className="flex-row items-center gap-3 border-t border-gray-200 bg-white px-4 py-2.5">
      <Pressable
        onPress={onForrige}
        disabled={av}
        hitSlop={8}
        accessibilityLabel={t("ftdSok.forrigeTreff")}
        className="rounded-md border border-gray-200 p-1.5"
      >
        <ChevronUp size={18} color={av ? "#d1d5db" : "#374151"} />
      </Pressable>
      <Pressable
        onPress={onNeste}
        disabled={av}
        hitSlop={8}
        accessibilityLabel={t("ftdSok.nesteTreff")}
        className="rounded-md border border-gray-200 p-1.5"
      >
        <ChevronDown size={18} color={av ? "#d1d5db" : "#374151"} />
      </Pressable>
      <Text className="text-sm text-gray-600">
        {t("ftdSok.tellerForekomst", { n: aktiv != null ? aktiv + 1 : "–", m: antall })}
      </Text>
      <View className="flex-1" />
      <Pressable onPress={onÅpneDokument} className="rounded-lg bg-sitedoc-blue px-3 py-2">
        <Text className="text-sm font-medium text-white">{t("sokMobil.aapneDokumentet")}</Text>
      </Pressable>
    </View>
  );
}
