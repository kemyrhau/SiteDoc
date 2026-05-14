import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

interface SummeringsBannerProps {
  totaltimer: number;
  arbeidstidTimer: number | null;
}

export function SummeringsBanner({
  totaltimer,
  arbeidstidTimer,
}: SummeringsBannerProps) {
  const { t } = useTranslation();

  const stil =
    arbeidstidTimer === null
      ? "border-gray-200 bg-gray-50"
      : totaltimer >= arbeidstidTimer
        ? "border-green-200 bg-green-50"
        : "border-yellow-200 bg-yellow-50";

  const tekstFarge =
    arbeidstidTimer === null
      ? "text-gray-600"
      : totaltimer >= arbeidstidTimer
        ? "text-green-700"
        : "text-yellow-800";

  return (
    <View className={`rounded-lg border p-3 ${stil}`}>
      <Text className={`text-sm ${tekstFarge}`}>
        {t("timer.summering", {
          registrert: totaltimer.toFixed(2),
          total: arbeidstidTimer === null ? "?" : arbeidstidTimer.toFixed(2),
        })}
      </Text>
    </View>
  );
}
