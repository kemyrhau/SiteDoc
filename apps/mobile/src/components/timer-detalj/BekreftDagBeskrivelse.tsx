import { forwardRef } from "react";
import { View, Text, Pressable, TextInput, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * ORDRE 36a (spec § 3) «Hva gjorde du i dag?» — ett felt pr. prosjekt med
 * arbeid i `/timer/bekreft-dag`. Påkrevd: nøytral ramme til arbeideren har
 * forsøkt å bekrefte med tomt felt (`visFeil`), da rød ramme + mikrotekst.
 * Chip erstatter teksten. Ingenting skrives herfra — teksten holdes i
 * skjermens retting til [Bekreft og lagre].
 */
export const BekreftDagBeskrivelse = forwardRef<
  TextInput,
  {
    prosjektNavn: string | null;
    /** Vis prosjektnavnet i etiketten (flere prosjekter samme dag). */
    visProsjekt: boolean;
    verdi: string;
    chips: string[];
    visFeil: boolean;
    onEndre: (tekst: string) => void;
    onLayout?: (e: LayoutChangeEvent) => void;
  }
>(function BekreftDagBeskrivelse(
  { prosjektNavn, visProsjekt, verdi, chips, visFeil, onEndre, onLayout },
  ref,
) {
  const { t } = useTranslation();
  return (
    <View onLayout={onLayout} className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <Text className="text-sm font-medium text-gray-700">
        {t("timer.bekreftDag.beskrivelse.etikett")}
        {visProsjekt && prosjektNavn ? ` · ${prosjektNavn}` : ""}
      </Text>
      {chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {chips.map((c) => {
            const valgt = c === verdi.trim();
            return (
              <Pressable
                key={c}
                onPress={() => onEndre(c)}
                className={`rounded-full border px-3 py-1 ${valgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
              >
                <Text className={`text-sm ${valgt ? "text-blue-700" : "text-gray-700"}`}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <TextInput
        ref={ref}
        value={verdi}
        onChangeText={onEndre}
        placeholder={t("timer.bekreftDag.beskrivelse.placeholder")}
        multiline
        textAlignVertical="top"
        className={`min-h-[56px] rounded-lg border px-3 py-3 text-base text-gray-900 ${
          visFeil ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
        }`}
      />
      {visFeil ? (
        <Text className="text-xs text-red-700">
          {t("timer.bekreftDag.beskrivelse.paakrevd", { prosjekt: prosjektNavn ?? "" })}
        </Text>
      ) : null}
    </View>
  );
});
