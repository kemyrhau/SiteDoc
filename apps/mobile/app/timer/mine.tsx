import { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  aktivitetLocal,
} from "../../src/db/schema";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";

/**
 * «Mine timer» mobil — kompakt rapport-visning på tvers av prosjekter
 * (Runde 2.7 2026-05-02).
 *
 * Lokal Drizzle-spørring — offline-trygt. Aggregeringer beregnes klient-side.
 * Tre periode-valg: Denne uken / Forrige uke / Denne måneden (egendefinert
 * er web-only).
 */

type Periode = "denne_uken" | "forrige_uken" | "denne_maaneden";

interface SedelRad {
  id: string;
  dato: string;
  status: string;
  projectId: string;
  aktivitetId: string;
  totaltimer: number;
}

function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay();
  const offset = dag === 0 ? -6 : 1 - dag;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tilIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDato(iso: string): string {
  return new Date(iso).toLocaleDateString("no-NB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function periodeRange(periode: Periode): { fra: string; til: string } {
  const naa = new Date();
  if (periode === "denne_uken") {
    const start = ukestart(naa);
    const slutt = new Date(start);
    slutt.setDate(slutt.getDate() + 6);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  if (periode === "forrige_uken") {
    const start = ukestart(naa);
    start.setDate(start.getDate() - 7);
    const slutt = new Date(start);
    slutt.setDate(slutt.getDate() + 6);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  // denne_maaneden
  const start = new Date(naa.getFullYear(), naa.getMonth(), 1);
  const slutt = new Date(naa.getFullYear(), naa.getMonth() + 1, 0);
  return { fra: tilIso(start), til: tilIso(slutt) };
}

function lesDataLokalt(userId: string, fra: string, til: string): {
  rader: SedelRad[];
  aktivitetNavnMap: Map<string, string>;
} {
  const db = hentDatabase();
  if (!db) return { rader: [], aktivitetNavnMap: new Map() };

  const sedler = db
    .select()
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        gte(dagsseddelLocal.dato, fra),
        lte(dagsseddelLocal.dato, til),
      ),
    )
    .orderBy(desc(dagsseddelLocal.dato))
    .all();

  const rader: SedelRad[] = sedler.map((s) => {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    return {
      id: s.id,
      dato: s.dato,
      status: s.status,
      projectId: s.projectId,
      aktivitetId: s.aktivitetId ?? "",
      totaltimer: timer.reduce((acc, t) => acc + t.timer, 0),
    };
  });

  const aktiviteter = db.select().from(aktivitetLocal).all();
  const aktivitetNavnMap = new Map<string, string>();
  for (const a of aktiviteter) aktivitetNavnMap.set(a.id, a.navn);

  return { rader, aktivitetNavnMap };
}

export default function MineTimerSide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const { triggerSync, syncerNa } = useTimerSync();

  const [periode, setPeriode] = useState<Periode>("denne_uken");
  const [data, setData] = useState<{
    rader: SedelRad[];
    aktivitetNavnMap: Map<string, string>;
  }>({ rader: [], aktivitetNavnMap: new Map() });

  const range = useMemo(() => periodeRange(periode), [periode]);

  useFocusEffect(
    useCallback(() => {
      if (bruker?.id) {
        setData(lesDataLokalt(bruker.id, range.fra, range.til));
      }
    }, [bruker?.id, range.fra, range.til]),
  );

  const onRefresh = useCallback(async () => {
    await triggerSync();
    if (bruker?.id) {
      setData(lesDataLokalt(bruker.id, range.fra, range.til));
    }
  }, [triggerSync, bruker?.id, range.fra, range.til]);

  const oppsummering = useMemo(() => {
    const totalt = data.rader.reduce((s, r) => s + r.totaltimer, 0);
    return { totalt, antallSedler: data.rader.length };
  }, [data.rader]);

  const perAktivitet = useMemo(() => {
    const m = new Map<string, { navn: string; timer: number }>();
    for (const r of data.rader) {
      const navn = data.aktivitetNavnMap.get(r.aktivitetId) ?? "—";
      const id = r.aktivitetId || "_ukjent";
      const eks = m.get(id);
      if (eks) eks.timer += r.totaltimer;
      else m.set(id, { navn, timer: r.totaltimer });
    }
    return Array.from(m.values()).sort((a, b) => b.timer - a.timer);
  }, [data.rader, data.aktivitetNavnMap]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("timer.mine.tittel")}
        </Text>
      </View>

      {/* Periode-toggle */}
      <View className="flex-row gap-2 border-b border-gray-200 bg-white px-4 py-2">
        {(["denne_uken", "forrige_uken", "denne_maaneden"] as Periode[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriode(p)}
            className={`flex-1 rounded px-3 py-2 ${
              periode === p ? "bg-blue-600" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-center text-xs font-medium ${
                periode === p ? "text-white" : "text-gray-700"
              }`}
            >
              {t(`timer.mine.periode.${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={syncerNa} onRefresh={onRefresh} />}
        contentContainerClassName="pb-12"
      >
        {/* Oppsummerings-pills */}
        <View className="flex-row gap-2 px-4 py-3">
          <View className="flex-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-blue-700">
              {t("timer.mine.totaltTimer")}
            </Text>
            <Text className="mt-1 text-2xl font-semibold text-blue-900">
              {oppsummering.totalt.toFixed(2)}t
            </Text>
          </View>
          <View className="flex-1 rounded-lg border border-purple-200 bg-purple-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-purple-700">
              {t("timer.mine.antallSedler")}
            </Text>
            <Text className="mt-1 text-2xl font-semibold text-purple-900">
              {oppsummering.antallSedler}
            </Text>
          </View>
        </View>

        {/* Per aktivitet */}
        {perAktivitet.length > 0 && (
          <View className="mt-2">
            <View className="border-b border-gray-200 bg-gray-50 px-4 py-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t("timer.mine.perAktivitet")}
              </Text>
            </View>
            {perAktivitet.map((a) => (
              <View
                key={a.navn}
                className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-2.5"
              >
                <Text className="flex-1 text-sm text-gray-900">{a.navn}</Text>
                <Text className="font-mono text-sm text-gray-700">
                  {a.timer.toFixed(2)}t
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Detaljliste */}
        <View className="mt-4">
          <View className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              {t("timer.mine.alleSedler")}
            </Text>
          </View>
          {data.rader.length === 0 ? (
            <View className="bg-white px-4 py-8">
              <Text className="text-center text-sm text-gray-400">
                {t("timer.mine.ingenSedler")}
              </Text>
            </View>
          ) : (
            data.rader.map((rad) => (
              <Pressable
                key={rad.id}
                onPress={() => router.push(`/timer/${rad.id}`)}
                className="border-b border-gray-100 bg-white px-4 py-3 active:bg-gray-50"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-medium text-gray-900">
                    {formatDato(rad.dato)}
                  </Text>
                  <Text className="font-mono text-sm text-gray-900">
                    {rad.totaltimer.toFixed(2)}t
                  </Text>
                </View>
                <View className="mt-0.5 flex-row items-center gap-2">
                  <Text className="text-xs text-gray-500">
                    {data.aktivitetNavnMap.get(rad.aktivitetId) ?? "—"}
                  </Text>
                  <Text className="text-xs text-gray-400">·</Text>
                  <Text className="text-xs text-gray-500">
                    {t(`timer.statusType.${rad.status}`)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
