import { View, Text, TextInput, Pressable } from "react-native";
import { Cloud, Pencil } from "lucide-react-native";
import { useState } from "react";
import type { RapportObjektProps } from "./typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
}

function formaterVaerTekst(v: VaerVerdi): string {
  const deler: string[] = [];
  if (v.temp) deler.push(v.temp);
  if (v.conditions) deler.push(v.conditions.toLowerCase());
  if (v.wind) deler.push(`vind ${v.wind}`);
  if (v.precipitation && v.precipitation !== "0 mm") deler.push(`nedbør ${v.precipitation}`);
  return deler.join(", ");
}

export function VaerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const vaerVerdi = (verdi as VaerVerdi) ?? {};
  const [redigerer, settRedigerer] = useState(false);
  const harVerdi = !!(vaerVerdi.temp || vaerVerdi.conditions || vaerVerdi.wind || vaerVerdi.precipitation);

  const oppdater = (felt: keyof VaerVerdi, nyVerdi: string) => {
    onEndreVerdi({ ...vaerVerdi, [felt]: nyVerdi, kilde: "manuell" as const });
  };

  // Kompakt visning (standard)
  if (!redigerer) {
    return (
      <View className="flex-row items-center gap-2">
        <Cloud size={16} color="#6b7280" />
        <Text className={`flex-1 text-sm ${harVerdi ? "text-gray-900" : "text-gray-400"}`}>
          {harVerdi ? formaterVaerTekst(vaerVerdi) : "Ingen værdata"}
        </Text>
        {!leseModus && (
          <Pressable onPress={() => settRedigerer(true)} hitSlop={8}>
            <Pencil size={14} color="#9ca3af" />
          </Pressable>
        )}
      </View>
    );
  }

  // Redigeringsmodus — kompakte felt på én rad
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <TextInput
          value={vaerVerdi.temp ?? ""}
          onChangeText={(t) => oppdater("temp", t)}
          placeholder="Temp"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
        <TextInput
          value={vaerVerdi.conditions ?? ""}
          onChangeText={(t) => oppdater("conditions", t)}
          placeholder="Forhold"
          className="flex-[2] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
      </View>
      <View className="flex-row gap-2">
        <TextInput
          value={vaerVerdi.wind ?? ""}
          onChangeText={(t) => oppdater("wind", t)}
          placeholder="Vind"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
        <TextInput
          value={vaerVerdi.precipitation ?? ""}
          onChangeText={(t) => oppdater("precipitation", t)}
          placeholder="Nedbør"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
      </View>
      <Pressable onPress={() => settRedigerer(false)}>
        <Text className="text-sm text-blue-600">Ferdig</Text>
      </Pressable>
    </View>
  );
}
