import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { timerStatusEtikett } from "@sitedoc/shared";
import { variantKlasse } from "../statusFarger";

/**
 * Liten badge for per-rad attesteringsstatus.
 * Del 7: farge + ord fra den DELTE kilden (timerStatusEtikett → variantKlasse),
 * samme som webs rad-badge. Ingen hardkodet fargetabell. null → «Venter».
 */
export function AttesteringStatusBadge({
  status,
}: {
  status: string | null;
}) {
  const { t } = useTranslation();
  const { variant, etikettKey } = timerStatusEtikett(status ?? "pending");
  const stil = variantKlasse(variant);
  return (
    <View className={`rounded-full px-2 py-0.5 ${stil.bg}`}>
      <Text className={`text-xs font-medium ${stil.tekstFarge}`}>
        {t(etikettKey)}
      </Text>
    </View>
  );
}
