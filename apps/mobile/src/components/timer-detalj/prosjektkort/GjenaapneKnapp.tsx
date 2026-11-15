/**
 * ORDRE 2026-11-15 (23): Gjenåpne-knappen i prosjektkort-modus — samme
 * utseende på samlesiden og kortskjermen. Vises bare for sendt sedel;
 * konflikt gir en sperret knapp med forklaring (aldri en blindvei).
 */
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react-native";
import { kanGjenaapneDagsseddel } from "../../../utils/gjenaapne-tilgang";

interface Props {
  status: string;
  syncStatus: string;
  pending: boolean;
  onGjenaapne: () => void;
}

export function GjenaapneKnapp({ status, syncStatus, pending, onGjenaapne }: Props) {
  const { t } = useTranslation();
  if (status !== "sent") return null;
  if (kanGjenaapneDagsseddel(status, syncStatus)) {
    return (
      <>
        <Pressable
          onPress={onGjenaapne}
          disabled={pending}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-3 active:bg-blue-50 disabled:opacity-50"
        >
          <RotateCcw size={16} color="#1e40af" />
          <Text className="text-base font-medium text-sitedoc-primary">
            {t("timer.gjenaapne.knapp")}
          </Text>
        </Pressable>
        <Text className="text-center text-xs text-gray-500">{t("timer.gjenaapne.hjelp")}</Text>
      </>
    );
  }
  return (
    <>
      <Pressable
        disabled
        className="flex-row items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-3 opacity-50"
      >
        <RotateCcw size={16} color="#9ca3af" />
        <Text className="text-base font-medium text-gray-400">{t("timer.gjenaapne.knapp")}</Text>
      </Pressable>
      <Text className="text-center text-xs text-gray-500">{t("timer.gjenaapne.sperretKonflikt")}</Text>
    </>
  );
}
