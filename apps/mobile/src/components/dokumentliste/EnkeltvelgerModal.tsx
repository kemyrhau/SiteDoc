import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, TextInput } from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet: samme mønster som ByggeplassVelgerModal (simulator-målt 2026-08-31, edges=top).
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export interface VelgerAlternativ {
  value: string;
  label: string;
}

/**
 * Generisk enkelt-select-modal for filter-sheetets nedtrekk (Emne/mal, Ansvarlig,
 * Tegning, Tidsfrist). Gjenbruker ByggeplassVelgerModal-mønsteret (pageSheet,
 * FlatList, søk ved lange lister, «Alle»-rad som nullstiller). `valgt === ""` = Alle.
 */
export function EnkeltvelgerModal({
  tittel,
  alternativer,
  valgt,
  alleLabel,
  onVelg,
  onLukk,
}: {
  tittel: string;
  alternativer: VelgerAlternativ[];
  valgt: string;
  alleLabel: string;
  /** "" = «Alle» (nullstill). */
  onVelg: (value: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return q
      ? alternativer.filter((a) => a.label.toLowerCase().includes(q))
      : alternativer;
  }, [alternativer, sok]);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">{tittel}</Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {alternativer.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("byggeplassVelger.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Pressable
              onPress={() => onVelg("")}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                valgt === "" ? "bg-blue-50" : ""
              }`}
            >
              <Text className="flex-1 text-base text-gray-700">{alleLabel}</Text>
              {valgt === "" && <Check size={18} color="#1e40af" />}
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.value)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.value === valgt ? "bg-blue-50" : ""
              }`}
            >
              <Text className="flex-1 text-base text-gray-900">{item.label}</Text>
              {item.value === valgt && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("dokumentsok.ingenTreff")}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
