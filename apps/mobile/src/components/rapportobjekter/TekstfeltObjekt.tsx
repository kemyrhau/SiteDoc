import { TextInput } from "react-native";
import type { RapportObjektProps } from "./typer";

export function TekstfeltObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const erFlerlinjet = objekt.config.multiline === true;

  return (
    <TextInput
      value={typeof verdi === "string" ? verdi : ""}
      onChangeText={(tekst) => onEndreVerdi(tekst)}
      placeholder="Skriv inn tekst..."
      multiline={erFlerlinjet}
      numberOfLines={erFlerlinjet ? 4 : 1}
      textAlignVertical={erFlerlinjet ? "top" : "center"}
      editable={!leseModus}
      className={`rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 ${
        erFlerlinjet ? "min-h-[100px]" : ""
      } ${leseModus ? "bg-gray-50 text-gray-500" : ""}`}
    />
  );
}
