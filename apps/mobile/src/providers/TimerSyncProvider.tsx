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
import { refreshKatalog } from "../services/timerKatalog";
import { refreshMaskinKatalog } from "../services/maskinKatalog";
import {
  refreshProsjektKatalog,
  hentUnikeFirmaIderLokalt,
} from "../services/prosjektKatalog";
import { refreshKalenderKatalog } from "../services/kalenderKatalog";
import { refreshOrganizationSettingKatalog } from "../services/organizationSettingKatalog";
import { refreshOppmotestedKatalog } from "../services/oppmotestedKatalog";
import { refreshByggeplassKatalog } from "../services/byggeplassKatalog";
import { refreshReisetidMatriseKatalog } from "../services/reisetidMatriseKatalog";

interface TimerSyncKontekst {
  pendingAntall: number;
  conflictAntall: number;
  sistSynkronisert: number | null; // Unix ms, null hvis aldri
  syncerNa: boolean;
  sisteFeil: string | null;
  katalogLastet: boolean;
  /** Manuell trigger — pull-to-refresh, etter lokal endring, etc. */
  triggerSync: () => Promise<void>;
  /** Last ned katalog (lønnsarter/aktiviteter/tillegg) fra server. */
  triggerKatalogRefresh: () => Promise<void>;
  /** Refresh tellere fra DB uten å kjøre sync (etter lokal opprett/slett). */
  oppdaterTellere: () => void;
}

const TimerSyncContext = createContext<TimerSyncKontekst>({
  pendingAntall: 0,
  conflictAntall: 0,
  sistSynkronisert: null,
  syncerNa: false,
  sisteFeil: null,
  katalogLastet: false,
  triggerSync: async () => {},
  triggerKatalogRefresh: async () => {},
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
  const [katalogLastet, setKatalogLastet] = useState(false);

  const syncerRef = useRef(false);
  const katalogRefreshRef = useRef(false);
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

  const triggerKatalogRefresh = useCallback(async () => {
    if (!bruker?.id || !erPaaNettet) return;
    if (katalogRefreshRef.current) return;
    katalogRefreshRef.current = true;
    try {
      // Steg 1 — parallelle base-pulls. Prosjekt-katalog må kjøres i dette
      // steget fordi de firma-spesifikke pullene (kalender + setting) leser
      // unike org-IDer fra prosjekt_local-cachen.
      await Promise.all([
        refreshKatalog(utils.client),
        refreshMaskinKatalog(utils.client),
        refreshProsjektKatalog(utils.client),
      ]);

      // Steg 2 — firma-spesifikke pulls (T4-d). Utled brukerens unike org-
      // IDer fra prosjekt-cachen og hent kalender + setting for hver.
      // Brukere er typisk medlem av ett firma, men løsningen støtter flere.
      const orgIds = hentUnikeFirmaIderLokalt();
      if (orgIds.length > 0) {
        await Promise.all(
          orgIds.flatMap((orgId) => [
            refreshKalenderKatalog(utils.client, orgId),
            refreshOrganizationSettingKatalog(utils.client, orgId),
            refreshOppmotestedKatalog(utils.client, orgId),
            refreshByggeplassKatalog(utils.client, orgId),
            refreshReisetidMatriseKatalog(utils.client, orgId),
          ]),
        );
      }

      setKatalogLastet(true);
    } catch (e) {
      // Katalog-feil er ikke kritisk — UI faller tilbake til eksisterende cache
      console.warn("[TIMER-SYNC] Katalog-refresh feilet:", e);
    } finally {
      katalogRefreshRef.current = false;
    }
  }, [bruker?.id, erPaaNettet, utils.client]);

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
      void triggerKatalogRefresh();
      void triggerSync();
    }
  }, [bruker?.id, erPaaNettet, oppdaterTellere, triggerSync, triggerKatalogRefresh]);

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
        katalogLastet,
        triggerSync,
        triggerKatalogRefresh,
        oppdaterTellere,
      }}
    >
      {children}
    </TimerSyncContext.Provider>
  );
}
