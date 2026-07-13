import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Play, Clock, ChevronRight, FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal, sheetTimerLocal } from "../db/schema";
import { useAuth } from "../providers/AuthProvider";
import {
  useArbeidsdag,
  formatIsoDato,
  tilHHMM,
} from "../hooks/useArbeidsdag";

/**
 * HjemTimerChip (P3-hybrid): kompakt timer-inngang på hjem-skjermen. Erstatter
 * det fulle StartSluttDagKort som nå bor på timer-flaten. Tre datadrevne
 * tilstander på `arbeidsdagLocal` (aktiv økt, via useArbeidsdag) + dagens
 * `dagsseddelLocal` (draft/returned) for brukeren:
 *
 *  1. Ingen aktiv økt OG ingen dagskort i dag → «Start dag» (amber-aksent).
 *  2. Aktiv økt → «Pågår … · … t/m» (grønn, minutt-tikk), trykk → timer-flaten.
 *  3. Dagskort finnes (draft/returned m/ innhold), ingen aktiv økt → variant B,
 *     delt chip: venstre passiv «Dagskort påbegynt …» → åpner sedelen; høyre
 *     amber «Start GPS» → starter GPS-økt på pågående dag (samme startDag; på
 *     «Slutt dag» senere appender genererForslag til samme draft via UF-0/UF-1).
 *
 * Tilstand 2 vinner over 3 (aktiv økt vises alltid som «Pågår»).
 */

type DagskortInfo = {
  sedelId: string;
  antallRader: number;
  totalTimer: number;
};

/**
 * Dagens dagskort for brukeren (draft/returned) med innhold. Speiler
 * DagsseddelListe/UkeTotalBanner sin lokale Drizzle-spørring. Aggregerer
 * timer-rader på tvers av dagens sedler; velger sedelen med innhold for
 * navigering. En tom auto-plassholder (0 rader) regnes ikke som «påbegynt».
 */
function lesDagensDagskort(userId: string): DagskortInfo | null {
  const db = hentDatabase();
  if (!db) return null;
  const iDag = formatIsoDato(new Date());

  const sedler = db
    .select()
    .from(dagsseddelLocal)
    .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.dato, iDag)))
    .all()
    .filter((s) => s.status === "draft" || s.status === "returned");
  if (sedler.length === 0) return null;

  let antallRader = 0;
  let totalTimer = 0;
  let valgtId: string | null = null;
  for (const s of sedler) {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    antallRader += timer.length;
    totalTimer += timer.reduce((acc, t) => acc + t.timer, 0);
    // Foretrekk en sedel som faktisk bærer rader for navigering.
    if (timer.length > 0 && valgtId === null) valgtId = s.id;
  }

  // Ingen rader → tom plassholder, ikke «påbegynt» → fall til «Start dag».
  if (antallRader === 0 || valgtId === null) return null;
  return { sedelId: valgtId, antallRader, totalTimer };
}

function forlopt(startAt: string, naa: number): string {
  const diffMin = Math.max(0, Math.floor((naa - new Date(startAt).getTime()) / 60_000));
  return `${String(Math.floor(diffMin / 60)).padStart(2, "0")}t ${String(diffMin % 60).padStart(2, "0")}m`;
}

export function HjemTimerChip() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bruker } = useAuth();
  const { aktivDag, startDag, behandler } = useArbeidsdag();

  const [naa, setNaa] = useState<number>(Date.now());
  const [dagskort, setDagskort] = useState<DagskortInfo | null>(null);

  // Re-les dagens dagskort ved fokus (reflekterer nye sedler/økter).
  useFocusEffect(
    useCallback(() => {
      setDagskort(bruker?.id ? lesDagensDagskort(bruker.id) : null);
    }, [bruker?.id]),
  );

  // Minutt-tikk kun mens en økt pågår.
  useEffect(() => {
    if (!aktivDag) return;
    setNaa(Date.now());
    const id = setInterval(() => setNaa(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [aktivDag]);

  if (!bruker?.id) return null;

  // Tilstand 2 — aktiv økt (vinner over dagskort). Trykk → timer-flaten.
  if (aktivDag) {
    return (
      <Pressable
        onPress={() => router.push("/timer")}
        className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 active:bg-green-100"
      >
        <Clock size={16} color="#10b981" />
        <Text className="flex-1 text-sm font-medium text-green-800">
          {t("timer.hjemChip.paagaar", {
            start: tilHHMM(aktivDag.startAt),
            forlopt: forlopt(aktivDag.startAt, naa),
          })}
        </Text>
        <ChevronRight size={16} color="#10b981" />
      </Pressable>
    );
  }

  // Tilstand 3 — dagskort påbegynt, ingen aktiv økt (variant B, delt chip).
  if (dagskort) {
    return (
      <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <Pressable
          onPress={() => router.push(`/timer/${dagskort.sedelId}`)}
          className="flex-1 flex-row items-center gap-2 active:opacity-70"
        >
          <FileText size={16} color="#6b7280" />
          <Text className="flex-1 text-sm text-gray-700" numberOfLines={1}>
            {t("timer.hjemChip.dagskortPaabegynt", {
              antall: dagskort.antallRader,
              timer: dagskort.totalTimer.toFixed(1),
            })}
          </Text>
        </Pressable>
        <Pressable
          onPress={startDag}
          disabled={behandler}
          accessibilityLabel={t("timer.hjemChip.startGpsHint")}
          className="flex-row items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1.5 active:bg-amber-200 disabled:opacity-50"
        >
          {behandler ? (
            <ActivityIndicator size="small" color="#b45309" />
          ) : (
            <Play size={13} color="#b45309" fill="#b45309" />
          )}
          <Text className="text-xs font-semibold text-amber-800">
            {t("timer.hjemChip.startGps")}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Tilstand 1 — ingen aktiv økt, ingen dagskort → «Start dag» (amber-aksent).
  return (
    <Pressable
      onPress={startDag}
      disabled={behandler}
      className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 py-3 active:bg-amber-100 disabled:opacity-50"
    >
      {behandler ? (
        <ActivityIndicator size="small" color="#b45309" />
      ) : (
        <Play size={16} color="#b45309" fill="#b45309" />
      )}
      <Text className="text-base font-semibold text-amber-900">
        {t("timer.hjemChip.startDag")}
      </Text>
    </Pressable>
  );
}
