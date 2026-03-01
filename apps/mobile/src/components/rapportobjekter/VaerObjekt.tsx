import { View, Text, TextInput } from "react-native";
import type { RapportObjektProps } from "./typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
}

export function VaerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const vaerVerdi = (verdi as VaerVerdi) ?? {};

  const oppdater = (felt: keyof VaerVerdi, nyVerdi: string) => {
    onEndreVerdi({ ...vaerVerdi, [felt]: nyVerdi });
  };

  return (
    <View className="gap-3">
      <View>
        <Text className="mb-1 text-xs font-medium text-gray-600">Temperatur</Text>
        <TextInput
          value={vaerVerdi.temp ?? ""}
          onChangeText={(t) => oppdater("temp", t)}
          placeholder="f.eks. 15°C"
          editable={!leseModus}
          className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ${
            leseModus ? "bg-gray-50 text-gray-500" : ""
          }`}
        />
      </View>
      <View>
        <Text className="mb-1 text-xs font-medium text-gray-600">Forhold</Text>
        <TextInput
          value={vaerVerdi.conditions ?? ""}
          onChangeText={(t) => oppdater("conditions", t)}
          placeholder="f.eks. Overskyet"
          editable={!leseModus}
          className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ${
            leseModus ? "bg-gray-50 text-gray-500" : ""
          }`}
        />
      </View>
      <View>
        <Text className="mb-1 text-xs font-medium text-gray-600">Vind</Text>
        <TextInput
          value={vaerVerdi.wind ?? ""}
          onChangeText={(t) => oppdater("wind", t)}
          placeholder="f.eks. 5 m/s NV"
          editable={!leseModus}
          className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ${
            leseModus ? "bg-gray-50 text-gray-500" : ""
          }`}
        />
      </View>
    </View>
  );
}
