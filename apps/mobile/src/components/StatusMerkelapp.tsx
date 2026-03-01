import { View, Text } from "react-native";

const STATUS_MAP: Record<string, { tekst: string; bg: string; tekstFarge: string }> = {
  draft: { tekst: "Utkast", bg: "bg-gray-100", tekstFarge: "text-gray-700" },
  sent: { tekst: "Sendt", bg: "bg-blue-100", tekstFarge: "text-blue-700" },
  received: { tekst: "Mottatt", bg: "bg-indigo-100", tekstFarge: "text-indigo-700" },
  in_progress: { tekst: "Under arbeid", bg: "bg-yellow-100", tekstFarge: "text-yellow-700" },
  responded: { tekst: "Besvart", bg: "bg-purple-100", tekstFarge: "text-purple-700" },
  approved: { tekst: "Godkjent", bg: "bg-green-100", tekstFarge: "text-green-700" },
  rejected: { tekst: "Avvist", bg: "bg-red-100", tekstFarge: "text-red-700" },
  closed: { tekst: "Lukket", bg: "bg-gray-200", tekstFarge: "text-gray-600" },
};

interface StatusMerkelappProps {
  status: string;
}

export function StatusMerkelapp({ status }: StatusMerkelappProps) {
  const info = STATUS_MAP[status] ?? { tekst: status, bg: "bg-gray-100", tekstFarge: "text-gray-700" };

  return (
    <View className={`rounded-full px-2.5 py-0.5 ${info.bg}`}>
      <Text className={`text-xs font-medium ${info.tekstFarge}`}>{info.tekst}</Text>
    </View>
  );
}
