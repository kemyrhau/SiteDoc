import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { normaliserOpsjon, oversettStandardtekst } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

export function FlervalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgteVerdier = Array.isArray(verdi) ? (verdi as string[]) : [];
  // Seedet standard-opsjon → oversett; firmaets egen streng → rå
  const visLabel = (s: string) => oversettStandardtekst(s, t) ?? s;

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
            <Text className="text-sm text-gray-900">{visLabel(alt.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
