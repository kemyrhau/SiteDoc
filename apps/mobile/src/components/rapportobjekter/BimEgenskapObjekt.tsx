import { TextInput } from "react-native";
import type { RapportObjektProps } from "./typer";

export function BimEgenskapObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const placeholder = (objekt.config.propertyName as string) || "BIM-egenskap...";

  return (
    <TextInput
      value={typeof verdi === "string" ? verdi : ""}
      onChangeText={(tekst) => onEndreVerdi(tekst)}
      placeholder={placeholder}
      editable={!leseModus}
      className={`rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 ${
        leseModus ? "bg-gray-50 text-gray-500" : ""
      }`}
    />
  );
}
