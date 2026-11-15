import { View, Text } from "react-native";
import { Calendar } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { UkeTotal } from "../services/timerListeLokal";

/**
 * UkeTotalBanner — viser innværende ukes totalsum (Runde 2.7 2026-05-02).
 *
 * Mobil-versjonen av ukesoppsummering. Beregnes lokalt fra Drizzle-cache for
 * valgt firma (POST 2026-11-15 (14)); ingen server-kall. (16) punkt 5: summen
 * leses av DagsseddelListe i `lesAlt` (fokus, synk, dra-ned) — en memo på
 * [userId, orgId] her ble stående gammel etter lagring av en seddel.
 *
 * Vises øverst i timer-listen for å gi brukeren rask oversikt over uka
 * uten å måtte navigere eller scrolle.
 */
export function UkeTotalBanner({ totalt, antall, ukeNr }: UkeTotal) {
  const { t } = useTranslation();

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
