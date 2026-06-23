import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useProsjekt } from "./ProsjektKontekst";

const BYGGEPLASS_MAP_KEY = "sitedoc_bygning_per_prosjekt";
// F1: per-byggeplass siste-tegning-minne. Erstatter de per-prosjekt-nøklede
// `sitedoc_sist_tegning_{prosjektId}` i OpprettDokumentModal — flyttes hit så
// ByggeplassKontekst er eneste kilde (mockup: «Husker siste tegning per byggeplass»).
const SIST_TEGNING_MAP_KEY = "sitedoc_sist_tegning_per_byggeplass";

async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

interface ByggeplassKontekstType {
  valgtBygningId: string | null;
  settBygning: (id: string) => void;
  lasterBygningId: boolean;
  /** F1: siste brukte tegning for en gitt byggeplass (null hvis ingen). */
  hentSistTegning: (byggeplassId: string) => string | null;
  /** F1: husk siste brukte tegning per byggeplass (persistert). */
  settSistTegning: (byggeplassId: string, tegningId: string) => void;
}

const ByggeplassContext = createContext<ByggeplassKontekstType>({
  valgtBygningId: null,
  settBygning: () => {},
  lasterBygningId: true,
  hentSistTegning: () => null,
  settSistTegning: () => {},
});

export function useByggeplass() {
  return useContext(ByggeplassContext);
}

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { valgtProsjektId } = useProsjekt();
  const [bygningMap, setBygningMap] = useState<Record<string, string>>({});
  const [sistTegningMap, setSistTegningMap] = useState<Record<string, string>>({});
  const [lasterBygningId, setLasterBygningId] = useState(true);

  // Last lagret bygnings-map + siste-tegning-map ved oppstart
  useEffect(() => {
    async function lastLagret() {
      try {
        const [lagretBygning, lagretTegning] = await Promise.all([
          hentVerdi(BYGGEPLASS_MAP_KEY),
          hentVerdi(SIST_TEGNING_MAP_KEY),
        ]);
        if (lagretBygning) setBygningMap(JSON.parse(lagretBygning));
        if (lagretTegning) setSistTegningMap(JSON.parse(lagretTegning));
      } catch {
        // Ignorer feil
      } finally {
        setLasterBygningId(false);
      }
    }
    lastLagret();
  }, []);

  const valgtBygningId = useMemo(
    () => (valgtProsjektId ? bygningMap[valgtProsjektId] ?? null : null),
    [valgtProsjektId, bygningMap],
  );

  const settBygning = useCallback(
    (id: string) => {
      if (!valgtProsjektId) return;
      setBygningMap((prev) => {
        const neste = { ...prev, [valgtProsjektId]: id };
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    },
    [valgtProsjektId],
  );

  const hentSistTegning = useCallback(
    (byggeplassId: string) => sistTegningMap[byggeplassId] ?? null,
    [sistTegningMap],
  );

  const settSistTegning = useCallback(
    (byggeplassId: string, tegningId: string) => {
      setSistTegningMap((prev) => {
        const neste = { ...prev, [byggeplassId]: tegningId };
        lagreVerdi(SIST_TEGNING_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    },
    [],
  );

  return (
    <ByggeplassContext.Provider
      value={{
        valgtBygningId,
        settBygning,
        lasterBygningId,
        hentSistTegning,
        settSistTegning,
      }}
    >
      {children}
    </ByggeplassContext.Provider>
  );
}
