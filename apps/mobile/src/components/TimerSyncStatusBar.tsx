import { Text, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react-native";
import { useTimerSync } from "../providers/TimerSyncProvider";
import { useNettverk } from "../providers/NettverkProvider";
import { useRouter } from "expo-router";
import { and, eq } from "drizzle-orm";
import { useAuth } from "../providers/AuthProvider";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal } from "../db/schema";
import {
  haandterStatusbarTrykk,
  velgEldsteKonflikt,
} from "../utils/dagsseddelListeVisning";

/** Lokale konflikt-sedler for brukeren; banneret åpner den eldste. */
function finnEldsteKonfliktSedelId(userId: string | undefined): string | null {
  const db = hentDatabase();
  if (!db || !userId) return null;
  const sedler = db
    .select({
      id: dagsseddelLocal.id,
      dato: dagsseddelLocal.dato,
      syncStatus: dagsseddelLocal.syncStatus,
    })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "conflict"),
      ),
    )
    .all();
  return velgEldsteKonflikt(sedler);
}

function formatTid(ms: number): string {
  return new Date(ms).toLocaleTimeString("no-NB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tynn statusbar over timer-listen.
 *  - Online + synced: grønt sjekkmerke + «Synkronisert kl XX:XX»
 *  - Online + pending: gul varsel + antall + spinner
 *  - Online + avvist: rødt + antall avvist (permanent — må rettes/slettes)
 *  - Online + conflict: rødt + antall konflikter
 *  - Offline: grå sky + «Offline — synker når nett er tilbake»
 *  - Pågående sync: spinner
 *
 * Trykker bruker — manuell trigger (samme som pull-to-refresh). Viser banneret
 * konflikter, åpnes i tillegg den eldste konflikt-sedelen (ordre 2026-11-13 pkt. 3).
 */
export function TimerSyncStatusBar() {
  const { t } = useTranslation();
  const { erPaaNettet } = useNettverk();
  const router = useRouter();
  const { bruker } = useAuth();
  const {
    pendingAntall,
    conflictAntall,
    avvistAntall,
    sistSynkronisert,
    syncerNa,
    triggerSync,
  } = useTimerSync();

  let bg = "bg-green-50";
  let tekstFarge = "text-green-800";
  let ikon = <CheckCircle size={14} color="#15803d" />;
  let melding = t("timer.sync.aldriSynkronisert");
  let visningErKonflikt = false;

  if (!erPaaNettet) {
    bg = "bg-gray-100";
    tekstFarge = "text-gray-700";
    ikon = <CloudOff size={14} color="#4b5563" />;
    melding = t("timer.sync.offline");
  } else if (syncerNa) {
    bg = "bg-blue-50";
    tekstFarge = "text-blue-800";
    ikon = <ActivityIndicator size="small" color="#1e40af" />;
    melding = t("timer.sync.synkroniserer");
  } else if (avvistAntall > 0) {
    // SYNC-1: permanent avvist — rødt, ikke gul spinner. Krever at arbeideren
    // retter eller sletter sedelen (terminal).
    bg = "bg-red-50";
    tekstFarge = "text-red-800";
    ikon = <AlertTriangle size={14} color="#b91c1c" />;
    melding = t("timer.sync.avvistAntall", { antall: avvistAntall });
  } else if (conflictAntall > 0) {
    bg = "bg-red-50";
    tekstFarge = "text-red-800";
    ikon = <AlertTriangle size={14} color="#b91c1c" />;
    melding = t("timer.sync.konflikter", { count: conflictAntall });
    visningErKonflikt = true;
  } else if (pendingAntall > 0) {
    bg = "bg-yellow-50";
    tekstFarge = "text-yellow-800";
    ikon = <RefreshCw size={14} color="#a16207" />;
    melding = t("timer.sync.venterAntall", { antall: pendingAntall });
  } else if (sistSynkronisert) {
    melding = t("timer.sync.synkronisertKl", { tid: formatTid(sistSynkronisert) });
  }

  return (
    <Pressable
      onPress={() =>
        haandterStatusbarTrykk({
          visningErKonflikt,
          finnKonfliktSedelId: () => finnEldsteKonfliktSedelId(bruker?.id),
          aapneSedel: (id) => router.push(`/timer/${id}`),
          startSync: () => void triggerSync(),
        })
      }
      disabled={!erPaaNettet || syncerNa}
      className={`flex-row items-center gap-2 px-4 py-2 ${bg}`}
    >
      {ikon}
      <Text className={`flex-1 text-sm ${tekstFarge}`}>{melding}</Text>
      {erPaaNettet && !syncerNa && (
        <RefreshCw size={14} color="#6b7280" />
      )}
    </Pressable>
  );
}
