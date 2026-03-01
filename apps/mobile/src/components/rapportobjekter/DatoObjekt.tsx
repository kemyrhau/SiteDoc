import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

export function DatoObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [visVelger, settVisVelger] = useState(false);
  const datoVerdi = typeof verdi === "string" ? new Date(verdi) : null;

  const formaterDato = (dato: Date) =>
    dato.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

  return (
    <View>
      <Pressable
        onPress={() => !leseModus && settVisVelger(true)}
        className={`flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <Calendar size={18} color="#6b7280" />
        <Text className={`text-sm ${datoVerdi ? "text-gray-900" : "text-gray-400"}`}>
          {datoVerdi ? formaterDato(datoVerdi) : "Velg dato..."}
        </Text>
      </Pressable>

      {visVelger && (
        <DateTimePicker
          value={datoVerdi ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, valgtDato) => {
            settVisVelger(Platform.OS === "ios");
            if (valgtDato) onEndreVerdi(valgtDato.toISOString());
          }}
        />
      )}
    </View>
  );
}
