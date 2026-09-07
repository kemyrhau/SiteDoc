import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { TRAFIKKLYS_VALG } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

// Fargeklasser per verdi — plattform-lokalt. Verdisett + etiketter bor i @sitedoc/shared
// (TRAFIKKLYS_VALG), delt med web; her bor bare fargene.
const FARGE: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
  gray: { aktiv: "bg-gray-400", inaktiv: "bg-gray-200" },
};

export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <View className="flex-row items-start gap-2 py-2">
      {TRAFIKKLYS_VALG.map(({ value, i18nKey }) => {
        const erValgt = valgtVerdi === value;
        const farge = FARGE[value]!;
        return (
          // Trykkflate 44px høy (del6b hit-target); synlig prikk 24px + navnet UNDER (fabel-vedtak:
          // navnet vises alltid ved fargen — mobil hadde ingen tekst i det hele tatt).
          <Pressable
            key={value}
            onPress={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : value);
            }}
            className="w-14 items-center"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full">
              <View className={`h-6 w-6 rounded-full ${erValgt ? farge.aktiv : farge.inaktiv} ${erValgt ? "border-2 border-gray-800" : ""}`} />
            </View>
            <Text className={`text-center text-[10px] leading-tight ${erValgt ? "font-medium text-gray-800" : "text-gray-500"}`}>
              {t(i18nKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
