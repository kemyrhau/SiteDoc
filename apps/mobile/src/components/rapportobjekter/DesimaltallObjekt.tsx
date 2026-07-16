import { View, Text, TextInput } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { normaliserGrense, formaterGrense, grenseStatus } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

export function DesimaltallObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const grense = normaliserGrense(objekt.config);
  const status = grenseStatus(verdi, grense);
  const utenfor = status !== null && status !== "ok";
  const grenseTekst = formaterGrense(grense);

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={verdi != null ? String(verdi) : ""}
          onChangeText={(tekst) => {
            const renset = tekst.replace(/[^0-9.,-]/g, "").replace(",", ".");
            if (renset === "" || renset === "-" || renset === ".") {
              onEndreVerdi(null);
            } else {
              const tall = parseFloat(renset);
              if (!isNaN(tall)) onEndreVerdi(tall);
            }
          }}
          placeholder="0.0"
          keyboardType="decimal-pad"
          editable={!leseModus}
          className={`min-w-[100px] flex-1 rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 ${
            utenfor ? "border-amber-500" : "border-gray-300"
          } ${leseModus ? "bg-gray-50 text-gray-500" : ""}`}
        />
        {grense.enhet ? <Text className="text-sm text-gray-600">{grense.enhet}</Text> : null}
      </View>
      {grenseTekst ? (
        <View className="flex-row items-center gap-1">
          {utenfor ? <AlertTriangle size={12} color="#d97706" /> : null}
          <Text className={`text-xs ${utenfor ? "font-medium text-amber-600" : "text-gray-400"}`}>
            {grenseTekst}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
