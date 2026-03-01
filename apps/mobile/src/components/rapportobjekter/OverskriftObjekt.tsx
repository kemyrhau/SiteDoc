import { Text } from "react-native";
import type { RapportObjektProps } from "./typer";

export function OverskriftObjekt({ objekt }: RapportObjektProps) {
  return (
    <Text className="py-2 text-lg font-bold text-gray-900">
      {objekt.label}
    </Text>
  );
}
