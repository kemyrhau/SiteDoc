import { useState } from "react";
import { View, Text, Pressable, Modal, SafeAreaView } from "react-native";
import { Target, X } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";
import type { TegningPosisjonVerdi } from "@siteflow/shared";

export function TegningPosisjonObjekt({
  verdi,
  onEndreVerdi,
  leseModus,
}: RapportObjektProps) {
  const posisjon = verdi as TegningPosisjonVerdi | null;
  const [_modalSynlig, _setModalSynlig] = useState(false);

  // Forenklet mobilversjon — viser posisjonsinformasjon
  // Full implementasjon med TegningsVisning og tegningsvelger kommer i neste iterasjon

  if (leseModus && posisjon) {
    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Target size={16} color="#6b7280" />
          <Text className="text-sm text-gray-700">
            {posisjon.drawingName}
          </Text>
        </View>
        <Text className="text-xs text-gray-500">
          Posisjon: {posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%
        </Text>
      </View>
    );
  }

  if (leseModus) {
    return (
      <Text className="text-sm italic text-gray-400">
        Ingen posisjon valgt
      </Text>
    );
  }

  return (
    <View className="gap-3">
      {posisjon ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Target size={16} color="#6b7280" />
            <Text className="flex-1 text-sm text-gray-700">
              {posisjon.drawingName}
            </Text>
            <Pressable
              onPress={() => onEndreVerdi(null)}
              className="rounded-full bg-gray-100 p-1"
            >
              <X size={14} color="#6b7280" />
            </Pressable>
          </View>
          <Text className="text-xs text-gray-500">
            Posisjon: {posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%
          </Text>
        </View>
      ) : (
        <View className="items-center rounded-lg border border-dashed border-gray-300 px-4 py-6">
          <Target size={24} color="#9ca3af" />
          <Text className="mt-2 text-sm text-gray-500">
            Velg tegning og marker posisjon
          </Text>
          <Text className="text-xs text-gray-400">
            Funksjonen er tilgjengelig i en kommende oppdatering
          </Text>
        </View>
      )}

      {/* Placeholder Modal for full tegningsvelger */}
      <Modal visible={false} animationType="slide">
        <SafeAreaView className="flex-1 bg-white">
          <Text>Tegningsvelger — kommer</Text>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
