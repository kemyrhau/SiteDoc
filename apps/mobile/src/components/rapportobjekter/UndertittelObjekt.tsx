import { Text } from "react-native";
import type { RapportObjektProps } from "./typer";

export function UndertittelObjekt({ objekt }: RapportObjektProps) {
  return (
    <Text className="py-1.5 text-base font-semibold text-gray-700">
      {objekt.label}
    </Text>
  );
}
