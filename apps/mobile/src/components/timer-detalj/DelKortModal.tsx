import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";
import { stegOvertidFra } from "../../utils/dagsforslag";

/**
 * Ordre c (prosjektkort-kortid-spec § 5.1): «Del til eget kort» i Bekreft dag.
 * Arbeideren velger klokkeslettet med −/+ (firmaets tidsrunding, ellers 15 min);
 * tiden før blir i kortet, tiden etter blir et nytt kort på samme prosjekt med
 * egen beskrivelse. Vinduet (`fra`–`til`) kommer fra `delingsVindu`, så ingen
 * del blir tom.
 */
export function DelKortModal({
  synlig,
  vindu,
  tidsrunding,
  onAvbryt,
  onDel,
}: {
  synlig: boolean;
  vindu: { fra: string; til: string; forslag: string } | null;
  tidsrunding: number | null;
  onAvbryt: () => void;
  onDel: (kl: string) => void;
}) {
  const { t } = useTranslation();
  const [kl, setKl] = useState(vindu?.forslag ?? "12:00");
  useEffect(() => {
    if (synlig && vindu) setKl(vindu.forslag);
  }, [synlig, vindu]);
  if (!vindu) return null;
  const steg = (retning: -1 | 1) => setKl((n) => stegOvertidFra(n, retning, vindu.fra, vindu.til, tidsrunding));
  return (
    <Modal visible={synlig} transparent animationType="fade" onRequestClose={onAvbryt}>
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="w-full max-w-sm rounded-2xl bg-white p-5">
          <Text className="mb-2 text-base font-semibold text-gray-900">{t("timer.bekreftDag.kort.delTittel")}</Text>
          <Text className="mb-4 text-sm text-gray-600">{t("timer.bekreftDag.kort.delTekst")}</Text>
          <View className="mb-5 flex-row items-center justify-center gap-4">
            <Pressable
              onPress={() => steg(-1)}
              accessibilityLabel={t("timer.bekreftDag.kort.tidligere")}
              className="h-11 w-11 items-center justify-center rounded-full border border-gray-300 active:bg-gray-100"
            >
              <Minus size={18} color="#374151" />
            </Pressable>
            <Text className="min-w-[72px] text-center text-2xl font-semibold text-gray-900">{kl}</Text>
            <Pressable
              onPress={() => steg(1)}
              accessibilityLabel={t("timer.bekreftDag.kort.senere")}
              className="h-11 w-11 items-center justify-center rounded-full border border-gray-300 active:bg-gray-100"
            >
              <Plus size={18} color="#374151" />
            </Pressable>
          </View>
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onAvbryt} className="rounded-lg px-4 py-2.5 active:bg-gray-100">
              <Text className="text-base font-medium text-gray-700">{t("handling.avbryt")}</Text>
            </Pressable>
            <Pressable onPress={() => onDel(kl)} className="rounded-lg bg-blue-600 px-4 py-2.5 active:bg-blue-700">
              <Text className="text-base font-semibold text-white">{t("timer.bekreftDag.kort.del", { kl })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
