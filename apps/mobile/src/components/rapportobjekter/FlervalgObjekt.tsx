import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
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

export function FlervalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgteVerdier = Array.isArray(verdi) ? (verdi as string[]) : [];

  const håndterToggle = (alternativVerdi: string) => {
    if (leseModus) return;
    const erValgt = valgteVerdier.includes(alternativVerdi);
    if (erValgt) {
      onEndreVerdi(valgteVerdier.filter((v) => v !== alternativVerdi));
    } else {
      onEndreVerdi([...valgteVerdier, alternativVerdi]);
    }
  };

  return (
    <View className="gap-2">
      {alternativer.map((alt, index) => {
        const erValgt = valgteVerdier.includes(alt.value);
        return (
          <Pressable
            key={`${alt.value}-${index}`}
            onPress={() => håndterToggle(alt.value)}
            className="flex-row items-center gap-3 py-1"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded border-2 ${
                erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
              }`}
            >
              {erValgt && <Check size={14} color="#ffffff" />}
            </View>
            <Text className="text-sm text-gray-900">{alt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
