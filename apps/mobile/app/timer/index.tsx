import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and, desc } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import { dagsseddelLocal, sheetTimerLocal } from "../../src/db/schema";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { TimerSyncStatusBar } from "../../src/components/TimerSyncStatusBar";
import { TimerStatusMerkelapp } from "../../src/components/TimerStatusMerkelapp";
import { UkeTotalBanner } from "../../src/components/UkeTotalBanner";

interface DagsseddelRad {
  id: string;
  dato: string;
  status: string;
  syncStatus: string;
  beskrivelse: string | null;
  totaltimer: number;
  antallRader: number;
}

function lesDagssedlerLokalt(userId: string): DagsseddelRad[] {
  const db = hentDatabase();
  if (!db) return [];

  const sedler = db
    .select()
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.userId, userId))
    .orderBy(desc(dagsseddelLocal.dato))
    .all();

  return sedler.map((s) => {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    return {
      id: s.id,
      dato: s.dato,
      status: s.status,
      syncStatus: s.syncStatus,
      beskrivelse: s.beskrivelse,
      totaltimer: timer.reduce((acc, t) => acc + t.timer, 0),
      antallRader: timer.length,
    };
  });
}

function formatDato(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("no-NB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default function TimerListeSide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const { triggerSync, syncerNa } = useTimerSync();

  const [rader, setRader] = useState<DagsseddelRad[]>([]);

  // Re-les fra DB hver gang siden får fokus (etter retur fra detalj/ny)
  useFocusEffect(
    useCallback(() => {
      if (bruker?.id) {
        setRader(lesDagssedlerLokalt(bruker.id));
      }
    }, [bruker?.id]),
  );

  const onRefresh = useCallback(async () => {
    await triggerSync();
    if (bruker?.id) {
      setRader(lesDagssedlerLokalt(bruker.id));
    }
  }, [triggerSync, bruker?.id]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("timer.tittel")}
        </Text>
      </View>

      <TimerSyncStatusBar />

      {bruker?.id && <UkeTotalBanner userId={bruker.id} />}

      <FlatList<DagsseddelRad>
        data={rader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={syncerNa} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View className="px-6 py-12">
            <Text className="text-center text-gray-500">
              {t("timer.ingenSedler")}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/timer/${item.id}`)}
            className="border-b border-gray-100 px-4 py-3 active:bg-gray-50"
          >
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-medium text-gray-900">
                {formatDato(item.dato)}
              </Text>
              <Text className="font-mono text-sm text-gray-700">
                {item.totaltimer.toFixed(2)} {t("timer.tEnhet")}
              </Text>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
            <View className="mt-1 flex-row items-center gap-2">
              <TimerStatusMerkelapp
                status={item.status}
                syncStatus={item.syncStatus}
              />
              <Text className="text-xs text-gray-500">
                {t("timer.antallRader", { antall: item.antallRader })}
              </Text>
            </View>
            {item.beskrivelse && (
              <Text
                className="mt-1 text-xs text-gray-500"
                numberOfLines={1}
              >
                {item.beskrivelse}
              </Text>
            )}
          </Pressable>
        )}
      />

      {/* Floating action button */}
      <Pressable
        onPress={() => router.push("/timer/ny")}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg active:bg-blue-700"
      >
        <Plus size={28} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}
