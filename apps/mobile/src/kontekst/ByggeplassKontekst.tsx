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
}

const ByggeplassContext = createContext<ByggeplassKontekstType>({
  valgtBygningId: null,
  settBygning: () => {},
  lasterBygningId: true,
});

export function useByggeplass() {
  return useContext(ByggeplassContext);
}

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { valgtProsjektId } = useProsjekt();
  const [bygningMap, setBygningMap] = useState<Record<string, string>>({});
  const [lasterBygningId, setLasterBygningId] = useState(true);

  // Last lagret bygnings-map ved oppstart
  useEffect(() => {
    async function lastLagretBygninger() {
      try {
        const lagret = await hentVerdi(BYGGEPLASS_MAP_KEY);
        if (lagret) {
          setBygningMap(JSON.parse(lagret));
        }
      } catch {
        // Ignorer feil
      } finally {
        setLasterBygningId(false);
      }
    }
    lastLagretBygninger();
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

  return (
    <ByggeplassContext.Provider value={{ valgtBygningId, settBygning, lasterBygningId }}>
      {children}
    </ByggeplassContext.Provider>
  );
}
