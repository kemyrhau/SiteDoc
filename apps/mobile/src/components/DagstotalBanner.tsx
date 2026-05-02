import { useMemo } from "react";
import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal, sheetTimerLocal } from "../db/schema";

/**
 * DagstotalBanner — viser sum timer på tvers av prosjekter for en gitt
 * dato (Runde 2.7 2026-05-02).
 *
 * Lokal Drizzle-spørring — offline-trygt. Server-versjonen
 * (timer.dagsseddel.hentDagstotal) brukes ikke her; lokal cache er
 * sannhetskilden mens enheten er offline.
 *
 * Brukstilfelle: vises øverst på ny-sedel-skjerm og detaljside slik at
 * arbeideren ser hvor mye som allerede er ført på dagen før hun legger
 * til mer.
 */
export function DagstotalBanner({
  userId,
  dato,
  ekskluderSheetId,
}: {
  userId: string;
  dato: string; // ISO YYYY-MM-DD
  /** Valgfri: ekskluder en spesifikk sedel fra sum (f.eks. når man redigerer
   * en sedel og vil se hvor mye som er ført PÅ ANDRE prosjekter samme dag) */
  ekskluderSheetId?: string;
}) {
  const { t } = useTranslation();

  const oppsummering = useMemo(() => {
    const db = hentDatabase();
    if (!db) return { totalt: 0, antallSedler: 0 };

    const sedler = db
      .select()
      .from(dagsseddelLocal)
      .where(
        and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.dato, dato)),
      )
      .all();

    let totalt = 0;
    let antallSedler = 0;
    for (const s of sedler) {
      if (ekskluderSheetId && s.id === ekskluderSheetId) continue;
      const timer = db
        .select({ timer: sheetTimerLocal.timer })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.dagsseddelId, s.id))
        .all();
      totalt += timer.reduce((acc, t) => acc + t.timer, 0);
      antallSedler += 1;
    }

    return { totalt, antallSedler };
  }, [userId, dato, ekskluderSheetId]);

  if (oppsummering.antallSedler === 0 && oppsummering.totalt === 0) {
    return (
      <View className="flex-row items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2">
        <Clock size={14} color="#1e40af" />
        <Text className="text-xs text-blue-900">
          {t("timer.banner.ingenIDag")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2">
      <Clock size={14} color="#1e40af" />
      <Text className="text-xs text-blue-900">
        {t("timer.banner.dagstotal", {
          timer: oppsummering.totalt.toFixed(2),
          antall: oppsummering.antallSedler,
        })}
      </Text>
    </View>
  );
}
