import { View, Text, Pressable } from "react-native";
import type { RapportObjektProps } from "./typer";

// Normaliser opsjon — støtter både string og {value, label}-format
function normaliserOpsjon(opsjon: unknown): { value: string; label: string } {
  if (typeof opsjon === "string") return { value: opsjon, label: opsjon };
  if (typeof opsjon === "object" && opsjon !== null) {
    const obj = opsjon as Record<string, unknown>;
    const value = typeof obj.value === "string" ? obj.value : String(obj.value ?? "");
    const label = typeof obj.label === "string" ? obj.label : value;
    return { value, label };
  }
  return { value: String(opsjon), label: String(opsjon) };
}

export function EnkeltvalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <View className="gap-2">
      {alternativer.map((alt, index) => {
        const erValgt = valgtVerdi === alt.value;
        return (
          <Pressable
            key={`${alt.value}-${index}`}
            onPress={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : alt.value);
            }}
            className="flex-row items-center gap-3 py-1"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
              }`}
            >
              {erValgt && <View className="h-2 w-2 rounded-full bg-white" />}
            </View>
            <Text className="text-sm text-gray-900">{alt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
