import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";
import { useNettverk } from "./NettverkProvider";
import { skalSjekke, utledOtaStatus, type OtaStatus } from "../services/otaStatus";

interface OtaKontekst {
  status: OtaStatus;
  /** «Se etter oppdatering» — går forbi 5-min-strupingen. */
  seEtter: () => void;
  /** Tar i bruk nedlastet versjon. Kalles KUN ved brukertrykk. */
  oppdater: () => void;
}

const OtaContext = createContext<OtaKontekst>({ status: "av", seEtter: () => {}, oppdater: () => {} });

export function useOta() {
  return useContext(OtaContext);
}

// Skjult dev-flagg: viser linja og «klar»-status uten ekte OTA (layoutsjekk av bunnmarg).
const DEMO_KLAR = __DEV__ && process.env.EXPO_PUBLIC_OTA_DEMO === "1";

function loggStille(hva: string, feil: unknown) {
  // Feil svelges stille for brukeren (ingen feilmeldinger), men synlig i dev.
  if (__DEV__) console.warn(`[ota] ${hva}`, feil);
}

/**
 * OTA-varsel (ota-varsel 2026-11-03). Ser etter ny versjon ved oppstart og når
 * appen kommer i forgrunnen (struping 5 min, kun på nett), og laster den ned i
 * bakgrunnen. Den nye versjonen tas ALDRI i bruk uten at brukeren trykker
 * (`oppdater`) — pågående utfylling går ikke tapt. `Updates.isEnabled === false`
 * (dev / Expo Go) → status «av», ingen kall mot expo-updates.
 * `checkAutomatically: "ON_LOAD"` beholdes; nedlastingen den starter gir samme
 * `isUpdatePending`, så linja vises også da.
 */
export function OtaProvider({ children }: { children: ReactNode }) {
  const { erPaaNettet } = useNettverk();
  const { isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const sistSjekketRef = useRef<number | null>(null);
  const påNettRef = useRef(erPaaNettet);
  påNettRef.current = erPaaNettet;

  const sjekk = useCallback(async (tvunget: boolean) => {
    if (!Updates.isEnabled || !påNettRef.current) return;
    const nå = Date.now();
    if (!skalSjekke(sistSjekketRef.current, nå, tvunget)) return;
    sistSjekketRef.current = nå;
    try {
      const resultat = await Updates.checkForUpdateAsync();
      if (resultat.isAvailable) await Updates.fetchUpdateAsync();
    } catch (feil) {
      loggStille("sjekk/nedlasting feilet", feil);
    }
  }, []);

  useEffect(() => {
    void sjekk(false);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void sjekk(false);
    });
    return () => sub.remove();
  }, [sjekk]);

  // Kommer nettet tilbake, prøv igjen (strupingen hindrer mas).
  useEffect(() => {
    if (erPaaNettet) void sjekk(false);
  }, [erPaaNettet, sjekk]);

  const oppdater = useCallback(() => {
    if (!Updates.isEnabled) return;
    Updates.reloadAsync().catch((feil) => loggStille("reload feilet", feil));
  }, []);

  const status: OtaStatus = DEMO_KLAR
    ? "klar"
    : utledOtaStatus({
        aktivert: Updates.isEnabled,
        påNett: erPaaNettet,
        sjekker: isChecking,
        lasterNed: isDownloading,
        klar: isUpdatePending,
      });

  const verdi = useMemo(
    () => ({ status, seEtter: () => void sjekk(true), oppdater }),
    [status, sjekk, oppdater],
  );
  return <OtaContext.Provider value={verdi}>{children}</OtaContext.Provider>;
}
