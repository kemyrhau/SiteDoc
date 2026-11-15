import { View, Text, Pressable } from "react-native";
import { MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/**
 * ORDRE (20) linja (2026-11-15): amber linje «Byggeplass ikke valgt · Velg» på dokument-detaljsider.
 * Kalleren avgjør synlighet med `visByggeplassIkkeValgt` (@sitedoc/shared) og hva «Velg» åpner
 * (sjekkliste: lokasjonsmodalen; oppgave: tegningsvelgeren). Mobil har ikke eget byggeplassvalg
 * uten tegning — se mobil.md.
 */
export function ByggeplassIkkeValgtLinje({ onVelg }: { onVelg: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      testID="byggeplass-ikke-valgt"
      accessibilityHint={t("kontekstChip.byggeplassIkkeValgtHjelp")}
      className="flex-row items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
    >
      <MapPin size={16} color="#f59e0b" />
      <Text className="text-sm text-amber-800">{t("kontekstChip.byggeplassIkkeValgt")}</Text>
      <Text className="text-sm text-amber-400">·</Text>
      <Pressable onPress={onVelg} hitSlop={8} accessibilityRole="button">
        <Text className="text-sm font-medium text-amber-900 underline">{t("handling.velg")}</Text>
      </Pressable>
    </View>
  );
}
