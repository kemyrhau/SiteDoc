import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

interface ValgAlternativ {
  value: string;
  label: string;
}

export function FlervalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const alternativer = (objekt.config.options as ValgAlternativ[]) ?? [];
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
      {alternativer.map((alt) => {
        const erValgt = valgteVerdier.includes(alt.value);
        return (
          <Pressable
            key={alt.value}
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
