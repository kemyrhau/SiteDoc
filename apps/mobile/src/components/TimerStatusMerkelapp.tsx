import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { timerStatusEtikett } from "@sitedoc/shared";
import { variantKlasse } from "./statusFarger";

// Del 7: sedel-statusens farge + ord leses fra den DELTE kilden
// (timerStatusEtikett → variantKlasse), samme som web. Ingen hardkodet
// status-fargetabell igjen. SYNC_MAP under er sync-status (utenfor Del 7 —
// røres ikke: syncStatus/konflikt hører til konflikt-sporet).
const SYNC_MAP: Record<
  string,
  { noekkel: string; bg: string; tekstFarge: string }
> = {
  pending: { noekkel: "timer.sync.venter", bg: "bg-yellow-100", tekstFarge: "text-yellow-800" },
  conflict: { noekkel: "timer.sync.konflikt", bg: "bg-red-100", tekstFarge: "text-red-700" },
  synced: { noekkel: "timer.sync.synkronisert", bg: "bg-green-50", tekstFarge: "text-green-700" },
};

export function TimerStatusMerkelapp({
  status,
  syncStatus,
}: {
  status: string;
  syncStatus?: string;
}) {
  const { t } = useTranslation();
  const { variant, etikettKey } = timerStatusEtikett(status);
  const stilStatus = { ...variantKlasse(variant), noekkel: etikettKey };

  // Sync-status overstyrer kun ved conflict — pending vises ved siden av
  if (syncStatus === "conflict") {
    const stil = SYNC_MAP.conflict;
    return (
      <View className={`rounded-full px-2.5 py-0.5 ${stil.bg}`}>
        <Text className={`text-xs font-medium ${stil.tekstFarge}`}>
          {t(stil.noekkel)}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row gap-1">
      <View className={`rounded-full px-2.5 py-0.5 ${stilStatus.bg}`}>
        <Text className={`text-xs font-medium ${stilStatus.tekstFarge}`}>
          {t(stilStatus.noekkel)}
        </Text>
      </View>
      {syncStatus === "pending" && (
        <View className={`rounded-full px-2.5 py-0.5 ${SYNC_MAP.pending.bg}`}>
          <Text
            className={`text-xs font-medium ${SYNC_MAP.pending.tekstFarge}`}
          >
            {t(SYNC_MAP.pending.noekkel)}
          </Text>
        </View>
      )}
    </View>
  );
}
