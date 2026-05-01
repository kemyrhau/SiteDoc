import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import { trpc } from "../lib/trpc";
import { useAuth } from "./AuthProvider";
import { useNettverk } from "./NettverkProvider";
import {
  syncTimer,
  tellPending,
  tellConflict,
} from "../services/timerSync";

interface TimerSyncKontekst {
  pendingAntall: number;
  conflictAntall: number;
  sistSynkronisert: number | null; // Unix ms, null hvis aldri
  syncerNa: boolean;
  sisteFeil: string | null;
  /** Manuell trigger — pull-to-refresh, etter lokal endring, etc. */
  triggerSync: () => Promise<void>;
  /** Refresh tellere fra DB uten å kjøre sync (etter lokal opprett/slett). */
  oppdaterTellere: () => void;
}

const TimerSyncContext = createContext<TimerSyncKontekst>({
  pendingAntall: 0,
  conflictAntall: 0,
  sistSynkronisert: null,
  syncerNa: false,
  sisteFeil: null,
  triggerSync: async () => {},
  oppdaterTellere: () => {},
});

export function useTimerSync() {
  return useContext(TimerSyncContext);
}

const SYNC_INTERVAL_MS = 30 * 1000; // 30s aktiv-app-interval per timer.md

export function TimerSyncProvider({ children }: { children: ReactNode }) {
  const { bruker } = useAuth();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();

  const [pendingAntall, setPendingAntall] = useState(0);
  const [conflictAntall, setConflictAntall] = useState(0);
  const [sistSynkronisert, setSistSynkronisert] = useState<number | null>(null);
  const [syncerNa, setSyncerNa] = useState(false);
  const [sisteFeil, setSisteFeil] = useState<string | null>(null);

  const syncerRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const oppdaterTellere = useCallback(() => {
    if (!bruker?.id) {
      setPendingAntall(0);
      setConflictAntall(0);
      return;
    }
    setPendingAntall(tellPending(bruker.id));
    setConflictAntall(tellConflict(bruker.id));
  }, [bruker?.id]);

  const triggerSync = useCallback(async () => {
    if (!bruker?.id) return;
    if (!erPaaNettet) return;
    if (syncerRef.current) return; // unngå overlappende kall
    syncerRef.current = true;
    setSyncerNa(true);
    try {
      const resultat = await syncTimer(utils.client, bruker.id);
      setSistSynkronisert(Date.now());
      setSisteFeil(resultat.feil ?? null);
      // Refresh tellere fra DB etter sync
      setPendingAntall(tellPending(bruker.id));
      setConflictAntall(tellConflict(bruker.id));
    } catch (e) {
      setSisteFeil(e instanceof Error ? e.message : "Sync feilet");
    } finally {
      syncerRef.current = false;
      setSyncerNa(false);
    }
  }, [bruker?.id, erPaaNettet, utils.client]);

  // Initial-sync ved innlogging + endret nettverk
  useEffect(() => {
    oppdaterTellere();
    if (bruker?.id && erPaaNettet) {
      void triggerSync();
    }
  }, [bruker?.id, erPaaNettet, oppdaterTellere, triggerSync]);

  // Periodisk sync hver 30s mens app er aktiv + online + innlogget
  useEffect(() => {
    if (!bruker?.id || !erPaaNettet) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (AppState.currentState === "active") {
        void triggerSync();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [bruker?.id, erPaaNettet, triggerSync]);

  return (
    <TimerSyncContext.Provider
      value={{
        pendingAntall,
        conflictAntall,
        sistSynkronisert,
        syncerNa,
        sisteFeil,
        triggerSync,
        oppdaterTellere,
      }}
    >
      {children}
    </TimerSyncContext.Provider>
  );
}
