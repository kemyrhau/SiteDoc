import { useMemo } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTimerSync } from "../providers/TimerSyncProvider";
import { useFirma } from "../kontekst/FirmaKontekst";
import { tellAvvist, tellConflict } from "../services/timerSync";

/**
 * POST 2026-11-15 (14) punkt 1: konflikt-/avvist-tall for VALGT firma.
 *
 * TimerSyncProvider ligger utenfor FirmaProvider og teller firma-bredt; de
 * tallene brukes her bare som endringssignal (re-tell etter synk), mens
 * visningen (statusbar, Mer-merket) teller på nytt med `valgtFirmaId`.
 */
export function useFirmaSyncTellere(): { conflictAntall: number; avvistAntall: number } {
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();
  const { conflictAntall: signalKonflikt, avvistAntall: signalAvvist } = useTimerSync();
  const userId = bruker?.id;
  return useMemo(() => {
    if (!userId) return { conflictAntall: 0, avvistAntall: 0 };
    return {
      conflictAntall: tellConflict(userId, valgtFirmaId ?? null),
      avvistAntall: tellAvvist(userId, valgtFirmaId ?? null),
    };
    // signal* er bevisst med: provideren endrer dem etter hver synk.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signal for ny lesing
  }, [userId, valgtFirmaId, signalKonflikt, signalAvvist]);
}
