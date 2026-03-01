import { View, Text } from "react-native";
import type { RapportObjektProps } from "./typer";

export function BeregningObjekt({ objekt, verdi }: RapportObjektProps) {
  const enhet = (objekt.config.unit as string) ?? "";
  const visVerdi = verdi != null ? String(verdi) : "—";

  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
      <Text className="text-sm font-medium text-gray-700">{visVerdi}</Text>
      {enhet ? <Text className="text-sm text-gray-500">{enhet}</Text> : null}
    </View>
  );
}
