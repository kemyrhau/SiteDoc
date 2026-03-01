import { View, Text, TextInput } from "react-native";
import type { RapportObjektProps } from "./typer";

export function HeltallObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const enhet = (objekt.config.unit as string) ?? "";

  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={verdi != null ? String(verdi) : ""}
        onChangeText={(tekst) => {
          const renset = tekst.replace(/[^0-9-]/g, "");
          if (renset === "" || renset === "-") {
            onEndreVerdi(null);
          } else {
            const tall = parseInt(renset, 10);
            if (!isNaN(tall)) onEndreVerdi(tall);
          }
        }}
        placeholder="0"
        keyboardType="number-pad"
        editable={!leseModus}
        className={`min-w-[100px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 ${
          leseModus ? "bg-gray-50 text-gray-500" : ""
        }`}
      />
      {enhet ? <Text className="text-sm text-gray-600">{enhet}</Text> : null}
    </View>
  );
}
