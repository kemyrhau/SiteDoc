import { useMemo } from "react";
import { View, Text } from "react-native";
import { Calendar } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { lesUkeTotalLokalt } from "../services/timerListeLokal";

/**
 * UkeTotalBanner — viser innværende ukes totalsum (Runde 2.7 2026-05-02).
 *
 * Mobil-versjonen av ukesoppsummering. Beregnes lokalt fra Drizzle-cache for
 * valgt firma (POST 2026-11-15 (14)); ingen server-kall.
 *
 * Vises øverst i timer-listen for å gi brukeren rask oversikt over uka
 * uten å måtte navigere eller scrolle.
 */
export function UkeTotalBanner({ userId, orgId }: { userId: string; orgId: string | null | undefined }) {
  const { t } = useTranslation();

  // POST (14): bare valgt firma (`lesUkeTotalLokalt`).
  const { totalt, antall, ukeNr } = useMemo(() => lesUkeTotalLokalt(userId, orgId), [userId, orgId]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <Calendar size={14} color="#6b7280" />
      <Text className="flex-1 text-xs text-gray-700">
        {t("timer.banner.uketotal", {
          ukeNr,
          timer: totalt.toFixed(2),
          antall,
        })}
      </Text>
    </View>
  );
}
