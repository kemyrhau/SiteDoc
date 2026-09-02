import { View, Text } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";

export function UkjentObjekt({ objekt }: RapportObjektProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2.5">
      <AlertCircle size={16} color="#d97706" />
      <Text className="text-sm text-yellow-700">
        {t("felt.felttypeIkkeStottet", { type: objekt.type })}
      </Text>
    </View>
  );
}
