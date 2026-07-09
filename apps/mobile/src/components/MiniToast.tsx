import { useCallback, useRef, useState } from "react";
import { View, Text } from "react-native";

/**
 * Lettvekts, ikke-blokkerende toast for stille bekreftelser/fallback (f.eks. når
 * en tel:/mailto:-lenke ikke kan åpnes). Auto-skjules. Ingen ekstern avhengighet.
 */
export function useMiniToast() {
  const [melding, setMelding] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vis = useCallback((m: string) => {
    setMelding(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMelding(null), 2600);
  }, []);

  return { melding, vis };
}

export function MiniToast({ melding }: { melding: string | null }) {
  if (!melding) return null;
  return (
    <View className="absolute inset-x-4 bottom-10 items-center" pointerEvents="none">
      <View className="max-w-full rounded-full bg-gray-900/90 px-4 py-2">
        <Text className="text-center text-xs text-white" numberOfLines={2}>
          {melding}
        </Text>
      </View>
    </View>
  );
}
