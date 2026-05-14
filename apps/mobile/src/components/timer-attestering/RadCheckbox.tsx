import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { AttesteringStatusBadge } from "./AttesteringStatusBadge";

/**
 * Rad med checkbox + status-badge + per-rad-info.
 * Brukes i AttesteringDetaljMobil for timer/tillegg/maskin-rader.
 *
 * - `tilgjengelig` = false: checkbox skjult (rad fra annet prosjekt eller
 *   allerede attestert/returnert). Raden vises dempet.
 * - `valgt` = true: blå checkbox med hake.
 */
export function RadCheckbox({
  valgt,
  tilgjengelig,
  status,
  hovedtekst,
  undertekst,
  hoyreVerdi,
  onTrykk,
}: {
  valgt: boolean;
  tilgjengelig: boolean;
  status: string | null;
  hovedtekst: string;
  undertekst?: string | null;
  hoyreVerdi?: string;
  onTrykk: () => void;
}) {
  return (
    <Pressable
      onPress={tilgjengelig ? onTrykk : undefined}
      className={`flex-row items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 ${
        tilgjengelig ? "active:bg-gray-50" : ""
      }`}
      style={tilgjengelig ? undefined : { opacity: 0.55 }}
    >
      {/* Checkbox (kun for tilgjengelige pending-rader) */}
      {tilgjengelig ? (
        <View
          className={`h-6 w-6 items-center justify-center rounded border-2 ${
            valgt
              ? "border-sitedoc-primary bg-sitedoc-primary"
              : "border-gray-300 bg-white"
          }`}
        >
          {valgt && <Check size={14} color="#ffffff" />}
        </View>
      ) : (
        <View className="h-6 w-6" />
      )}

      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {hovedtekst}
        </Text>
        {undertekst && (
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
            {undertekst}
          </Text>
        )}
      </View>

      {hoyreVerdi && (
        <Text className="font-mono text-sm text-gray-900">{hoyreVerdi}</Text>
      )}

      <AttesteringStatusBadge status={status} />
    </Pressable>
  );
}
