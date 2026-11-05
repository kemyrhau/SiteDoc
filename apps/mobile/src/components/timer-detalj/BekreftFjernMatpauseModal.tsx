import { View, Text, Pressable, Modal } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/** Bekreft fjerning av matpause-raden (prosjektkort-skjermen). */
export function BekreftFjernMatpauseModal({
  synlig,
  onAvbryt,
  onBekreft,
}: {
  synlig: boolean;
  onAvbryt: () => void;
  onBekreft: () => void;
}) {
  const { t } = useTranslation();
  return (
      <Modal
        visible={synlig}
        transparent
        animationType="fade"
        onRequestClose={onAvbryt}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View className="w-full max-w-sm rounded-2xl bg-white p-5">
            <View className="mb-2 flex-row items-center gap-2">
              <AlertTriangle size={20} color="#d97706" />
              <Text className="flex-1 text-base font-semibold text-gray-900">
                {t("timer.matpause.fjernTittel")}
              </Text>
            </View>
            <Text className="mb-4 text-sm text-gray-600">
              {t("timer.matpause.fjernTekst")}
            </Text>
            <View className="flex-row justify-end gap-2">
              <Pressable
                onPress={onAvbryt}
                className="rounded-lg px-4 py-2.5 active:bg-gray-100"
              >
                <Text className="text-base font-medium text-gray-700">
                  {t("handling.avbryt")}
                </Text>
              </Pressable>
              <Pressable
                onPress={onBekreft}
                className="rounded-lg bg-amber-600 px-4 py-2.5 active:bg-amber-700"
              >
                <Text className="text-base font-semibold text-white">
                  {t("timer.matpause.fjernBekreft")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
  );
}
