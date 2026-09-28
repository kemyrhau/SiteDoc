import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { trafikklysOpsjoner, oversettStandardtekst, ukjentTrafikklysVerdi } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

// Fargeklasser per verdi — plattform-lokalt. Verdisett + rekkefølge kommer fra feltets
// `config.options` (via trafikklysOpsjoner) eller kanonisk sett — delt regel med web; her bor
// bare fargene, nøklet på verdi.
const FARGE: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
  gray: { aktiv: "bg-gray-400", inaktiv: "bg-gray-200" },
};

export function TrafikklysObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const valgtVerdi = typeof verdi === "string" ? verdi : null;
  const foreldreloes = ukjentTrafikklysVerdi(verdi);

  // Feltets eget lyssett (delmengde/rekkefølge/egen etikett) når det finnes, ellers kanonisk.
  const valg = trafikklysOpsjoner(objekt.config?.options);

  return (
    <View className="flex-row items-start gap-2 py-2">
      {valg.map(({ value, tekst, erI18nNokkel }) => {
        const erValgt = valgtVerdi === value;
        const farge = FARGE[value] ?? FARGE.gray!;
        // Seedet standardtekst → oversett; firmaets egen streng → rå; kanonisk → i18n-nøkkel.
        const label = erI18nNokkel ? t(tekst) : oversettStandardtekst(tekst, t) ?? tekst;
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
              {label}
            </Text>
          </Pressable>
        );
      })}
      {foreldreloes !== null && (
        // Deaktivert brikke med den RÅ verdien — et lagret svar skal aldri forsvinne stille.
        <View className="w-14 items-center">
          <View className="h-11 w-11 items-center justify-center rounded-full">
            <View className="h-6 w-6 rounded-full border-2 border-dashed border-gray-400 bg-gray-100" />
          </View>
          <Text className="text-center text-[10px] leading-tight font-medium text-gray-700">
            {foreldreloes}
          </Text>
          {/* Synlig mikrotekst — samme ordlyd som arkiv-PDF-en (mobil har ingen hover å gjemme den i). */}
          <Text className="text-center text-[9px] leading-tight text-gray-500">
            {t("rapportobjekt.ikkeGyldigValg")}
          </Text>
        </View>
      )}
    </View>
  );
}
