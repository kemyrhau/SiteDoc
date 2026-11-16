import { View, Text, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * Slett-bekreftelsen i prosjektkort-flyten (ui-standarder: slett via modal).
 * Løftet ut av `RadHandlinger` (ORDRE 36c-kort) så «Slett raden» og
 * «Slett kort» deler samme modal. `bekreftTekst` er den røde knappen.
 */
export function BekreftSlettModal({
  synlig,
  tittel,
  tekst,
  bekreftTekst,
  onAvbryt,
  onBekreft,
}: {
  synlig: boolean;
  tittel?: string;
  tekst: string;
  bekreftTekst: string;
  onAvbryt: () => void;
  onBekreft: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={synlig} transparent animationType="fade" onRequestClose={onAvbryt}>
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="w-full max-w-sm rounded-2xl bg-white p-5">
          {tittel && <Text className="mb-2 text-base font-semibold text-gray-900">{tittel}</Text>}
          <Text className="mb-4 text-base text-gray-900">{tekst}</Text>
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onAvbryt} className="rounded-lg px-4 py-2.5 active:bg-gray-100">
              <Text className="text-base font-medium text-gray-700">{t("handling.avbryt")}</Text>
            </Pressable>
            <Pressable onPress={onBekreft} className="rounded-lg bg-red-600 px-4 py-2.5 active:bg-red-700">
              <Text className="text-base font-semibold text-white">{bekreftTekst}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
