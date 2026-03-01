import { View, Text } from "react-native";
import { AlertCircle } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

export function UkjentObjekt({ objekt }: RapportObjektProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2.5">
      <AlertCircle size={16} color="#d97706" />
      <Text className="text-sm text-yellow-700">
        Felttype «{objekt.type}» er ikke støttet ennå
      </Text>
    </View>
  );
}
