/**
 * Kompakt flytindikator for mobilens detaljsider.
 * Native View — ingen WebView.
 *
 * Kompakt: aktiv boks + én nabo på hver side, tap for full flyt.
 */

import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  byggLedd,
  finnAktivtIndex,
  forkort,
  type FlytMedlem,
  type Ledd,
} from "../utils/dokumentflyt-ledd";

interface FlytIndikatorProps {
  medlemmer: FlytMedlem[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  status: string;
  bestillerUserId?: string;
}

export function FlytIndikator({ medlemmer, recipientUserId, recipientGroupId, status, bestillerUserId }: FlytIndikatorProps) {
  const [ekspandert, setEkspandert] = useState(false);

  if (!medlemmer || medlemmer.length === 0) return null;

  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return null;

  const aktivtIndex = finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId);

  // Kompakt: aktiv + én nabo på hver side
  const visbareLedd = (!ekspandert && ledd.length > 3)
    ? filtrerNaboer(ledd, aktivtIndex)
    : ledd.map((l, i) => ({ ledd: l, originalIndex: i }));

  const harMer = !ekspandert && ledd.length > 3;

  return (
    <Pressable
      onPress={() => ledd.length > 3 && setEkspandert(!ekspandert)}
      className="flex-row items-center gap-0.5 px-4 py-1"
    >
      {visbareLedd.map((item, visIdx) => {
        const erAktiv = item.originalIndex === aktivtIndex;
        const visningstekst = erAktiv ? item.ledd.aktivNavn : item.ledd.navn;
        return (
          <View key={item.originalIndex} className="flex-row items-center gap-0.5">
            {visIdx > 0 && (
              <Text className={erAktiv ? "text-[10px] text-blue-300" : "text-[10px] text-gray-400"}>→</Text>
            )}
            <View
              className={
                erAktiv
                  ? "rounded px-1.5 py-0.5 bg-blue-500"
                  : "rounded px-1.5 py-0.5 bg-white/20"
              }
            >
              <Text
                className={
                  erAktiv
                    ? "text-[10px] font-medium text-white"
                    : "text-[10px] text-white/70"
                }
                numberOfLines={1}
              >
                {erAktiv && "● "}{forkort(visningstekst, erAktiv ? 20 : 10)}
              </Text>
            </View>
          </View>
        );
      })}
      {harMer && (
        <Text className="ml-0.5 text-[9px] text-white/50">+{ledd.length - visbareLedd.length}</Text>
      )}
    </Pressable>
  );
}

function filtrerNaboer(
  ledd: Ledd[],
  aktivtIndex: number,
): Array<{ ledd: Ledd; originalIndex: number }> {
  if (aktivtIndex === -1) {
    return ledd.slice(-2).map((l, i) => ({ ledd: l, originalIndex: ledd.length - 2 + i }));
  }
  const start = Math.max(0, aktivtIndex - 1);
  const slutt = Math.min(ledd.length - 1, aktivtIndex + 1);
  const resultat: Array<{ ledd: Ledd; originalIndex: number }> = [];
  for (let i = start; i <= slutt; i++) {
    const l = ledd[i];
    if (l) resultat.push({ ledd: l, originalIndex: i });
  }
  return resultat;
}

export type { FlytMedlem };
