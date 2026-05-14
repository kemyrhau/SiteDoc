import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * Liten badge for per-rad attesteringsstatus.
 * Mønster speiler webs status-badges i AttesteringDetalj.
 */
export function AttesteringStatusBadge({
  status,
}: {
  status: string | null;
}) {
  const { t } = useTranslation();

  if (status === "attestert") {
    return (
      <View className="rounded-full bg-green-100 px-2 py-0.5">
        <Text className="text-xs font-medium text-green-800">
          {t("timer.attestering.radStatus.attestert")}
        </Text>
      </View>
    );
  }
  if (status === "returnert") {
    return (
      <View className="rounded-full bg-red-100 px-2 py-0.5">
        <Text className="text-xs font-medium text-red-800">
          {t("timer.attestering.radStatus.returnert")}
        </Text>
      </View>
    );
  }
  return (
    <View className="rounded-full bg-gray-100 px-2 py-0.5">
      <Text className="text-xs font-medium text-gray-700">
        {t("timer.attestering.radStatus.pending")}
      </Text>
    </View>
  );
}
