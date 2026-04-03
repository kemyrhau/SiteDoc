import { Text } from "react-native";
import type { RapportObjektProps } from "./typer";

/** Ren lesetekst (ikke redigerbar) — for PSI og instruksjoner */
export function InfoTekstObjekt({ objekt }: RapportObjektProps) {
  const innhold = (objekt.config.content as string) ?? "";
  if (!innhold) return null;

  return (
    <Text className="mb-3 text-base leading-7 text-gray-800">
      {innhold}
    </Text>
  );
}
