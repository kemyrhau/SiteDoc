import { useState } from "react";
import { Text, Pressable, Modal } from "react-native";
import { HelpCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/**
 * Mobilens ?-ikon (ORDRE Tillegg/Utlegg i Bekreft dag, B2). Web har
 * `HjelpKnapp` i sidehodet; på mobil står ikonet ved overskriften det
 * forklarer. Trykk åpner et ark med tittel + tekst; trykk utenfor (eller
 * «Lukk») lukker. Treffflate ≥ 44 pt via `hitSlop` (18 + 2·13), så ikonet
 * ikke gjør overskriftslinjen høyere. Tekstene kommer ferdig oversatt.
 */
export function HjelpIkon({ tittel, tekst }: { tittel: string; tekst: string }) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setApen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("hjelp.ikonEtikett", { tittel })}
        hitSlop={13}
      >
        <HelpCircle size={18} color="#6b7280" />
      </Pressable>
      <Modal visible={apen} transparent animationType="fade" onRequestClose={() => setApen(false)}>
        <Pressable
          onPress={() => setApen(false)}
          accessibilityLabel={t("handling.lukk")}
          className="flex-1 justify-end bg-black/40"
        >
          {/* Trykk på selve arket lukker ikke. */}
          <Pressable onPress={() => undefined} className="gap-3 rounded-t-2xl bg-white px-5 pb-10 pt-5">
            <Text className="text-lg font-semibold text-gray-900">{tittel}</Text>
            <Text className="text-base leading-6 text-gray-700">{tekst}</Text>
            <Pressable
              onPress={() => setApen(false)}
              className="mt-2 min-h-[44px] items-center justify-center rounded-lg border border-gray-300 active:bg-gray-50"
            >
              <Text className="text-base font-medium text-gray-900">{t("handling.lukk")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
