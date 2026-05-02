import { useMemo } from "react";
import { View, Text } from "react-native";
import { Calendar } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and, gte, lte } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal, sheetTimerLocal } from "../db/schema";

/**
 * UkeTotalBanner — viser innværende ukes totalsum (Runde 2.7 2026-05-02).
 *
 * Mobil-versjonen av ukesoppsummering. Beregnes lokalt fra Drizzle-cache;
 * ingen server-kall.
 *
 * Vises øverst i timer-listen for å gi brukeren rask oversikt over uka
 * uten å måtte navigere eller scrolle.
 */
function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay(); // 0 = Sun
  const offset = dag === 0 ? -6 : 1 - dag; // mandag som ukestart
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoUkenummer(dato: Date): number {
  const d = new Date(dato);
  const torsdag = new Date(d);
  torsdag.setDate(d.getDate() + 3);
  const aar = torsdag.getFullYear();
  const start = new Date(aar, 0, 1);
  const dager = Math.floor(
    (torsdag.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.ceil((dager + start.getDay() + 1) / 7);
}

export function UkeTotalBanner({ userId }: { userId: string }) {
  const { t } = useTranslation();

  const { totalt, antall, ukeNr } = useMemo(() => {
    const db = hentDatabase();
    if (!db) return { totalt: 0, antall: 0, ukeNr: 0 };

    const naa = new Date();
    const start = ukestart(naa);
    const slutt = new Date(start);
    slutt.setDate(slutt.getDate() + 6);

    const sedler = db
      .select()
      .from(dagsseddelLocal)
      .where(
        and(
          eq(dagsseddelLocal.userId, userId),
          gte(dagsseddelLocal.dato, formatIso(start)),
          lte(dagsseddelLocal.dato, formatIso(slutt)),
        ),
      )
      .all();

    let totalt = 0;
    for (const s of sedler) {
      const timer = db
        .select({ timer: sheetTimerLocal.timer })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.dagsseddelId, s.id))
        .all();
      totalt += timer.reduce((acc, t) => acc + t.timer, 0);
    }

    return { totalt, antall: sedler.length, ukeNr: isoUkenummer(start) };
  }, [userId]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <Calendar size={14} color="#6b7280" />
      <Text className="flex-1 text-xs text-gray-700">
        {t("timer.banner.uketotal", {
          ukeNr,
          timer: totalt.toFixed(2),
          antall,
        })}
      </Text>
    </View>
  );
}
