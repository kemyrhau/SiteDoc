import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Calendar, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { DatoVelgerFelt } from "../DatoVelgerFelt";
import type { RapportObjektProps } from "./typer";

export function DatoObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const [visVelger, settVisVelger] = useState(false);
  const datoVerdi = typeof verdi === "string" ? new Date(verdi) : null;

  const formaterDato = (dato: Date) =>
    dato.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

  const erIDag = (dato: Date) => {
    const iDag = new Date();
    return (
      dato.getDate() === iDag.getDate() &&
      dato.getMonth() === iDag.getMonth() &&
      dato.getFullYear() === iDag.getFullYear()
    );
  };

  const haandterTrykk = () => {
    if (leseModus) return;
    if (!datoVerdi) {
      onEndreVerdi(new Date().toISOString());
    }
    settVisVelger(true);
  };

  const settIDag = () => {
    onEndreVerdi(new Date().toISOString());
  };

  const fjernVerdi = () => {
    onEndreVerdi(null);
    settVisVelger(false);
  };

  return (
    <View>
      <Pressable
        onPress={haandterTrykk}
        className={`flex-row items-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <Calendar size={18} color="#6b7280" />
        <Text className={`ml-2 flex-1 text-sm ${datoVerdi ? "text-gray-900" : "text-gray-400"}`}>
          {datoVerdi ? formaterDato(datoVerdi) : t("felt.velgDato")}
        </Text>
        {datoVerdi && !leseModus && (
          <Pressable onPress={fjernVerdi} hitSlop={8}>
            <X size={16} color="#9ca3af" />
          </Pressable>
        )}
      </Pressable>

      {!leseModus && !datoVerdi && (
        <Pressable onPress={settIDag} className="mt-1 ml-1">
          <Text className="text-sm text-blue-600">{t("felt.idag")}</Text>
        </Pressable>
      )}
      {datoVerdi && !leseModus && !erIDag(datoVerdi) && (
        <Pressable onPress={settIDag} className="mt-1 ml-1">
          <Text className="text-sm text-blue-600">{t("felt.idag")}</Text>
        </Pressable>
      )}

      {visVelger && (
        <DatoVelgerFelt
          value={datoVerdi ?? new Date()}
          mode="date"
          onChange={(_event, valgtDato) => {
            if (Platform.OS !== "ios") settVisVelger(false); // Android-dialogen lukker seg selv
            if (valgtDato) onEndreVerdi(valgtDato.toISOString());
          }}
          onLukk={() => settVisVelger(false)}
        />
      )}
    </View>
  );
}
