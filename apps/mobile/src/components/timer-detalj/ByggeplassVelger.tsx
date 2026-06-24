import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { hentByggeplasserForProsjektLokalt } from "../../services/byggeplassKatalog";

/**
 * Byggeplass-velger-modal for sedel-nivå byggeplass (L1, B6 sedel-nivå-runde).
 * Leser byggeplassLocal filtrert på sedelens prosjekt — offline-trygt etter
 * R4-sync. Sedel-nivå (én byggeplass per dag, jf. @@unique(userId, dato));
 * per-rad/«splitt dagen» er Beslutning 6-oppfølger.
 */
export function ByggeplassVelgerModal({
  projectId,
  valgtId,
  gpsForeslagId,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  /** F3: GPS-foreslått byggeplass — badges «du er her» på raden. */
  gpsForeslagId?: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const byggeplasser = useMemo(() => {
    if (!projectId) return [];
    return hentByggeplasserForProsjektLokalt(projectId);
  }, [projectId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return byggeplasser;
    const q = sok.toLowerCase();
    return byggeplasser.filter(
      (b) =>
        (b.navn ?? "").toLowerCase().includes(q) ||
        String(b.number ?? "").includes(q),
    );
  }, [byggeplasser, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("byggeplassVelger.velg")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {byggeplasser.length > 7 && (
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
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">
                  {item.navn ?? item.id}
                </Text>
                {item.id === gpsForeslagId ? (
                  <Text className="text-xs text-green-600">
                    {t("byggeplassVelger.gpsForeslarHer")}
                  </Text>
                ) : (
                  item.number != null && (
                    <Text className="text-xs text-gray-500">#{item.number}</Text>
                  )
                )}
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("byggeplassVelger.ingen")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
