import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Package } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { formatKortTall } from "../../lib/prosjektkortMobil";
import type { LokalVarelinje } from "../../services/vareforbrukSync";

export type VisVarelinje = {
  id: string;
  projectId: string;
  antall: number;
  vare: { navn: string; enhet: string };
  /** ORDRE 36b: kortnøkkelens B og UP (null/mangler = dagens byggeplass / uten UP). */
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  syncStatus?: LokalVarelinje["syncStatus"];
  feilmelding?: string | null;
};

/**
 * Vareforbruk-blokken (L3): linjene kan ikke endres her — retting skjer i
 * Varelager. Prosjektkortet legger «+ Ny vare» inn som `children`; dagskortet
 * (K20) viser den kun lesende.
 */
export function VareforbrukLesListe({ varer, children }: { varer: VisVarelinje[]; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <View className="mb-2 flex-row items-center gap-2">
        <Package size={16} color="#6b7280" />
        <Text className="text-sm font-semibold text-gray-900">
          {t("vareforbruk.tittel")}
        </Text>
      </View>
      {varer.map((v) => (
        <View key={v.id} className="py-1">
          <View className="flex-row justify-between">
            <Text className="flex-1 text-sm text-gray-700">{v.vare.navn}</Text>
            {v.syncStatus === "pending" && (
              <Text className="mr-2 text-xs text-amber-700">{t("timer.sync.venter")}</Text>
            )}
            <Text className="text-sm text-gray-900">
              {formatKortTall(v.antall).replace(/,0$/, "")} {v.vare.enhet}
            </Text>
          </View>
          {v.syncStatus === "avvist" && v.feilmelding && (
            <Text className="text-xs text-red-600">{t(v.feilmelding, { defaultValue: v.feilmelding })}</Text>
          )}
        </View>
      ))}
      {children}
    </View>
  );
}
