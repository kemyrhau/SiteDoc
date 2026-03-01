import { View, Text, Pressable } from "react-native";
import type { RapportObjektProps } from "./typer";

interface ValgAlternativ {
  value: string;
  label: string;
}

export function EnkeltvalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const alternativer = (objekt.config.options as ValgAlternativ[]) ?? [];
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <View className="gap-2">
      {alternativer.map((alt) => {
        const erValgt = valgtVerdi === alt.value;
        return (
          <Pressable
            key={alt.value}
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
