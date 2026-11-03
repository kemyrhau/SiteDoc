import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";

/**
 * Seksjon i «Alle» (spec § 9.4 A): overskrift «Mapper (7)», trykkbar → velger kilden alene. I enkelt omfang
 * vises innholdet uten overskrift. `merknad` = grå linje under overskriften (offline-tilstand pr. kilde).
 */
export function KildeSeksjon({
  tittel,
  visOverskrift,
  merknad,
  onVelgKilde,
  children,
}: {
  tittel: string;
  visOverskrift: boolean;
  merknad?: string | null;
  onVelgKilde: () => void;
  children: ReactNode;
}) {
  return (
    <View className="mb-2">
      {visOverskrift ? (
        <Pressable
          onPress={onVelgKilde}
          accessibilityRole="button"
          className="flex-row items-center justify-between px-4 pb-1.5 pt-3"
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tittel}</Text>
          <ChevronRight size={14} color="#9ca3af" />
        </Pressable>
      ) : null}
      {merknad ? <Text className="px-4 pb-1.5 text-xs text-gray-500">{merknad}</Text> : null}
      {children}
    </View>
  );
}
