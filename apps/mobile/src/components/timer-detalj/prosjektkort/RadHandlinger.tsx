import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * ORDRE 36b: «Del opp raden» / «Slett raden» nederst i timer- og maskin-
 * modalen — kun når prosjektkort-flyten sender `handlinger` (dagsoversikt og
 * kortskjerm). Dagskortet sender ingenting og ser modalene som før
 * (`dagskort-isolert-vakt.test.ts`). Slett går ALLTID via bekreftelsen.
 * `onFlytt` (36b § 5b) står over «Del opp» og åpner `KortValgModal`.
 * `matpause` (36b): kortskjermens matpause-avhuking for raden — samme regel som
 * dagskortets rad-kort (dag > 5,5t og raden krysser lunsjvinduet), flyttet hit.
 */
export type RadHandlingerProps = {
  /** 36b § 5b: flytt raden til et annet kort (prosjekt, byggeplass, underprosjekt). */
  onFlytt?: () => void;
  onDelOpp: () => void;
  onSlett: () => void;
  matpause?: { avhuket: boolean; trukketMin: number; onToggle: () => void };
};

export function RadHandlinger({ handlinger }: { handlinger: RadHandlingerProps }) {
  const { t } = useTranslation();
  const [bekreft, setBekreft] = useState(false);
  return (
    <View className="mt-4 border-t border-gray-200 pt-2">
      {handlinger.matpause && (
        <Pressable onPress={handlinger.matpause.onToggle} className="min-h-[44px] justify-center active:bg-gray-50">
          <Text className={`text-base ${handlinger.matpause.avhuket ? "text-gray-700" : "text-gray-400"}`}>
            {handlinger.matpause.avhuket
              ? t("timer.matpause.trukket", { min: handlinger.matpause.trukketMin })
              : t("timer.matpause.trukketUmerket")}
          </Text>
        </Pressable>
      )}
      {handlinger.onFlytt && (
        <Pressable onPress={handlinger.onFlytt} className="min-h-[44px] justify-center active:bg-gray-50">
          <Text className="text-base text-gray-700">{t("timer.dagsoversikt.flyttRad")}</Text>
        </Pressable>
      )}
      <Pressable onPress={handlinger.onDelOpp} className="min-h-[44px] justify-center active:bg-gray-50">
        <Text className="text-base text-gray-700">{t("timer.dagsoversikt.delOpp")}</Text>
      </Pressable>
      <Pressable onPress={() => setBekreft(true)} className="min-h-[44px] justify-center active:bg-gray-50">
        <Text className="text-base text-red-600">{t("timer.dagsoversikt.slettRad")}</Text>
      </Pressable>

      <Modal visible={bekreft} transparent animationType="fade" onRequestClose={() => setBekreft(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View className="w-full max-w-sm rounded-2xl bg-white p-5">
            <Text className="mb-4 text-base text-gray-900">{t("timer.dagsoversikt.slettRadBekreft")}</Text>
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setBekreft(false)} className="rounded-lg px-4 py-2.5 active:bg-gray-100">
                <Text className="text-base font-medium text-gray-700">{t("handling.avbryt")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setBekreft(false);
                  handlinger.onSlett();
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 active:bg-red-700"
              >
                <Text className="text-base font-semibold text-white">{t("timer.dagsoversikt.slettRad")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
