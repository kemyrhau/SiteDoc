import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

interface SummeringsBannerProps {
  totaltimer: number;
  /**
   * Norm = sesongjustert dagsnorm (fase-0:1041), decouplet fra arbeidstid-
   * vinduet. null = ukjent (grå safety-fallback). En kort dag er gyldig (blå).
   */
  normTimer: number | null;
  /** Sum maskintimer på tvers av prosjekter — vises som «herav» når > 0. */
  maskinTimer?: number;
}

export function SummeringsBanner({
  totaltimer,
  normTimer,
  maskinTimer,
}: SummeringsBannerProps) {
  const { t } = useTranslation();

  // Tre-veis trafikklys relativt til dagsnorm: grønn = treffer, gul = over
  // (overtid), blå = under (akseptert kort dag). Rund KUN for farge-beslutningen
  // (nærmeste 15 min — T.5-konsistent); vist tall er uendret. Grønn-band ±7,5 min.
  const rundet = Math.round(totaltimer * 4) / 4;
  const sone =
    normTimer === null
      ? "grå"
      : Math.abs(rundet - normTimer) < 0.001
        ? "grønn"
        : rundet > normTimer
          ? "gul"
          : "blå";

  const stil =
    sone === "grå"
      ? "border-gray-200 bg-gray-50"
      : sone === "grønn"
        ? "border-green-200 bg-green-50"
        : sone === "gul"
          ? "border-yellow-200 bg-yellow-50"
          : "border-blue-200 bg-blue-50";

  const tekstFarge =
    sone === "grå"
      ? "text-gray-600"
      : sone === "grønn"
        ? "text-green-700"
        : sone === "gul"
          ? "text-yellow-800"
          : "text-blue-700";

  return (
    <View className={`rounded-lg border p-3 ${stil}`}>
      <Text className={`text-sm ${tekstFarge}`}>
        {t("timer.summering", {
          registrert: totaltimer.toFixed(2),
          total: normTimer === null ? "?" : normTimer.toFixed(2),
        })}
      </Text>
      {maskinTimer !== undefined && maskinTimer > 0 && (
        <Text className={`mt-0.5 text-xs ${tekstFarge}`}>
          {t("timer.summering.heravMaskin", {
            maskin: maskinTimer.toFixed(2),
          })}
        </Text>
      )}
    </View>
  );
}
