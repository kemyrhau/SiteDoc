import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CheckCircle, XCircle } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";

/** Quiz-spørsmål med riktig/feil-feedback — for PSI */
export function QuizObjekt({ objekt, verdi, onEndreVerdi }: RapportObjektProps) {
  const spørsmål = (objekt.config.question as string) ?? objekt.label;
  const alternativer = (objekt.config.options as string[]) ?? [];
  const riktigIndex = (objekt.config.correctIndex as number) ?? 0;
  const [valgt, setValgt] = useState<number | null>(verdi as number | null);
  const [harSjekket, setHarSjekket] = useState(false);

  const erRiktig = valgt === riktigIndex;

  const velg = (index: number) => {
    if (harSjekket && erRiktig) return; // Allerede besvart riktig
    setValgt(index);
    setHarSjekket(false);
  };

  const sjekk = () => {
    if (valgt === null) return;
    setHarSjekket(true);
    if (valgt === riktigIndex) {
      onEndreVerdi(valgt); // Lagre riktig svar
    }
  };

  return (
    <View className="my-3 rounded-xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-base font-semibold text-gray-900">{spørsmål}</Text>

      {alternativer.map((alt, i) => {
        const erValgtAlternativ = valgt === i;
        const visRiktig = harSjekket && i === riktigIndex;
        const visFeil = harSjekket && erValgtAlternativ && !erRiktig;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => velg(i)}
            disabled={harSjekket && erRiktig}
            className={`mb-2 flex-row items-center rounded-lg border px-4 py-3 ${
              visRiktig
                ? "border-green-500 bg-green-50"
                : visFeil
                  ? "border-red-400 bg-red-50"
                  : erValgtAlternativ
                    ? "border-sitedoc-primary bg-blue-50"
                    : "border-gray-200 bg-white"
            }`}
          >
            <View className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
              erValgtAlternativ ? "border-sitedoc-primary bg-sitedoc-primary" : "border-gray-300"
            }`}>
              {erValgtAlternativ && <View className="h-2 w-2 rounded-full bg-white" />}
            </View>
            <Text className={`flex-1 text-sm ${
              visRiktig ? "font-medium text-green-700" : visFeil ? "text-red-600" : "text-gray-800"
            }`}>
              {alt}
            </Text>
            {visRiktig && <CheckCircle size={18} color="#16a34a" />}
            {visFeil && <XCircle size={18} color="#ef4444" />}
          </TouchableOpacity>
        );
      })}

      {!harSjekket && valgt !== null && (
        <TouchableOpacity
          onPress={sjekk}
          className="mt-1 items-center rounded-lg bg-sitedoc-primary py-2.5"
        >
          <Text className="text-sm font-medium text-white">Sjekk svar</Text>
        </TouchableOpacity>
      )}

      {harSjekket && !erRiktig && (
        <Text className="mt-2 text-center text-sm text-red-600">
          Feil svar — prøv igjen
        </Text>
      )}

      {harSjekket && erRiktig && (
        <Text className="mt-2 text-center text-sm text-green-600">
          ✓ Riktig!
        </Text>
      )}
    </View>
  );
}
