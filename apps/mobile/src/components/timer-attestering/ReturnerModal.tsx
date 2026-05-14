import { useState } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";

/**
 * Returner-modal — speil av webs ReturnerDialog.
 * Kommentar er obligatorisk. Ved suksess: invalider relevant cache + lukk.
 */
export function ReturnerModal({
  radIder,
  onLukket,
  onLukk,
}: {
  radIder: { timerIder: string[]; tilleggIder: string[]; maskinIder: string[] };
  /** Kalles ved vellykket retur — typisk for å navigere tilbake. */
  onLukket: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returnerRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLukket();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function lagre() {
    setFeil(null);
    if (!kommentar.trim()) {
      setFeil(t("timer.attestering.kommentarPaakrevd"));
      return;
    }
    returner.mutate({ radIder, kommentar: kommentar.trim() });
  }

  const antall =
    radIder.timerIder.length + radIder.tilleggIder.length + radIder.maskinIder.length;

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
            {t("timer.attestering.returnerTittel")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <View className="gap-4 p-4">
          <Text className="text-sm text-gray-600">
            {t("timer.attestering.returnerBeskrivelse")}
          </Text>
          <Text className="text-sm font-medium text-gray-800">
            {t("timer.attestering.radValg.returnererAntall", { antall })}
          </Text>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.attestering.kommentar")}
            </Text>
            <TextInput
              value={kommentar}
              onChangeText={setKommentar}
              placeholder={t("timer.attestering.kommentarPlaceholder")}
              multiline
              numberOfLines={5}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
              style={{ textAlignVertical: "top", minHeight: 120 }}
              autoFocus
            />
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={onLukk}
              className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-3 active:bg-gray-50"
            >
              <Text className="text-base font-medium text-gray-700">
                {t("handling.avbryt")}
              </Text>
            </Pressable>
            <Pressable
              onPress={lagre}
              disabled={returner.isPending || !kommentar.trim()}
              className="flex-1 items-center rounded-lg bg-red-600 py-3 active:bg-red-700 disabled:opacity-50"
              style={
                returner.isPending || !kommentar.trim() ? { opacity: 0.5 } : undefined
              }
            >
              <Text className="text-base font-semibold text-white">
                {returner.isPending
                  ? t("handling.lagrer")
                  : t("timer.attestering.returner")}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
