import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { BadgeVariant } from "@sitedoc/shared";
import { statusMerkelappInfo, variantKlasse } from "./statusFarger";

interface StatusMerkelappProps {
  status: string;
  lestAvMottakerVed?: Date | string | null;
  /**
   * Perspektiv-avhengig etikett + farge, ferdig utledet av kallstedet via
   * `perspektivEtikett` (@sitedoc/shared) — speiler web-`StatusBadge`. Når satt,
   * overstyrer det det nøytrale oppslaget: feltarbeideren ser «din tur» i gult på
   * detaljsiden, slik web gjør. `etikettKey` er en i18n-nøkkel; komponenten kaller `t()`.
   */
  perspektiv?: { etikettKey: string; variant: BadgeVariant };
}

export function StatusMerkelapp({ status, lestAvMottakerVed, perspektiv }: StatusMerkelappProps) {
  const { t } = useTranslation();

  // «sent» + mottaker har lest → vis «Lest». Fyrer FØR perspektiv-grenen (samme
  // rekkefølge som web): perspektivEtikett får aldri lest-tidspunktet inn.
  if (status === "sent" && lestAvMottakerVed != null) {
    return (
      <View className="rounded-full px-2.5 py-0.5 bg-blue-100">
        <Text className="text-xs font-medium text-blue-700">
          {t("status.lest")}
        </Text>
      </View>
    );
  }

  // Perspektiv-avhengig etikett (kallstedet har kalt perspektivEtikett).
  if (perspektiv) {
    const k = variantKlasse(perspektiv.variant);
    return (
      <View className={`rounded-full px-2.5 py-0.5 ${k.bg}`}>
        <Text className={`text-xs font-medium ${k.tekstFarge}`}>
          {t(perspektiv.etikettKey)}
        </Text>
      </View>
    );
  }

  const info = statusMerkelappInfo(status);
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${info.bg}`}>
      <Text className={`text-xs font-medium ${info.tekstFarge}`}>
        {t(info.noekkel)}
      </Text>
    </View>
  );
}
