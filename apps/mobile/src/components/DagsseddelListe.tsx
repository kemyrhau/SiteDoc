import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  ChevronRight,
  Info,
  AlertTriangle,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
} from "../db/schema";
import { useAuth } from "../providers/AuthProvider";
import { useTimerSync } from "../providers/TimerSyncProvider";
import { TimerSyncStatusBar } from "./TimerSyncStatusBar";
import { TimerStatusMerkelapp } from "./TimerStatusMerkelapp";
import { UkeTotalBanner } from "./UkeTotalBanner";
import { StartSluttDagKort } from "./StartSluttDagKort";

interface DagsseddelRad {
  id: string;
  dato: string;
  status: string;
  syncStatus: string;
  beskrivelse: string | null;
  totaltimer: number;
  antallRader: number;
  // Bærer sedelen faktisk data? (timer- ELLER tillegg- ELLER maskin-rader).
  // Brukes av visnings-dedupe: en tom plassholder (0 av alt) kan skjules trygt,
  // en sedel med innhold aldri.
  harInnhold: boolean;
  // Settes kun ved ekte divergens (≥2 søsken med innhold for samme dato) —
  // da vises begge kort MED denne markeringen i stedet for å skjule data stille.
  divergens?: boolean;
}

/**
 * Visnings-dedupe (2026-07-11): kollaps lokale sedel-hoder med samme dato til
 * ett i lista. Rent display — ingen DB-skriving, ingen pull-endring. Duplikat
 * kan oppstå som pre-F4-1-relikvi på enheter oppdatert fra gammel pull (som
 * matchet kun på server-id og innsatte et ekstra tomt server-hode ved siden av
 * en pending offline-sedel). Merge-autoriteten blir i M1 (push/`forsonSedel-
 * Identitet`) — her skjuler vi kun den tomme plassholderen visuelt.
 *
 * Ufravikelig: kun tomme plassholdere skjules. Har begge søsken innhold (ekte
 * divergens, sjelden) vises begge med `divergens`-markering — aldri stille tap.
 */
function dedupPerDato(rader: DagsseddelRad[]): DagsseddelRad[] {
  const grupper = new Map<string, DagsseddelRad[]>();
  for (const r of rader) {
    const liste = grupper.get(r.dato);
    if (liste) liste.push(r);
    else grupper.set(r.dato, [r]);
  }

  const resultat: DagsseddelRad[] = [];
  // Map bevarer innsettingsrekkefølge; input er dato desc → gruppe-rekkefølge
  // forblir dato desc.
  for (const gruppe of grupper.values()) {
    if (gruppe.length === 1) {
      resultat.push(gruppe[0]);
      continue;
    }
    const medInnhold = gruppe.filter((r) => r.harInnhold);
    if (medInnhold.length >= 2) {
      // Ekte divergens: ALDRI skjul data stille. Vis alle innholds-søsken med
      // markering; tomme plassholdere i samme gruppe skjules fortsatt.
      for (const r of medInnhold) resultat.push({ ...r, divergens: true });
      continue;
    }
    // 0–1 søsken med innhold → trygt å kollapse til ett hode. Foretrekk søsknet
    // med innhold; ellers et ikke-avvist hode; ellers første.
    const beholdt =
      medInnhold[0] ??
      gruppe.find((r) => r.syncStatus !== "avvist") ??
      gruppe[0];
    resultat.push(beholdt);
  }
  return resultat;
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

  const rader = sedler.map((s) => {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    // Innhold = timer- ELLER tillegg- ELLER maskin-rader. Tillegg/maskin telles
    // for at en sedel som kun bærer tillegg/maskin ikke feilklassifiseres som tom.
    const antallTillegg = db
      .select({ id: sheetTilleggLocal.id })
      .from(sheetTilleggLocal)
      .where(eq(sheetTilleggLocal.dagsseddelId, s.id))
      .all().length;
    const antallMaskin = db
      .select({ id: sheetMachineLocal.id })
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, s.id))
      .all().length;
    return {
      id: s.id,
      dato: s.dato,
      status: s.status,
      syncStatus: s.syncStatus,
      beskrivelse: s.beskrivelse,
      totaltimer: timer.reduce((acc, t) => acc + t.timer, 0),
      antallRader: timer.length,
      harInnhold: timer.length > 0 || antallTillegg > 0 || antallMaskin > 0,
    };
  });

  return dedupPerDato(rader);
}

function formatDato(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("no-NB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function iDagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dagsseddel-lista. Ekstrahert fra `app/timer/index.tsx` (ren flytting) slik at
 * både timer-stackens index og den nye Timer-tab-en (2a) rendrer samme visning.
 *
 * `medTilbakeknapp` = true gir header med ArrowLeft (timer-stack-inngang, byte-
 * tilsvarende dagens `/timer`); false gir ren tittel (tab-inngang).
 */
export function DagsseddelListe({
  medTilbakeknapp = false,
}: {
  medTilbakeknapp?: boolean;
}) {
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

  // UF-3: kladd-påminnelse — usendte drafts MED innhold fra TIDLIGERE dager.
  // Distinkt fra glemt-dag-prompt (StartSluttDagKort = uavsluttet økt): dette
  // er «økten er avsluttet, men kladden er ikke sendt». Dagens egen draft (under
  // arbeid) maser ikke — kun dato < i dag.
  const usendteKladder = useMemo(() => {
    const iDag = iDagIso();
    return rader.filter(
      (r) => r.status === "draft" && r.antallRader > 0 && r.dato < iDag,
    );
  }, [rader]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
        {medTilbakeknapp && (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
        )}
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("timer.tittel")}
        </Text>
      </View>

      <TimerSyncStatusBar />

      {/* P3-hybrid: det fulle «Start dag/Slutt dag»-kortet bor nå øverst på
          timer-flaten (Timer-tab + /timer-stack), ikke lenger på hjem. Hjem
          viser i stedet den kompakte HjemTimerChip. */}
      <StartSluttDagKort />

      {bruker?.id && <UkeTotalBanner userId={bruker.id} />}

      {/* UF-3: mild kladd-påminnelse — trykk åpner eldste usendte kladd. */}
      {usendteKladder.length > 0 && (
        <Pressable
          onPress={() =>
            router.push(
              `/timer/${usendteKladder[usendteKladder.length - 1].id}`,
            )
          }
          className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 active:bg-amber-100"
        >
          <Info size={16} color="#b45309" />
          <Text className="flex-1 text-sm text-amber-800">
            {t("timer.kladdPaaminnelse", { antall: usendteKladder.length })}
          </Text>
          <ChevronRight size={16} color="#b45309" />
        </Pressable>
      )}

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
              {item.divergens && (
                // Ekte divergens: to sedler med innhold for samme dato. Vis
                // begge + markering i stedet for å skjule data.
                <AlertTriangle size={16} color="#b45309" />
              )}
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
              <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
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
