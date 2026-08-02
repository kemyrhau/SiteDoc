import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

/**
 * Status → i18n-nøkkel + farge. Delt kilde: brukes både av `StatusMerkelapp`
 * (badge) og `StatusFilterRad` (filter-chip) så fargespråket er ett sted.
 */
export const STATUS_MAP: Record<string, { noekkel: string; bg: string; tekstFarge: string }> = {
  draft: { noekkel: "status.utkast", bg: "bg-gray-100", tekstFarge: "text-gray-700" },
  sent: { noekkel: "status.sendt", bg: "bg-blue-100", tekstFarge: "text-blue-700" },
  received: { noekkel: "status.mottatt", bg: "bg-indigo-100", tekstFarge: "text-indigo-700" },
  // Runde-2 (2026-08-02, Q1=A): `in_progress` kollapset → vises som «Mottatt» (received) også i
  // tidslinjeloggen. Ingen «Under arbeid» på mobil heller (web-paritet).
  in_progress: { noekkel: "status.mottatt", bg: "bg-indigo-100", tekstFarge: "text-indigo-700" },
  responded: { noekkel: "status.besvart", bg: "bg-purple-100", tekstFarge: "text-purple-700" },
  approved: { noekkel: "status.godkjent", bg: "bg-green-100", tekstFarge: "text-green-700" },
  rejected: { noekkel: "status.avvist", bg: "bg-red-100", tekstFarge: "text-red-700" },
  closed: { noekkel: "status.lukket", bg: "bg-gray-200", tekstFarge: "text-gray-600" },
  cancelled: { noekkel: "status.avbrutt", bg: "bg-red-100", tekstFarge: "text-red-700" },
};

interface StatusMerkelappProps {
  status: string;
  lestAvMottakerVed?: Date | string | null;
}

export function StatusMerkelapp({ status, lestAvMottakerVed }: StatusMerkelappProps) {
  const { t } = useTranslation();

  // «sent» + mottaker har lest → vis «Lest»
  if (status === "sent" && lestAvMottakerVed != null) {
    return (
      <View className="rounded-full px-2.5 py-0.5 bg-blue-100">
        <Text className="text-xs font-medium text-blue-700">
          {t("status.lest")}
        </Text>
      </View>
    );
  }

  const info = STATUS_MAP[status];

  return (
    <View className={`rounded-full px-2.5 py-0.5 ${info?.bg ?? "bg-gray-100"}`}>
      <Text className={`text-xs font-medium ${info?.tekstFarge ?? "text-gray-700"}`}>
        {info ? t(info.noekkel) : status}
      </Text>
    </View>
  );
}
