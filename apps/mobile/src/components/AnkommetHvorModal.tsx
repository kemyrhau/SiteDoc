import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, TextInput } from "react-native";
import { X, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ModalFlate } from "./ModalFlate";
import { hentByggeplasserForFirmaLokalt } from "../services/byggeplassKatalog";
import type { BesokSted } from "../services/arbeidsdagBesok";

/**
 * L4-A S2 (spec § 2.4): «Ankommet hvor?» — arbeideren velger dagens neste stopp.
 * GPS-treff øverst, så firmaets byggeplasser med søk, og «Utenfor kjent
 * byggeplass» (id null — prosjekt velges i bekreft-skjermen). Ingen skriving
 * her; kalleren registrerer besøket.
 */
export function AnkommetHvorModal({
  orgId,
  gpsTreff,
  onVelg,
  onLukk,
}: {
  orgId: string;
  gpsTreff: BesokSted | null;
  onVelg: (sted: BesokSted) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const byggeplasser = useMemo(() => hentByggeplasserForFirmaLokalt(orgId), [orgId]);

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const liste = byggeplasser.filter((b) => b.id !== gpsTreff?.id);
    if (!q) return liste;
    return liste.filter(
      (b) =>
        (b.navn ?? "").toLowerCase().includes(q) ||
        String(b.number ?? "").includes(q),
    );
  }, [byggeplasser, sok, gpsTreff?.id]);

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet" onRequestClose={onLukk}>
      <ModalFlate kanter={["top"]} className="bg-white">
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.besok.ankommetHvor")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12} accessibilityLabel={t("timer.besok.lukk")}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {gpsTreff?.id ? (
          <Pressable
            onPress={() => onVelg(gpsTreff)}
            className="flex-row items-center gap-2 border-b border-gray-200 bg-green-50 px-4 py-3 active:bg-green-100"
          >
            <MapPin size={16} color="#047857" />
            <Text className="flex-1 text-base text-gray-900">{gpsTreff.navn ?? ""}</Text>
            <Text className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
              {t("timer.besok.gpsTreff")}
            </Text>
          </Pressable>
        ) : null}
        <View className="border-b border-gray-200 px-4 py-2">
          <TextInput
            value={sok}
            onChangeText={setSok}
            placeholder={t("timer.besok.sok")}
            className="rounded bg-gray-100 px-3 py-2 text-base"
          />
        </View>
        <FlatList
          data={filtrert}
          keyExtractor={(b) => b.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                onVelg({ id: item.id, navn: item.navn ?? null, projectId: item.projectId })
              }
              className="border-b border-gray-100 px-4 py-3 active:bg-gray-50"
            >
              <Text className="text-base text-gray-900">
                {item.number != null ? `${item.number} · ` : ""}
                {item.navn ?? ""}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => onVelg({ id: null, navn: null, projectId: null })}
              className="px-4 py-3 active:bg-gray-50"
            >
              <Text className="text-base text-gray-900">{t("timer.besok.utenfor")}</Text>
              <Text className="text-xs text-gray-500">{t("timer.besok.utenforHjelp")}</Text>
            </Pressable>
          }
        />
      </ModalFlate>
    </Modal>
  );
}
