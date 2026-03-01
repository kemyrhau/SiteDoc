import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Clock } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

export function DatoTidObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [visModus, settVisModus] = useState<"date" | "time" | null>(null);
  const datoVerdi = typeof verdi === "string" ? new Date(verdi) : null;

  const formaterDatoTid = (dato: Date) =>
    `${dato.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })} kl. ${dato.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <View>
      <Pressable
        onPress={() => !leseModus && settVisModus("date")}
        className={`flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 ${
          leseModus ? "bg-gray-50" : ""
        }`}
      >
        <Clock size={18} color="#6b7280" />
        <Text className={`text-sm ${datoVerdi ? "text-gray-900" : "text-gray-400"}`}>
          {datoVerdi ? formaterDatoTid(datoVerdi) : "Velg dato og tid..."}
        </Text>
      </Pressable>

      {visModus && (
        <DateTimePicker
          value={datoVerdi ?? new Date()}
          mode={visModus}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, valgtDato) => {
            if (Platform.OS !== "ios") settVisModus(null);
            if (!valgtDato) return;

            if (visModus === "date") {
              // Behold eksisterende tid hvis tilgjengelig
              const nyDato = datoVerdi ? new Date(datoVerdi) : new Date();
              nyDato.setFullYear(valgtDato.getFullYear(), valgtDato.getMonth(), valgtDato.getDate());
              onEndreVerdi(nyDato.toISOString());
              if (Platform.OS !== "ios") settVisModus("time");
            } else {
              const nyDato = datoVerdi ? new Date(datoVerdi) : new Date();
              nyDato.setHours(valgtDato.getHours(), valgtDato.getMinutes());
              onEndreVerdi(nyDato.toISOString());
              if (Platform.OS === "ios") settVisModus(null);
            }
          }}
        />
      )}
    </View>
  );
}
