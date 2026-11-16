import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { BekreftSlettModal } from "./BekreftSlettModal";

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
  /** TILLEGG 2026-11-12: koblet maskin følger raden — merknad i stedet for egen flytt. */
  folgerRaden?: boolean;
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
      {handlinger.folgerRaden && (
        <View className="min-h-[44px] justify-center">
          <Text className="text-sm text-gray-500">{t("timer.dagsoversikt.folgerRaden")}</Text>
        </View>
      )}
      <Pressable onPress={handlinger.onDelOpp} className="min-h-[44px] justify-center active:bg-gray-50">
        <Text className="text-base text-gray-700">{t("timer.dagsoversikt.delOpp")}</Text>
      </Pressable>
      <Pressable onPress={() => setBekreft(true)} className="min-h-[44px] justify-center active:bg-gray-50">
        <Text className="text-base text-red-600">{t("timer.dagsoversikt.slettRad")}</Text>
      </Pressable>

      <BekreftSlettModal
        synlig={bekreft}
        tekst={t("timer.dagsoversikt.slettRadBekreft")}
        bekreftTekst={t("timer.dagsoversikt.slettRad")}
        onAvbryt={() => setBekreft(false)}
        onBekreft={() => {
          setBekreft(false);
          handlinger.onSlett();
        }}
      />
    </View>
  );
}
